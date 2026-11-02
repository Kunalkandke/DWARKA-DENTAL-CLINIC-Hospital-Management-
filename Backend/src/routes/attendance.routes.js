const express = require('express')
const router = express.Router()
const multer = require('multer')
const attendanceController = require('../controllers/attendance.controller')
const { authMiddleware, requireRole, requirePermission } = require('../middleware/authMiddleware')

// Multer config for file upload (in-memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['text/csv', 'application/vnd.ms-excel', 'application/csv']
    if (allowedMimes.includes(file.mimetype) || file.originalname.endsWith('.csv')) {
      cb(null, true)
    } else {
      cb(new Error('Only CSV files are allowed'))
    }
  },
})

// All routes require admin authentication + attendance permission
router.use(requireRole('admin'))
router.use(requirePermission('attendance', 'view'))

/**
 * GET /api/attendance
 * List attendance with filters (date, dateRange, userId, status, pagination)
 */
router.get('/', attendanceController.getAttendance)

/**
 * GET /api/attendance/calendar
 * Calendar view for a month (query: month=YYYY-MM, userId=optional)
 */
router.get('/calendar', attendanceController.getCalendar)

/**
 * GET /api/attendance/stats
 * Attendance statistics (query: startDate, endDate, userId)
 */
router.get('/stats', attendanceController.getStats)

/**
 * GET /api/attendance/export
 * Export to Excel (query: startDate, endDate, userId, format=excel)
 */
router.get('/export', requirePermission('attendance', 'export'), attendanceController.exportExcel)

/**
 * POST /api/attendance
 * Mark attendance (single or bulk)
 * Body (single): { userId, attendanceDate, status, checkInTime, checkOutTime, notes }
 * Body (bulk): { attendanceDate, bulkStatus, checkInTime, checkOutTime, userIds: ['uuid'] or 'all' }
 */
router.post('/', requirePermission('attendance', 'mark'), attendanceController.markAttendance)

/**
 * POST /api/attendance/import
 * Import attendance from CSV file
 * File: multipart/form-data, field name: 'file'
 */
router.post('/import', requirePermission('attendance', 'import'), upload.single('file'), attendanceController.importCSV)

/**
 * PUT /api/attendance/:id
 * Update attendance record
 */
router.put('/:id', requirePermission('attendance', 'mark'), attendanceController.updateAttendance)

/**
 * DELETE /api/attendance/:id
 * Delete attendance record
 */
router.delete('/:id', requirePermission('attendance', 'mark'), attendanceController.deleteAttendance)

module.exports = router
