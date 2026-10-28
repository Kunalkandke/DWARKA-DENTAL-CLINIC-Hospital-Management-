const express = require('express')
const { requireRole } = require('../middleware/authMiddleware')
const availabilityController = require('../controllers/availability.controller')
const chairController = require('../controllers/chair.controller')

const router = express.Router()
// authMiddleware applied at mount in routes/index.js

// ─── Chairs ───────────────────────────────────────────────────────────────────
router.get('/chairs',        chairController.getChairs)
router.post('/chairs',       requireRole('admin'), chairController.createChair)
router.put('/chairs/:id',    requireRole('admin'), chairController.updateChair)
router.delete('/chairs/:id', requireRole('admin'), chairController.deleteChair)

// ─── Doctor availability slots ────────────────────────────────────────────────
router.get('/doctors/:doctorId/slots',         availabilityController.getAvailability)
router.post('/doctors/:doctorId/slots',        requireRole('admin'), availabilityController.createAvailability)
router.put('/doctors/:doctorId/slots/:id',     requireRole('admin'), availabilityController.updateAvailability)
router.delete('/doctors/:doctorId/slots/:id',  requireRole('admin'), availabilityController.deleteAvailability)

// ─── Doctor blocks (leave / unavailability) ───────────────────────────────────
router.get('/doctors/:doctorId/blocks',        availabilityController.getBlocks)
router.post('/doctors/:doctorId/blocks',       requireRole('admin'), availabilityController.createBlock)
router.delete('/doctors/:doctorId/blocks/:id', requireRole('admin'), availabilityController.deleteBlock)

module.exports = router
