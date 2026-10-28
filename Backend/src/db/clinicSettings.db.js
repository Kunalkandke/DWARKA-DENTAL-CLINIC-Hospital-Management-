const supabase = require('../config/supabase')

/**
 * Clinic settings (structured JSONB blob per clinic).
 */
async function getByClinic(clinic_id) {
  const { data, error } = await supabase
    .from('clinic_settings')
    .select('*')
    .eq('clinic_id', clinic_id)
    .single()
  if (error) {
    if (error.code === 'PGRST116') return null
    throw new Error(error.message)
  }
  return data
}

async function upsert(clinic_id, settings) {
  const { data, error } = await supabase
    .from('clinic_settings')
    .upsert({ clinic_id, settings }, { onConflict: 'clinic_id' })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}

module.exports = { getByClinic, upsert }
