const supabase = require('../config/supabase')

/**
 * Refresh token store. Tokens are stored hashed (never plaintext).
 */
async function create({ user_id, token_hash, expires_at }) {
  const { data, error } = await supabase
    .from('refresh_tokens')
    .insert([{ user_id, token_hash, expires_at }])
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}

async function findByHash(token_hash) {
  const { data, error } = await supabase
    .from('refresh_tokens')
    .select('*')
    .eq('token_hash', token_hash)
    .is('revoked_at', null)
    .limit(1)
  if (error) throw new Error(error.message)
  return data && data.length > 0 ? data[0] : null
}

async function revoke(id, replacedByTokenHash = null) {
  const fields = { revoked_at: new Date().toISOString() }
  if (replacedByTokenHash) {
    // Look up the replacement row id and record it for an audit trail.
    const { data: repl } = await supabase
      .from('refresh_tokens')
      .select('id')
      .eq('token_hash', replacedByTokenHash)
      .limit(1)
    if (repl && repl.length > 0) fields.replaced_by_id = repl[0].id
  }
  const { data, error } = await supabase
    .from('refresh_tokens')
    .update(fields)
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}

async function revokeAllForUser(user_id) {
  const { data, error } = await supabase
    .from('refresh_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('user_id', user_id)
    .is('revoked_at', null)
    .select()
  if (error) throw new Error(error.message)
  return data || []
}

module.exports = { create, findByHash, revoke, revokeAllForUser }
