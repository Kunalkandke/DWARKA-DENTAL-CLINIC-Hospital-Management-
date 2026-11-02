const supabase = require('../config/supabase')

async function create(fileData) {
  const { data, error } = await supabase
    .from('files')
    .insert([fileData])
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

async function findById(id) {
  const { data, error } = await supabase
    .from('files')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw new Error(error.message)
  }
  return data
}

module.exports = {
  create,
  findById,
}
