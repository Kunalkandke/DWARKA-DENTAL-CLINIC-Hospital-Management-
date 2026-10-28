const express = require('express')
const { authMiddleware } = require('../middleware/authMiddleware')

const authRoutes = require('./auth.routes')
const patientRoutes = require('./patient.routes')
const appointmentRoutes = require('./appointment.routes')
const paymentRoutes = require('./payment.routes')
const clinicalRoutes = require('./clinical.routes')
const aiRoutes = require('./ai.routes')
const categoryRoutes = require('./treatment-category.routes')

const { statsDb, appointmentDb, patientDb } = require('../db')
const asyncHandler = require('../middleware/asyncHandler')
const ApiResponse = require('../utils/ApiResponse')

const router = express.Router()

// ─── Public routes ────────────────────────────────────────────────────────────
router.use('/auth', authRoutes)

// ─── Protected routes — all require valid JWT ─────────────────────────────────
router.use('/categories', categoryRoutes) // has own authMiddleware inside
router.use('/patients', authMiddleware, patientRoutes)
router.use('/appointments', authMiddleware, appointmentRoutes)
router.use('/payments', authMiddleware, paymentRoutes)
router.use('/clinical', authMiddleware, clinicalRoutes)
router.use('/ai', authMiddleware, aiRoutes)

// ─── Admin: Dashboard aggregation stats ───────────────────────────────────────
router.get('/stats/dashboard', authMiddleware, asyncHandler(async (req, res) => {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)

  const counts = await statsDb.getDashboardCounts(todayStart, todayEnd)
  const todayRevenuePaise = await statsDb.getTodayRevenue(todayStart, todayEnd)
  const totalRevenuePaise = await statsDb.getTotalRevenue()
  const categoryAgg = await statsDb.getCategoryBreakdown()

  const treatmentCategoryService = require('../services/treatment-category.service')
  const allCategories = await treatmentCategoryService.getCategories({ status: 'active' })

  const catMap = Object.fromEntries(categoryAgg.map(c => [c.treatment_category_id, c.count]))

  const categoryBreakdown = allCategories.map(cat => ({
    id: cat.id,
    name: cat.name,
    code: cat.code,
    count: catMap[cat.id] || 0,
  })).sort((a, b) => b.count - a.count)

  return new ApiResponse(200, {
    totalPatients: counts.total_patients,
    todayAppointments: counts.today_appointments,
    missedAppointments: counts.missed_appointments,
    upcomingAppointments: counts.upcoming_appointments,
    completedAppointments: counts.completed_appointments,
    todayRevenue: todayRevenuePaise / 100,
    totalRevenue: totalRevenuePaise / 100,
    categoryBreakdown,
  }, 'Dashboard stats fetched').send(res)
}))

// ─── WhatsApp reminder dispatch ────────────────────────────────────────────────
const { sendWhatsAppReminder } = require('../utils/whatsapp')

router.post('/notifications/send-reminders', authMiddleware, asyncHandler(async (req, res) => {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().split('T')[0]

  const tomorrowStart = new Date(`${tomorrowStr}T00:00:00.000Z`)
  const tomorrowEnd = new Date(`${tomorrowStr}T23:59:59.999Z`)

  const appointments = await appointmentDb.findRemindersToSend(tomorrowStart, tomorrowEnd)

  const results = []
  for (const apt of appointments) {
    const patient = await patientDb.findById(apt.patient_id)
    if (patient && patient.phone) {
      const startAt = new Date(apt.start_at)
      const reminderResult = await sendWhatsAppReminder({
        phone: patient.phone,
        patientName: patient.name,
        date: startAt.toISOString().split('T')[0],
        time: startAt.toTimeString().slice(0, 5),
        doctorName: 'Doctor',
      })
      // Mark reminder as sent to prevent duplicates
      await appointmentDb.updateStatus(apt.id, {
        reminder_sent: true,
        reminder_sent_at: new Date().toISOString(),
      })
      results.push({ patientName: patient.name, phone: patient.phone, ...reminderResult })
    }
  }

  return new ApiResponse(200, { processedCount: results.length, details: results }, 'Reminders dispatched').send(res)
}))

module.exports = router
