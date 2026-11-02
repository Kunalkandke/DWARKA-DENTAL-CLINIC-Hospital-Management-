-- =============================================================================
-- Dwarka Dental Clinic — Phase 1 Foundation Migration (ADDITIVE)
-- Adds: permission matrix, clinic settings + holidays, chairs, doctor_blocks,
--       doctor_availability extensions, appointments.chair_id, audit_logs extra
--       columns, user lockout columns, refresh_tokens table.
-- Rules: additive only (CREATE/ALTER ADD/seed). Never edits the old migration.
--       Idempotent (IF NOT EXISTS / ON CONFLICT).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Permission matrix: role_permissions + user_overrides
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS role_permissions (
  role     TEXT NOT NULL,
  module   TEXT NOT NULL,
  action   TEXT NOT NULL,
  allowed  BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (role, module, action)
);

CREATE TABLE IF NOT EXISTS user_overrides (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  module      TEXT NOT NULL,
  action      TEXT NOT NULL,
  allowed     BOOLEAN NOT NULL,
  reason      TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_overrides_user ON user_overrides (user_id, module, action);

-- Seed the Section 6 matrix (admin / doctor / receptionist).
-- Roles not listed (assistant, lab_technician, staff) default to DENY (no rows = denied).
INSERT INTO role_permissions (role, module, action, allowed) VALUES
  -- Patient
  ('admin',        'patient', 'view',              TRUE),
  ('receptionist', 'patient', 'view',              TRUE),
  ('doctor',       'patient', 'view',              TRUE),
  ('admin',        'patient', 'edit_demographics', TRUE),
  ('receptionist', 'patient', 'edit_demographics', TRUE),
  ('doctor',       'patient', 'edit_demographics', FALSE),
  ('admin',        'patient', 'edit_medical_history', TRUE),
  ('receptionist', 'patient', 'edit_medical_history', FALSE),
  ('doctor',       'patient', 'edit_medical_history', TRUE),
  ('admin',        'patient', 'delete',             TRUE),
  ('receptionist', 'patient', 'delete',            FALSE),
  ('doctor',       'patient', 'delete',            FALSE),
  -- Clinical records
  ('admin',        'clinical_record', 'view',   TRUE),
  ('doctor',       'clinical_record', 'view',   TRUE),
  ('receptionist', 'clinical_record', 'view',   FALSE),
  ('doctor',       'clinical_record', 'create', TRUE),
  ('admin',        'clinical_record', 'create', FALSE),
  ('receptionist', 'clinical_record', 'create', FALSE),
  -- Appointments
  ('admin',        'appointment', 'view',          TRUE),
  ('receptionist', 'appointment', 'view',          TRUE),
  ('doctor',       'appointment', 'view',          TRUE),
  ('admin',        'appointment', 'book',          TRUE),
  ('receptionist', 'appointment', 'book',          TRUE),
  ('doctor',       'appointment', 'book',         FALSE),
  ('admin',        'appointment', 'update_status', TRUE),
  ('receptionist', 'appointment', 'update_status', TRUE),
  ('doctor',       'appointment', 'update_status', TRUE),
  ('admin',        'appointment', 'cancel',        TRUE),
  ('receptionist', 'appointment', 'cancel',        TRUE),
  ('doctor',       'appointment', 'cancel',        FALSE),
  -- Payments
  ('admin',        'payment', 'view',   TRUE),
  ('receptionist', 'payment', 'view',   TRUE),
  ('doctor',       'payment', 'view',   TRUE),
  ('admin',        'payment', 'create', TRUE),
  ('receptionist', 'payment', 'create', TRUE),
  ('doctor',       'payment', 'create', FALSE),
  ('admin',        'payment', 'delete', TRUE),
  ('receptionist', 'payment', 'delete', FALSE),
  ('doctor',       'payment', 'delete', FALSE),
  -- Finance / reports (endpoint allowed for all; scoping done in code)
  ('admin',        'finance', 'view', TRUE),
  ('receptionist', 'finance', 'view', TRUE),
  ('doctor',       'finance', 'view', TRUE),
  -- Treatment categories
  ('admin',        'category', 'view',   TRUE),
  ('receptionist', 'category', 'view',   TRUE),
  ('doctor',       'category', 'view',   TRUE),
  ('admin',        'category', 'create', TRUE),
  ('receptionist', 'category', 'create', FALSE),
  ('doctor',       'category', 'create', FALSE),
  ('admin',        'category', 'update', TRUE),
  ('receptionist', 'category', 'update', FALSE),
  ('doctor',       'category', 'update', FALSE),
  -- Staff
  ('admin',        'staff', 'view_all', TRUE),
  ('receptionist', 'staff', 'view_all', FALSE),
  ('doctor',       'staff', 'view_all', FALSE),
  -- Audit
  ('admin',        'audit', 'view', TRUE),
  ('receptionist', 'audit', 'view', FALSE),
  ('doctor',       'audit', 'view', FALSE),
  -- Clinic settings
  ('admin',        'settings', 'view',   TRUE),
  ('receptionist', 'settings', 'view',   TRUE),
  ('doctor',       'settings', 'view',   TRUE),
  ('admin',        'settings', 'manage', TRUE),
  ('receptionist', 'settings', 'manage', FALSE),
  ('doctor',       'settings', 'manage', FALSE),
  -- Holidays
  ('admin',        'holiday', 'view',   TRUE),
  ('receptionist', 'holiday', 'view',   TRUE),
  ('doctor',       'holiday', 'view',   TRUE),
  ('admin',        'holiday', 'manage', TRUE),
  ('receptionist', 'holiday', 'manage', FALSE),
  ('doctor',       'holiday', 'manage', FALSE),
  -- Chairs
  ('admin',        'chair', 'view',   TRUE),
  ('receptionist', 'chair', 'view',   TRUE),
  ('doctor',       'chair', 'view',   TRUE),
  ('admin',        'chair', 'manage', TRUE),
  ('receptionist', 'chair', 'manage', FALSE),
  ('doctor',       'chair', 'manage', FALSE),
  -- Doctor availability
  ('admin',        'availability', 'view',   TRUE),
  ('receptionist', 'availability', 'view',   TRUE),
  ('doctor',       'availability', 'view',   TRUE),
  ('admin',        'availability', 'manage', TRUE),
  ('receptionist', 'availability', 'manage', FALSE),
  ('doctor',       'availability', 'manage', FALSE),
  -- Doctor leave blocks
  ('admin',        'block', 'manage', TRUE),
  ('receptionist', 'block', 'manage', FALSE),
  ('doctor',       'block', 'manage', FALSE),
  -- AI
  ('receptionist', 'ai', 'upload', TRUE),
  ('doctor',       'ai', 'upload', TRUE),
  ('admin',        'ai', 'upload', FALSE),
  ('doctor',       'ai', 'review', TRUE),
  ('admin',        'ai', 'review', FALSE),
  ('receptionist', 'ai', 'review', FALSE)
ON CONFLICT (role, module, action) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. Audit logs: extra context columns
-- ---------------------------------------------------------------------------
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS ip_address TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_agent TEXT;

-- ---------------------------------------------------------------------------
-- 3. Users: account lockout columns
-- ---------------------------------------------------------------------------
ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_failed_at TIMESTAMPTZ;

-- ---------------------------------------------------------------------------
-- 4. Refresh tokens
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash    TEXT NOT NULL,
  expires_at    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at    TIMESTAMPTZ,
  replaced_by_id UUID
);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens (token_hash);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_active ON refresh_tokens (user_id, revoked_at)
  WHERE revoked_at IS NULL;

-- ---------------------------------------------------------------------------
-- 5. Clinic settings (key/value + structured JSON) + clinic_holidays
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS clinic_settings (
  clinic_id   UUID PRIMARY KEY REFERENCES clinics(id) ON DELETE CASCADE,
  settings    JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER trg_clinic_settings_updated_at
  BEFORE UPDATE ON clinic_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS clinic_holidays (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id     UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  holiday_date  DATE NOT NULL,
  reason        TEXT,
  is_recurring  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_clinic_holidays_clinic_date
  ON clinic_holidays (clinic_id, holiday_date);
CREATE TRIGGER trg_clinic_holidays_updated_at
  BEFORE UPDATE ON clinic_holidays
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Seed default settings for the existing default clinic (Mon-Sat 9-9, existing prefixes).
INSERT INTO clinic_settings (clinic_id, settings)
SELECT c.id, jsonb_build_object(
  'clinicName', c.name,
  'weeklyHours', jsonb_build_object(
    '0', jsonb_build_array(),                                   -- Sunday closed
    '1', jsonb_build_array(jsonb_build_object('start','09:00','end','21:00')),
    '2', jsonb_build_array(jsonb_build_object('start','09:00','end','21:00')),
    '3', jsonb_build_array(jsonb_build_object('start','09:00','end','21:00')),
    '4', jsonb_build_array(jsonb_build_object('start','09:00','end','21:00')),
    '5', jsonb_build_array(jsonb_build_object('start','09:00','end','21:00')),
    '6', jsonb_build_array(jsonb_build_object('start','09:00','end','21:00'))
  ),
  'numbering', jsonb_build_object(
    'patient','DWK', 'appointment','APT', 'invoice','INV', 'receipt','RCPT'
  ),
  'templates', jsonb_build_object(
    'invoiceFooter', '', 'smsReminder', 'Hi {patient}, reminder: appt with {doctor} on {date} at {time}.'
  ),
  'tax', jsonb_build_object('rate', 0, 'label', 'GST'),
  'defaults', jsonb_build_object('slotLengthMinutes', 30)
)
FROM clinics c
WHERE NOT EXISTS (SELECT 1 FROM clinic_settings cs WHERE cs.clinic_id = c.id);

-- ---------------------------------------------------------------------------
-- 6. Chairs (operatories)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chairs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id   UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'active',   -- active | inactive | maintenance
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_chairs_clinic ON chairs (clinic_id, status);
CREATE TRIGGER trg_chairs_updated_at
  BEFORE UPDATE ON chairs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 7. Doctor availability extensions + appointments.chair_id + doctor_blocks
-- ---------------------------------------------------------------------------
ALTER TABLE doctor_availability ADD COLUMN IF NOT EXISTS chair_id UUID REFERENCES chairs(id) ON DELETE SET NULL;
ALTER TABLE doctor_availability ADD COLUMN IF NOT EXISTS slot_length INTEGER DEFAULT 30;
ALTER TABLE doctor_availability ADD COLUMN IF NOT EXISTS break_windows JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE doctor_availability ADD COLUMN IF NOT EXISTS max_patients_per_day INTEGER;

ALTER TABLE appointments ADD COLUMN IF NOT EXISTS chair_id UUID REFERENCES chairs(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS doctor_blocks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id   UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  doctor_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  start_at    TIMESTAMPTZ NOT NULL,
  end_at      TIMESTAMPTZ NOT NULL,
  reason      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_doctor_blocks_end_after_start CHECK (end_at > start_at)
);
CREATE INDEX IF NOT EXISTS idx_doctor_blocks_doctor ON doctor_blocks (doctor_id, start_at);
CREATE INDEX IF NOT EXISTS idx_doctor_blocks_clinic ON doctor_blocks (clinic_id, start_at);
CREATE TRIGGER trg_doctor_blocks_updated_at
  BEFORE UPDATE ON doctor_blocks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 8. RLS: enable + permissive service_role (consistent with existing pattern)
--     Backend uses service_role key which bypasses RLS; app layer enforces roles.
-- ---------------------------------------------------------------------------
ALTER TABLE role_permissions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_overrides      ENABLE ROW LEVEL SECURITY;
ALTER TABLE refresh_tokens      ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_settings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_holidays     ENABLE ROW LEVEL SECURITY;
ALTER TABLE chairs              ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_blocks       ENABLE ROW LEVEL SECURITY;

CREATE POLICY role_permissions_service_role_policy
  ON role_permissions FOR ALL TO service_role USING (true);
CREATE POLICY user_overrides_service_role_policy
  ON user_overrides FOR ALL TO service_role USING (true);
CREATE POLICY refresh_tokens_service_role_policy
  ON refresh_tokens FOR ALL TO service_role USING (true);
CREATE POLICY clinic_settings_service_role_policy
  ON clinic_settings FOR ALL TO service_role USING (true);
CREATE POLICY clinic_holidays_service_role_policy
  ON clinic_holidays FOR ALL TO service_role USING (true);
CREATE POLICY chairs_service_role_policy
  ON chairs FOR ALL TO service_role USING (true);
CREATE POLICY doctor_blocks_service_role_policy
  ON doctor_blocks FOR ALL TO service_role USING (true);

-- =============================================================================
-- End of Phase 1 Foundation migration
-- =============================================================================
