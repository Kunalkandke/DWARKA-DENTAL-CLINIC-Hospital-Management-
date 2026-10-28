const attendanceService = require('../services/attendance.service')
const ApiResponse = require('../utils/ApiResponse')
const ApiError = require('../utils/ApiError')
const asyncHandler = require('../middleware/asyncHandler')

/** GET /api/attendance - List attendance with filters */
const getAttendance = asyncHandler(async (req, res) => {
  const result = await attendanceService.getAttendance(req.query, req.user)
  return new ApiResponse(200, result, 'Attendance fetched').send(res)
})

/** GET /api/attendance/calendar - Calendar view for a month */
const getCalendar = asyncHandler(async (req, res) => {
  const { month, userId } = req.query
  if (!month) throw ApiError.badRequest('Month parameter required (format: YYYY-MM)')
  
  const result = await attendanceService.getCalendarView(month, userId)
  return new ApiResponse(200, result, 'Calendar data fetched').send(res)
})

/** GET /api/attendance/stats - Attendance statistics */
const getStats = asyncHandler(async (req, res) => {
  const result = await attendanceService.getStatistics(req.query)
  return new ApiResponse(200, result, 'Statistics fetched').send(res)
})

/** POST /api/attendance - Mark attendance (single or bulk) */
const markAttendance = asyncHandler(async (req, res) => {
  const result = await attendanceService.markAttendance(req.body, req.user, req)
  return new ApiResponse(201, result, 'Attendance marked').send(res)
})

/** PUT /api/attendance/:id - Update attendance */
const updateAttendance = asyncHandler(async (req, res) => {
  const result = await attendanceService.updateAttendance(req.params.id, req.body, req.user, req)
  return new ApiResponse(200, result, 'Attendance updated').send(res)
})

/** DELETE /api/attendance/:id - Delete attendance */
const deleteAttendance = asyncHandler(async (req, res) => {
  await attendanceService.deleteAttendance(req.params.id, req.user, req)
  return new ApiResponse(200, null, 'Attendance deleted').send(res)
})

/** POST /api/attendance/import - Import from CSV */
const importCSV = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('No file uploaded')
  
  const result = await attendanceService.importFromCSV(req.file, req.user)
  return new ApiResponse(200, result, result.message).send(res)
})

/** GET /api/attendance/export - Export to Excel */
const exportExcel = asyncHandler(async (req, res) => {
  const buffer = await attendanceService.exportToExcel(req.query)
  
  const { startDate, endDate } = req.query
  const filename = `attendance_${startDate || 'all'}_to_${endDate || 'all'}.xlsx`
  
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  res.send(buffer)
})

module.exports = {
  getAttendance,
  getCalendar,
  getStats,
  markAttendance,
  updateAttendance,
  deleteAttendance,
  importCSV,
  exportExcel,
}
