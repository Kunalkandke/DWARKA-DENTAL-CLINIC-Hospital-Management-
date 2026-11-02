const { clinicSettingsDb, clinicHolidayDb, clinicDb } = require('../db')
const ApiResponse = require('../utils/ApiResponse')
const ApiError = require('../utils/ApiError')
const asyncHandler = require('../middleware/asyncHandler')
const auditService = require('../services/audit.service')

// ─── Clinic Settings ──────────────────────────────────────────────────────────

const getSettings = asyncHandler(async (req, res) => {
  const clinic = await clinicDb.getDefaultClinic()
  const row = await clinicSettingsDb.getByClinic(clinic.id)
  return new ApiResponse(200, { settings: row?.settings || {} }, 'Settings fetched').send(res)
})

const updateSettings = asyncHandler(async (req, res) => {
  const clinic = await clinicDb.getDefaultClinic()
  const current = await clinicSettingsDb.getByClinic(clinic.id)
  const merged = { ...(current?.settings || {}), ...req.body }
  const updated = await clinicSettingsDb.upsert(clinic.id, merged)

  await auditService.log({
    actorUserId: req.user?.id,
    action: 'update',
    collectionName: 'clinic_settings',
    documentId: clinic.id,
    before: current?.settings,
    after: merged,
    ip: req.headers['x-forwarded-for']?.split(',')[0] || req.ip,
    userAgent: req.headers['user-agent'],
  })

  return new ApiResponse(200, { settings: updated.settings }, 'Settings updated').send(res)
})

// ─── Clinic Holidays ──────────────────────────────────────────────────────────

const getHolidays = asyncHandler(async (req, res) => {
  const clinic = await clinicDb.getDefaultClinic()
  const holidays = await clinicHolidayDb.findAll(clinic.id)
  return new ApiResponse(200, { holidays }, 'Holidays fetched').send(res)
})

const createHoliday = asyncHandler(async (req, res) => {
  const clinic = await clinicDb.getDefaultClinic()
  const { holiday_date, reason, is_recurring } = req.body
  if (!holiday_date) throw ApiError.badRequest('holiday_date is required (YYYY-MM-DD).')
  const holiday = await clinicHolidayDb.create({
    clinic_id: clinic.id,
    holiday_date,
    reason: reason || '',
    is_recurring: !!is_recurring,
  })
  await auditService.log({ actorUserId: req.user?.id, action: 'create', collectionName: 'clinic_holidays', documentId: holiday.id, after: holiday, ip: req.ip, userAgent: req.headers['user-agent'] })
  return new ApiResponse(201, { holiday }, 'Holiday created').send(res)
})

const updateHoliday = asyncHandler(async (req, res) => {
  const { id } = req.params
  const { holiday_date, reason, is_recurring } = req.body
  const holiday = await clinicHolidayDb.update(id, { holiday_date, reason, is_recurring })
  return new ApiResponse(200, { holiday }, 'Holiday updated').send(res)
})

const deleteHoliday = asyncHandler(async (req, res) => {
  await clinicHolidayDb.remove(req.params.id)
  return new ApiResponse(200, null, 'Holiday deleted').send(res)
})

module.exports = { getSettings, updateSettings, getHolidays, createHoliday, updateHoliday, deleteHoliday }
