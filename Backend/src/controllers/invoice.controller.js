/**
 * invoice.controller.js
 *
 * Invoices table columns (from initial_schema.sql):
 *   subtotal, discount, tax, total, amount_paid, balance_due,
 *   status, issued_at, due_at, created_at, updated_at, description (added in migration)
 *
 * invoice_items: description, quantity, unit_price, discount, amount
 *
 * All monetary values stored in PAISE (integer).
 * toINR(paise) = paise / 100
 * toPaise(inr) = Math.round(parseFloat(inr) * 100)
 */
const { invoiceDb, paymentDb, auditLogDb, clinicDb } = require('../db')
const ApiResponse  = require('../utils/ApiResponse')
const ApiError     = require('../utils/ApiError')
const asyncHandler = require('../middleware/asyncHandler')

const toINR   = (paise) => (paise || 0) / 100
const toPaise = (inr)   => Math.round(parseFloat(inr || 0) * 100)

// ─── Shape: DB row → frontend ─────────────────────────────────────────────────
function toFrontendShape(inv) {
  const totalAmount = toINR(inv.total || 0)
  const amountPaid  = toINR(inv.amount_paid || 0)
  const balanceDue  = inv.balance_due != null
    ? toINR(inv.balance_due)
    : Math.max(0, totalAmount - amountPaid)

  // Derive consistent status
  let status = inv.status || 'issued'
  if (status !== 'cancelled' && status !== 'draft' && totalAmount > 0) {
    if (amountPaid <= 0)        status = 'issued'
    else if (balanceDue <= 0.5) status = 'paid'
    else                        status = 'partially_paid'
  }

  return {
    id:            inv.id,
    invoiceNumber: inv.invoice_number || inv.id?.slice(0, 8).toUpperCase(),
    date:          inv.issued_at ? inv.issued_at.split('T')[0] : (inv.created_at ? inv.created_at.split('T')[0] : null),
    dueDate:       inv.due_at    ? inv.due_at.split('T')[0]    : null,
    patientId:     inv.patient_id,
    appointmentId: inv.appointment_id || null,
    description:   inv.description    || '',
    subtotal:      toINR(inv.subtotal || 0),
    discount:      toINR(inv.discount  || 0),
    tax:           toINR(inv.tax       || 0),
    totalAmount,
    amountPaid,
    balanceDue,
    status,
    items: (inv.invoice_items || []).map(item => ({
      id:          item.id,
      description: item.description || '',
      quantity:    item.quantity     || 1,
      unitPrice:   toINR(item.unit_price || 0),
      amount:      toINR(item.amount     || 0),
    })),
    createdAt: inv.created_at,
    isDeleted: inv.is_deleted || false,
  }
}

// ─── GET /api/invoices/patient/:patientId ─────────────────────────────────────
const getByPatient = asyncHandler(async (req, res) => {
  const raw      = await invoiceDb.findByPatient(req.params.patientId)
  const invoices = raw.map(toFrontendShape)
  return new ApiResponse(200, { invoices }, 'Invoices fetched').send(res)
})

// ─── GET /api/invoices/patient/:patientId/summary ─────────────────────────────
const getPatientFinancialSummary = asyncHandler(async (req, res) => {
  const { patientId } = req.params
  const [invoices, payments] = await Promise.all([
    invoiceDb.findByPatient(patientId),
    paymentDb.findByPatient(patientId),
  ])

  const shaped       = invoices.map(toFrontendShape)
  const totalBilled  = shaped.reduce((s, i) => s + i.totalAmount, 0)
  const totalDiscount= shaped.reduce((s, i) => s + i.discount,    0)
  const outstanding  = shaped
    .filter(i => ['issued', 'partially_paid'].includes(i.status))
    .reduce((s, i) => s + i.balanceDue, 0)

  const totalPaid = payments
    .filter(p => !p.is_deleted)
    .reduce((s, p) => s + toINR(p.amount || 0), 0)

  const lastPay = payments
    .filter(p => !p.is_deleted)
    .sort((a, b) => new Date(b.paid_at || b.created_at) - new Date(a.paid_at || a.created_at))[0]

  return new ApiResponse(200, {
    summary: {
      totalBilled,
      totalDiscount,
      totalPaid,
      outstandingBalance: Math.max(0, outstanding),
      lastPaymentDate:   lastPay?.paid_at  || lastPay?.created_at || null,
      lastPaymentAmount: lastPay ? toINR(lastPay.amount) : 0,
      invoiceCount:      invoices.length,
      paymentCount:      payments.filter(p => !p.is_deleted).length,
    }
  }, 'Financial summary fetched').send(res)
})

// ─── GET /api/invoices/:id ────────────────────────────────────────────────────
const getById = asyncHandler(async (req, res) => {
  const inv = await invoiceDb.findById(req.params.id)
  if (!inv) throw ApiError.notFound('Invoice not found')
  return new ApiResponse(200, { invoice: toFrontendShape(inv) }, 'Invoice fetched').send(res)
})

// ─── POST /api/invoices ───────────────────────────────────────────────────────
const createInvoice = asyncHandler(async (req, res) => {
  const { patientId, appointmentId, description, items = [], discount = 0, tax = 0, dueDate } = req.body
  if (!patientId) throw ApiError.badRequest('patientId is required')

  const subtotalINR = items.reduce((s, i) => s + (parseFloat(i.unitPrice || 0) * (parseInt(i.quantity) || 1)), 0)
  const discountINR = parseFloat(discount) || 0
  const taxINR      = parseFloat(tax)      || 0
  const totalINR    = Math.max(0, subtotalINR - discountINR + taxINR)

  // Get clinic id (non-fatal)
  let clinicId = null
  try { const c = await clinicDb.getDefaultClinic(); clinicId = c?.id || null } catch (_) {}

  // Map to the REAL database column names
  const invoiceData = {
    patient_id:      patientId,
    appointment_id:  appointmentId || null,
    ...(clinicId ? { clinic_id: clinicId } : {}),
    description:     description || '',
    subtotal:        toPaise(subtotalINR),
    discount:        toPaise(discountINR),
    tax:             toPaise(taxINR),
    total:           toPaise(totalINR),
    amount_paid:     0,
    balance_due:     toPaise(totalINR),
    status:          'issued',
    issued_at:       new Date().toISOString(),
    ...(dueDate ? { due_at: new Date(dueDate).toISOString() } : {}),
    ...(req.user?.id ? { created_by: req.user.id } : {}),
    is_deleted:      false,
  }

  const itemRows = items.map(item => ({
    description: item.description || '',
    quantity:    parseInt(item.quantity) || 1,
    unit_price:  toPaise(parseFloat(item.unitPrice || 0)),
    discount:    0,
    amount:      toPaise(parseFloat(item.unitPrice || 0) * (parseInt(item.quantity) || 1)),
  }))

  const { invoice, items: createdItems } = await invoiceDb.createWithItems(invoiceData, itemRows)

  try {
    await auditLogDb.create({
      actor_id:      req.user?.id,
      actor_role:    req.user?.role,
      action:        'create',
      resource_type: 'invoice',
      resource_id:   invoice.id,
      details:       { patientId, totalINR, itemCount: itemRows.length },
    })
  } catch (_) {}

  return new ApiResponse(201, {
    invoice: toFrontendShape({ ...invoice, invoice_items: createdItems })
  }, 'Invoice created').send(res)
})

// ─── PATCH /api/invoices/:id ──────────────────────────────────────────────────
const updateInvoice = asyncHandler(async (req, res) => {
  if (!['admin', 'receptionist'].includes(req.user?.role)) throw ApiError.forbidden('Admin or Receptionist required')

  const existing = await invoiceDb.findById(req.params.id)
  if (!existing)          throw ApiError.notFound('Invoice not found')
  if (existing.status === 'paid') throw ApiError.badRequest('Cannot modify a paid invoice')

  const allowed = {}
  if (req.body.description != null) allowed.description = req.body.description
  if (req.body.dueDate     != null) allowed.due_at     = new Date(req.body.dueDate).toISOString()
  if (req.body.status      != null && ['draft', 'issued', 'cancelled'].includes(req.body.status)) {
    allowed.status = req.body.status
  }
  if (req.body.discount != null) {
    const discPaise = toPaise(parseFloat(req.body.discount))
    allowed.discount = discPaise
    // Recalculate total using REAL column name `total`
    const newTotal = Math.max(0, (existing.subtotal || 0) - discPaise + (existing.tax || 0))
    allowed.total       = newTotal
    allowed.balance_due = Math.max(0, newTotal - (existing.amount_paid || 0))
    if (allowed.balance_due <= 0 && (existing.amount_paid || 0) > 0) allowed.status = 'paid'
    else if ((existing.amount_paid || 0) > 0) allowed.status = 'partially_paid'
  }

  const updated = await invoiceDb.updateInvoice(req.params.id, allowed)
  return new ApiResponse(200, { invoice: toFrontendShape(updated) }, 'Invoice updated').send(res)
})

// ─── DELETE /api/invoices/:id ─────────────────────────────────────────────────
const deleteInvoice = asyncHandler(async (req, res) => {
  if (req.user?.role !== 'admin') throw ApiError.forbidden('Admin only')
  const inv = await invoiceDb.findById(req.params.id)
  if (!inv) throw ApiError.notFound('Invoice not found')
  if ((inv.amount_paid || 0) > 0) throw ApiError.badRequest('Cannot delete an invoice with payments')
  await invoiceDb.softDelete(req.params.id)
  return new ApiResponse(200, null, 'Invoice deleted').send(res)
})

module.exports = { getByPatient, getById, createInvoice, updateInvoice, deleteInvoice, getPatientFinancialSummary }
