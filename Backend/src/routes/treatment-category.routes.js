const express = require('express');
const categoryController = require('../controllers/treatment-category.controller');
const { authMiddleware, requireRole } = require('../middleware/authMiddleware');

const router = express.Router();

// All category routes require authentication
router.use(authMiddleware);

// GET /api/categories — all authenticated roles can view
router.get('/', categoryController.getAll);

// POST /api/categories — Admin only (spec: "Treatment catalog and price list — Admin Full")
router.post('/', requireRole('admin'), categoryController.create);

// PUT /api/categories/:id — admin only
router.put('/:id', requireRole('admin'), categoryController.update);

// PATCH /api/categories/:id/toggle — admin only
router.patch('/:id/toggle', requireRole('admin'), categoryController.toggle);

module.exports = router;
