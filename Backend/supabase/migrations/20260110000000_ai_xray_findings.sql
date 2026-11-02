-- =============================================================================
-- Dwarka Dental Clinic — AI X-ray Findings Migration
-- Adds 'findings_detected' to ai_report_result_enum and extends ai_reports
-- with per-finding detail columns.
-- Additive / idempotent — safe to re-run.
-- =============================================================================

-- ── 1. Extend enum ────────────────────────────────────────────────────────────
-- NOTE: On some Postgres versions (< 12) ALTER TYPE … ADD VALUE cannot run
-- inside a transaction block. If your Supabase project uses Postgres < 12,
-- execute ONLY this statement first in its own SQL Editor run, then come back
-- and run the rest. On Postgres 12+ (all modern Supabase projects) the whole
-- file can be run in one go.
--
-- The DO block makes this idempotent: it checks pg_enum before adding the
-- value, so re-running the migration never throws "already exists".
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'findings_detected'
      AND enumtypid = 'ai_report_result_enum'::regtype
  ) THEN
    ALTER TYPE ai_report_result_enum ADD VALUE 'findings_detected';
  END IF;
END;
$$;

-- ── 2. Add new columns to ai_reports ─────────────────────────────────────────
-- Each statement uses ADD COLUMN IF NOT EXISTS, so re-running is safe.

-- Per-detection findings from the YOLO model: array of
-- { label, confidence, box:[x1,y1,x2,y2], suggestion }
ALTER TABLE ai_reports
  ADD COLUMN IF NOT EXISTS findings JSONB NOT NULL DEFAULT '[]';

-- One plain-English summary sentence produced by the ML service.
ALTER TABLE ai_reports
  ADD COLUMN IF NOT EXISTS summary TEXT;

-- Storage key (path) of the annotated PNG uploaded to Supabase Storage.
-- NULL means the image was not stored (e.g. returned inline only).
ALTER TABLE ai_reports
  ADD COLUMN IF NOT EXISTS annotated_image_key TEXT;

-- Original image dimensions, useful for rendering boxes correctly on the
-- front-end without re-fetching the file.
ALTER TABLE ai_reports
  ADD COLUMN IF NOT EXISTS image_width INTEGER;

ALTER TABLE ai_reports
  ADD COLUMN IF NOT EXISTS image_height INTEGER;
