const supabase = require('../config/supabase')

async function create(logData) {
  const { data, error } = await supabase
    .from('audit_logs')
    .insert([logData])
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

/**
 * Query audit logs with filters and pagination.
 * @param {object} filter  { actor_user_id, collection_name, action, dateFrom, dateTo, page, limit, clinic_id }
 */
async function findAll(filter = {}) {
  const {
    actor_user_id,
    collection_name,
    action,
    dateFrom,
    dateTo,
    clinic_id,
    page = 1,
    limit = 50,
  } = filter

  const pageNum = Math.max(1, parseInt(page))
  const pageLimit = Math.min(200, Math.max(1, parseInt(limit) || 50))
  const from = (pageNum - 1) * pageLimit
  const to = from + pageLimit - 1

  let q = supabase.from('audit_logs').select(
    'id, clinic_id, actor_user_id, action, collection_name, document_id, before, after, ip_address, user_agent, created_at, actor:users!audit_logs_actor_user_id_fkey(id, name, email, role)',
    { count: 'exact' }
  )

  if (clinic_id) q = q.eq('clinic_id', clinic_id)
  if (actor_user_id) q = q.eq('actor_user_id', actor_user_id)
  if (collection_name) q = q.eq('collection_name', collection_name)
  if (action) q = q.eq('action', action)
  if (dateFrom) q = q.gte('created_at', new Date(dateFrom).toISOString())
  if (dateTo) {
    const dt = new Date(dateTo); dt.setHours(23, 59, 59)
    q = q.lte('created_at', dt.toISOString())
  }

  q = q.order('created_at', { ascending: false }).range(from, to)

  const { data, error, count } = await q
  if (error) throw new Error(error.message)

  return {
    data: data || [],
    total: count || 0,
    pagination: {
      page: pageNum,
      limit: pageLimit,
      total: count || 0,
      totalPages: Math.ceil((count || 0) / pageLimit),
    },
  }
}

module.exports = {
  create,
  findAll,
}
