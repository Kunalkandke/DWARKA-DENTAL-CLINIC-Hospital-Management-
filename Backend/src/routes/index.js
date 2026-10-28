const express = require('express')
const { authMiddleware, requireRole } = require('../middleware/authMiddleware')

const authRoutes = require('./auth.routes')
const patientRoutes = require('./patient.routes')
const appointmentRoutes = require('./appointment.routes')
const paymentRoutes = require('./payment.routes')
const clinicalRoutes = require('./clinical.routes')
const aiRoutes = require('./ai.routes')
const categoryRoutes = require('./treatment-category.routes')
const auditRoutes = require('./audit.routes')
const settingsRoutes = require('./settings.routes')
const availabilityRoutes = require('./availability.routes')
const attendanceRoutes = require('./attendance.routes')

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
router.use('/audit-logs', authMiddleware, auditRoutes)
router.use('/settings', authMiddleware, settingsRoutes)
router.use('/availability', authMiddleware, availabilityRoutes)
router.use('/attendance', authMiddleware, attendanceRoutes)

// ─── Admin: Enhanced Dashboard Stats ─────────────────────────────────────────
/**
 * GET /api/stats/dashboard
 * Query params:
 *   dateFrom  — ISO date string (default: start of today)
 *   dateTo    — ISO date string (default: end of today)
 *   compare   — 'true' to include previous-period comparison
 *
 * Returns all dashboard KPIs, charts data, doctor performance, action centre.
 * Access: Admin and Receptionist only (backend-enforced).
 */
router.get(
  '/stats/dashboard',
  authMiddleware,
  requireRole('admin', 'receptionist'),
  asyncHandler(async (req, res) => {
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
    const nowIso = now.toISOString()

    // Resolve date range from query params (default: today)
    let dateFrom = todayStart.toISOString()
    let dateTo = todayEnd.toISOString()

    if (req.query.dateFrom) {
      const parsedFrom = new Date(req.query.dateFrom)
      if (!isNaN(parsedFrom.getTime())) {
        parsedFrom.setHours(0, 0, 0, 0)
        dateFrom = parsedFrom.toISOString()
      }
    }
    if (req.query.dateTo) {
      const parsedTo = new Date(req.query.dateTo)
      if (!isNaN(parsedTo.getTime())) {
        parsedTo.setHours(23, 59, 59, 999)
        dateTo = parsedTo.toISOString()
      }
    }

    // Calculate previous period of same duration for comparison
    const periodMs = new Date(dateTo).getTime() - new Date(dateFrom).getTime()
    const prevDateTo = new Date(new Date(dateFrom).getTime() - 1).toISOString()
    const prevDateFrom = new Date(new Date(dateFrom).getTime() - periodMs - 1).toISOString()

    const compareEnabled = req.query.compare === 'true'

    // Run all data fetches in parallel
    const [
      enhanced,
      revenueSeries,
      aptSeries,
      liveQueue,
      categoryRevenue,
      allCategories,
      prevPeriodData,
    ] = await Promise.all([
      statsDb.getEnhancedDashboardStats({
        dateFrom,
        dateTo,
        todayStart: todayStart.toISOString(),
        todayEnd: todayEnd.toISOString(),
        nowIso,
      }),
      statsDb.getRevenueTimeSeries(dateFrom, dateTo),
      statsDb.getAppointmentTimeSeries(dateFrom, dateTo),
      statsDb.getLiveQueueStats(todayStart, todayEnd),
      statsDb.getRevenueByCategory(dateFrom, dateTo),

      // Category names for breakdown
      (async () => {
        const treatmentCategoryService = require('../services/treatment-category.service')
        return treatmentCategoryService.getCategories({ status: 'active' })
      })(),

      // Previous period (only if compare=true)
      compareEnabled
        ? statsDb.getEnhancedDashboardStats({
            dateFrom: prevDateFrom,
            dateTo: prevDateTo,
            todayStart: todayStart.toISOString(),
            todayEnd: todayEnd.toISOString(),
            nowIso,
          })
        : Promise.resolve(null),
    ])

    // Legacy category breakdown (all time, for category tiles)
    const catAgg = await statsDb.getCategoryBreakdown()
    const catMap = Object.fromEntries(catAgg.map(c => [c.treatment_category_id, c.count]))
    const categoryBreakdown = allCategories.map(cat => ({
      id: cat.id,
      name: cat.name,
      code: cat.code,
      count: catMap[cat.id] || 0,
    })).sort((a, b) => b.count - a.count)

    // Period-over-period comparison helpers
    function pctChange(current, previous) {
      if (!previous || previous === 0) return current > 0 ? 100 : 0
      return Math.round(((current - previous) / previous) * 100)
    }

    const comparison = compareEnabled && prevPeriodData ? {
      totalPatients: pctChange(enhanced.totalPatients, prevPeriodData.totalPatients),
      newPatientsInPeriod: pctChange(enhanced.newPatientsInPeriod, prevPeriodData.newPatientsInPeriod),
      completedAppointmentsInPeriod: pctChange(enhanced.completedAppointmentsInPeriod, prevPeriodData.completedAppointmentsInPeriod),
      periodCollections: pctChange(enhanced.periodCollections, prevPeriodData.periodCollections),
      noShowCount: pctChange(enhanced.noShowCount, prevPeriodData.noShowCount),
    } : null

    // Live queue summary
    const liveStats = {
      waiting: liveQueue.filter(a => ['scheduled', 'confirmed'].includes(a.status) && new Date(a.start_at) <= now).length,
      inTreatment: liveQueue.filter(a => ['arrived', 'in_progress'].includes(a.status)).length,
      completed: liveQueue.filter(a => a.status === 'completed').length,
      queue: liveQueue.map(a => ({
        id: a.id,
        appointmentNumber: a.appointment_number,
        patientId: a.patient_id,
        patientName: a.patient?.name || 'Unknown',
        patientNumber: a.patient?.patient_number || '',
        patientPhone: a.patient?.phone || '',
        doctorId: a.doctor_id,
        doctorName: a.doctor?.name || 'Unknown',
        specialization: a.doctor?.specialization || '',
        categoryName: a.treatment_category?.name || 'General',
        categoryCode: a.treatment_category?.code || '',
        startAt: a.start_at,
        endAt: a.end_at,
        durationMinutes: a.duration_minutes,
        status: a.status,
        chairId: a.chair_id || null,
        priority: a.priority,
        notes: a.notes || '',
      })),
    }

    return new ApiResponse(200, {
      // KPI metrics
      totalPatients: enhanced.totalPatients,
      newPatientsInPeriod: enhanced.newPatientsInPeriod,
      todayAppointments: enhanced.todayAppointments,
      completedAppointmentsInPeriod: enhanced.completedAppointmentsInPeriod,
      upcomingAppointments: enhanced.upcomingAppointments,
      cancelledAppointmentsInPeriod: enhanced.cancelledAppointmentsInPeriod,
      noShowCount: enhanced.noShowCount,
      todayCollections: enhanced.todayCollections,
      periodCollections: enhanced.periodCollections,
      outstandingDues: enhanced.outstandingDues,
      avgBillValue: enhanced.avgBillValue,

      // Charts
      revenueTimeSeries: revenueSeries,
      appointmentTimeSeries: aptSeries,
      revenueByMethod: enhanced.revenueByMethod,
      categoryRevenue,
      categoryBreakdown,

      // Doctor performance
      doctorPerformance: enhanced.doctorPerformance,

      // Live operations
      liveQueue: liveStats,

      // Action centre
      unreviewedAiReportsCount: enhanced.unreviewedAiReportsCount,
      unreviewedAiReports: enhanced.unreviewedAiReports,

      // Period comparison (null if not requested)
      comparison,

      // Meta
      period: { dateFrom, dateTo },
      generatedAt: now.toISOString(),
    }, 'Dashboard stats fetched').send(res)
  })
)

// ─── WhatsApp reminder dispatch ────────────────────────────────────────────────
const { sendWhatsAppReminder } = require('../utils/whatsapp')

router.post('/notifications/send-reminders', authMiddleware, requireRole('admin', 'receptionist'), asyncHandler(async (req, res) => {
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
