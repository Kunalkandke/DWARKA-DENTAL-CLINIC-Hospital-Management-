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

/**
 * Record a failed login attempt and (optionally) lock the account.
 * @param {string} id      user id
 * @param {number} maxAttempts  lockout threshold (default 5)
 * @param {number} lockoutMinutes lockout duration in minutes (default 15)
 * @returns {{ failed_login_attempts: number, locked_until: string|null }}
 */
async function recordFailedLogin(id, maxAttempts = 5, lockoutMinutes = 15) {
  const now = new Date()
  // Read current count first to decide lockout (atomic enough for this app scale).
  const { data: user } = await supabase.from('users').select('failed_login_attempts').eq('id', id).single()

  const next = (user?.failed_login_attempts || 0) + 1
  const fields = { failed_login_attempts: next, last_failed_at: now.toISOString() }
  if (next >= maxAttempts) {
    const lockedUntil = new Date(now.getTime() + lockoutMinutes * 60_000)
    fields.locked_until = lockedUntil.toISOString()
  }

  const { data, error } = await supabase.from('users').update(fields).eq('id', id).select().single()
  if (error) throw new Error(error.message)
  return {
    failed_login_attempts: data.failed_login_attempts,
    locked_until: data.locked_until,
  }
}

/** Reset failed-login counters on successful login. */
async function resetFailedLogin(id) {
  const { data, error } = await supabase
    .from('users')
    .update({ failed_login_attempts: 0, locked_until: null, last_failed_at: null })
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
  recordFailedLogin,
  resetFailedLogin,
}
