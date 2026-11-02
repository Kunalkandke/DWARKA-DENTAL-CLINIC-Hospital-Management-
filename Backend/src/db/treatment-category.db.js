const supabase = require('../config/supabase')

async function findAll(filter = {}) {
  const { search, is_active, sortBy = 'name', sortOrder = 'asc', clinic_id } = filter

  let query = supabase.from('treatment_categories').select('*')

  if (clinic_id) query = query.eq('clinic_id', clinic_id)
  if (is_active !== undefined) query = query.eq('is_active', is_active)
  if (search && search.trim()) {
    query = query.ilike('name', `%${search.trim()}%`)
  }

  const ascending = sortOrder !== 'desc'
  query = query.order(sortBy || 'name', { ascending })

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data || []
}

async function findById(id) {
  const { data, error } = await supabase
    .from('treatment_categories')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw new Error(error.message)
  }
  return data
}

async function findByCode(code) {
  const { data, error } = await supabase
    .from('treatment_categories')
    .select('*')
    .eq('code', code.toUpperCase())
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw new Error(error.message)
  }
  return data
}

async function create(categoryData) {
  const { data, error } = await supabase
    .from('treatment_categories')
    .insert([categoryData])
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

async function update(id, fields) {
  const { data, error } = await supabase
    .from('treatment_categories')
    .update(fields)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

async function toggleActive(id, isActive) {
  const { data, error } = await supabase
    .from('treatment_categories')
    .update({ is_active: isActive })
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

async function upsertByCode(code, clinicId, categoryData) {
  const payload = { ...categoryData, code: code.toUpperCase(), clinic_id: clinicId }
  const { data, error } = await supabase
    .from('treatment_categories')
    .upsert([payload], { onConflict: 'clinic_id,code' })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

module.exports = {
  findAll,
  findById,
  findByCode,
  create,
  update,
  toggleActive,
  upsertByCode,
}
