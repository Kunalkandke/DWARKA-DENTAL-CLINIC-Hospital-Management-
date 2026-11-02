const express = require('express')
const invoiceController = require('../controllers/invoice.controller')
const { requireRole } = require('../middleware/authMiddleware')

const router = express.Router()
// authMiddleware applied globally in routes/index.js

// ── Patient-scoped routes (explicit paths first) ──────────────────────────────
// Financial summary for a patient
router.get('/patient/:patientId/summary', invoiceController.getPatientFinancialSummary)

// All invoices for a patient
router.get('/patient/:patientId', invoiceController.getByPatient)

// ── Create (explicit verb, no param ambiguity) ────────────────────────────────
router.post('/', requireRole('admin', 'receptionist'), invoiceController.createInvoice)

// ── Single-invoice routes (parameterized — must come after explicit paths) ────
router.get('/:id', invoiceController.getById)
router.patch('/:id', requireRole('admin', 'receptionist'), invoiceController.updateInvoice)
router.delete('/:id', requireRole('admin'), invoiceController.deleteInvoice)

module.exports = router
