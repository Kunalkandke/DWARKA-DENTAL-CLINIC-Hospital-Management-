const supabase = require('../config/supabase')

/**
 * Fetch payments with filter/sort/pagination.
 * LEFT JOINs patients for patient name and patient_number.
 */
async function findAll(filter = {}) {
  const {
    status,
    patient_id,
    patientId,
    dateFrom,
    date_from,
    dateTo,
    date_to,
    sortBy = 'paid_at',
    sortOrder = 'desc',
    page = 1,
    limit = 50,
    clinic_id,
  } = filter

  const pageNum = Math.max(1, parseInt(page))
  const pageLimit = Math.min(100, Math.max(1, parseInt(limit)))
  const from = (pageNum - 1) * pageLimit
  const to = from + pageLimit - 1

  const resolvedPatientId = patient_id || patientId
  const resolvedDateFrom = dateFrom || date_from
  const resolvedDateTo = dateTo || date_to

  let q = supabase
    .from('payments')
    .select(
      '*, patient:patients!payments_patient_id_fkey(id, name, patient_number)',
      { count: 'exact' }
    )
    .eq('is_deleted', false)

  if (clinic_id) q = q.eq('clinic_id', clinic_id)
  if (resolvedPatientId) q = q.eq('patient_id', resolvedPatientId)
  if (status) q = q.eq('status', status)
  if (resolvedDateFrom) q = q.gte('paid_at', new Date(resolvedDateFrom).toISOString())
  if (resolvedDateTo) {
    const dt = new Date(resolvedDateTo)
    dt.setHours(23, 59, 59)
    q = q.lte('paid_at', dt.toISOString())
  }

  const validSortCols = { paid_at: 'paid_at', paidAt: 'paid_at', amount: 'amount' }
  const sortCol = validSortCols[sortBy] || 'paid_at'
  const ascending = sortOrder !== 'desc'

  q = q.order(sortCol, { ascending }).range(from, to)

  const { data, error, count } = await q
  if (error) throw new Error(error.message)

  return { data: data || [], total: count || 0 }
}

async function findByPatient(patientId) {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('patient_id', patientId)
    .eq('is_deleted', false)
    .order('paid_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data || []
}

/**
 * Insert a payment. DO NOT include receipt_number — sequence generates it.
 * Returns the full inserted row including auto-generated receipt_number.
 */
async function create(paymentData) {
  const { data, error } = await supabase
    .from('payments')
    .insert([paymentData])
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

async function softDelete(id) {
  const { data, error } = await supabase
    .from('payments')
    .update({ is_deleted: true, deleted_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

async function getRevenueSummary(clinicId) {
  let q = supabase
    .from('payments')
    .select('method, amount')
    .eq('is_deleted', false)

  if (clinicId) q = q.eq('clinic_id', clinicId)

  const { data, error } = await q
  if (error) throw new Error(error.message)

  // Aggregate in JS since Supabase JS client doesn't support GROUP BY directly
  const grouped = {}
  for (const row of data || []) {
    const method = row.method || 'other'
    grouped[method] = (grouped[method] || 0) + (row.amount || 0)
  }

  return Object.entries(grouped).map(([method, value]) => ({ method, value }))
}

module.exports = {
  findAll,
  findByPatient,
  create,
  softDelete,
  getRevenueSummary,
}
