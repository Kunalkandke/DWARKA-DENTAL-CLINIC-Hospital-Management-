const express = require('express');
const multer = require('multer');
const path = require('path');
const aiController = require('../controllers/ai.controller');
const { UPLOAD_DIR } = require('../services/ai.service');
const { requireRole } = require('../middleware/authMiddleware');

const router = express.Router();
// Note: authMiddleware (requireAuth) is applied in routes/index.js

// ── Multer storage ────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `xray-${uniqueSuffix}${path.extname(file.originalname).toLowerCase()}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const allowedExt = /\.(jpeg|jpg|png)$/i;
    const allowedMime = /^image\/(jpeg|jpg|png)$/i;
    if (allowedExt.test(path.extname(file.originalname)) && allowedMime.test(file.mimetype)) {
      return cb(null, true);
    }
    // Passing an error with a flag so the multer error handler below can
    // distinguish a filter rejection from an unexpected multer crash.
    const err = new Error('Only JPEG or PNG X-ray images are allowed.');
    err.isFileFilterError = true;
    cb(err);
  },
});

/**
 * Multer error handler middleware.
 * Converts multer-specific errors (file type, file size) into clean 400 JSON
 * responses instead of letting them fall through as unhandled 500 errors.
 */
function handleMulterError(err, _req, res, next) {
  if (err) {
    if (err instanceof multer.MulterError) {
      // e.g. LIMIT_FILE_SIZE
      const message =
        err.code === 'LIMIT_FILE_SIZE'
          ? 'File too large. Maximum allowed size is 10 MB.'
          : `Upload error: ${err.message}`;
      return res.status(400).json({ success: false, message });
    }
    if (err.isFileFilterError) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }
  next(err);
}

// ── Routes ────────────────────────────────────────────────────────────────────

/** POST /api/ai/upload — doctors, admin & receptionists */
router.post(
  '/upload',
  requireRole('doctor', 'admin', 'receptionist'),
  upload.single('xray'),
  handleMulterError,
  aiController.uploadAndAnalyzeXray
);

/** GET /api/ai/reports/:patientId */
router.get('/reports/:patientId', aiController.getAiReportsByPatient);

/** PATCH /api/ai/reports/:id/review — doctors & admin only */
router.patch('/reports/:id/review', requireRole('doctor', 'admin'), aiController.reviewAiReport);

module.exports = router;
