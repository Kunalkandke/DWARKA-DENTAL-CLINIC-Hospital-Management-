const supabase = require('../config/supabase')

async function create(notificationData) {
  const { data, error } = await supabase
    .from('notifications')
    .insert([notificationData])
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

async function findByRecipient(recipientId) {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('recipient_id', recipientId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data || []
}

module.exports = {
  create,
  findByRecipient,
}
