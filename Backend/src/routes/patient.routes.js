const express = require('express')
const patientController = require('../controllers/patient.controller')
const validateRequest = require('../middleware/validateRequest')
const { requireRole } = require('../middleware/authMiddleware')

const router = express.Router()
// authMiddleware is applied in routes/index.js before this router

// Any authenticated role may view patients
router.get('/', patientController.getPatients)
router.get('/:id', patientController.getPatient)

// Register / update demographics — Admin + Receptionist only (Doctor blocked)
router.post(
  '/',
  requireRole('admin', 'receptionist'),
  validateRequest({ name: { required: true, label: 'Name' }, phone: { required: true, label: 'Phone' } }),
  patientController.addPatient,
)
router.put('/:id', requireRole('admin', 'receptionist', 'doctor'), patientController.updatePatient)

// Delete / archive — Admin only (spec: "Delete / archive / merge patient — Admin only")
router.delete('/:id', requireRole('admin'), patientController.softDeletePatient)

module.exports = router
