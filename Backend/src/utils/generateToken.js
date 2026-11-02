const jwt = require('jsonwebtoken');
const config = require('../config/env');

const JWT_SECRET = config.JWT_SECRET || process.env.JWT_SECRET;
const ACCESS_EXPIRES = process.env.JWT_ACCESS_EXPIRES_IN || '15m';
const REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

/**
 * Generate a short-lived ACCESS token for a user.
 * @param {{ id: string, role: string, email: string }} payload
 * @returns {string} JWT token
 */
function generateToken(payload) {
  return jwt.sign(
    { id: payload.id, role: payload.role, email: payload.email, type: 'access' },
    JWT_SECRET,
    { expiresIn: ACCESS_EXPIRES },
  );
}

/**
 * Verify an ACCESS token and return the decoded payload.
 * Rejects refresh tokens (type mismatch).
 * @param {string} token
 */
function verifyToken(token) {
  const decoded = jwt.verify(token, JWT_SECRET);
  if (decoded.type && decoded.type !== 'access') {
    const err = new Error('Wrong token type');
    err.name = 'WrongTokenType';
    throw err;
  }
  return decoded;
}

/**
 * Generate a long-lived REFRESH token (carries only id + email, never role).
 * @param {{ id: string, email: string }} payload
 */
function generateRefreshToken(payload) {
  return jwt.sign(
    { id: payload.id, email: payload.email, type: 'refresh' },
    JWT_SECRET,
    { expiresIn: REFRESH_EXPIRES },
  );
}

/**
 * Verify a REFRESH token. Rejects access tokens.
 */
function verifyRefreshToken(token) {
  const decoded = jwt.verify(token, JWT_SECRET);
  if (decoded.type !== 'refresh') {
    const err = new Error('Not a refresh token');
    err.name = 'WrongTokenType';
    throw err;
  }
  return decoded;
}

module.exports = { generateToken, verifyToken, generateRefreshToken, verifyRefreshToken, ACCESS_EXPIRES, REFRESH_EXPIRES };
