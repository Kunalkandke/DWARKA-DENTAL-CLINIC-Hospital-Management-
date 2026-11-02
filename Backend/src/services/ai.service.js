/**
 * AI X-Ray Analysis Service
 *
 * Sends the uploaded X-ray image to the ML FastAPI service (ML_SERVICE_URL).
 * NEVER creates fake or placeholder results.
 *
 * Architecture:
 *   React → Node/Express (this service) → FastAPI (Python/YOLO) → Supabase
 */
const { aiReportDb, fileDb, patientDb, clinicDb } = require('../db')
const ApiError = require('../utils/ApiError')
const path = require('path')
const fs = require('fs')
const axios = require('axios')
const FormData = require('form-data')

// ── Upload directory ─────────────────────────────────────────────────────────
/** Absolute path to the uploads folder — shared with multer in ai.routes.js */
const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads')
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true })
}

// ── Config ───────────────────────────────────────────────────────────────────
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000'
const ML_API_KEY = process.env.ML_API_KEY || ''

// Valid enum values that ai_report_result_enum accepts in Postgres.
const VALID_RESULTS = new Set(['cavity', 'findings_detected', 'normal', 'uncertain'])

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Silently delete a file path, logging on failure but never throwing.
 * Used for cleanup when an ML call fails after multer already saved the file.
 */
function _safeDelete(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath)
  } catch (e) {
    console.warn('[AI] Could not delete file:', filePath, e.message)
  }
}

/**
 * Decode a data-URL PNG from the ML service and write it to UPLOAD_DIR.
 * Returns the filename (e.g. "xray-annotated-1234567890123.png") or null
 * if the data-URL is absent or invalid.
 *
 * @param {string|null|undefined} dataUrl  "data:image/png;base64,<b64>"
 * @returns {string|null}  filename written, or null
 */
function _saveAnnotatedImage(dataUrl) {
  if (!dataUrl || !dataUrl.startsWith('data:image/')) return null

  try {
    const base64 = dataUrl.split(',')[1]
    if (!base64) return null

    const filename = `xray-annotated-${Date.now()}.png`
    const dest = path.join(UPLOAD_DIR, filename)
    fs.writeFileSync(dest, Buffer.from(base64, 'base64'))
    return filename
  } catch (e) {
    console.warn('[AI] Failed to save annotated image:', e.message)
    return null
  }
}

// ── ML service call ──────────────────────────────────────────────────────────

/**
 * POST the image to the FastAPI /predict endpoint and return its full JSON.
 *
 * Throws:
 *   ApiError 503  — ML service unreachable or returned 5xx
 *   ApiError 400  — ML service returned 400 (bad image / not an X-ray)
 *   ApiError 500  — unexpected / malformed response
 *
 * @param {string} imagePath  Absolute path to the image file on disk
 * @returns {Promise<object>}  Full ML service response object
 */
async function callMlService(imagePath) {
  const form = new FormData()
  form.append('file', fs.createReadStream(imagePath))

  const headers = { ...form.getHeaders() }
  if (ML_API_KEY) headers['x-api-key'] = ML_API_KEY

  let response
  try {
    response = await axios.post(`${ML_SERVICE_URL}/predict`, form, {
      headers,
      timeout: 60_000, // 60 s — first call loads the model
      maxContentLength: 50 * 1024 * 1024, // 50 MB response (annotated PNG is large)
      maxBodyLength: 50 * 1024 * 1024,
    })
  } catch (err) {
    // Network-level errors or 4xx/5xx from axios
    if (
      err.code === 'ECONNREFUSED' ||
      err.code === 'ENOTFOUND' ||
      err.code === 'ETIMEDOUT' ||
      err.code === 'ECONNRESET' ||
      err.message?.toLowerCase().includes('timeout')
    ) {
      throw ApiError.serviceUnavailable(
        'The AI analysis service is currently unreachable. Please ensure the ML service is running and try again.'
      )
    }

    if (err.response) {
      const status = err.response.status
      const detail =
        err.response.data?.detail ||
        err.response.data?.message ||
        err.response.data ||
        err.message

      if (status === 400) {
        // Bad image / not an X-ray — pass the ML service message straight back
        throw ApiError.badRequest(
          typeof detail === 'string' ? detail : 'The uploaded image was rejected by the AI service.'
        )
      }

      if (status >= 500) {
        throw ApiError.serviceUnavailable(
          `The AI analysis service returned an error (HTTP ${status}). Please try again later.`
        )
      }

      // 401, 403, etc. — config issue on the server side
      throw ApiError.internal(
        `Unexpected response from AI service (HTTP ${status}): ${JSON.stringify(detail)}`
      )
    }

    // Unknown error
    throw ApiError.serviceUnavailable(
      `AI service communication error: ${err.message}`
    )
  }

  const data = response.data
  if (!data || typeof data.result !== 'string') {
    throw ApiError.internal('AI service returned an invalid or empty response.')
  }

  return data
}

// ── Public service functions ─────────────────────────────────────────────────

/**
 * Upload an X-ray, call the ML service, persist file + report rows, and
 * return the frontend-ready report shape.
 *
 * If the ML call fails the uploaded file is deleted so storage stays clean.
 *
 * @param {object} file            Multer file object (req.file)
 * @param {string} patientId       Patient UUID
 * @param {object} requestingUser  { id, role } from JWT
 */
async function uploadAndAnalyzeXray(file, patientId, requestingUser) {
  const clinic = await clinicDb.getDefaultClinic()

  const patient = await patientDb.findById(patientId)
  if (!patient || patient.is_deleted) {
    _safeDelete(file.path)
    throw ApiError.notFound('Patient not found.')
  }

  // ── Call ML service ────────────────────────────────────────────────────────
  // If this throws, the uploaded file is cleaned up before the error propagates.
  let mlData
  try {
    mlData = await callMlService(file.path)
  } catch (err) {
    _safeDelete(file.path)
    throw err // rethrow the ApiError as-is
  }

  // ── Save annotated image from base64 data-URL ──────────────────────────────
  // We decode it here and store only the filename — never the base64 string.
  const annotatedFilename = _saveAnnotatedImage(mlData.annotatedImage)

  // ── Normalise result to a value the DB enum accepts ────────────────────────
  const resultNormalized = VALID_RESULTS.has(mlData.result) ? mlData.result : 'uncertain'

  // ── Persist file row ───────────────────────────────────────────────────────
  // Done only after a successful ML call — no orphan file rows on failure.
  const fileDoc = await fileDb.create({
    clinic_id: clinic.id,
    patient_id: patient.id,
    uploaded_by_id: requestingUser?.id ?? null,
    file_type: 'xray',
    storage_key: file.filename,
    original_name: file.originalname,
    mime_type: file.mimetype,
    size_bytes: file.size,
    uploaded_at: new Date().toISOString(),
  })

  // ── Persist AI report row ──────────────────────────────────────────────────
  const report = await aiReportDb.create({
    clinic_id: clinic.id,
    patient_id: patient.id,
    file_id: fileDoc.id,
    result: resultNormalized,
    confidence: parseFloat((mlData.confidence ?? 0).toFixed(4)),
    suggestions: Array.isArray(mlData.suggestions) ? mlData.suggestions : [],
    model_version: mlData.modelVersion || 'unknown',
    // New columns from migration 20260110000000_ai_xray_findings
    findings: Array.isArray(mlData.findings) ? mlData.findings : [],
    summary: mlData.summary || null,
    annotated_image_key: annotatedFilename || null,
    image_width: mlData.imageWidth || null,
    image_height: mlData.imageHeight || null,
  })

  return {
    id: report.id,
    patientId: patient.id,
    image: `/uploads/${file.filename}`,
    annotatedImage: annotatedFilename ? `/uploads/${annotatedFilename}` : null,
    result: resultNormalized,
    confidence: report.confidence,
    summary: mlData.summary || null,
    suggestions: Array.isArray(mlData.suggestions) ? mlData.suggestions : [],
    findings: Array.isArray(mlData.findings) ? mlData.findings : [],
    modelVersion: mlData.modelVersion || 'unknown',
    disclaimer: mlData.disclaimer || null,
    date: new Date().toISOString().split('T')[0],
    doctorReview: null,
    doctorNotes: null,
  }
}

/**
 * Fetch all AI reports for a patient, newest first.
 *
 * @param {string} patientId
 */
async function getAiReportsByPatient(patientId) {
  const reports = await aiReportDb.findByPatient(patientId)

  return reports.map((r) => ({
    id: r.id,
    patientId: r.patient_id,
    image: r.file?.storage_key ? `/uploads/${r.file.storage_key}` : null,
    annotatedImage: r.annotated_image_key ? `/uploads/${r.annotated_image_key}` : null,
    result: r.result,
    confidence: r.confidence ?? 0,
    summary: r.summary || null,
    suggestions: Array.isArray(r.suggestions) ? r.suggestions : [],
    findings: Array.isArray(r.findings) ? r.findings : [],
    modelVersion: r.model_version || 'unknown',
    disclaimer: null, // not stored — always regenerated by ML service
    date: r.created_at ? new Date(r.created_at).toISOString().split('T')[0] : null,
    doctorReview: r.doctor_review || null,
    doctorNotes: r.doctor_notes || null,
  }))
}

/**
 * Doctor confirms or rejects an AI finding.
 *
 * @param {string} reportId
 * @param {{ doctorReview: 'confirmed'|'rejected', doctorNotes?: string }} body
 * @param {object} requestingUser
 */
async function reviewAiReport(reportId, body, requestingUser) {
  const updated = await aiReportDb.update(reportId, {
    doctor_review: body.doctorReview,
    doctor_notes: body.doctorNotes || '',
    reviewed_at: new Date().toISOString(),
    reviewed_by_id: requestingUser?.id || null,
  })

  if (!updated) throw ApiError.notFound('AI report not found.')

  return {
    id: updated.id,
    doctorReview: updated.doctor_review,
    doctorNotes: updated.doctor_notes,
    reviewedAt: updated.reviewed_at,
  }
}

module.exports = { uploadAndAnalyzeXray, getAiReportsByPatient, reviewAiReport, UPLOAD_DIR }
