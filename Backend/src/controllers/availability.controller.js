const { doctorAvailabilityDb, doctorBlockDb, clinicDb } = require('../db')
const ApiResponse = require('../utils/ApiResponse')
const ApiError = require('../utils/ApiError')
const asyncHandler = require('../middleware/asyncHandler')
const auditService = require('../services/audit.service')

// ─── Doctor Availability ──────────────────────────────────────────────────────

const getAvailability = asyncHandler(async (req, res) => {
  const { doctorId } = req.params
  const slots = await doctorAvailabilityDb.findByDoctor(doctorId)
  return new ApiResponse(200, { availability: slots }, 'Availability fetched').send(res)
})

const createAvailability = asyncHandler(async (req, res) => {
  const clinic = await clinicDb.getDefaultClinic()
  const { doctorId } = req.params
  const { day_of_week, start_time, end_time, effective_from, effective_to, is_active, chair_id, slot_length, break_windows, max_patients_per_day } = req.body

  if (day_of_week === undefined || !start_time || !end_time || !effective_from) {
    throw ApiError.badRequest('day_of_week, start_time, end_time, and effective_from are required.')
  }

  const slot = await doctorAvailabilityDb.create({
    clinic_id: clinic.id,
    doctor_id: doctorId,
    day_of_week,
    start_time,
    end_time,
    effective_from,
    effective_to: effective_to || null,
    is_active: is_active !== false,
    chair_id: chair_id || null,
    slot_length: slot_length || 30,
    break_windows: break_windows || [],
    max_patients_per_day: max_patients_per_day || null,
  })

  await auditService.log({ actorUserId: req.user?.id, action: 'create', collectionName: 'doctor_availability', documentId: slot.id, after: slot, ip: req.ip, userAgent: req.headers['user-agent'] })
  return new ApiResponse(201, { slot }, 'Availability slot created').send(res)
})

const updateAvailability = asyncHandler(async (req, res) => {
  const { id } = req.params
  const fields = {}
  const allowed = ['day_of_week','start_time','end_time','effective_from','effective_to','is_active','chair_id','slot_length','break_windows','max_patients_per_day']
  for (const k of allowed) if (req.body[k] !== undefined) fields[k] = req.body[k]
  const slot = await doctorAvailabilityDb.update(id, fields)
  return new ApiResponse(200, { slot }, 'Availability updated').send(res)
})

const deleteAvailability = asyncHandler(async (req, res) => {
  await doctorAvailabilityDb.remove(req.params.id)
  return new ApiResponse(200, null, 'Availability slot removed').send(res)
})

// ─── Doctor Blocks (leave / unavailability) ───────────────────────────────────

const getBlocks = asyncHandler(async (req, res) => {
  const { doctorId } = req.params
  const blocks = await doctorBlockDb.findByDoctor(doctorId)
  return new ApiResponse(200, { blocks }, 'Doctor blocks fetched').send(res)
})

const createBlock = asyncHandler(async (req, res) => {
  const clinic = await clinicDb.getDefaultClinic()
  const { doctorId } = req.params
  const { start_at, end_at, reason } = req.body
  if (!start_at || !end_at) throw ApiError.badRequest('start_at and end_at are required.')
  if (new Date(end_at) <= new Date(start_at)) throw ApiError.badRequest('end_at must be after start_at.')

  const block = await doctorBlockDb.create({
    clinic_id: clinic.id,
    doctor_id: doctorId,
    start_at: new Date(start_at).toISOString(),
    end_at: new Date(end_at).toISOString(),
    reason: reason || '',
  })
  await auditService.log({ actorUserId: req.user?.id, action: 'create', collectionName: 'doctor_blocks', documentId: block.id, after: block, ip: req.ip, userAgent: req.headers['user-agent'] })
  return new ApiResponse(201, { block }, 'Doctor block created').send(res)
})

const deleteBlock = asyncHandler(async (req, res) => {
  await doctorBlockDb.remove(req.params.id)
  return new ApiResponse(200, null, 'Block removed').send(res)
})

module.exports = { getAvailability, createAvailability, updateAvailability, deleteAvailability, getBlocks, createBlock, deleteBlock }
