const supabase = require('../config/supabase')

/**
 * Returns 5 dashboard counts in a single RPC call (legacy — kept for compat).
 */
async function getDashboardCounts(todayStart, todayEnd) {
  const todayStartIso = todayStart instanceof Date ? todayStart.toISOString() : todayStart
  const todayEndIso = todayEnd instanceof Date ? todayEnd.toISOString() : todayEnd
  const nowIso = new Date().toISOString()

  const [
    totalPatientsResult,
    todayAppointmentsResult,
    missedAppointmentsResult,
    upcomingAppointmentsResult,
    completedAppointmentsResult,
  ] = await Promise.all([
    supabase.from('patients').select('id', { count: 'exact', head: true }).eq('is_deleted', false),
    supabase.from('appointments').select('id', { count: 'exact', head: true }).eq('is_deleted', false).gte('start_at', todayStartIso).lte('start_at', todayEndIso).not('status', 'eq', 'cancelled'),
    supabase.from('appointments').select('id', { count: 'exact', head: true }).eq('is_deleted', false).or(`status.eq.missed,and(start_at.lt.${todayStartIso},status.in.(scheduled,confirmed,arrived))`),
    supabase.from('appointments').select('id', { count: 'exact', head: true }).eq('is_deleted', false).gte('start_at', nowIso).in('status', ['scheduled', 'confirmed']),
    supabase.from('appointments').select('id', { count: 'exact', head: true }).eq('is_deleted', false).eq('status', 'completed'),
  ])

  if (totalPatientsResult.error) throw new Error(totalPatientsResult.error.message)
  if (todayAppointmentsResult.error) throw new Error(todayAppointmentsResult.error.message)
  if (missedAppointmentsResult.error) throw new Error(missedAppointmentsResult.error.message)
  if (upcomingAppointmentsResult.error) throw new Error(upcomingAppointmentsResult.error.message)
  if (completedAppointmentsResult.error) throw new Error(completedAppointmentsResult.error.message)

  return {
    total_patients: totalPatientsResult.count || 0,
    today_appointments: todayAppointmentsResult.count || 0,
    missed_appointments: missedAppointmentsResult.count || 0,
    upcoming_appointments: upcomingAppointmentsResult.count || 0,
    completed_appointments: completedAppointmentsResult.count || 0,
  }
}

async function getTodayRevenue(todayStart, todayEnd) {
  const startIso = todayStart instanceof Date ? todayStart.toISOString() : todayStart
  const endIso = todayEnd instanceof Date ? todayEnd.toISOString() : todayEnd
  const { data, error } = await supabase.from('payments').select('amount').eq('is_deleted', false).gte('paid_at', startIso).lte('paid_at', endIso)
  if (error) throw new Error(error.message)
  return (data || []).reduce((sum, row) => sum + (row.amount || 0), 0)
}

async function getTotalRevenue() {
  const { data, error } = await supabase.from('payments').select('amount').eq('is_deleted', false)
  if (error) throw new Error(error.message)
  return (data || []).reduce((sum, row) => sum + (row.amount || 0), 0)
}

async function getCategoryBreakdown() {
  const { data, error } = await supabase.from('appointments').select('treatment_category_id').eq('is_deleted', false).not('treatment_category_id', 'is', null)
  if (error) throw new Error(error.message)
  const counts = {}
  for (const row of data || []) {
    const catId = row.treatment_category_id
    counts[catId] = (counts[catId] || 0) + 1
  }
  return Object.entries(counts).map(([treatment_category_id, count]) => ({ treatment_category_id, count }))
}

// ─────────────────────────────────────────────────────────────────────────────
// ENHANCED DASHBOARD STATS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * All enhanced KPI metrics in one parallelised pass.
 * @param {string} dateFrom  ISO string — start of period (inclusive)
 * @param {string} dateTo    ISO string — end of period (inclusive, set to 23:59:59)
 * @param {string} todayStart  ISO string — start of today
 * @param {string} todayEnd    ISO string — end of today
 * @param {string} nowIso      ISO string — current moment
 */
async function getEnhancedDashboardStats({ dateFrom, dateTo, todayStart, todayEnd, nowIso }) {
  const [
    // Patient KPIs
    totalPatientsRes,
    newPatientsInPeriodRes,
    // Appointment KPIs
    todayAptsRes,
    completedAptsInPeriodRes,
    upcomingAptsRes,
    cancelledAptsInPeriodRes,
    noShowAptsInPeriodRes,
    // Financial KPIs
    todayCollectionsRes,
    periodCollectionsRes,
    outstandingDuesRes,
    avgBillRes,
    // Action center
    unreviewedAiRes,
    // Doctor performance base data
    doctorPerformanceAptsRes,
    // Payment method breakdown (period)
    periodPaymentsMethodRes,
  ] = await Promise.all([

    // Total registered patients (all time)
    supabase.from('patients').select('id', { count: 'exact', head: true }).eq('is_deleted', false),

    // New patients registered in period
    supabase.from('patients').select('id', { count: 'exact', head: true }).eq('is_deleted', false).gte('registered_at', dateFrom).lte('registered_at', dateTo),

    // Today's appointments (non-cancelled)
    supabase.from('appointments').select('id', { count: 'exact', head: true }).eq('is_deleted', false).gte('start_at', todayStart).lte('start_at', todayEnd).not('status', 'eq', 'cancelled'),

    // Completed appointments in period
    supabase.from('appointments').select('id', { count: 'exact', head: true }).eq('is_deleted', false).eq('status', 'completed').gte('start_at', dateFrom).lte('start_at', dateTo),

    // Upcoming appointments (from now)
    supabase.from('appointments').select('id', { count: 'exact', head: true }).eq('is_deleted', false).gte('start_at', nowIso).in('status', ['scheduled', 'confirmed']),

    // Cancelled appointments in period
    supabase.from('appointments').select('id', { count: 'exact', head: true }).eq('is_deleted', false).eq('status', 'cancelled').gte('start_at', dateFrom).lte('start_at', dateTo),

    // No-shows in period: missed OR past-due scheduled/confirmed
    supabase.from('appointments').select('id', { count: 'exact', head: true }).eq('is_deleted', false).or(`status.eq.missed,and(start_at.lt.${todayStart},status.in.(scheduled,confirmed,arrived))`).gte('start_at', dateFrom).lte('start_at', dateTo),

    // Today's collections (payments.amount in paise)
    supabase.from('payments').select('amount').eq('is_deleted', false).gte('paid_at', todayStart).lte('paid_at', todayEnd),

    // Period collections
    supabase.from('payments').select('amount').eq('is_deleted', false).gte('paid_at', dateFrom).lte('paid_at', dateTo),

    // Outstanding dues: invoices not cancelled, balance_due > 0
    supabase.from('invoices').select('balance_due').not('status', 'eq', 'cancelled').gt('balance_due', 0),

    // Average bill: all non-cancelled invoices total
    supabase.from('invoices').select('total').not('status', 'eq', 'cancelled').gt('total', 0),

    // Unreviewed AI reports
    supabase.from('ai_reports').select('id, patient_id, result, created_at, patient:patients!ai_reports_patient_id_fkey(id, name, patient_number)', { count: 'exact' }).is('doctor_review', null).order('created_at', { ascending: false }).limit(10),

    // Doctor performance: appointments in period with doctor info
    supabase.from('appointments')
      .select('doctor_id, status, duration_minutes, doctor:users!appointments_doctor_id_fkey(id, name, specialization), treatment_category:treatment_categories(id, name)')
      .eq('is_deleted', false)
      .gte('start_at', dateFrom)
      .lte('start_at', dateTo)
      .not('status', 'eq', 'cancelled'),

    // Payment method breakdown for period
    supabase.from('payments').select('method, amount').eq('is_deleted', false).gte('paid_at', dateFrom).lte('paid_at', dateTo),
  ])

  // Collect errors
  const errors = [
    totalPatientsRes, newPatientsInPeriodRes, todayAptsRes, completedAptsInPeriodRes,
    upcomingAptsRes, cancelledAptsInPeriodRes, noShowAptsInPeriodRes, todayCollectionsRes,
    periodCollectionsRes, outstandingDuesRes, avgBillRes, unreviewedAiRes,
    doctorPerformanceAptsRes, periodPaymentsMethodRes,
  ].filter(r => r.error)
  if (errors.length > 0) throw new Error(errors[0].error.message)

  // Aggregate collections (amounts in paise → will be divided at route level)
  const todayCollectionsPaise = (todayCollectionsRes.data || []).reduce((s, r) => s + (r.amount || 0), 0)
  const periodCollectionsPaise = (periodCollectionsRes.data || []).reduce((s, r) => s + (r.amount || 0), 0)

  // Outstanding dues (paise)
  const outstandingDuesPaise = (outstandingDuesRes.data || []).reduce((s, r) => s + (r.balance_due || 0), 0)

  // Average bill value (paise)
  const invoices = avgBillRes.data || []
  const avgBillPaise = invoices.length > 0
    ? Math.round(invoices.reduce((s, r) => s + (r.total || 0), 0) / invoices.length)
    : 0

  // Payment method breakdown (period)
  const methodMap = {}
  for (const row of periodPaymentsMethodRes.data || []) {
    const method = row.method || 'other'
    methodMap[method] = (methodMap[method] || 0) + (row.amount || 0)
  }
  const revenueByMethod = Object.entries(methodMap).map(([method, valuePaise]) => ({
    method,
    label: method.charAt(0).toUpperCase() + method.slice(1),
    value: Math.round(valuePaise / 100),
  }))

  // Doctor performance aggregation
  const doctorMap = {}
  for (const apt of doctorPerformanceAptsRes.data || []) {
    if (!apt.doctor) continue
    const docId = apt.doctor_id
    if (!doctorMap[docId]) {
      doctorMap[docId] = {
        doctorId: docId,
        doctorName: apt.doctor.name,
        specialization: apt.doctor.specialization || '',
        patientsCount: 0,
        completedVisits: 0,
        totalDurationMinutes: 0,
      }
    }
    doctorMap[docId].patientsCount++
    if (apt.status === 'completed') {
      doctorMap[docId].completedVisits++
      doctorMap[docId].totalDurationMinutes += apt.duration_minutes || 0
    }
  }
  const doctorPerformance = Object.values(doctorMap).map(d => ({
    ...d,
    avgDurationMinutes: d.completedVisits > 0 ? Math.round(d.totalDurationMinutes / d.completedVisits) : 0,
  })).sort((a, b) => b.completedVisits - a.completedVisits)

  // Unreviewed AI reports
  const unreviewedAiReports = (unreviewedAiRes.data || []).map(r => ({
    id: r.id,
    patientId: r.patient_id,
    patientName: r.patient?.name || 'Unknown',
    patientNumber: r.patient?.patient_number || '',
    result: r.result,
    createdAt: r.created_at,
  }))

  return {
    // Patient KPIs
    totalPatients: totalPatientsRes.count || 0,
    newPatientsInPeriod: newPatientsInPeriodRes.count || 0,

    // Appointment KPIs
    todayAppointments: todayAptsRes.count || 0,
    completedAppointmentsInPeriod: completedAptsInPeriodRes.count || 0,
    upcomingAppointments: upcomingAptsRes.count || 0,
    cancelledAppointmentsInPeriod: cancelledAptsInPeriodRes.count || 0,
    noShowCount: noShowAptsInPeriodRes.count || 0,

    // Financial KPIs (in INR — divided from paise)
    todayCollections: Math.round(todayCollectionsPaise / 100),
    periodCollections: Math.round(periodCollectionsPaise / 100),
    outstandingDues: Math.round(outstandingDuesPaise / 100),
    avgBillValue: Math.round(avgBillPaise / 100),
    revenueByMethod,

    // Action center
    unreviewedAiReportsCount: unreviewedAiRes.count || 0,
    unreviewedAiReports,

    // Doctor performance
    doctorPerformance,
  }
}

/**
 * Revenue time-series: daily sums from payments for a date range.
 * Returns an array of { date: 'YYYY-MM-DD', amount: number (INR) }
 */
async function getRevenueTimeSeries(dateFrom, dateTo) {
  const { data, error } = await supabase
    .from('payments')
    .select('amount, paid_at')
    .eq('is_deleted', false)
    .gte('paid_at', dateFrom)
    .lte('paid_at', dateTo)
    .order('paid_at', { ascending: true })

  if (error) throw new Error(error.message)

  // Group by date (YYYY-MM-DD)
  const byDate = {}
  for (const row of data || []) {
    const d = row.paid_at ? row.paid_at.slice(0, 10) : null
    if (!d) continue
    byDate[d] = (byDate[d] || 0) + (row.amount || 0)
  }

  return Object.entries(byDate).map(([date, amountPaise]) => ({
    date,
    amount: Math.round(amountPaise / 100),
  }))
}

/**
 * Appointment time-series: daily appointment counts for a date range.
 */
async function getAppointmentTimeSeries(dateFrom, dateTo) {
  const { data, error } = await supabase
    .from('appointments')
    .select('start_at, status')
    .eq('is_deleted', false)
    .gte('start_at', dateFrom)
    .lte('start_at', dateTo)

  if (error) throw new Error(error.message)

  const byDate = {}
  for (const row of data || []) {
    const d = row.start_at ? row.start_at.slice(0, 10) : null
    if (!d) continue
    if (!byDate[d]) byDate[d] = { date: d, total: 0, completed: 0, cancelled: 0 }
    byDate[d].total++
    if (row.status === 'completed') byDate[d].completed++
    if (row.status === 'cancelled') byDate[d].cancelled++
  }

  return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * Today's live appointment queue with patient, doctor, chair info.
 */
async function getLiveQueueStats(todayStart, todayEnd) {
  const startIso = todayStart instanceof Date ? todayStart.toISOString() : todayStart
  const endIso = todayEnd instanceof Date ? todayEnd.toISOString() : todayEnd

  const { data, error } = await supabase
    .from('appointments')
    .select(
      '*, patient:patients!appointments_patient_id_fkey(id, name, patient_number, phone), doctor:users!appointments_doctor_id_fkey(id, name, specialization), treatment_category:treatment_categories(id, name, code)'
    )
    .eq('is_deleted', false)
    .gte('start_at', startIso)
    .lte('start_at', endIso)
    .not('status', 'eq', 'cancelled')
    .order('start_at', { ascending: true })

  if (error) throw new Error(error.message)

  const queue = (data || []).filter(a => a.patient && !a.patient.is_deleted)
  return queue
}

/**
 * Revenue by treatment category for a date range.
 */
async function getRevenueByCategory(dateFrom, dateTo) {
  // Get appointments in period with category
  const { data: apts, error: aptsErr } = await supabase
    .from('appointments')
    .select('id, treatment_category_id, treatment_category:treatment_categories(id, name, code)')
    .eq('is_deleted', false)
    .eq('status', 'completed')
    .gte('start_at', dateFrom)
    .lte('start_at', dateTo)
    .not('treatment_category_id', 'is', null)

  if (aptsErr) throw new Error(aptsErr.message)

  // Count by category
  const catMap = {}
  for (const apt of apts || []) {
    if (!apt.treatment_category) continue
    const catId = apt.treatment_category_id
    if (!catMap[catId]) {
      catMap[catId] = {
        id: catId,
        name: apt.treatment_category.name,
        code: apt.treatment_category.code,
        count: 0,
      }
    }
    catMap[catId].count++
  }

  return Object.values(catMap).sort((a, b) => b.count - a.count)
}

module.exports = {
  getDashboardCounts,
  getTodayRevenue,
  getTotalRevenue,
  getCategoryBreakdown,
  getEnhancedDashboardStats,
  getRevenueTimeSeries,
  getAppointmentTimeSeries,
  getLiveQueueStats,
  getRevenueByCategory,
}
