const authService = require('../services/auth.service');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../middleware/asyncHandler');
const { verifyToken } = require('../utils/generateToken');
const ApiError = require('../utils/ApiError');
const { userDb } = require('../db');

function clientContext(req) {
  return {
    ip: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || req.ip || null,
    userAgent: req.headers['user-agent'] || null,
  };
}

/**
 * POST /api/auth/login
 * Returns: { success, user, role, token, refreshToken }
 */
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const result = await authService.login(email, password, clientContext(req));
  return new ApiResponse(200, result, 'Login successful').send(res);
});

/**
 * POST /api/auth/refresh
 * Body: { refreshToken }. Returns new { token, refreshToken, role, user }.
 */
const refresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body || {};
  const result = await authService.refresh(refreshToken, clientContext(req));
  return new ApiResponse(200, result, 'Token refreshed').send(res);
});

/**
 * POST /api/auth/logout
 * Body: { refreshToken, all? }. Revokes the refresh token (and all if `all`).
 */
const logout = asyncHandler(async (req, res) => {
  const { refreshToken, all } = req.body || {};
  await authService.logout(refreshToken, !!all);
  return new ApiResponse(200, null, 'Logged out').send(res);
});

/**
 * GET /api/auth/me
 * Verify JWT and return current user profile.
 */
const me = asyncHandler(async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw ApiError.unauthorized('No token provided.');
  }
  const token = authHeader.slice(7).trim();
  let decoded;
  try {
    decoded = verifyToken(token);
  } catch {
    throw ApiError.unauthorized('Invalid or expired token.');
  }

  const user = await userDb.findById(decoded.id);
  if (!user || user.status !== 'active') {
    throw ApiError.unauthorized('User not found or inactive.');
  }

  return new ApiResponse(200, {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      specialization: user.specialization,
    },
    role: user.role,
  }, 'Authenticated').send(res);
});

module.exports = { login, refresh, logout, me };
