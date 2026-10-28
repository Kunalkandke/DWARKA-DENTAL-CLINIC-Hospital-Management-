const express = require('express')
const clinicalController = require('../controllers/clinical.controller')
const validateRequest = require('../middleware/validateRequest')
const { requireRole } = require('../middleware/authMiddleware')

const router = express.Router()
// authMiddleware is applied in routes/index.js before this router

// GET clinical records — Doctor (own patients) + Admin (audit/view). Receptionist: summary only (no full record access).
router.get('/:patientId', requireRole('admin', 'doctor'), clinicalController.getClinicalRecordsByPatient)

// POST clinical record — Doctor + Admin (spec: "Clinical records, dental chart, diagnosis — Doctor Full own patients; Admin view+audit")
router.post(
  '/',
  requireRole('doctor', 'admin'),
  validateRequest({
    patientId: { required: true, label: 'Patient' },
    doctorId: { required: true, label: 'Doctor' },
    diagnosis: { required: true, label: 'Diagnosis' },
    treatment: { required: true, label: 'Treatment' },
  }),
  clinicalController.addClinicalRecord,
)

module.exports = router
