const express = require('express')
const { requireRole } = require('../middleware/authMiddleware')
const c = require('../controllers/settings.controller')

const router = express.Router()
// authMiddleware applied at mount

// Settings — all roles read; only admin can write
router.get('/',       c.getSettings)
router.put('/',       requireRole('admin'), c.updateSettings)

// Holidays — all roles read; only admin can write
router.get('/holidays',        c.getHolidays)
router.post('/holidays',       requireRole('admin'), c.createHoliday)
router.put('/holidays/:id',    requireRole('admin'), c.updateHoliday)
router.delete('/holidays/:id', requireRole('admin'), c.deleteHoliday)

module.exports = router
