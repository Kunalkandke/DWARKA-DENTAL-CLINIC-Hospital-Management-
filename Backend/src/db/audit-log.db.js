const supabase = require('../config/supabase')

async function create(logData) {
  const { data, error } = await supabase
    .from('audit_logs')
    .insert([logData])
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

module.exports = {
  create,
}
