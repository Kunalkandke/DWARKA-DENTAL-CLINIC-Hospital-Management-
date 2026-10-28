const { clinicalRecordDb, appointmentDb, patientDb, clinicDb } = require('../db')
const ApiError = require('../utils/ApiError')

/**
 * Fetch clinical records for a patient, sorted newest-first.
 * @param {string} patientId  UUID string
 */
async function getClinicalRecordsByPatient(patientId) {
  const records = await clinicalRecordDb.findByPatient(patientId)

  return records.map((r) => ({
    ...r,
    id: r.id,
    // prescription field was dropped from clinical_records table — return [] for backward compatibility
    prescription: [],
  }))
}

/**
 * Add a new clinical record for a patient visit.
 * @param {object} body  { patientId, appointmentId?, doctorId, chiefComplaint, diagnosis, treatment, clinicalNotes, followUpDate?, followUpInstructions?, prescription? }
 */
async function addClinicalRecord(body) {
  const clinic = await clinicDb.getDefaultClinic()
  const {
    patientId, appointmentId, doctorId, chiefComplaint,
    diagnosis, treatment, clinicalNotes, followUpDate,
    followUpInstructions, prescription, dentalChart,
  } = body

  const patient = await patientDb.findById(patientId)
  if (!patient || patient.is_deleted) throw ApiError.notFound('Patient not found.')

  // doctorName is not stored in clinical_records table — omit from create payload
  const record = await clinicalRecordDb.create({
    clinic_id: clinic.id,
    patient_id: patient.id,
    appointment_id: appointmentId || null,
    doctor_id: doctorId,
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
    ...record,
    id: record.id,
    // Return prescription array for backward compatibility
    prescription: prescription || [],
  }
}

module.exports = { getClinicalRecordsByPatient, addClinicalRecord }
