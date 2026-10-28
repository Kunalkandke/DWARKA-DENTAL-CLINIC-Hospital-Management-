const express = require('express')
const bcrypt = require('bcryptjs')
const rateLimit = require('express-rate-limit')
const authController = require('../controllers/auth.controller')
const validateRequest = require('../middleware/validateRequest')
const asyncHandler = require('../middleware/asyncHandler')
const { authMiddleware, requireRole } = require('../middleware/authMiddleware')
const { userDb, clinicDb } = require('../db')
const ApiResponse = require('../utils/ApiResponse')
const ApiError = require('../utils/ApiError')

const router = express.Router()

// ─── Password policy ──────────────────────────────────────────────────────────
function validatePassword(password) {
  if (!password || password.length < 8) return 'Password must be at least 8 characters.'
  if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter.'
  if (!/[0-9]/.test(password)) return 'Password must contain at least one digit.'
  return null // valid
}

// ─── Rate limiter for login ───────────────────────────────────────────────────
const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,                   // 10 attempts per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts from this IP. Please try again after 15 minutes.' },
})

// ─── Public: Login ────────────────────────────────────────────────────────────
router.post(
  '/login',
  loginRateLimiter,
  validateRequest({ email: { required: true, label: 'Email' }, password: { required: true, label: 'Password' } }),
  authController.login,
)

// ─── Public: Refresh + Logout ────────────────────────────────────────────────
router.post('/refresh', authController.refresh)
router.post('/logout', authController.logout)

// ─── Authenticated: /me ───────────────────────────────────────────────────────
router.get('/me', authController.me)

// ─── Doctors list (any authenticated role — for dropdowns) ────────────────────
router.get('/doctors', authMiddleware, asyncHandler(async (req, res) => {
  const doctors = await userDb.findDoctors({ status: 'active' })
  return new ApiResponse(200, doctors.map((d) => ({
    id: d.id,
    name: d.name,
    email: d.email,
    specialization: d.specialization || '',
    phone: d.phone || '',
  })), 'Doctors fetched').send(res)
}))

// ─── Staff list — Admin only ──────────────────────────────────────────────────
router.get('/staff', authMiddleware, requireRole('admin'), asyncHandler(async (req, res) => {
  const staff = await userDb.findAllStaff()
  return new ApiResponse(200, staff.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    specialization: u.specialization || '',
    phone: u.phone || '',
    status: u.status,
  })), 'Staff fetched').send(res)
}))

// ─── Create staff — Admin only ────────────────────────────────────────────────
router.post('/staff', authMiddleware, requireRole('admin'), asyncHandler(async (req, res) => {
  const { name, email, role = 'receptionist', phone, specialization, password } = req.body
  if (!name || !email) throw ApiError.badRequest('Name and Email are required.')

  // Password policy — no weak defaults allowed
  const rawPassword = (password || '').trim()
  if (!rawPassword) throw ApiError.badRequest('Password is required for new staff accounts.')
  const policyErr = validatePassword(rawPassword)
  if (policyErr) throw ApiError.badRequest(policyErr)

  const normalizedEmail = email.toLowerCase().trim()
  const existing = await userDb.findByEmail(normalizedEmail)
  if (existing) throw ApiError.badRequest('User with this email already exists.')

  const clinic = await clinicDb.getDefaultClinic()
  const password_hash = await bcrypt.hash(rawPassword, 10)

  const newUser = await userDb.createUser({
    clinic_id: clinic.id,
    name: name.trim(),
    email: normalizedEmail,
    password_hash,
    role,
    phone: phone || '',
    specialization: specialization || '',
    status: 'active',
  })

  return new ApiResponse(201, {
    id: newUser.id,
    name: newUser.name,
    email: newUser.email,
    role: newUser.role,
    phone: newUser.phone,
    specialization: newUser.specialization,
  }, 'Staff member created successfully').send(res)
}))

// ─── Update staff — Admin only ────────────────────────────────────────────────
router.put('/staff/:id', authMiddleware, requireRole('admin'), asyncHandler(async (req, res) => {
  const { name, email, role, phone, specialization, status, password } = req.body
  const user = await userDb.findById(req.params.id)
  if (!user) throw ApiError.notFound('User not found.')

  const updateFields = {}
  if (name) updateFields.name = name.trim()
  if (email) updateFields.email = email.toLowerCase().trim()
  if (role) updateFields.role = role
  if (phone !== undefined) updateFields.phone = phone
  if (specialization !== undefined) updateFields.specialization = specialization
  if (status) updateFields.status = status

  if (password && password.trim().length > 0) {
    const policyErr = validatePassword(password.trim())
    if (policyErr) throw ApiError.badRequest(policyErr)
    updateFields.password_hash = await bcrypt.hash(password.trim(), 10)
  }

  const updated = await userDb.updateUser(user.id, updateFields)

  return new ApiResponse(200, {
    id: updated.id,
    name: updated.name,
    email: updated.email,
    role: updated.role,
    phone: updated.phone,
    specialization: updated.specialization,
    status: updated.status,
  }, 'Staff member updated successfully').send(res)
}))

module.exports = router
