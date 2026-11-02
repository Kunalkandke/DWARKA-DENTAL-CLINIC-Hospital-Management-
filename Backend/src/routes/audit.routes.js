const express = require('express')
const { requireRole } = require('../middleware/authMiddleware')
const auditController = require('../controllers/audit.controller')

const router = express.Router()
// authMiddleware is applied in routes/index.js when mounting this router

router.get('/', requireRole('admin'), auditController.getAuditLogs)

module.exports = router
