const { auditLogDb, clinicDb } = require('../db')
const ApiResponse = require('../utils/ApiResponse')
const asyncHandler = require('../middleware/asyncHandler')

/**
 * GET /api/audit-logs
 * Filters: actor_user_id, collection_name, action, dateFrom, dateTo, page, limit
 * Admin only — enforced on the route.
 */
const getAuditLogs = asyncHandler(async (req, res) => {
  const clinic = await clinicDb.getDefaultClinic()
  const { actor_user_id, collection_name, action, dateFrom, dateTo, page = 1, limit = 50 } = req.query

  const result = await auditLogDb.findAll({
    clinic_id: clinic.id,
    actor_user_id,
    collection_name,
    action,
    dateFrom,
    dateTo,
    page,
    limit,
  })

  return new ApiResponse(200, result, 'Audit logs fetched').send(res)
})

module.exports = { getAuditLogs }
