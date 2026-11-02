const supabase = require('../config/supabase')

async function findByDoctor(doctor_id) {
  const { data, error } = await supabase
    .from('doctor_blocks')
    .select('*')
    .eq('doctor_id', doctor_id)
    .order('start_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data || []
}

/** Active leave/block overlapping the window [startAt, endAt). */
async function findActiveOverlap(doctor_id, startAt, endAt) {
  const startIso = startAt instanceof Date ? startAt.toISOString() : startAt
  const endIso = endAt instanceof Date ? endAt.toISOString() : endAt
  const { data, error } = await supabase
    .from('doctor_blocks')
    .select('*')
    .eq('doctor_id', doctor_id)
    .lt('start_at', endIso)
    .gt('end_at', startIso)
    .limit(1)
  if (error) throw new Error(error.message)
  return data && data.length > 0 ? data[0] : null
}

async function create(payload) {
  const { data, error } = await supabase.from('doctor_blocks').insert([payload]).select().single()
  if (error) throw new Error(error.message)
  return data
}

async function remove(id) {
  const { error } = await supabase.from('doctor_blocks').delete().eq('id', id)
  if (error) throw new Error(error.message)
  return true
}

module.exports = { findByDoctor, findActiveOverlap, create, remove }
