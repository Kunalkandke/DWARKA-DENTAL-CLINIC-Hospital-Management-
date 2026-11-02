-- =============================================================================
-- Dwarka Dental Clinic — Payment Flexibility Migration
-- Actual invoices columns: subtotal, discount, tax, total, amount_paid,
--   balance_due, issued_at, due_at (NOT total_amount / discount_amount / etc.)
-- Additive / idempotent — safe to re-run.
-- =============================================================================

-- ── 1. Make payments.invoice_id optional ─────────────────────────────────────
ALTER TABLE payments ALTER COLUMN invoice_id DROP NOT NULL;

-- ── 2. Make payments.recorded_by_id optional ─────────────────────────────────
ALTER TABLE payments ALTER COLUMN recorded_by_id DROP NOT NULL;

-- ── 3. Add payment_type column ────────────────────────────────────────────────
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_type TEXT NOT NULL DEFAULT 'payment'
  CHECK (payment_type IN ('advance', 'payment', 'partial', 'settlement', 'refund'));

-- ── 4. Add transaction_ref column ────────────────────────────────────────────
ALTER TABLE payments ADD COLUMN IF NOT EXISTS transaction_ref TEXT;

-- ── 5. Add missing columns to invoices ──────────────────────────────────────
--    The original schema has: subtotal, discount, tax, total, amount_paid,
--    balance_due, status, issued_at, due_at — but NO is_deleted, deleted_at,
--    description, or created_by. We add them here.
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS description  TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS is_deleted   BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS deleted_at   TIMESTAMPTZ;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS created_by   UUID;

-- ── 6. Backfill balance_due where it may be zero/wrong ───────────────────────
--    Uses the real column name: total (not total_amount)
UPDATE invoices
   SET balance_due = GREATEST(0, total - amount_paid)
 WHERE balance_due IS NULL OR balance_due < 0;

-- ── 7. Useful indexes ─────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments (invoice_id)
  WHERE invoice_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payments_patient_type ON payments (patient_id, payment_type)
  WHERE is_deleted = FALSE;

-- ── 8. Patient financial summary view ────────────────────────────────────────
CREATE OR REPLACE VIEW patient_financial_summary AS
SELECT
  p.id                                                                           AS patient_id,
  p.name                                                                         AS patient_name,
  p.patient_number,
  COALESCE(SUM(i.total)        FILTER (WHERE COALESCE(i.is_deleted, FALSE) = FALSE), 0)              AS total_billed,
  COALESCE(SUM(i.amount_paid)  FILTER (WHERE COALESCE(i.is_deleted, FALSE) = FALSE), 0)              AS total_paid_on_invoices,
  COALESCE(SUM(i.balance_due)  FILTER (WHERE COALESCE(i.is_deleted, FALSE) = FALSE
                                          AND i.status IN ('issued','partially_paid')), 0) AS outstanding_balance,
  COALESCE(SUM(i.discount)     FILTER (WHERE COALESCE(i.is_deleted, FALSE) = FALSE), 0)              AS total_discount
FROM patients p
LEFT JOIN invoices i ON i.patient_id = p.id
GROUP BY p.id, p.name, p.patient_number;

-- =============================================================================
-- End of migration
-- =============================================================================
