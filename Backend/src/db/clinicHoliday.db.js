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
  const { data, error } = await supabase
    .from('clinic_holidays')
    .select('*')
    .eq('clinic_id', clinic_id)
    .or(`holiday_date.eq.${dateStr},and(is_recurring.eq.true,substring(holiday_date::text,6,5).eq.${monthDay})`)
    .limit(1)
  if (error) throw new Error(error.message)
  return data && data.length > 0 ? data[0] : null
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
