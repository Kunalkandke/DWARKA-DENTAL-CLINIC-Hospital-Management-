const supabase = require('../config/supabase')

/**
 * Insert an invoice header. DO NOT include invoice_number — sequence generates it.
 * Returns the full inserted row including auto-generated invoice_number.
 */
async function create(invoiceData) {
  const { data, error } = await supabase
    .from('invoices')
    .insert([invoiceData])
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

/**
 * Insert an invoice and its line items in sequence.
 * Returns { invoice, items }.
 */
async function createWithItems(invoiceData, items) {
  const invoice = await create(invoiceData)

  if (items && items.length > 0) {
    const itemRows = items.map(item => ({
      ...item,
      invoice_id: invoice.id,
    }))

    const { data: insertedItems, error: itemsError } = await supabase
      .from('invoice_items')
      .insert(itemRows)
      .select()

    if (itemsError) throw new Error(itemsError.message)
    return { invoice, items: insertedItems || [] }
  }

  return { invoice, items: [] }
}

module.exports = {
  create,
  createWithItems,
}
