/**
 * payment.controller.js
 *
 * IMPORTANT: The payments table stores amounts in PAISE (INTEGER).
 * All amounts from the frontend are INR floats.
 * toINR(paise) = paise / 100
 * toPaise(inr) = Math.round(parseFloat(inr) * 100)
 */
const supabase = require('../config/supabase')
const { paymentDb, invoiceDb, auditLogDb, clinicDb, patientDb } = require('../db')
const ApiResponse  = require('../utils/ApiResponse')
const ApiError     = require('../utils/ApiError')
const asyncHandler = require('../middleware/asyncHandler')

const toINR   = (paise) => (paise || 0) / 100
const toPaise = (inr)   => Math.round(parseFloat(inr || 0) * 100)

// ─── Shape: DB row → frontend object ─────────────────────────────────────────
function toFrontendShape(p) {
  return {
    id:            p.id,
    receiptNumber: p.receipt_number || null,
    patientId:     p.patient_id,
    invoiceId:     p.invoice_id || null,
    amount:        toINR(p.amount),
    mode:          formatMode(p.method),
    paymentType:   p.payment_type || 'payment',
    notes:         p.notes || '',
    date:          p.paid_at
      ? p.paid_at.split('T')[0]
      : (p.created_at ? p.created_at.split('T')[0] : null),
    transactionRef: p.transaction_ref || p.transaction_reference || null,
    status:        p.status || 'paid',
    isDeleted:     p.is_deleted || false,
    receivedBy:    p.recorded_by_id || null,
    patientName:   p.patient?.name || null,
    patientNumber: p.patient?.patient_number || null,
    invoiceNumber: p.invoice?.invoice_number || null,
    invoiceBalance: p.invoice ? toINR(p.invoice.balance_due) : null,
  }
}

function formatMode(method) {
  const m = (method || '').toLowerCase()
  if (m === 'upi')                            return 'UPI'
  if (m === 'cash')                           return 'Cash'
  if (m === 'card')                           return 'Card'
  if (m === 'bank_transfer' || m === 'bank transfer') return 'Bank Transfer'
  return method || 'UPI'
}

function toDbMethod(mode) {
  const m = (mode || '').toLowerCase().replace(/\s+/g, '_')
  if (m === 'upi')           return 'upi'
  if (m === 'cash')          return 'cash'
  if (m === 'card')          return 'card'
  if (m.includes('bank'))    return 'bank_transfer'
  return 'upi'
}

// ─── GET /api/payments ────────────────────────────────────────────────────────
const getPayments = asyncHandler(async (req, res) => {
  const result   = await paymentDb.findAll(req.query)
  const payments = (result.data || []).map(toFrontendShape)
  return new ApiResponse(200, { payments, total: result.total }, 'Payments fetched').send(res)
})

// ─── GET /api/payments/patient/:patientId ─────────────────────────────────────
const getByPatient = asyncHandler(async (req, res) => {
  const rows     = await paymentDb.findByPatient(req.params.patientId)
  const payments = rows.map(toFrontendShape)
  const totalPaid  = payments.filter(p => !p.isDeleted).reduce((s, p) => s + p.amount, 0)
  const advance    = payments.filter(p => p.paymentType === 'advance' && !p.isDeleted).reduce((s, p) => s + p.amount, 0)
  return new ApiResponse(200, { payments, totalPaid, advanceBalance: advance }, 'Payments fetched').send(res)
})

// ─── GET /api/payments/:id ────────────────────────────────────────────────────
const getById = asyncHandler(async (req, res) => {
  const p = await paymentDb.findById(req.params.id)
  if (!p) throw ApiError.notFound('Payment not found')
  return new ApiResponse(200, { payment: toFrontendShape(p) }, 'Payment fetched').send(res)
})

// ─── POST /api/payments ───────────────────────────────────────────────────────
const addPayment = asyncHandler(async (req, res) => {
  const {
    patientId, invoiceId, amount, mode,
    paymentType = 'payment', notes, date, transactionRef,
  } = req.body

  if (!patientId)             throw ApiError.badRequest('patientId is required')
  const amountINR = parseFloat(amount)
  if (!amountINR || amountINR <= 0) throw ApiError.badRequest('Valid positive amount is required')
  if (!mode)                  throw ApiError.badRequest('Payment mode is required')

  const amountPaise = toPaise(amountINR)

  // Get clinic id (non-fatal if unavailable)
  let clinicId = null
  try { const c = await clinicDb.getDefaultClinic(); clinicId = c?.id || null } catch (_) {}

  // Verify patient exists
  const patient = await patientDb.findById(patientId)
  if (!patient) throw ApiError.notFound('Patient not found')

  const paymentData = {
    patient_id:      patientId,
    invoice_id:      invoiceId || null,
    amount:          amountPaise,
    method:          toDbMethod(mode),
    payment_type:    paymentType,
    notes:           notes || '',
    paid_at:         date ? new Date(date).toISOString() : new Date().toISOString(),
    transaction_ref: transactionRef || null,
    recorded_by_id:  req.user?.id || null,
    status:          'paid',
    is_deleted:      false,
    ...(clinicId ? { clinic_id: clinicId } : {}),
  }

  const payment = await paymentDb.create(paymentData)

  // Recalc invoice balance if linked
  if (invoiceId) {
    try { await invoiceDb.recalcInvoiceBalance(invoiceId) } catch (_) {}
  }

  // Audit
  try {
    await auditLogDb.create({
      actor_id:      req.user?.id,
      actor_role:    req.user?.role,
      action:        'create',
      resource_type: 'payment',
      resource_id:   payment.id,
      details:       { patientId, amountINR, mode, paymentType, invoiceId },
    })
  } catch (_) {}

  return new ApiResponse(201, { payment: toFrontendShape(payment) }, 'Payment recorded').send(res)
})

// ─── PATCH /api/payments/:id ──────────────────────────────────────────────────
const editPayment = asyncHandler(async (req, res) => {
  if (!['admin', 'receptionist'].includes(req.user?.role)) {
    throw ApiError.forbidden('Admin or Receptionist required')
  }

  const existing = await paymentDb.findById(req.params.id)
  if (!existing)           throw ApiError.notFound('Payment not found')
  if (existing.is_deleted) throw ApiError.badRequest('Cannot edit a voided payment')

  const updates = {}
  if (req.body.mode  != null) updates.method  = toDbMethod(req.body.mode)
  if (req.body.notes != null) updates.notes   = req.body.notes
  if (req.body.date  != null) updates.paid_at = new Date(req.body.date).toISOString()
  if (req.body.transactionRef != null) updates.transaction_ref = req.body.transactionRef

  // Amount edits — admin only
  if (req.body.amount != null && req.user?.role === 'admin') {
    const newINR = parseFloat(req.body.amount)
    if (newINR <= 0) throw ApiError.badRequest('Amount must be positive')
    updates.amount = toPaise(newINR)
  }

  const { data: updated, error } = await supabase
    .from('payments')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .select()
    .single()
  if (error) throw new Error(error.message)

  if (existing.invoice_id) {
    try { await invoiceDb.recalcInvoiceBalance(existing.invoice_id) } catch (_) {}
  }

  try {
    await auditLogDb.create({
      actor_id:      req.user?.id,
      actor_role:    req.user?.role,
      action:        'update',
      resource_type: 'payment',
      resource_id:   req.params.id,
      details:       { changes: req.body, previousAmountINR: toINR(existing.amount) },
    })
  } catch (_) {}

  return new ApiResponse(200, { payment: toFrontendShape(updated) }, 'Payment updated').send(res)
})

// ─── DELETE /api/payments/:id ─────────────────────────────────────────────────
const softDeletePayment = asyncHandler(async (req, res) => {
  if (req.user?.role !== 'admin') throw ApiError.forbidden('Admin only')

  const existing = await paymentDb.findById(req.params.id)
  if (!existing) throw ApiError.notFound('Payment not found')

  await paymentDb.softDelete(req.params.id)

  if (existing.invoice_id) {
    try { await invoiceDb.recalcInvoiceBalance(existing.invoice_id) } catch (_) {}
  }

  try {
    await auditLogDb.create({
      actor_id:      req.user?.id,
      actor_role:    req.user?.role,
      action:        'delete',
      resource_type: 'payment',
      resource_id:   req.params.id,
      details:       { amountINR: toINR(existing.amount), patientId: existing.patient_id },
    })
  } catch (_) {}

  return new ApiResponse(200, null, 'Payment voided').send(res)
})

// ─── GET /api/payments/summary ────────────────────────────────────────────────
const getRevenueSummary = asyncHandler(async (req, res) => {
  const result      = await paymentDb.getRevenueSummary()
  const totalPaise  = result.reduce((s, r) => s + (r.value || 0), 0)
  return new ApiResponse(200, {
    totalPaid: toINR(totalPaise),
    byMode:    result.map(r => ({ mode: formatMode(r.method), value: toINR(r.value) })),
  }, 'Revenue summary').send(res)
})

// ─── GET /api/payments/patient/:patientId/financial-summary ───────────────────
const getPatientFinancialSummary = asyncHandler(async (req, res) => {
  const { patientId } = req.params

  const [rows, invoices] = await Promise.all([
    paymentDb.findByPatient(patientId),
    invoiceDb.findByPatient(patientId).catch(() => []),
  ])

  const payments    = rows.map(toFrontendShape)
  const totalPaid   = payments.filter(p => !p.isDeleted).reduce((s, p) => s + p.amount, 0)
  const totalBilled = invoices.reduce((s, i) => s + toINR(i.total_amount || 0), 0)
  const outstanding = invoices
    .filter(i => ['issued', 'partially_paid'].includes(i.status) && !i.is_deleted)
    .reduce((s, i) => {
      const due = i.balance_due != null
        ? toINR(i.balance_due)
        : Math.max(0, toINR(i.total_amount || 0) - toINR(i.amount_paid || 0))
      return s + due
    }, 0)

  return new ApiResponse(200, {
    totalBilled,
    totalPaid,
    outstandingBalance: Math.max(0, outstanding),
    invoiceCount:  invoices.length,
    paymentCount:  payments.filter(p => !p.isDeleted).length,
  }, 'Financial summary').send(res)
})

module.exports = {
  getPayments,
  getByPatient,
  getById,
  addPayment,
  editPayment,
  softDeletePayment,
  getRevenueSummary,
  getPatientFinancialSummary,
}
