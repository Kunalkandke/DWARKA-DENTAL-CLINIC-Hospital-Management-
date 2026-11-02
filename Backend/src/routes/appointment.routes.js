const express = require('express')
const appointmentController = require('../controllers/appointment.controller')
const { requireRole } = require('../middleware/authMiddleware')

const router = express.Router()
// authMiddleware applied in routes/index.js

// Any authenticated role may view appointments
router.get('/', appointmentController.getAppointments)
router.get('/patient/:patientId', appointmentController.getByPatient)

// Book — Admin + Receptionist (Doctor uses their own schedule view; spec says Receptionist Full / Doctor "own schedule: confirm/reschedule request")
router.post('/', requireRole('admin', 'receptionist'), appointmentController.bookAppointment)

// Status update — any authenticated role (doctor updates own, receptionist/admin update all; fine-grained scoping in service)
router.put('/:id/status', appointmentController.updateStatus)

// Cancel / delete — Admin + Receptionist (spec: "Book/reschedule/cancel — Receptionist Full, Admin Full, Doctor own schedule")
router.delete('/:id', requireRole('admin', 'receptionist'), appointmentController.softDelete)

// Single appointment by ID — must be last so /patient/:patientId takes priority
router.get('/:id', appointmentController.getAppointmentById)

module.exports = router
