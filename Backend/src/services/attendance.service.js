const { attendanceDb, userDb, clinicDb } = require('../db')
const ApiError = require('../utils/ApiError')
const auditService = require('./audit.service')
const ExcelJS = require('exceljs')
const csvParser = require('csv-parser')
const { Readable } = require('stream')

/**
 * Get attendance records with filters
 */
async function getAttendance(query = {}, requestingUser) {
  const clinic = await clinicDb.getDefaultClinic()
  const filters = {
    ...query,
    clinicId: clinic.id,
  }

  const { data, total } = await attendanceDb.findAll(filters)

  return {
    data: data.map(toFrontendShape),
    pagination: {
      page: parseInt(query.page) || 1,
      limit: parseInt(query.limit) || 50,
      total,
      totalPages: Math.ceil(total / (parseInt(query.limit) || 50)),
    },
  }
}

/**
 * Get calendar view for a month
 */
async function getCalendarView(month, userId = null) {
  const clinic = await clinicDb.getDefaultClinic()
  const staffData = await attendanceDb.findCalendar(month, clinic.id, userId)

  return {
    month,
    staff: staffData,
  }
}

/**
 * Mark attendance (single or bulk)
 */
async function markAttendance(body, requestingUser, req = null) {
  const clinic = await clinicDb.getDefaultClinic()

  // Bulk marking (all staff for a day)
  if (body.bulkStatus && body.attendanceDate) {
    const userIds = body.userIds === 'all'
      ? (await userDb.findAllStaff()).filter(u => u.status === 'active' && u.clinic_id === clinic.id).map(u => u.id)
      : body.userIds

    const payloads = userIds.map(userId => ({
      clinic_id: clinic.id,
      user_id: userId,
      attendance_date: body.attendanceDate,
      status: body.bulkStatus,
      check_in_time: body.checkInTime || null,
      check_out_time: body.checkOutTime || null,
      notes: body.notes || '',
      marked_by_id: requestingUser.id,
    }))

    const created = await attendanceDb.bulkUpsert(payloads)

    // Audit log
    auditService.log({
      action: 'attendance.bulk_mark',
      userId: requestingUser?.id,
      entityType: 'attendance',
      entityId: null,
      changes: { date: body.attendanceDate, count: created.length, status: body.bulkStatus },
      ipAddress: req?.ip,
      userAgent: req?.get('user-agent'),
    })

    return {
      success: true,
      message: `Attendance marked for ${created.length} staff members`,
      data: { created: created.length, updated: 0 },
    }
  }

  // Single marking
  const { userId, attendanceDate, status, checkInTime, checkOutTime, notes } = body

  // Check if already exists
  const existing = await attendanceDb.findByUserAndDate(userId, attendanceDate)

  let record
  if (existing) {
    // Update existing
    record = await attendanceDb.update(existing.id, {
      status,
      check_in_time: checkInTime || null,
      check_out_time: checkOutTime || null,
      notes: notes || '',
      marked_by_id: requestingUser.id,
    })
  } else {
    // Create new
    record = await attendanceDb.create({
      clinic_id: clinic.id,
      user_id: userId,
      attendance_date: attendanceDate,
      status,
      check_in_time: checkInTime || null,
      check_out_time: checkOutTime || null,
      notes: notes || '',
      marked_by_id: requestingUser.id,
    })
  }

  // Audit log
  auditService.log({
    action: existing ? 'attendance.update' : 'attendance.create',
    userId: requestingUser?.id,
    entityType: 'attendance',
    entityId: record.id,
    changes: { user_id: userId, date: attendanceDate, status },
    ipAddress: req?.ip,
    userAgent: req?.get('user-agent'),
  })

  return toFrontendShape(record)
}

/**
 * Update attendance
 */
async function updateAttendance(id, body, requestingUser, req = null) {
  const record = await attendanceDb.update(id, {
    ...body,
    marked_by_id: requestingUser.id,
  })

  // Audit log
  auditService.log({
    action: 'attendance.update',
    userId: requestingUser?.id,
    entityType: 'attendance',
    entityId: id,
    changes: body,
    ipAddress: req?.ip,
    userAgent: req?.get('user-agent'),
  })

  return toFrontendShape(record)
}

/**
 * Delete attendance
 */
async function deleteAttendance(id, requestingUser, req = null) {
  await attendanceDb.remove(id)

  // Audit log
  auditService.log({
    action: 'attendance.delete',
    userId: requestingUser?.id,
    entityType: 'attendance',
    entityId: id,
    changes: {},
    ipAddress: req?.ip,
    userAgent: req?.get('user-agent'),
  })

  return { success: true }
}

/**
 * Import attendance from CSV file
 * CSV Format: Date,Staff Email,Status,Check In,Check Out,Notes
 */
async function importFromCSV(file, requestingUser) {
  const clinic = await clinicDb.getDefaultClinic()
  const results = { total: 0, imported: 0, skipped: 0, errors: [] }

  // Fetch all staff emails for lookup
  const staff = await userDb.findAllStaff()
  const activeStaff = staff.filter(u => u.status === 'active' && u.clinic_id === clinic.id)
  const emailMap = new Map(activeStaff.map(u => [u.email.toLowerCase(), u.id]))

  return new Promise((resolve, reject) => {
    const records = []
    const stream = Readable.from(file.buffer.toString('utf-8'))

    stream
      .pipe(csvParser())
      .on('data', (row) => {
        results.total++
        const rowNum = results.total

        // Validate row
        const date = row.Date || row.date
        const email = (row['Staff Email'] || row.email || '').toLowerCase().trim()
        const status = (row.Status || row.status || 'present').toLowerCase()
        const checkIn = row['Check In'] || row.checkIn || row.check_in || null
        const checkOut = row['Check Out'] || row.checkOut || row.check_out || null
        const notes = row.Notes || row.notes || ''

        if (!date || !email) {
          results.errors.push({ row: rowNum, error: 'Missing date or email' })
          results.skipped++
          return
        }

        const userId = emailMap.get(email)
        if (!userId) {
          results.errors.push({ row: rowNum, error: `Staff not found: ${email}` })
          results.skipped++
          return
        }

        if (!['present', 'absent', 'half_day', 'leave', 'holiday'].includes(status)) {
          results.errors.push({ row: rowNum, error: `Invalid status: ${status}` })
          results.skipped++
          return
        }

        records.push({
          clinic_id: clinic.id,
          user_id: userId,
          attendance_date: date,
          status,
          check_in_time: checkIn || null,
          check_out_time: checkOut || null,
          notes,
          marked_by_id: requestingUser.id,
        })
      })
      .on('end', async () => {
        try {
          if (records.length > 0) {
            const imported = await attendanceDb.bulkUpsert(records)
            results.imported = imported.length

            // Audit log
            auditService.log({
              action: 'attendance.import',
              userId: requestingUser?.id,
              entityType: 'attendance',
              entityId: null,
              changes: { count: results.imported },
            })
          }

          resolve({
            success: true,
            message: `Imported ${results.imported} attendance records`,
            summary: results,
          })
        } catch (err) {
          reject(new Error(`Import failed: ${err.message}`))
        }
      })
      .on('error', (err) => {
        reject(new Error(`CSV parsing error: ${err.message}`))
      })
  })
}

/**
 * Export attendance to Excel
 */
async function exportToExcel(filters = {}) {
  const clinic = await clinicDb.getDefaultClinic()
  const { startDate, endDate, userId } = filters

  // Fetch attendance data
  const { data } = await attendanceDb.findAll({
    clinicId: clinic.id,
    startDate,
    endDate,
    userId,
    limit: 10000, // Large limit for export
  })

  // Create workbook
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Dwarka Dental Clinic'
  workbook.created = new Date()

  // Sheet 1: Daily Attendance
  const sheet1 = workbook.addWorksheet('Daily Attendance')
  sheet1.columns = [
    { header: 'Date', key: 'date', width: 12 },
    { header: 'Staff Name', key: 'name', width: 25 },
    { header: 'Role', key: 'role', width: 15 },
    { header: 'Status', key: 'status', width: 12 },
    { header: 'Check In', key: 'checkIn', width: 10 },
    { header: 'Check Out', key: 'checkOut', width: 10 },
    { header: 'Hours', key: 'hours', width: 8 },
    { header: 'Notes', key: 'notes', width: 30 },
  ]

  data.forEach(record => {
    sheet1.addRow({
      date: record.attendance_date,
      name: record.user?.name || '',
      role: record.user?.role || '',
      status: record.status,
      checkIn: record.check_in_time || '',
      checkOut: record.check_out_time || '',
      hours: record.working_hours || 0,
      notes: record.notes || '',
    })
  })

  // Style header row
  sheet1.getRow(1).font = { bold: true }
  sheet1.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFD3D3D3' },
  }

  // Sheet 2: Monthly Summary
  const stats = await attendanceDb.getStats({ clinicId: clinic.id, startDate, endDate, userId })
  const sheet2 = workbook.addWorksheet('Summary')
  sheet2.columns = [
    { header: 'Staff Name', key: 'name', width: 25 },
    { header: 'Role', key: 'role', width: 15 },
    { header: 'Present', key: 'present', width: 10 },
    { header: 'Absent', key: 'absent', width: 10 },
    { header: 'Leave', key: 'leave', width: 10 },
    { header: 'Half Day', key: 'halfDay', width: 10 },
    { header: 'Total Hours', key: 'totalHours', width: 12 },
    { header: 'Attendance %', key: 'attendanceRate', width: 12 },
  ]

  stats.byStaff.forEach(staff => {
    sheet2.addRow({
      name: staff.name,
      role: staff.role,
      present: staff.present,
      absent: staff.absent,
      leave: staff.leave,
      halfDay: staff.halfDay,
      totalHours: staff.totalHours.toFixed(2),
      attendanceRate: staff.attendanceRate.toFixed(2) + '%',
    })
  })

  sheet2.getRow(1).font = { bold: true }
  sheet2.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFD3D3D3' },
  }

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer()
  return buffer
}

/**
 * Get attendance statistics
 */
async function getStatistics(filters = {}) {
  const clinic = await clinicDb.getDefaultClinic()
  const stats = await attendanceDb.getStats({ ...filters, clinicId: clinic.id })

  return {
    period: `${filters.startDate || 'All'} to ${filters.endDate || 'All'}`,
    stats: stats.overall,
    byStaff: stats.byStaff,
  }
}

// Helper: Convert DB record to frontend shape
function toFrontendShape(record) {
  return {
    id: record.id,
    user: record.user
      ? {
          id: record.user.id,
          name: record.user.name,
          email: record.user.email,
          role: record.user.role,
        }
      : null,
    attendanceDate: record.attendance_date,
    status: record.status,
    checkInTime: record.check_in_time,
    checkOutTime: record.check_out_time,
    workingHours: record.working_hours,
    notes: record.notes,
    markedBy: record.marked_by
      ? { id: record.marked_by.id, name: record.marked_by.name }
      : null,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  }
}

module.exports = {
  getAttendance,
  getCalendarView,
  markAttendance,
  updateAttendance,
  deleteAttendance,
  importFromCSV,
  exportToExcel,
  getStatistics,
}
