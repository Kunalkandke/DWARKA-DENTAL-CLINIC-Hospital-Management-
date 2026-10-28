const supabase = require('../config/supabase')

/**
 * Fetch appointments with view/filter/sort/pagination.
 * Filters out appointments whose patient has is_deleted=true via the JOIN.
 */
async function findAll(query = {}) {
  const {
    view,
    status,
    doctorId,
    doctor_id,
    categoryId,
    treatment_category_id,
    date,
    dateFrom,
    date_from,
    dateTo,
    date_to,
    priority,
    sortBy = 'start_at',
    sortOrder = 'asc',
    page = 1,
    limit = 200,
    clinic_id,
  } = query

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)

  const pageNum = Math.max(1, parseInt(page))
  const parsedLimit = limit === 'all' ? 1000 : parseInt(limit || 200)
  const pageLimit = Math.min(1000, Math.max(1, isNaN(parsedLimit) ? 200 : parsedLimit))
  const from = (pageNum - 1) * pageLimit
  const to = from + pageLimit - 1

  let q = supabase
    .from('appointments')
    .select(
      '*, patient:patients!appointments_patient_id_fkey(id, name, patient_number, phone, is_deleted), doctor:users!appointments_doctor_id_fkey(id, name, specialization), treatment_category:treatment_categories(id, name, code, default_duration_minutes, default_follow_up_days)',
      { count: 'exact' }
    )
    .eq('is_deleted', false)
    .eq('patients.is_deleted', false)

  if (clinic_id) q = q.eq('clinic_id', clinic_id)

  // View presets
  if (view === 'today') {
    q = q
      .gte('start_at', todayStart.toISOString())
      .lte('start_at', todayEnd.toISOString())
      .not('status', 'eq', 'cancelled')
  } else if (view === 'missed') {
    q = q.or(
      `status.eq.missed,and(start_at.lt.${todayStart.toISOString()},status.in.(scheduled,confirmed,arrived))`
    )
  } else if (view === 'upcoming') {
    q = q
      .gte('start_at', todayStart.toISOString())
      .in('status', ['scheduled', 'confirmed'])
  }

  // Manual filters
  const resolvedDoctorId = doctorId || doctor_id
  const resolvedCategoryId = categoryId || treatment_category_id
  const resolvedDateFrom = dateFrom || date_from
  const resolvedDateTo = dateTo || date_to

  if (status && status !== 'all' && status !== 'ALL') q = q.eq('status', status)
  if (priority && priority !== 'all' && priority !== 'ALL') q = q.eq('priority', priority)
  if (resolvedDoctorId) q = q.eq('doctor_id', resolvedDoctorId)
  if (resolvedCategoryId && resolvedCategoryId !== 'all' && resolvedCategoryId !== 'ALL') {
    q = q.eq('treatment_category_id', resolvedCategoryId)
  }

  if (date) {
    const d = new Date(date)
    const dStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0)
    const dEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59)
    q = q.gte('start_at', dStart.toISOString()).lte('start_at', dEnd.toISOString())
  }
  if (resolvedDateFrom) q = q.gte('start_at', new Date(resolvedDateFrom).toISOString())
  if (resolvedDateTo) {
    const dt = new Date(resolvedDateTo)
    dt.setHours(23, 59, 59)
    q = q.lte('start_at', dt.toISOString())
  }

  const validSortCols = {
    startAt: 'start_at',
    start_at: 'start_at',
    date: 'start_at',
    patient: 'patient_id',
    doctor: 'doctor_id',
  }
  const sortCol = validSortCols[sortBy] || 'start_at'
  const ascending = sortOrder !== 'desc'

  q = q.order(sortCol, { ascending }).range(from, to)

  const { data, error, count } = await q
  if (error) throw new Error(error.message)

  // Filter out appointments where patient is deleted (in case FK filter doesn't catch all)
  const filtered = (data || []).filter(a => {
    if (!a.patient) return false
    if (a.patient.is_deleted) return false
    return true
  })

  return { data: filtered, total: count || 0 }
}

async function findById(id) {
  const { data, error } = await supabase
    .from('appointments')
    .select(
      '*, patient:patients!appointments_patient_id_fkey(id, name, patient_number, phone, is_deleted), doctor:users!appointments_doctor_id_fkey(id, name, specialization), treatment_category:treatment_categories(id, name, code, default_duration_minutes, default_follow_up_days)'
    )
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw new Error(error.message)
  }
  return data
}

async function findByPatient(patientId) {
  const { data, error } = await supabase
    .from('appointments')
    .select(
      '*, doctor:users!appointments_doctor_id_fkey(id, name, specialization), treatment_category:treatment_categories(id, name, code, default_duration_minutes, default_follow_up_days)'
    )
    .eq('patient_id', patientId)
    .eq('is_deleted', false)
    .order('start_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data || []
}

async function findRemindersToSend(tomorrowStart, tomorrowEnd) {
  const { data, error } = await supabase
    .from('appointments')
    .select('*, patient:patients!appointments_patient_id_fkey(id, name, phone)')
    .gte('start_at', tomorrowStart instanceof Date ? tomorrowStart.toISOString() : tomorrowStart)
    .lte('start_at', tomorrowEnd instanceof Date ? tomorrowEnd.toISOString() : tomorrowEnd)
    .in('status', ['scheduled', 'confirmed'])
    .eq('is_deleted', false)
    .eq('reminder_sent', false)

  if (error) throw new Error(error.message)
  return data || []
}

/**
 * Insert a new appointment. DO NOT include appointment_number — sequence generates it.
 * Returns the full inserted row including auto-generated appointment_number.
 */
async function create(appointmentData) {
  const { data, error } = await supabase
    .from('appointments')
    .insert([appointmentData])
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

async function updateStatus(id, updateFields) {
  const { data, error } = await supabase
    .from('appointments')
    .update(updateFields)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

async function softDelete(id) {
  const { data, error } = await supabase
    .from('appointments')
    .update({ is_deleted: true, deleted_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

async function bulkSoftDeleteByPatient(patientId) {
  const { data, error } = await supabase
    .from('appointments')
    .update({
      is_deleted: true,
      status: 'cancelled',
      deleted_at: new Date().toISOString(),
    })
    .eq('patient_id', patientId)
    .eq('is_deleted', false)
    .select()

  if (error) throw new Error(error.message)
  return data || []
}

/**
 * Check for scheduling overlap for a doctor.
 * Returns the conflicting appointment row if one exists, or null.
 */
async function checkOverlap(doctorId, startAt, endAt) {
  const startIso = startAt instanceof Date ? startAt.toISOString() : startAt
  const endIso = endAt instanceof Date ? endAt.toISOString() : endAt

  const { data, error } = await supabase
    .from('appointments')
    .select('id, start_at, end_at')
    .eq('doctor_id', doctorId)
    .eq('is_deleted', false)
    .not('status', 'in', '(cancelled,rescheduled,completed,missed)')
    .lt('start_at', endIso)
    .gt('end_at', startIso)
    .limit(1)

  if (error) throw new Error(error.message)
  return data && data.length > 0 ? data[0] : null
}

module.exports = {
  findAll,
  findById,
  findByPatient,
  findRemindersToSend,
  create,
  updateStatus,
  softDelete,
  bulkSoftDeleteByPatient,
  checkOverlap,
}
