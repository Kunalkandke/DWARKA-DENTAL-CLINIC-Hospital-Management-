const { verifyToken } = require('../utils/generateToken');
const ApiError = require('../utils/ApiError');

/**
 * JWT Authentication Middleware.
 * Reads the Authorization: Bearer <token> header, verifies the JWT,
 * and attaches the decoded payload to req.user.
 *
 * The backend determines role from the verified token — never trusts the client.
 */
function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(ApiError.unauthorized('Authentication required.'));
    }

    const token = authHeader.slice(7).trim();
    if (!token || token === 'demo-token') {
      return next(ApiError.unauthorized('Authentication required.'));
    }

    const decoded = verifyToken(token);
    req.user = { id: decoded.id, role: decoded.role, email: decoded.email };
    next();
  } catch (err) {
    return next(ApiError.unauthorized('Authentication required.'));
  }
}

/**
 * Role-based authorization middleware factory.
 * Usage: router.get('/admin-route', authMiddleware, requireRole('admin'), handler)
 * @param {...string} roles  Allowed roles
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(ApiError.unauthorized('Not authenticated.'));
    }
    if (!roles.includes(req.user.role)) {
      return next(ApiError.forbidden(`Access denied. Required role: ${roles.join(' or ')}.`));
    }
    next();
  };
}

module.exports = { authMiddleware, requireRole };
