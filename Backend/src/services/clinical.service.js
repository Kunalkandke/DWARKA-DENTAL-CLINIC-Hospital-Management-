const { clinicalRecordDb, appointmentDb, patientDb, clinicDb, userDb } = require('../db')
const ApiError = require('../utils/ApiError')
const auditService = require('./audit.service')

/**
 * Map a raw DB clinical record row to camelCase frontend shape.
 */
function toClinicalFrontendShape(r) {
  const doctor = r.doctor && typeof r.doctor === 'object' ? r.doctor : null
  return {
    id: r.id,
    patientId: r.patient_id,
    appointmentId: r.appointment_id || null,
    doctorId: r.doctor_id,
    doctorName: doctor ? doctor.name : null,
    visitDate: r.visit_date,
    chiefComplaint: r.chief_complaint || '',
    diagnosis: r.diagnosis || '',
    treatment: r.treatment || '',
    clinicalNotes: r.clinical_notes || '',
    followUpDate: r.follow_up_date || null,
    followUpInstructions: r.follow_up_instructions || '',
    dentalChart: Array.isArray(r.dental_chart) ? r.dental_chart : [],
    status: r.status || 'completed',
    isDeleted: r.is_deleted,
    createdAt: r.created_at,
    // prescription field was dropped — return [] for backward compatibility
    prescription: [],
  }
}

async function getClinicalRecordsByPatient(patientId) {
  const records = await clinicalRecordDb.findByPatient(patientId)
  return records.map(toClinicalFrontendShape)
}

/**
 * Add a new clinical record for a patient visit.
 * @param {object} body  { patientId, appointmentId?, doctorId, chiefComplaint, diagnosis, treatment, clinicalNotes, followUpDate?, followUpInstructions?, prescription? }
 */
async function addClinicalRecord(body, requestingUser = null, req = null) {
  const clinic = await clinicDb.getDefaultClinic()
  const {
    patientId, appointmentId, doctorId, chiefComplaint,
    diagnosis, treatment, clinicalNotes, followUpDate,
    followUpInstructions, prescription, dentalChart,
  } = body

  const patient = await patientDb.findById(patientId)
  if (!patient || patient.is_deleted) throw ApiError.notFound('Patient not found.')

  // doctor_id is NOT NULL + FK to users(id). Resolve a valid UUID before inserting.
  let resolvedDoctorId = doctorId && doctorId.trim() ? doctorId.trim() : null

  if (!resolvedDoctorId) {
    // 1. Patient's assigned doctor
    resolvedDoctorId = patient.assigned_doctor_id || null
  }
  if (!resolvedDoctorId) {
    // 2. Most recent appointment for this patient that has a doctor
    const aptRows = await appointmentDb.findByPatient(patientId)
    const aptWithDoctor = aptRows.find(a => a.doctor_id)
    resolvedDoctorId = aptWithDoctor?.doctor_id || null
  }
  if (!resolvedDoctorId) {
    // 3. First active doctor in the clinic
    const doctors = await userDb.findDoctors({ status: 'active' })
    const fallbackDoc = doctors.find(d => d.id) || null
    resolvedDoctorId = fallbackDoc?.id || null
  }
  if (!resolvedDoctorId) {
    throw ApiError.badRequest('No doctor available to attribute this clinical record. Assign a doctor to the patient or create a doctor account first.')
  }

  // doctorName is not stored in clinical_records table — omit from create payload
  const record = await clinicalRecordDb.create({
    clinic_id: clinic.id,
    patient_id: patient.id,
    appointment_id: appointmentId || null,
    doctor_id: resolvedDoctorId,
    visit_date: new Date().toISOString(),
    chief_complaint: chiefComplaint || patient.chief_complaint || '',
    diagnosis,
    treatment,
    clinical_notes: clinicalNotes || '',
    follow_up_date: followUpDate || null,
    follow_up_instructions: followUpInstructions || '',
    // dental_chart is passed as a JS array — Supabase serializes to JSONB automatically
    dental_chart: Array.isArray(dentalChart) ? dentalChart : [],
    status: 'completed',
  })

  // Audit log
  auditService.log({
    action: 'clinical.add',
    userId: requestingUser?.id,
    entityType: 'clinical_record',
    entityId: record.id,
    changes: { patient_id: patientId, diagnosis, treatment },
    ipAddress: req?.ip,
    userAgent: req?.get('user-agent'),
  })

  // Update patient summary fields
  const patientUpdateFields = {
    last_visit_at: new Date().toISOString(),
    total_visits: (patient.total_visits || 0) + 1,
  }
  if (followUpDate) {
    patientUpdateFields.next_follow_up_at = new Date(followUpDate).toISOString()
    patientUpdateFields.status = 'follow_up'
  } else {
    patientUpdateFields.status = 'completed'
  }
  if (chiefComplaint) patientUpdateFields.chief_complaint = chiefComplaint
  await patientDb.update(patient.id, patientUpdateFields)

  // Mark appointment as completed if provided
  if (appointmentId) {
    await appointmentDb.updateStatus(appointmentId, {
      status: 'completed',
      completed_at: new Date().toISOString(),
    })
  }

  return {
    ...toClinicalFrontendShape(record),
    // Return prescription array for backward compatibility
    prescription: prescription || [],
  }
}

module.exports = { getClinicalRecordsByPatient, addClinicalRecord }
