const supabase = require('../config/supabase')

async function create(reportData) {
  const { data, error } = await supabase
    .from('ai_reports')
    .insert([reportData])
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

async function findByPatient(patientId) {
  const { data, error } = await supabase
    .from('ai_reports')
    .select('*, file:files!ai_reports_file_id_fkey(id, original_name, storage_key, mime_type)')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data || []
}

async function update(id, fields) {
  const { data, error } = await supabase
    .from('ai_reports')
    .update(fields)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

module.exports = {
  create,
  findByPatient,
  update,
}
