const supabase = require('../config/supabase')

async function findAll(clinic_id, { status } = {}) {
  let q = supabase.from('chairs').select('*').eq('clinic_id', clinic_id)
  if (status) q = q.eq('status', status)
  q = q.order('name', { ascending: true })
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return data || []
}

async function findById(id) {
  const { data, error } = await supabase.from('chairs').select('*').eq('id', id).single()
  if (error) {
    if (error.code === 'PGRST116') return null
    throw new Error(error.message)
  }
  return data
}

async function create(payload) {
  const { data, error } = await supabase.from('chairs').insert([payload]).select().single()
  if (error) throw new Error(error.message)
  return data
}

async function update(id, fields) {
  const { data, error } = await supabase.from('chairs').update(fields).eq('id', id).select().single()
  if (error) throw new Error(error.message)
  return data
}

async function remove(id) {
  const { error } = await supabase.from('chairs').delete().eq('id', id)
  if (error) throw new Error(error.message)
  return true
}

module.exports = { findAll, findById, create, update, remove }
