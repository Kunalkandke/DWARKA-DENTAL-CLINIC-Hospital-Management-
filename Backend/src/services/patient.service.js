const { patientDb, appointmentDb, userDb, clinicDb, treatmentCategoryDb } = require('../db')
const { isValidUUID } = require('../utils/isValidUUID')
const ApiError = require('../utils/ApiError')
const auditService = require('./audit.service')

function normalizeCategory(str) {
  if (!str) return 'General Consultation'
  let clean = String(str).trim().toLowerCase()
  clean = clean.replace(/^cat-/, '').trim()
  clean = clean.replace(/\s*\([^)]*\)/g, '').trim()
  if (['root canal', 'rct', 'root canal treatment', 'endodontics & rct', 'endodontics'].includes(clean)) return 'Root Canal Treatment'
  if (['orthodontic', 'orthodontics', 'othodontic', 'othodontics', 'ortho', 'braces'].includes(clean)) return 'Orthodontics'
  if (['extraction', 'tooth extraction', 'extractions', 'extract'].includes(clean)) return 'Tooth Extraction'
  if (['dental implant', 'implant', 'implants', 'dental implants'].includes(clean)) return 'Dental Implant'
  if (['general consultation', 'consultation', 'consult', 'general dentistry'].includes(clean)) return 'General Consultation'
  if (['cleaning & scaling', 'scaling & cleaning', 'scale', 'scaling', 'cleaning', 'periodontics'].includes(clean)) return 'Cleaning & Scaling'
  if (['cavity filling', 'filling', 'fill'].includes(clean)) return 'Cavity Filling'
  if (['prosthodontics & crown', 'crown', 'prosthodontics', 'implantology & prosthodontics'].includes(clean)) return 'Prosthodontics & Crown'
  if (['emergency dental', 'emergency', 'emerg'].includes(clean)) return 'Emergency Dental'
  if (['x-ray & diagnosis', 'x-ray', 'xray', 'diagnosis'].includes(clean)) return 'X-Ray & Diagnosis'
  return clean
}

/**
 * Fetch patients with search / filter / sort / pagination.
 * @param {object} query  { search, status, doctorId, sortBy, sortOrder, page, limit }
 * @returns {{ data: object[], pagination: object }}
 */
async function getAllPatients(query = {}) {
  const {
    search = '',
    status,
    doctorId,
    categoryId,
    sortBy = 'registeredAt',
    sortOrder = 'desc',
    page = 1,
    limit = 200,
  } = query

  const filter = {
    search,
    sortBy,
    sortOrder,
    page,
    limit,
  }
  if (status) filter.status = status
  if (doctorId && isValidUUID(doctorId)) filter.assigned_doctor_id = doctorId
  if (categoryId && isValidUUID(categoryId)) filter.treatment_category_id = categoryId

  const { data, total } = await patientDb.findAll(filter)

  const pageNum = Math.max(1, parseInt(page))
  const parsedLimit = limit === 'all' ? 2000 : parseInt(limit || 200)
  const pageLimit = Math.min(2000, Math.max(1, isNaN(parsedLimit) ? 200 : parsedLimit))

  return {
    data: data.map(toFrontendShape),
    pagination: {
      page: pageNum,
      limit: pageLimit,
      total,
      totalPages: Math.ceil(total / pageLimit),
    },
  }
}

/**
 * Get a single patient by ID.
 */
async function getPatientById(id) {
  const patient = await patientDb.findById(id)
  if (!patient) throw ApiError.notFound('Patient not found.')
  return toFrontendShape(patient)
}

/**
 * Register a new patient (and optionally create their first appointment).
 */
async function createPatient(body, requestingUser = null, req = null) {
  const clinic = await clinicDb.getDefaultClinic()

  const {
    name, age, dob, gender, phone, email, address,
    emergencyContact, bloodGroup, assignedDoctorId,
    chiefComplaint, allergies, medicalHistory,
    appointmentDate, appointmentTime, appointmentType,
    treatmentCategoryId, notes,
  } = body

  const allergiesArr = typeof allergies === 'string'
    ? allergies.split(',').map((a) => a.trim()).filter(Boolean)
    : (allergies || [])

  let validDoctorId = assignedDoctorId && isValidUUID(assignedDoctorId)
    ? assignedDoctorId : undefined

  if (!validDoctorId) {
    const doctors = await userDb.findDoctors({ status: 'active' })
    const defaultDoc = doctors.find(d => d.clinic_id === clinic.id) || doctors[0]
    if (defaultDoc) validDoctorId = defaultDoc.id
  }

  // Robust category resolution
  let validCatId
  let catName = 'General Consultation'
  const catParam = treatmentCategoryId || body.treatmentCategoryName || body.categoryName

  const allCategories = await treatmentCategoryDb.findAll({})

  if (catParam) {
    const rawParam = String(catParam).trim()
    const normParam = normalizeCategory(rawParam).toLowerCase()
    const cleanCode = rawParam.replace(/^cat-/, '').toUpperCase()

    // 1. Direct ID match
    let matched = allCategories.find(c => c.id === rawParam)

    // 2. Direct Code match
    if (!matched) {
      matched = allCategories.find(c => c.code && c.code.toUpperCase() === cleanCode)
    }

    // 3. Normalized Name match
    if (!matched) {
      matched = allCategories.find(c => normalizeCategory(c.name).toLowerCase() === normParam)
    }

    // 4. Fuzzy Substring match
    if (!matched) {
      matched = allCategories.find(c => {
        const cNorm = normalizeCategory(c.name).toLowerCase()
        return cNorm.includes(normParam) || normParam.includes(cNorm)
      })
    }

    if (matched) {
      validCatId = matched.id
      catName = matched.name
    } else {
      catName = body.treatmentCategoryName || body.categoryName || rawParam
    }
  }

  // Fallback to General Consultation if no category was specified
  if (!validCatId && (!body.treatmentCategoryName && !body.categoryName && !treatmentCategoryId)) {
    const generalCat = allCategories.find(c => normalizeCategory(c.name).toLowerCase() === 'general consultation') || allCategories[0]
    if (generalCat) {
      validCatId = generalCat.id
      catName = generalCat.name
    }
  }

  // patient_number is auto-generated by sequence — do NOT pass it
  const patient = await patientDb.create({
    clinic_id: clinic.id,
    name,
    date_of_birth: dob || null,
    gender,
    phone,
    email,
    address,
    emergency_contact: emergencyContact?.name ? emergencyContact : null,
    blood_group: bloodGroup,
    chief_complaint: chiefComplaint,
    medical_history: medicalHistory,
    allergies: allergiesArr,
    assigned_doctor_id: validDoctorId || null,
    treatment_category_id: validCatId || null,
    status: 'new',
    registered_at: new Date().toISOString(),
    total_visits: 0,
    is_deleted: false,
  })

  // Audit log
  auditService.log({
    action: 'patient.create',
    userId: requestingUser?.id,
    entityType: 'patient',
    entityId: patient.id,
    changes: { name, phone, patient_number: patient.patient_number },
    ipAddress: req?.ip,
    userAgent: req?.get('user-agent'),
  })

  let initialApt = null
  const aptDate = appointmentDate || new Date().toISOString().split('T')[0]
  const aptTime = appointmentTime || '10:00'

  if (validDoctorId) {
    try {
      // Parse as IST (UTC+5:30) to avoid midnight boundary shifts
      const startAt = new Date(`${aptDate}T${aptTime}:00+05:30`)
      const endAt = new Date(startAt.getTime() + 30 * 60 * 1000)

      // appointment_number is auto-generated by sequence — do NOT pass it
      // Strip fields that don't exist in appointments table
      initialApt = await appointmentDb.create({
        clinic_id: clinic.id,
        patient_id: patient.id,
        doctor_id: validDoctorId,
        treatment_category_id: validCatId || null,
        start_at: startAt.toISOString(),
        end_at: endAt.toISOString(),
        duration_minutes: 30,
        status: 'scheduled',
        priority: 'normal',
        notes: notes || chiefComplaint || '',
        created_by_id: validDoctorId,
        is_deleted: false,
      })
    } catch (aptErr) {
      console.error('[createPatient] Appointment creation failed:', aptErr.message)
    }
  }

  let recordedPayment = null
  const advanceAmount = Number(body.advanceAmount || body.advancePayment || 0)
  if (advanceAmount > 0) {
    try {
      const paymentService = require('./payment.service')
      let pMethod = 'upi'
      const rawMethod = String(body.paymentMode || 'upi').toLowerCase().trim()
      if (rawMethod.includes('cash')) pMethod = 'cash'
      else if (rawMethod.includes('card')) pMethod = 'card'
      else if (rawMethod.includes('bank') || rawMethod.includes('transfer') || rawMethod.includes('net')) pMethod = 'bank_transfer'
      else pMethod = 'upi'

      recordedPayment = await paymentService.addPayment({
        patientId: patient.id,
        appointmentId: initialApt ? initialApt.id : undefined,
        amount: advanceAmount,
        mode: pMethod,
        notes: body.paymentNotes || 'Registration Advance Payment',
        date: aptDate,
      }, { id: validDoctorId || clinic.id }, req)
    } catch (payErr) {
      console.error('[createPatient] Advance payment creation failed:', payErr.message)
    }
  }

  return {
    patient: toFrontendShape(patient),
    appointment: initialApt ? toFrontendAppointment(initialApt) : null,
    payment: recordedPayment || null,
  }
}

/**
 * Update editable patient fields.
 */
async function updatePatient(id, body, requestingUser = null, req = null) {
  const existing = await patientDb.findById(id)
  if (!existing) throw ApiError.notFound('Patient not found.')

  // Map camelCase body fields to snake_case DB columns; exclude patientNumber and treatmentCategoryName
  const updateFields = {}
  if (body.name !== undefined) updateFields.name = body.name
  if (body.phone !== undefined) updateFields.phone = body.phone
  if (body.email !== undefined) updateFields.email = body.email
  if (body.address !== undefined) updateFields.address = body.address
  if (body.gender !== undefined) updateFields.gender = body.gender
  if (body.bloodGroup !== undefined) updateFields.blood_group = body.bloodGroup
  if (body.chiefComplaint !== undefined) updateFields.chief_complaint = body.chiefComplaint
  if (body.medicalHistory !== undefined) updateFields.medical_history = body.medicalHistory
  if (body.allergies !== undefined) updateFields.allergies = body.allergies
  if (body.assignedDoctorId !== undefined) updateFields.assigned_doctor_id = body.assignedDoctorId
  if (body.treatmentCategoryId !== undefined) updateFields.treatment_category_id = body.treatmentCategoryId
  if (body.status !== undefined) updateFields.status = body.status
  if (body.lastVisitAt !== undefined) updateFields.last_visit_at = body.lastVisitAt
  if (body.nextFollowUpAt !== undefined) updateFields.next_follow_up_at = body.nextFollowUpAt
  if (body.totalVisits !== undefined) updateFields.total_visits = body.totalVisits
  if (body.emergencyContact !== undefined) updateFields.emergency_contact = body.emergencyContact
  if (body.dateOfBirth !== undefined) updateFields.date_of_birth = body.dateOfBirth

  const updated = await patientDb.update(id, updateFields)

  // Audit log
  auditService.log({
    action: 'patient.update',
    userId: requestingUser?.id,
    entityType: 'patient',
    entityId: id,
    changes: { before: toFrontendShape(existing), after: updateFields },
    ipAddress: req?.ip,
    userAgent: req?.get('user-agent'),
  })

  return toFrontendShape(updated)
}

/**
 * Soft-delete a patient (Admin and Receptionist).
 * Also cancels and soft-deletes all associated appointments.
 */
async function softDeletePatient(id, requestingUser = null, req = null) {
  let patient = null
  if (isValidUUID(id)) {
    patient = await patientDb.findById(id)
  }
  if (!patient) {
    patient = await patientDb.findByPatientNumber(String(id))
  }

  if (patient) {
    await patientDb.softDelete(patient.id)
    await appointmentDb.bulkSoftDeleteByPatient(patient.id)

    // Audit log
    auditService.log({
      action: 'patient.delete',
      userId: requestingUser?.id,
      entityType: 'patient',
      entityId: patient.id,
      changes: { patient_number: patient.patient_number, name: patient.name },
      ipAddress: req?.ip,
      userAgent: req?.get('user-agent'),
    })
  }
}

// ─── Shape helpers ────────────────────────────────────────────────────────────

function toFrontendShape(p) {
  // Handle both flat row (from create/update) and JOIN result (from findAll/findById)
  const docObj = p.assigned_doctor || null
  const docId = docObj ? docObj.id : (p.assigned_doctor_id || null)
  const docName = docObj ? docObj.name : null
  const docSpec = docObj ? docObj.specialization : null

  const catObj = p.treatment_category || null
  const catId = catObj ? catObj.id : (p.treatment_category_id || null)
  const catName = (catObj && catObj.name) || 'General Consultation'

  return {
    id: p.id,
    patientId: p.patient_number,
    name: p.name,
    age: p.date_of_birth ? Math.floor((Date.now() - new Date(p.date_of_birth)) / 3.156e10) : undefined,
    dob: p.date_of_birth,
    gender: p.gender,
    phone: p.phone,
    email: p.email,
    address: p.address,
    emergencyContact: p.emergency_contact || null,
    bloodGroup: p.blood_group,
    chiefComplaint: p.chief_complaint,
    medicalHistory: p.medical_history,
    allergies: Array.isArray(p.allergies) ? p.allergies.join(', ') : (p.allergies || 'None'),
    assignedDoctorId: docId,
    doctorName: docName,
    doctorSpecialization: docSpec,
    treatmentCategoryId: catId,
    treatmentCategoryName: catName,
    categoryName: catName,
    status: p.status,
    registeredAt: p.registered_at,
    lastVisit: p.last_visit_at,
    nextFollowUp: p.next_follow_up_at,
    totalVisits: p.total_visits || 0,
    isDeleted: p.is_deleted,
  }
}

function toFrontendAppointment(a) {
  const startAt = a.start_at ? new Date(a.start_at) : null
  return {
    id: a.id,
    appointmentNumber: a.appointment_number || '',
    patientId: a.patient_id || '',
    patientName: a.patient_name || '',
    patientPhone: a.patient_phone || '',
    doctorId: a.doctor_id || '',
    doctorName: a.doctor_name || '',
    treatmentCategoryName: a.treatment_category_name || 'General Consultation',
    date: startAt ? startAt.toISOString().split('T')[0] : null,
    time: startAt ? startAt.toTimeString().slice(0, 5) : null,
    type: 'Consultation',
    status: a.status || 'scheduled',
    notes: a.notes || '',
  }
}

module.exports = {
  getAllPatients,
  getPatientById,
  createPatient,
  updatePatient,
  softDeletePatient,
  toFrontendShape,
  toFrontendAppointment,
}
