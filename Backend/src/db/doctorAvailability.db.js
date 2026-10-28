const supabase = require('../config/supabase')

async function findByDoctor(doctor_id) {
  const { data, error } = await supabase
    .from('doctor_availability')
    .select('*, chair:chairs(id, name)')
    .eq('doctor_id', doctor_id)
    .order('day_of_week', { ascending: true })
  if (error) throw new Error(error.message)
  return data || []
}

/** Active weekly availability rows for a doctor on a given day of week (e.g., 'monday'). */
async function findActiveForDoctorOnDate(doctor_id, dayOfWeekStr /* 'monday', 'tuesday', etc. */) {
  const dayMap = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 }
  const dayNum = dayMap[dayOfWeekStr.toLowerCase()]
  if (dayNum === undefined) return []

  const { data, error } = await supabase
    .from('doctor_availability')
    .select('*, chair:chairs(id, name)')
    .eq('doctor_id', doctor_id)
    .eq('day_of_week', dayNum)
    .eq('is_active', true)
  if (error) throw new Error(error.message)
  return data || []
}

async function create(payload) {
  const { data, error } = await supabase.from('doctor_availability').insert([payload]).select().single()
  if (error) throw new Error(error.message)
  return data
}

async function update(id, fields) {
  const { data, error } = await supabase.from('doctor_availability').update(fields).eq('id', id).select().single()
  if (error) throw new Error(error.message)
  return data
}

async function remove(id) {
  const { error } = await supabase.from('doctor_availability').delete().eq('id', id)
  if (error) throw new Error(error.message)
  return true
}

module.exports = { findByDoctor, findActiveForDoctorOnDate, create, update, remove }
