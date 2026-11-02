const supabase = require('../config/supabase')

/**
 * Fetch patients with search / filter / sort / pagination.
 * @param {object} filter  { search, status, assigned_doctor_id, treatment_category_id,
 *                           sortBy, sortOrder, page, limit, clinic_id }
 * @returns {{ data: object[], total: number }}
 */
async function findAll(filter = {}) {
  const {
    search = '',
    status,
    assigned_doctor_id,
    treatment_category_id,
    sortBy = 'registered_at',
    sortOrder = 'desc',
    page = 1,
    limit = 200,
    clinic_id,
  } = filter

  const pageNum = Math.max(1, parseInt(page))
  const parsedLimit = limit === 'all' ? 2000 : parseInt(limit || 200)
  const pageLimit = Math.min(2000, Math.max(1, isNaN(parsedLimit) ? 200 : parsedLimit))
  const from = (pageNum - 1) * pageLimit
  const to = from + pageLimit - 1

  let query = supabase
    .from('patients')
    .select(
      '*, assigned_doctor:users!patients_assigned_doctor_id_fkey(id, name, specialization), treatment_category:treatment_categories(id, name, code, default_duration_minutes, default_follow_up_days)',
      { count: 'exact' }
    )
    .eq('is_deleted', false)

  if (clinic_id) query = query.eq('clinic_id', clinic_id)
  if (status) query = query.eq('status', status)
  if (assigned_doctor_id) query = query.eq('assigned_doctor_id', assigned_doctor_id)

  // For treatment_category_id filter — match directly on patients table
  if (treatment_category_id) query = query.eq('treatment_category_id', treatment_category_id)

  if (search && search.trim()) {
    const s = search.trim()
    query = query.or(
      `name.ilike.%${s}%,phone.ilike.%${s}%,patient_number.ilike.%${s}%,email.ilike.%${s}%,chief_complaint.ilike.%${s}%`
    )
  }

  const validSortCols = {
    name: 'name',
    registeredAt: 'registered_at',
    registered_at: 'registered_at',
    lastVisit: 'last_visit_at',
    last_visit_at: 'last_visit_at',
    nextFollowUp: 'next_follow_up_at',
    next_follow_up_at: 'next_follow_up_at',
  }
  const sortCol = validSortCols[sortBy] || 'registered_at'
  const ascending = sortOrder !== 'desc'

  query = query
    .order(sortCol, { ascending })
    .range(from, to)

  const { data, error, count } = await query
  if (error) throw new Error(error.message)

  return { data: data || [], total: count || 0 }
}

async function findById(id) {
  const { data, error } = await supabase
    .from('patients')
    .select(
      '*, assigned_doctor:users!patients_assigned_doctor_id_fkey(id, name, specialization), treatment_category:treatment_categories(id, name, code, default_duration_minutes, default_follow_up_days)'
    )
    .eq('id', id)
    .eq('is_deleted', false)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw new Error(error.message)
  }
  return data
}

async function findByPatientNumber(patientNumber) {
  const { data, error } = await supabase
    .from('patients')
    .select('*')
    .eq('patient_number', patientNumber)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw new Error(error.message)
  }
  return data
}

/**
 * Insert a new patient. DO NOT include patient_number — let the DB sequence generate it.
 * Returns the full inserted row including auto-generated patient_number.
 */
async function create(patientData) {
  const { data, error } = await supabase
    .from('patients')
    .insert([patientData])
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

async function update(id, fields) {
  const { data, error } = await supabase
    .from('patients')
    .update(fields)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

async function softDelete(id) {
  const { data, error } = await supabase
    .from('patients')
    .update({ is_deleted: true, deleted_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

module.exports = {
  findAll,
  findById,
  findByPatientNumber,
  create,
  update,
  softDelete,
}
