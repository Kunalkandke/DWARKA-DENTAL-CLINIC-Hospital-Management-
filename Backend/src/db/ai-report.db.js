const supabase = require('../config/supabase')

/**
 * Insert a new AI report row.
 * Accepts all columns including the new ones from migration 20260110000000_ai_xray_findings.
 */
async function create(reportData) {
  const { data, error } = await supabase
    .from('ai_reports')
    .insert([reportData])
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

/**
 * Fetch all AI reports for a patient, newest first.
 * Selects all new columns so callers do not need a separate query.
 */
async function findByPatient(patientId) {
  const { data, error } = await supabase
    .from('ai_reports')
    .select(
      `*,
       file:files!ai_reports_file_id_fkey(id, original_name, storage_key, mime_type)`
    )
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data || []
}

/**
 * Update an AI report (e.g. doctor review fields).
 */
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

module.exports = { create, findByPatient, update }
