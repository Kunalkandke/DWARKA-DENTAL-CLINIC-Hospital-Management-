const { auditLogDb, clinicDb } = require('../db')

/**
 * Central audit-log writer. Fire-and-forget: audit failures must NEVER break
 * the business operation that triggered them.
 *
 * @param {object} ctx  { actorUserId, action, collectionName, documentId, before, after, ip, userAgent }
 */
async function log(ctx) {
  try {
    let clinicId = ctx.clinicId
    if (!clinicId) {
      const clinic = await clinicDb.getDefaultClinic()
      clinicId = clinic?.id
    }
    await auditLogDb.create({
      clinic_id: clinicId,
      actor_user_id: ctx.actorUserId || null,
      action: ctx.action,                 // create | update | delete | login | export
      collection_name: ctx.collectionName,
      document_id: ctx.documentId ? String(ctx.documentId) : null,
      before: ctx.before ? JSON.parse(JSON.stringify(ctx.before)) : null,
      after: ctx.after ? JSON.parse(JSON.stringify(ctx.after)) : null,
      ip_address: ctx.ip || null,
      user_agent: ctx.userAgent || null,
    })
  } catch (err) {
    console.error('[audit] failed to write audit log:', err.message)
  }
}

module.exports = { log }
