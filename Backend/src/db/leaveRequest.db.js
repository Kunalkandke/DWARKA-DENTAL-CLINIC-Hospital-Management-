const supabase = require('../config/supabase')

/**
 * Find all leave requests with filters
 */
async function findAll(filters = {}) {
  const { userId, status, startDate, endDate, page = 1, limit = 50 } = filters

  const pageNum = Math.max(1, parseInt(page))
  const pageLimit = Math.min(100, Math.max(1, parseInt(limit)))
  const from = (pageNum - 1) * pageLimit
  const to = from + pageLimit - 1

  let query = supabase
    .from('leave_requests')
    .select('*, user:users!leave_requests_user_id_fkey(id, name, email, role), approved_by:users!leave_requests_approved_by_id_fkey(id, name)', { count: 'exact' })

  if (userId) query = query.eq('user_id', userId)
  if (status) query = query.eq('status', status)
  if (startDate) query = query.gte('start_date', startDate)
  if (endDate) query = query.lte('end_date', endDate)

  query = query.order('created_at', { ascending: false }).range(from, to)

  const { data, error, count } = await query
  if (error) throw new Error(error.message)

  return { data: data || [], total: count || 0 }
}

/**
 * Find leave request by ID
 */
async function findById(id) {
  const { data, error } = await supabase
    .from('leave_requests')
    .select('*, user:users!leave_requests_user_id_fkey(id, name, email, role), approved_by:users!leave_requests_approved_by_id_fkey(id, name)')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw new Error(error.message)
  }
  return data
}

/**
 * Create leave request
 */
async function create(payload) {
  const { data, error } = await supabase
    .from('leave_requests')
    .insert([payload])
    .select('*, user:users!leave_requests_user_id_fkey(id, name, email, role)')
    .single()

  if (error) throw new Error(error.message)
  return data
}

/**
 * Update leave request (for approval/rejection)
 */
async function update(id, fields) {
  const { data, error } = await supabase
    .from('leave_requests')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*, user:users!leave_requests_user_id_fkey(id, name, email, role)')
    .single()

  if (error) throw new Error(error.message)
  return data
}

/**
 * Delete leave request
 */
async function remove(id) {
  const { error } = await supabase
    .from('leave_requests')
    .delete()
    .eq('id', id)

  if (error) throw new Error(error.message)
  return true
}

/**
 * Get pending leave requests count
 */
async function getPendingCount() {
  const { count, error } = await supabase
    .from('leave_requests')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending')

  if (error) throw new Error(error.message)
  return count || 0
}

module.exports = {
  findAll,
  findById,
  create,
  update,
  remove,
  getPendingCount,
}
