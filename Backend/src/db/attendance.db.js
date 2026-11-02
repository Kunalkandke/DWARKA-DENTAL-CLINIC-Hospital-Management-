const supabase = require('../config/supabase')

/**
 * Find all attendance records with filters and pagination
 * @param {object} filters - { date, startDate, endDate, userId, status, clinicId, page, limit, sortBy, sortOrder }
 */
async function findAll(filters = {}) {
  const {
    date,
    startDate,
    endDate,
    userId,
    status,
    clinicId,
    page = 1,
    limit = 50,
    sortBy = 'attendance_date',
    sortOrder = 'desc',
  } = filters

  const pageNum = Math.max(1, parseInt(page))
  const pageLimit = Math.min(1000, Math.max(1, parseInt(limit)))
  const from = (pageNum - 1) * pageLimit
  const to = from + pageLimit - 1

  let query = supabase
    .from('attendance')
    .select('*, user:users!attendance_user_id_fkey(id, name, email, role, phone), marked_by:users!attendance_marked_by_id_fkey(id, name)', { count: 'exact' })

  if (clinicId) query = query.eq('clinic_id', clinicId)
  if (userId) query = query.eq('user_id', userId)
  if (status) query = query.eq('status', status)
  if (date) query = query.eq('attendance_date', date)
  if (startDate) query = query.gte('attendance_date', startDate)
  if (endDate) query = query.lte('attendance_date', endDate)

  const ascending = sortOrder === 'asc'
  query = query.order(sortBy, { ascending }).range(from, to)

  const { data, error, count } = await query
  if (error) throw new Error(error.message)

  return { data: data || [], total: count || 0 }
}

/**
 * Get calendar view data for a month
 * Returns attendance grouped by user with daily status
 * @param {string} month - YYYY-MM format
 * @param {string} clinicId - clinic UUID
 * @param {string} userId - optional, specific user or all users
 */
async function findCalendar(month, clinicId, userId = null) {
  const startDate = `${month}-01`
  const endDate = new Date(month + '-01')
  endDate.setMonth(endDate.getMonth() + 1)
  endDate.setDate(0) // Last day of month
  const endDateStr = endDate.toISOString().split('T')[0]

  let userQuery = supabase
    .from('users')
    .select('id, name, email, role, phone')
    .eq('status', 'active')

  if (clinicId) userQuery = userQuery.eq('clinic_id', clinicId)
  if (userId) userQuery = userQuery.eq('id', userId)

  const { data: users, error: userError } = await userQuery
  if (userError) throw new Error(userError.message)

  // Fetch all attendance records for this month
  let attQuery = supabase
    .from('attendance')
    .select('*')
    .gte('attendance_date', startDate)
    .lte('attendance_date', endDateStr)

  if (clinicId) attQuery = attQuery.eq('clinic_id', clinicId)
  if (userId) attQuery = attQuery.eq('user_id', userId)

  const { data: records, error: attError } = await attQuery
  if (attError) throw new Error(attError.message)

  // Group by user
  const result = users.map(user => {
    const userRecords = records.filter(r => r.user_id === user.id)
    const attendance = {}
    const summary = {
      present: 0,
      absent: 0,
      leave: 0,
      halfDay: 0,
      holiday: 0,
      totalHours: 0,
    }

    userRecords.forEach(record => {
      attendance[record.attendance_date] = {
        id: record.id,
        status: record.status,
        checkInTime: record.check_in_time,
        checkOutTime: record.check_out_time,
        hours: record.working_hours || 0,
        notes: record.notes,
      }

      // Update summary
      if (record.status === 'present') summary.present++
      else if (record.status === 'absent') summary.absent++
      else if (record.status === 'leave') summary.leave++
      else if (record.status === 'half_day') summary.halfDay++
      else if (record.status === 'holiday') summary.holiday++

      summary.totalHours += record.working_hours || 0
    })

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      attendance,
      summary,
    }
  })

  return result
}

/**
 * Find single attendance record by ID
 */
async function findById(id) {
  const { data, error } = await supabase
    .from('attendance')
    .select('*, user:users!attendance_user_id_fkey(id, name, email, role), marked_by:users!attendance_marked_by_id_fkey(id, name)')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw new Error(error.message)
  }
  return data
}

/**
 * Find attendance for a specific user and date
 */
async function findByUserAndDate(userId, date) {
  const { data, error } = await supabase
    .from('attendance')
    .select('*')
    .eq('user_id', userId)
    .eq('attendance_date', date)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw new Error(error.message)
  }
  return data
}

/**
 * Create attendance record
 */
async function create(payload) {
  const { data, error } = await supabase
    .from('attendance')
    .insert([payload])
    .select('*, user:users!attendance_user_id_fkey(id, name, email, role)')
    .single()

  if (error) throw new Error(error.message)
  return data
}

/**
 * Bulk create attendance records (for bulk marking)
 */
async function bulkCreate(payloads) {
  const { data, error } = await supabase
    .from('attendance')
    .insert(payloads)
    .select('*')

  if (error) throw new Error(error.message)
  return data || []
}

/**
 * Bulk upsert (insert or update if exists)
 */
async function bulkUpsert(payloads) {
  const { data, error } = await supabase
    .from('attendance')
    .upsert(payloads, { onConflict: 'user_id,attendance_date' })
    .select('*')

  if (error) throw new Error(error.message)
  return data || []
}

/**
 * Update attendance record
 */
async function update(id, fields) {
  const { data, error } = await supabase
    .from('attendance')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*, user:users!attendance_user_id_fkey(id, name, email, role)')
    .single()

  if (error) throw new Error(error.message)
  return data
}

/**
 * Delete attendance record
 */
async function remove(id) {
  const { error } = await supabase
    .from('attendance')
    .delete()
    .eq('id', id)

  if (error) throw new Error(error.message)
  return true
}

/**
 * Get attendance statistics for a date range
 * @param {object} filters - { startDate, endDate, userId, clinicId }
 */
async function getStats(filters = {}) {
  const { startDate, endDate, userId, clinicId } = filters

  let query = supabase
    .from('attendance')
    .select('user_id, status, working_hours, user:users!attendance_user_id_fkey(id, name, role)')

  if (clinicId) query = query.eq('clinic_id', clinicId)
  if (userId) query = query.eq('user_id', userId)
  if (startDate) query = query.gte('attendance_date', startDate)
  if (endDate) query = query.lte('attendance_date', endDate)

  const { data, error } = await query
  if (error) throw new Error(error.message)

  // Calculate overall stats
  const overall = {
    present: 0,
    absent: 0,
    leave: 0,
    halfDay: 0,
    holiday: 0,
    totalHours: 0,
  }

  data.forEach(record => {
    if (record.status === 'present') overall.present++
    else if (record.status === 'absent') overall.absent++
    else if (record.status === 'leave') overall.leave++
    else if (record.status === 'half_day') overall.halfDay++
    else if (record.status === 'holiday') overall.holiday++

    overall.totalHours += record.working_hours || 0
  })

  // Group by staff
  const byStaff = {}
  data.forEach(record => {
    const uid = record.user_id
    if (!byStaff[uid]) {
      byStaff[uid] = {
        userId: uid,
        name: record.user?.name || 'Unknown',
        role: record.user?.role || '',
        present: 0,
        absent: 0,
        leave: 0,
        halfDay: 0,
        holiday: 0,
        totalHours: 0,
      }
    }

    if (record.status === 'present') byStaff[uid].present++
    else if (record.status === 'absent') byStaff[uid].absent++
    else if (record.status === 'leave') byStaff[uid].leave++
    else if (record.status === 'half_day') byStaff[uid].halfDay++
    else if (record.status === 'holiday') byStaff[uid].holiday++

    byStaff[uid].totalHours += record.working_hours || 0
  })

  // Calculate attendance rate per staff
  Object.values(byStaff).forEach(staff => {
    const workingDays = staff.present + staff.absent + staff.leave + staff.halfDay
    staff.attendanceRate = workingDays > 0
      ? Math.round(((staff.present + staff.halfDay * 0.5) / workingDays) * 100 * 100) / 100
      : 0
  })

  return {
    overall,
    byStaff: Object.values(byStaff),
  }
}

module.exports = {
  findAll,
  findCalendar,
  findById,
  findByUserAndDate,
  create,
  bulkCreate,
  bulkUpsert,
  update,
  remove,
  getStats,
}
