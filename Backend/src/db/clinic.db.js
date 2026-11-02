const supabase = require('../config/supabase')

async function getDefaultClinic() {
  const { data, error } = await supabase
    .from('clinics')
    .select('*')
    .limit(1)
    .single()

  if (!error && data) return data

  // No clinic row found — create one
  if (error && error.code === 'PGRST116') {
    const { data: created, error: createError } = await supabase
      .from('clinics')
      .insert([{
        name: 'Dwarka Dental Clinic',
        email: 'info@dwarkadental.com',
        phone: '+91 98765 00000',
        address_line1: 'Sector 12',
        address_city: 'Dwarka, New Delhi',
        address_state: 'Delhi',
        address_postal_code: '110075',
        address_country: 'India',
      }])
      .select()
      .single()

    if (createError) throw new Error(createError.message)
    return created
  }

  if (error) throw new Error(error.message)
  return data
}

module.exports = { getDefaultClinic }
