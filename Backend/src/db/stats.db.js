const supabase = require('../config/supabase')

/**
 * Returns 5 dashboard counts in a single RPC call.
 * @param {string} todayStart  ISO string for start of today
 * @param {string} todayEnd    ISO string for end of today
 */
async function getDashboardCounts(todayStart, todayEnd) {
  const todayStartIso = todayStart instanceof Date ? todayStart.toISOString() : todayStart
  const todayEndIso = todayEnd instanceof Date ? todayEnd.toISOString() : todayEnd
  const nowIso = new Date().toISOString()

  // Run all 5 counts in parallel using Promise.all with separate Supabase queries
  const [
    totalPatientsResult,
    todayAppointmentsResult,
    missedAppointmentsResult,
    upcomingAppointmentsResult,
    completedAppointmentsResult,
  ] = await Promise.all([
    supabase
      .from('patients')
      .select('id', { count: 'exact', head: true })
      .eq('is_deleted', false),

    supabase
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('is_deleted', false)
      .gte('start_at', todayStartIso)
      .lte('start_at', todayEndIso)
      .not('status', 'eq', 'cancelled'),

    supabase
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('is_deleted', false)
      .or(`status.eq.missed,and(start_at.lt.${todayStartIso},status.in.(scheduled,confirmed,arrived))`),

    supabase
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('is_deleted', false)
      .gte('start_at', nowIso)
      .in('status', ['scheduled', 'confirmed']),

    supabase
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('is_deleted', false)
      .eq('status', 'completed'),
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

  const { data, error } = await supabase
    .from('payments')
    .select('amount')
    .eq('is_deleted', false)
    .gte('paid_at', startIso)
    .lte('paid_at', endIso)

  if (error) throw new Error(error.message)
  return (data || []).reduce((sum, row) => sum + (row.amount || 0), 0)
}

async function getTotalRevenue() {
  const { data, error } = await supabase
    .from('payments')
    .select('amount')
    .eq('is_deleted', false)

  if (error) throw new Error(error.message)
  return (data || []).reduce((sum, row) => sum + (row.amount || 0), 0)
}

async function getCategoryBreakdown() {
  const { data, error } = await supabase
    .from('appointments')
    .select('treatment_category_id')
    .eq('is_deleted', false)
    .not('treatment_category_id', 'is', null)

  if (error) throw new Error(error.message)

  // Aggregate in JS
  const counts = {}
  for (const row of data || []) {
    const catId = row.treatment_category_id
    counts[catId] = (counts[catId] || 0) + 1
  }

  return Object.entries(counts).map(([treatment_category_id, count]) => ({
    treatment_category_id,
    count,
  }))
}

module.exports = {
  getDashboardCounts,
  getTodayRevenue,
  getTotalRevenue,
  getCategoryBreakdown,
}
