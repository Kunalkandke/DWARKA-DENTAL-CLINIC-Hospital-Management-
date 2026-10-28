const supabase = require('../config/supabase')

/**
 * Permission matrix data access.
 * Roles not present in role_permissions are DENIED by default.
 */

// In-process cache to avoid a DB round-trip on every request.
let cache = null
let cacheAt = 0
const CACHE_TTL_MS = 60_000

async function loadMatrix() {
  const now = Date.now()
  if (cache && now - cacheAt < CACHE_TTL_MS) return cache

  const { data, error } = await supabase
    .from('role_permissions')
    .select('role, module, action, allowed')

  if (error) throw new Error(error.message)

  const map = {}
  for (const row of data || []) {
    map[`${row.role}:${row.module}:${row.action}`] = row.allowed
  }
  cache = map
  cacheAt = now
  return map
}

function clearCache() {
  cache = null
  cacheAt = 0
}

/**
 * Returns true if the role is allowed (module, action).
 * Honours per-user overrides when a user id is supplied.
 * Unknown roles / missing rows => denied.
 */
async function isAllowed(role, module, action, userId = null) {
  const matrix = await loadMatrix()

  // Per-user override wins over role matrix.
  if (userId) {
    const { data } = await supabase
      .from('user_overrides')
      .select('allowed')
      .eq('user_id', userId)
      .eq('module', module)
      .eq('action', action)
      .limit(1)
    if (data && data.length > 0) return !!data[0].allowed
  }

  const key = `${role}:${module}:${action}`
  if (key in matrix) return !!matrix[key]
  return false // deny by default for unmapped roles/rows
}

/** Bulk fetch all permissions for a role (for the admin UI). */
async function listByRole(role) {
  const { data, error } = await supabase
    .from('role_permissions')
    .select('module, action, allowed')
    .eq('role', role)
  if (error) throw new Error(error.message)
  return data || []
}

module.exports = { isAllowed, listByRole, clearCache }
