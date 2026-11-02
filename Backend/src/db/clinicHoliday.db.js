const supabase = require('../config/supabase')

async function findAll(clinic_id) {
  const { data, error } = await supabase
    .from('clinic_holidays')
    .select('*')
    .eq('clinic_id', clinic_id)
    .order('holiday_date', { ascending: true })
  if (error) throw new Error(error.message)
  return data || []
}

/** Returns a holiday row covering the given date (including recurring annual ones). */
async function findForDate(clinic_id, dateStr /* YYYY-MM-DD */) {
  const monthDay = dateStr.slice(5) // MM-DD
  // Fetch all clinic holidays and filter in JS — PostgREST doesn't support substring() in .or()
  const { data, error } = await supabase
    .from('clinic_holidays')
    .select('*')
    .eq('clinic_id', clinic_id)
  if (error) throw new Error(error.message)

  if (!data || data.length === 0) return null

  const matched = data.find(h => {
    // Exact date match
    if (h.holiday_date === dateStr) return true
    // Recurring: compare month-day portion
    if (h.is_recurring) {
      const hMonthDay = String(h.holiday_date).slice(5)
      return hMonthDay === monthDay
    }
    return false
  })

  return matched || null
}

async function create(payload) {
  const { data, error } = await supabase
    .from('clinic_holidays')
    .insert([payload])
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}

async function update(id, fields) {
  const { data, error } = await supabase
    .from('clinic_holidays')
    .update(fields)
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}

async function remove(id) {
  const { error } = await supabase
    .from('clinic_holidays')
    .delete()
    .eq('id', id)
  if (error) throw new Error(error.message)
  return true
}

module.exports = { findAll, findForDate, create, update, remove }
