const { chairDb, clinicDb } = require('../db')
const ApiResponse = require('../utils/ApiResponse')
const ApiError = require('../utils/ApiError')
const asyncHandler = require('../middleware/asyncHandler')
const auditService = require('../services/audit.service')

const getChairs = asyncHandler(async (req, res) => {
  const clinic = await clinicDb.getDefaultClinic()
  const chairs = await chairDb.findAll(clinic.id, { status: req.query.status })
  return new ApiResponse(200, { chairs }, 'Chairs fetched').send(res)
})

const createChair = asyncHandler(async (req, res) => {
  const clinic = await clinicDb.getDefaultClinic()
  const { name, status = 'active' } = req.body
  if (!name) throw ApiError.badRequest('Chair name is required.')
  const chair = await chairDb.create({ clinic_id: clinic.id, name: name.trim(), status })
  await auditService.log({ actorUserId: req.user?.id, action: 'create', collectionName: 'chairs', documentId: chair.id, after: chair, ip: req.ip, userAgent: req.headers['user-agent'] })
  return new ApiResponse(201, { chair }, 'Chair created').send(res)
})

const updateChair = asyncHandler(async (req, res) => {
  const { name, status } = req.body
  const fields = {}
  if (name) fields.name = name.trim()
  if (status) fields.status = status
  const chair = await chairDb.update(req.params.id, fields)
  return new ApiResponse(200, { chair }, 'Chair updated').send(res)
})

const deleteChair = asyncHandler(async (req, res) => {
  await chairDb.remove(req.params.id)
  return new ApiResponse(200, null, 'Chair deleted').send(res)
})

module.exports = { getChairs, createChair, updateChair, deleteChair }
