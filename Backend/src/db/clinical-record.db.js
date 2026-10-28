const supabase = require('../config/supabase')

async function findByPatient(patientId) {
  const { data, error } = await supabase
    .from('clinical_records')
    .select('*')
    .eq('patient_id', patientId)
    .eq('is_deleted', false)
    .order('visit_date', { ascending: false })

  if (error) throw new Error(error.message)
  return data || []
}

async function findById(id) {
  const { data, error } = await supabase
    .from('clinical_records')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw new Error(error.message)
  }
  return data
}

/**
 * Insert a new clinical record.
 * dental_chart should be a JS array — Supabase serializes it to JSONB automatically.
 */
async function create(recordData) {
  const { data, error } = await supabase
    .from('clinical_records')
    .insert([recordData])
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

async function update(id, fields) {
  const { data, error } = await supabase
    .from('clinical_records')
    .update(fields)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

module.exports = {
  findByPatient,
  findById,
  create,
  update,
}
