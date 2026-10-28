const { treatmentCategoryDb, clinicDb } = require('../db')
const ApiError = require('../utils/ApiError')

/**
 * List treatment categories with optional search / filter / sort.
 * @param {object} query  { search, status, sortBy, sortOrder }
 */
async function getCategories(query = {}) {
  const clinic = await clinicDb.getDefaultClinic()
  const { search, status, sortBy = 'name', sortOrder = 'asc' } = query

  const sortField = {
    name: 'name',
    code: 'code',
    duration: 'default_duration_minutes',
    followup: 'default_follow_up_days',
    newest: 'created_at',
    oldest: 'created_at',
  }[sortBy] || 'name'

  const resolvedSortOrder = sortBy === 'oldest' ? 'asc' : sortOrder

  const filter = {
    clinic_id: clinic.id,
    sortBy: sortField,
    sortOrder: resolvedSortOrder,
  }
  if (search) filter.search = search
  if (status === 'active') filter.is_active = true
  if (status === 'inactive') filter.is_active = false

  const cats = await treatmentCategoryDb.findAll(filter)
  return cats.map(toShape)
}

/**
 * Create a treatment category.
 * @param {object} body  { name, code, defaultDurationMinutes, defaultFollowUpDays, isActive }
 */
async function createCategory(body) {
  const clinic = await clinicDb.getDefaultClinic()
  const { name, code, defaultDurationMinutes, defaultFollowUpDays, isActive } = body

  // Duplicate code check within clinic
  const existing = await treatmentCategoryDb.findByCode(code.toUpperCase())
  if (existing && existing.clinic_id === clinic.id) {
    throw ApiError.badRequest(`Treatment code "${code.toUpperCase()}" already exists.`)
  }

  const cat = await treatmentCategoryDb.create({
    clinic_id: clinic.id,
    name: name.trim(),
    code: code.trim().toUpperCase(),
    default_duration_minutes: defaultDurationMinutes || 30,
    default_follow_up_days: defaultFollowUpDays !== undefined ? defaultFollowUpDays : 30,
    is_active: isActive !== undefined ? isActive : true,
  })

  return toShape(cat)
}

/**
 * Update a treatment category.
 * @param {string} id   Category id
 * @param {object} body Fields to update
 */
async function updateCategory(id, body) {
  const existing = await treatmentCategoryDb.findById(id)
  if (!existing) throw ApiError.notFound('Treatment category not found.')

  const updateFields = {}
  if (body.name !== undefined) updateFields.name = body.name
  if (body.code !== undefined) updateFields.code = body.code.toUpperCase()
  if (body.defaultDurationMinutes !== undefined) updateFields.default_duration_minutes = body.defaultDurationMinutes
  if (body.defaultFollowUpDays !== undefined) updateFields.default_follow_up_days = body.defaultFollowUpDays
  if (body.isActive !== undefined) updateFields.is_active = body.isActive

  const cat = await treatmentCategoryDb.update(id, updateFields)
  return toShape(cat)
}

/**
 * Toggle active/inactive status.
 * @param {string}  id       Category id
 * @param {boolean} isActive New status
 */
async function toggleActive(id, isActive) {
  const existing = await treatmentCategoryDb.findById(id)
  if (!existing) throw ApiError.notFound('Treatment category not found.')
  const cat = await treatmentCategoryDb.toggleActive(id, isActive)
  return toShape(cat)
}

// ─── Shape ────────────────────────────────────────────────────────────────────
function toShape(c) {
  return {
    id: c.id,
    name: c.name,
    code: c.code,
    defaultDurationMinutes: c.default_duration_minutes || 30,
    defaultFollowUpDays: c.default_follow_up_days !== undefined ? c.default_follow_up_days : 30,
    isActive: c.is_active,
    createdAt: c.created_at,
  }
}

module.exports = { getCategories, createCategory, updateCategory, toggleActive }
