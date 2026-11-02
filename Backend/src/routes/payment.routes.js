const express = require('express')
const paymentController = require('../controllers/payment.controller')
const validateRequest = require('../middleware/validateRequest')
const { requireRole } = require('../middleware/authMiddleware')

const router = express.Router()
// authMiddleware applied globally in routes/index.js

// Revenue summary — Admin + Receptionist
router.get('/summary', requireRole('admin', 'receptionist'), paymentController.getRevenueSummary)

// Financial summary for a patient
router.get('/patient/:patientId/financial-summary', paymentController.getPatientFinancialSummary)

// Payments by patient — any authenticated role
router.get('/patient/:patientId', paymentController.getByPatient)

// Single payment
router.get('/:id', paymentController.getById)

// All payments list — Admin + Receptionist
router.get('/', requireRole('admin', 'receptionist'), paymentController.getPayments)

// Create payment — Admin + Receptionist
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

// Edit payment — Admin + Receptionist
router.patch('/:id', requireRole('admin', 'receptionist'), paymentController.editPayment)

// Delete — Admin only
router.delete('/:id', requireRole('admin'), paymentController.softDeletePayment)

module.exports = router
