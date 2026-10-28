const supabase = require('../config/supabase')

async function findByEmail(email) {
  const { data, error } = await supabase
    .from('users')
    .select('*, password_hash')
    .eq('email', email.toLowerCase().trim())
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null // not found
    throw new Error(error.message)
  }
  return data
}

async function findById(id) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw new Error(error.message)
  }
  return data
}

async function findDoctors({ status } = {}) {
  let query = supabase
    .from('users')
    .select('*')
    .eq('role', 'doctor')

  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data || []
}

async function findAllStaff() {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .order('name', { ascending: true })

  if (error) throw new Error(error.message)
  return data || []
}

async function createUser(userData) {
  const { data, error } = await supabase
    .from('users')
    .insert([userData])
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

async function updateUser(id, fields) {
  const { data, error } = await supabase
    .from('users')
    .update(fields)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

async function updateLastLogin(id) {
  const { data, error } = await supabase
    .from('users')
    .update({ last_login_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

module.exports = {
  findByEmail,
  findById,
  findDoctors,
  findAllStaff,
  createUser,
  updateUser,
  updateLastLogin,
}
