const bcrypt = require('bcryptjs')
const crypto = require('crypto')
const { userDb, refreshTokenDb, clinicDb } = require('../db')
const ApiError = require('../utils/ApiError')
const { generateToken, generateRefreshToken } = require('../utils/generateToken')
const auditService = require('./audit.service')

const MAX_FAILED_ATTEMPTS = parseInt(process.env.LOGIN_MAX_ATTEMPTS || '5', 10)
const LOCKOUT_MINUTES = parseInt(process.env.LOGIN_LOCKOUT_MINUTES || '15', 10)

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

/**
 * Authenticate a user. Enforces account lockout and records audit entries.
 * Returns access token + refresh token, plus the user's REAL role.
 */
async function login(email, password, { ip, userAgent } = {}) {
  const normalizedEmail = email.toLowerCase().trim()

  const user = await userDb.findByEmail(normalizedEmail)
  if (!user) {
    // Avoid user-enumeration: same message, but still audit the attempt.
    await auditService.log({ actorUserId: null, action: 'login', collectionName: 'users', documentId: normalizedEmail, after: { success: false, reason: 'user_not_found' }, ip, userAgent })
    throw ApiError.badRequest('Invalid email or password.')
  }

  if (user.status !== 'active') {
    throw ApiError.forbidden('Account is inactive. Please contact the administrator.')
  }

  // Lockout check
  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    const mins = Math.ceil((new Date(user.locked_until) - new Date()) / 60000)
    throw ApiError.forbidden(`Account is temporarily locked. Try again in ${mins} minute(s) or contact the administrator.`)
  }

  let isMatch = false
  try {
    isMatch = await bcrypt.compare(password, user.password_hash)
  } catch (_) {}

  if (!isMatch) {
    // Record failed attempt (may lock the account on reaching the threshold).
    try {
      const result = await userDb.recordFailedLogin(user.id, MAX_FAILED_ATTEMPTS, LOCKOUT_MINUTES)
      if (result.locked_until) {
        await auditService.log({ actorUserId: user.id, action: 'login', collectionName: 'users', documentId: user.id, after: { success: false, locked: true }, ip, userAgent })
        throw ApiError.forbidden(`Too many failed attempts. Account locked for ${LOCKOUT_MINUTES} minutes.`)
      }
    } catch (lockErr) {
      if (lockErr.statusCode === 403) throw lockErr
      // non-fatal: continue to generic message
    }
    await auditService.log({ actorUserId: user.id, action: 'login', collectionName: 'users', documentId: user.id, after: { success: false }, ip, userAgent })
    throw ApiError.badRequest('Invalid email or password.')
  }

  // Success — reset counters, issue tokens.
  await userDb.resetFailedLogin(user.id)
  userDb.updateLastLogin(user.id).catch(() => {})

  const userResponse = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,           // REAL role in the token — no remapping
    phone: user.phone,
    specialization: user.specialization,
  }

  const accessToken = generateToken({ id: userResponse.id, role: userResponse.role, email: user.email })
  const refreshToken = generateRefreshToken({ id: userResponse.id, email: user.email })
  await refreshTokenDb.create({
    user_id: userResponse.id,
    token_hash: hashToken(refreshToken),
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  })

  await auditService.log({ actorUserId: userResponse.id, action: 'login', collectionName: 'users', documentId: userResponse.id, after: { success: true }, ip, userAgent })

  return { user: userResponse, role: userResponse.role, token: accessToken, refreshToken }
}

/**
 * Validate a refresh token, rotate it, and return a new access + refresh pair.
 */
async function refresh(refreshToken, { ip, userAgent } = {}) {
  if (!refreshToken) throw ApiError.unauthorized('Refresh token required.')

  let decoded
  try {
    const { verifyRefreshToken } = require('../utils/generateToken')
    decoded = verifyRefreshToken(refreshToken)
  } catch (_) {
    throw ApiError.unauthorized('Invalid or expired refresh token.')
  }

  const stored = await refreshTokenDb.findByHash(hashToken(refreshToken))
  if (!stored || (stored.expires_at && new Date(stored.expires_at) < new Date())) {
    throw ApiError.unauthorized('Refresh token is no longer valid. Please log in again.')
  }

  const user = await userDb.findById(decoded.id)
  if (!user || user.status !== 'active') {
    throw ApiError.unauthorized('Account not found or inactive.')
  }

  // Rotate: revoke the old refresh token and issue a new pair.
  const newAccessToken = generateToken({ id: user.id, role: user.role, email: user.email })
  const newRefreshToken = generateRefreshToken({ id: user.id, email: user.email })
  await refreshTokenDb.create({
    user_id: user.id,
    token_hash: hashToken(newRefreshToken),
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  })
  await refreshTokenDb.revoke(stored.id, hashToken(newRefreshToken))

  return { token: newAccessToken, refreshToken: newRefreshToken, role: user.role, user: { id: user.id, name: user.name, email: user.email, role: user.role } }
}

/**
 * Revoke the supplied refresh token (and, if requested, all of the user's tokens).
 */
async function logout(refreshToken, revokeAll = false) {
  if (!refreshToken) return { revoked: true }
  try {
    const stored = await refreshTokenDb.findByHash(hashToken(refreshToken))
    if (stored) {
      if (revokeAll) await refreshTokenDb.revokeAllForUser(stored.user_id)
      else await refreshTokenDb.revoke(stored.id)
    }
  } catch (_) {}
  return { revoked: true }
}

module.exports = { login, refresh, logout }
