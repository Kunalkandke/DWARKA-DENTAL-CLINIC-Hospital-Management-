const express = require('express')
const paymentController = require('../controllers/payment.controller')
const validateRequest = require('../middleware/validateRequest')
const { requireRole } = require('../middleware/authMiddleware')

const router = express.Router()
// authMiddleware applied in routes/index.js

// Revenue summary — Admin + Receptionist only (spec: "Revenue and finance reports — Admin Full, Receptionist own collections only, Doctor own earnings only")
router.get('/summary', requireRole('admin', 'receptionist'), paymentController.getRevenueSummary)

// Payments by patient — any authenticated role (doctor needs to view own patient procedures)
router.get('/patient/:patientId', paymentController.getByPatient)

// All payments list — Admin + Receptionist
router.get('/', requireRole('admin', 'receptionist'), paymentController.getPayments)

// Create payment — Admin + Receptionist only (spec: "Invoices and payments — Admin full+approve, Receptionist create/collect, Doctor view own only")
router.post(
  '/',
  requireRole('admin', 'receptionist'),
  validateRequest({
    patientId: { required: true, label: 'Patient' },
    amount: { required: true, type: 'number', label: 'Amount' },
    mode: { required: true, label: 'Payment mode' },
  }),
  paymentController.addPayment,
)

// Delete — Admin only
router.delete('/:id', requireRole('admin'), paymentController.softDeletePayment)

module.exports = router
