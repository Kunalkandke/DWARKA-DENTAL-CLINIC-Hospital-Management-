const { verifyToken } = require('../utils/generateToken');
const ApiError = require('../utils/ApiError');
const { rolePermissionsDb } = require('../db');

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

/**
 * Permission-matrix authorization middleware factory.
 * Consults the role_permissions table (cached) + per-user overrides.
 * Roles/rows not present in the matrix are DENIED by default.
 *
 * Usage: router.post('/', authMiddleware, requirePermission('patient', 'edit_demographics'), handler)
 *
 * @param {string} module  e.g. 'patient', 'clinical_record', 'payment'
 * @param {string} action  e.g. 'create', 'edit_demographics', 'delete'
 */
function requirePermission(module, action) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return next(ApiError.unauthorized('Not authenticated.'));
      }
      const allowed = await rolePermissionsDb.isAllowed(req.user.role, module, action, req.user.id);
      if (!allowed) {
        return next(ApiError.forbidden(`Access denied: your role cannot ${action.replace(/_/g, ' ')} ${module.replace(/_/g, ' ')}.`));
      }
      next();
    } catch (err) {
      // If the permission store is unreachable, fail closed.
      return next(ApiError.forbidden('Access denied: could not verify permissions.'));
    }
  };
}

module.exports = { authMiddleware, requireRole, requirePermission };
