-- =============================================================================
-- Dwarka Dental Clinic — Supabase PostgreSQL Migration
-- Generated from Phase 2 Schema Design
-- Target: PostgreSQL 15 (Supabase)
-- All monetary values stored in paise (INTEGER). Never use FLOAT for money.
-- =============================================================================

-- =============================================================================
-- PART 1: ENUM TYPES
-- =============================================================================

CREATE TYPE user_role_enum AS ENUM (
  'admin', 'doctor', 'receptionist', 'assistant', 'lab_technician', 'staff'
);

CREATE TYPE user_status_enum AS ENUM ('active', 'inactive');

CREATE TYPE patient_gender_enum AS ENUM ('male', 'female', 'other');

CREATE TYPE patient_status_enum AS ENUM ('new', 'follow_up', 'completed', 'inactive');

CREATE TYPE appointment_status_enum AS ENUM (
  'scheduled', 'confirmed', 'arrived', 'in_progress',
  'completed', 'missed', 'cancelled', 'rescheduled'
);

CREATE TYPE appointment_priority_enum AS ENUM ('normal', 'high', 'emergency');

CREATE TYPE clinical_record_status_enum AS ENUM ('draft', 'completed', 'edited');

CREATE TYPE dental_finding_surface_enum AS ENUM (
  'mesial', 'distal', 'occlusal', 'buccal', 'lingual', 'all'
);

CREATE TYPE dental_finding_condition_enum AS ENUM (
  'healthy', 'cavity', 'restored', 'missing', 'fractured',
  'root_canal', 'implant', 'crown', 'other'
);

CREATE TYPE invoice_status_enum AS ENUM (
  'draft', 'issued', 'partially_paid', 'paid', 'cancelled'
);

CREATE TYPE payment_method_enum AS ENUM ('cash', 'upi', 'card', 'bank_transfer');

CREATE TYPE payment_status_enum AS ENUM ('pending', 'paid', 'failed', 'refunded');

CREATE TYPE file_type_enum AS ENUM ('xray', 'photo', 'prescription', 'document');

CREATE TYPE ai_report_result_enum AS ENUM ('cavity', 'normal', 'uncertain');

-- NULL means "not yet reviewed" — only 'confirmed' and 'rejected' are valid values
CREATE TYPE ai_report_doctor_review_enum AS ENUM ('confirmed', 'rejected');

CREATE TYPE notification_type_enum AS ENUM (
  'appointment_reminder', 'follow_up', 'payment', 'system'
);

CREATE TYPE notification_channel_enum AS ENUM ('in_app', 'whatsapp', 'email', 'sms');

CREATE TYPE notification_status_enum AS ENUM ('pending', 'sent', 'failed', 'read');

CREATE TYPE audit_log_action_enum AS ENUM (
  'create', 'update', 'delete', 'login', 'export'
);

-- =============================================================================
-- PART 2: TRIGGER FUNCTION FOR updated_at AUTO-UPDATE
-- =============================================================================

-- Reusable trigger function: sets updated_at = NOW() on any UPDATE
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- =============================================================================
-- PART 3: SEQUENCES FOR HUMAN-READABLE IDs
-- =============================================================================

-- patient_number_seq: DWK-YYYY-NNNN
CREATE SEQUENCE IF NOT EXISTS patient_number_seq
  START WITH 1
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;

-- appointment_number_seq: APT-YYYY-NNNN
CREATE SEQUENCE IF NOT EXISTS appointment_number_seq
  START WITH 1
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;

-- invoice_number_seq: INV-YYYY-NNNN
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq
  START WITH 1
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;

-- receipt_number_seq: RCPT-YYYY-NNNN
CREATE SEQUENCE IF NOT EXISTS receipt_number_seq
  START WITH 1
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;

-- =============================================================================
-- PART 4: HELPER FUNCTION FOR FORMATTED SEQUENTIAL IDs
-- =============================================================================

-- Returns formatted IDs like "APT-2026-0001", "DWK-2026-0042", etc.
-- seq_name: the sequence to nextval from
-- prefix:   the string prefix (e.g. 'APT', 'DWK', 'INV', 'RCPT')
-- year:     4-digit year to embed (pass EXTRACT(YEAR FROM NOW())::INT at call site)
CREATE OR REPLACE FUNCTION next_seq_id(
  seq_name TEXT,
  prefix   TEXT,
  year     INT
)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  seq_val BIGINT;
BEGIN
  EXECUTE format('SELECT nextval(%L)', seq_name) INTO seq_val;
  RETURN prefix || '-' || year::TEXT || '-' || LPAD(seq_val::TEXT, 4, '0');
END;
$$;

-- =============================================================================
-- PART 5: TABLES (in dependency order)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 5.1 clinics — Root entity; all other records belong to a clinic
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS clinics (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT        NOT NULL,
  phone               TEXT        NOT NULL,
  -- email stored lowercase (enforced by application layer)
  email               TEXT        NOT NULL,
  -- Inlined from Mongoose embedded addressSchema (_id: false)
  address_line1       TEXT        NOT NULL,
  address_line2       TEXT,
  address_city        TEXT        NOT NULL,
  address_state       TEXT        NOT NULL,
  address_postal_code TEXT        NOT NULL,
  address_country     TEXT        NOT NULL DEFAULT 'India',
  is_active           BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_clinics_email ON clinics (email);

CREATE TRIGGER trg_clinics_updated_at
  BEFORE UPDATE ON clinics
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 5.2 users — Staff accounts for the clinic
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id               UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id        UUID              NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
  name             TEXT              NOT NULL,
  -- email stored lowercase
  email            TEXT              NOT NULL,
  -- passwordHash: select:false in Mongoose; never returned by default queries
  password_hash    TEXT              NOT NULL,
  role             user_role_enum    NOT NULL DEFAULT 'receptionist',
  phone            TEXT,
  specialization   TEXT,
  -- qualifications [String] → TEXT array
  qualifications   TEXT[]            NOT NULL DEFAULT '{}',
  experience_years INTEGER           CHECK (experience_years >= 0),
  -- salary in paise; select:false in Mongoose
  salary           INTEGER,
  status           user_status_enum  NOT NULL DEFAULT 'active',
  last_login_at    TIMESTAMPTZ,
  created_at       TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

-- From userSchema.index({ clinicId: 1, email: 1 }, { unique: true })
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_clinic_email ON users (clinic_id, email);
-- From clinicId: { index: true }
CREATE INDEX IF NOT EXISTS idx_users_clinic_id ON users (clinic_id);
-- For role/status filtering (getAllDoctors, getAllStaff, seed lookup)
CREATE INDEX IF NOT EXISTS idx_users_role_status ON users (clinic_id, role, status);

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 5.3 treatment_categories — Dental treatment types with default durations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS treatment_categories (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id                UUID        NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
  name                     TEXT        NOT NULL,
  -- code stored uppercase (enforced by application layer)
  code                     TEXT        NOT NULL,
  default_duration_minutes INTEGER     CHECK (default_duration_minutes >= 1),
  default_follow_up_days   INTEGER     CHECK (default_follow_up_days >= 0),
  is_active                BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- From treatmentCategorySchema.index({ clinicId: 1, code: 1 }, { unique: true })
CREATE UNIQUE INDEX IF NOT EXISTS idx_treatment_categories_clinic_code
  ON treatment_categories (clinic_id, code);

CREATE TRIGGER trg_treatment_categories_updated_at
  BEFORE UPDATE ON treatment_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 5.4 patients — Patient registry
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS patients (
  id                       UUID                 PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id                UUID                 NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
  -- Sequential human-readable ID; replaces countDocuments() race condition
  patient_number           TEXT                 NOT NULL
    DEFAULT next_seq_id('patient_number_seq', 'DWK', EXTRACT(YEAR FROM NOW())::INT),
  name                     TEXT                 NOT NULL,
  date_of_birth            DATE,
  gender                   patient_gender_enum,
  phone                    TEXT                 NOT NULL,
  email                    TEXT,
  -- address is a flat string per current frontend (not structured)
  address                  TEXT,
  -- Inlined from emergencyContactSchema (_id: false)
  emergency_contact_name   TEXT,
  emergency_contact_relation TEXT,
  emergency_contact_phone  TEXT,
  chief_complaint          TEXT,
  medical_history          TEXT,
  blood_group              TEXT,
  -- allergies [String] → TEXT array
  allergies                TEXT[]               NOT NULL DEFAULT '{}',
  -- medicalAlerts [String] → TEXT array
  medical_alerts           TEXT[]               NOT NULL DEFAULT '{}',
  general_medical_history  TEXT,
  -- treatmentCategoryName denormalized field is DROPPED; derive via JOIN
  assigned_doctor_id       UUID                 REFERENCES users(id) ON DELETE SET NULL,
  treatment_category_id    UUID                 REFERENCES treatment_categories(id) ON DELETE SET NULL,
  status                   patient_status_enum  NOT NULL DEFAULT 'new',
  -- registeredAt has semantic meaning separate from created_at
  registered_at            TIMESTAMPTZ          NOT NULL DEFAULT NOW(),
  last_visit_at            TIMESTAMPTZ,
  next_follow_up_at        TIMESTAMPTZ,
  total_visits             INTEGER              NOT NULL DEFAULT 0 CHECK (total_visits >= 0),
  is_deleted               BOOLEAN              NOT NULL DEFAULT FALSE,
  deleted_at               TIMESTAMPTZ,
  created_at               TIMESTAMPTZ          NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ          NOT NULL DEFAULT NOW()
);

-- From patientSchema.index({ clinicId: 1, patientNumber: 1 }, { unique: true })
CREATE UNIQUE INDEX IF NOT EXISTS idx_patients_clinic_patient_number
  ON patients (clinic_id, patient_number);
-- From patientSchema.index({ clinicId: 1, phone: 1 })
CREATE INDEX IF NOT EXISTS idx_patients_clinic_phone ON patients (clinic_id, phone);
-- Soft-delete filter used in every service query
CREATE INDEX IF NOT EXISTS idx_patients_is_deleted ON patients (is_deleted);
-- For getAllPatients filter by doctorId
CREATE INDEX IF NOT EXISTS idx_patients_assigned_doctor_id ON patients (assigned_doctor_id);

CREATE TRIGGER trg_patients_updated_at
  BEFORE UPDATE ON patients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 5.5 appointments — Dental appointment scheduling
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS appointments (
  id                   UUID                      PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id            UUID                      NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
  -- Sequential human-readable ID
  appointment_number   TEXT                      NOT NULL
    DEFAULT next_seq_id('appointment_number_seq', 'APT', EXTRACT(YEAR FROM NOW())::INT),
  patient_id           UUID                      NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  doctor_id            UUID                      NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  treatment_category_id UUID                     REFERENCES treatment_categories(id) ON DELETE SET NULL,
  start_at             TIMESTAMPTZ               NOT NULL,
  end_at               TIMESTAMPTZ               NOT NULL,
  duration_minutes     INTEGER                   NOT NULL CHECK (duration_minutes >= 1),
  status               appointment_status_enum   NOT NULL DEFAULT 'scheduled',
  priority             appointment_priority_enum NOT NULL DEFAULT 'normal',
  notes                TEXT,
  -- Self-reference for rescheduling chains
  rescheduled_from_id  UUID                      REFERENCES appointments(id) ON DELETE SET NULL,
  created_by_id        UUID                      REFERENCES users(id) ON DELETE SET NULL,
  confirmed_at         TIMESTAMPTZ,
  arrived_at           TIMESTAMPTZ,
  completed_at         TIMESTAMPTZ,
  -- WhatsApp deduplication flag
  reminder_sent        BOOLEAN                   NOT NULL DEFAULT FALSE,
  reminder_sent_at     TIMESTAMPTZ,
  is_deleted           BOOLEAN                   NOT NULL DEFAULT FALSE,
  deleted_at           TIMESTAMPTZ,
  created_at           TIMESTAMPTZ               NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ               NOT NULL DEFAULT NOW(),
  -- Replaces Mongoose pre('validate') hook
  CONSTRAINT chk_appointment_end_after_start CHECK (end_at > start_at)
);

-- From appointmentSchema.index({ clinicId: 1, appointmentNumber: 1 }, { unique: true })
CREATE UNIQUE INDEX IF NOT EXISTS idx_appointments_clinic_number
  ON appointments (clinic_id, appointment_number);
-- From appointmentSchema.index({ clinicId: 1, doctorId: 1, startAt: 1 })
CREATE INDEX IF NOT EXISTS idx_appointments_clinic_doctor_start
  ON appointments (clinic_id, doctor_id, start_at);
-- From appointmentSchema.index({ clinicId: 1, patientId: 1, startAt: -1 })
CREATE INDEX IF NOT EXISTS idx_appointments_clinic_patient_start
  ON appointments (clinic_id, patient_id, start_at DESC);
-- From appointmentSchema.index({ clinicId: 1, status: 1, startAt: 1 })
CREATE INDEX IF NOT EXISTS idx_appointments_clinic_status_start
  ON appointments (clinic_id, status, start_at);
-- For soft-delete filtering
CREATE INDEX IF NOT EXISTS idx_appointments_is_deleted ON appointments (is_deleted);
-- For send-reminders query: start_at range + status + reminder_sent
CREATE INDEX IF NOT EXISTS idx_appointments_reminder
  ON appointments (start_at, status, reminder_sent)
  WHERE is_deleted = FALSE;

CREATE TRIGGER trg_appointments_updated_at
  BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 5.6 doctor_availability — Weekly availability slots per doctor
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS doctor_availability (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id      UUID        NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
  -- Cascade: availability has no meaning without the doctor
  doctor_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- 0=Sunday, 1=Monday, ..., 6=Saturday
  day_of_week    SMALLINT    NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  -- Migrated from HH:MM strings to proper TIME type
  start_time     TIME        NOT NULL,
  end_time       TIME        NOT NULL,
  effective_from DATE        NOT NULL,
  effective_to   DATE,
  is_active      BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_availability_end_after_start CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_doctor_availability_clinic_doctor
  ON doctor_availability (clinic_id, doctor_id);
CREATE INDEX IF NOT EXISTS idx_doctor_availability_doctor_day
  ON doctor_availability (doctor_id, day_of_week);

CREATE TRIGGER trg_doctor_availability_updated_at
  BEFORE UPDATE ON doctor_availability
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 5.7 clinical_records — Per-visit clinical notes and dental chart
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS clinical_records (
  id                    UUID                         PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id             UUID                         NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
  patient_id            UUID                         NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  appointment_id        UUID                         REFERENCES appointments(id) ON DELETE SET NULL,
  doctor_id             UUID                         NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  visit_date            TIMESTAMPTZ                  NOT NULL,
  chief_complaint       TEXT,
  diagnosis             TEXT,
  treatment             TEXT,
  clinical_notes        TEXT,
  -- prescription (stringified JSON anti-pattern) is DROPPED; use prescriptions table
  -- doctorName (denormalized) is DROPPED; derive via JOIN on users
  -- dental_chart: JSONB array of { tooth_number: int, status: string, surfaces: string[], notes: string }
  -- status enum values from actual model: healthy|decay|filled|crown|rct|missing
  dental_chart          JSONB                        NOT NULL DEFAULT '[]'::jsonb,
  follow_up_date        TIMESTAMPTZ,
  follow_up_instructions TEXT,
  status                clinical_record_status_enum  NOT NULL DEFAULT 'draft',
  is_deleted            BOOLEAN                      NOT NULL DEFAULT FALSE,
  deleted_at            TIMESTAMPTZ,
  created_at            TIMESTAMPTZ                  NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ                  NOT NULL DEFAULT NOW()
);

-- From clinicalRecordSchema.index({ clinicId: 1, patientId: 1, visitDate: -1 })
CREATE INDEX IF NOT EXISTS idx_clinical_records_clinic_patient_visit
  ON clinical_records (clinic_id, patient_id, visit_date DESC);
CREATE INDEX IF NOT EXISTS idx_clinical_records_is_deleted
  ON clinical_records (is_deleted);

CREATE TRIGGER trg_clinical_records_updated_at
  BEFORE UPDATE ON clinical_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 5.8 dental_findings — Individual tooth findings per clinical record
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dental_findings (
  id                 UUID                            PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id          UUID                            NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
  patient_id         UUID                            NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  -- Cascade: findings have no meaning without the parent clinical record
  clinical_record_id UUID                            NOT NULL REFERENCES clinical_records(id) ON DELETE CASCADE,
  -- toothNumber is String in Mongoose model (not Number)
  tooth_number       TEXT                            NOT NULL,
  surface            dental_finding_surface_enum     NOT NULL,
  condition          dental_finding_condition_enum   NOT NULL,
  notes              TEXT,
  recorded_by_id     UUID                            NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  -- recordedAt with default Date.now; no created_at/updated_at (timestamps: false)
  recorded_at        TIMESTAMPTZ                     NOT NULL DEFAULT NOW()
);

-- From dentalFindingSchema.index({ clinicId: 1, patientId: 1, toothNumber: 1 })
CREATE INDEX IF NOT EXISTS idx_dental_findings_clinic_patient_tooth
  ON dental_findings (clinic_id, patient_id, tooth_number);

-- No updated_at trigger — timestamps: false in Mongoose model

-- ---------------------------------------------------------------------------
-- 5.9 prescriptions — Prescription header per clinical visit
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS prescriptions (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id          UUID        NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
  patient_id         UUID        NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  -- Cascade: prescription has no meaning without the clinical record
  clinical_record_id UUID        NOT NULL REFERENCES clinical_records(id) ON DELETE CASCADE,
  doctor_id          UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  issued_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- timestamps: { createdAt: true, updatedAt: false } in Mongoose
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- No updated_at column
);

CREATE INDEX IF NOT EXISTS idx_prescriptions_clinical_record_id
  ON prescriptions (clinical_record_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_patient_id
  ON prescriptions (patient_id);

-- No updated_at trigger — updatedAt: false in Mongoose model

-- ---------------------------------------------------------------------------
-- 5.10 prescription_items — Individual medicines within a prescription
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS prescription_items (
  id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id UUID    NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
  medicine_name   TEXT    NOT NULL,
  dosage          TEXT    NOT NULL,
  frequency       TEXT    NOT NULL,
  duration_days   INTEGER NOT NULL CHECK (duration_days >= 1),
  instructions    TEXT
  -- No timestamps — was _id: false embedded subdoc
);

CREATE INDEX IF NOT EXISTS idx_prescription_items_prescription_id
  ON prescription_items (prescription_id);

-- ---------------------------------------------------------------------------
-- 5.11 treatment_plans — Stub table for Invoice.treatmentPlanId FK
-- ---------------------------------------------------------------------------
-- TreatmentPlan model does not exist in the codebase.
-- This stub prevents FK violations and allows future feature expansion.
CREATE TABLE IF NOT EXISTS treatment_plans (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id  UUID        NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- Expand when TreatmentPlan feature is implemented
);

-- ---------------------------------------------------------------------------
-- 5.12 invoices — Billing records; all monetary values in paise
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invoices (
  id                UUID                 PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id         UUID                 NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
  -- Sequential human-readable ID
  invoice_number    TEXT                 NOT NULL
    DEFAULT next_seq_id('invoice_number_seq', 'INV', EXTRACT(YEAR FROM NOW())::INT),
  -- RESTRICT: financial record; never cascade-delete
  patient_id        UUID                 NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  appointment_id    UUID                 REFERENCES appointments(id) ON DELETE SET NULL,
  treatment_plan_id UUID                 REFERENCES treatment_plans(id) ON DELETE SET NULL,
  -- All monetary amounts in paise (integer cents × 100)
  subtotal          INTEGER              NOT NULL CHECK (subtotal >= 0),
  discount          INTEGER              NOT NULL DEFAULT 0 CHECK (discount >= 0),
  tax               INTEGER              NOT NULL DEFAULT 0 CHECK (tax >= 0),
  total             INTEGER              NOT NULL CHECK (total >= 0),
  amount_paid       INTEGER              NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  balance_due       INTEGER              NOT NULL CHECK (balance_due >= 0),
  status            invoice_status_enum  NOT NULL DEFAULT 'draft',
  issued_at         TIMESTAMPTZ,
  due_at            TIMESTAMPTZ,
  created_at        TIMESTAMPTZ          NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ          NOT NULL DEFAULT NOW()
);

-- From invoiceSchema.index({ clinicId: 1, invoiceNumber: 1 }, { unique: true })
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_clinic_invoice_number
  ON invoices (clinic_id, invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_patient_id ON invoices (patient_id);

CREATE TRIGGER trg_invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 5.13 invoice_items — Line items within an invoice; all monetary in paise
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invoice_items (
  id                    UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id            UUID    NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description           TEXT    NOT NULL,
  treatment_category_id UUID    REFERENCES treatment_categories(id) ON DELETE SET NULL,
  quantity              INTEGER NOT NULL CHECK (quantity >= 1),
  -- unit_price: min: 0 in Mongoose (allows free items)
  unit_price            INTEGER NOT NULL CHECK (unit_price >= 0),
  discount              INTEGER NOT NULL DEFAULT 0 CHECK (discount >= 0),
  amount                INTEGER NOT NULL CHECK (amount >= 0)
  -- No timestamps — was _id: false embedded subdoc
);

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items (invoice_id);

-- ---------------------------------------------------------------------------
-- 5.14 payments — Payment records against invoices; all monetary in paise
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payments (
  id                    UUID                  PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id             UUID                  NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
  -- Sequential human-readable receipt number
  receipt_number        TEXT                  NOT NULL
    DEFAULT next_seq_id('receipt_number_seq', 'RCPT', EXTRACT(YEAR FROM NOW())::INT),
  -- RESTRICT: financial record; never cascade-delete invoice
  invoice_id            UUID                  NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
  -- RESTRICT: financial record
  patient_id            UUID                  NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  -- amount: min: 1 in Mongoose (paise; must be > 0)
  amount                INTEGER               NOT NULL CHECK (amount > 0),
  method                payment_method_enum   NOT NULL,
  status                payment_status_enum   NOT NULL DEFAULT 'pending',
  transaction_reference TEXT,
  paid_at               TIMESTAMPTZ,
  notes                 TEXT,
  recorded_by_id        UUID                  NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  is_deleted            BOOLEAN               NOT NULL DEFAULT FALSE,
  deleted_at            TIMESTAMPTZ,
  created_at            TIMESTAMPTZ           NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ           NOT NULL DEFAULT NOW()
);

-- From paymentSchema.index({ clinicId: 1, receiptNumber: 1 }, { unique: true })
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_clinic_receipt_number
  ON payments (clinic_id, receipt_number);
-- From paymentSchema.index({ clinicId: 1, invoiceId: 1, paidAt: -1 })
CREATE INDEX IF NOT EXISTS idx_payments_clinic_invoice_paid_at
  ON payments (clinic_id, invoice_id, paid_at DESC);
-- For revenue aggregation queries (getRevenueSummary, dashboard stats)
CREATE INDEX IF NOT EXISTS idx_payments_is_deleted_paid_at
  ON payments (is_deleted, paid_at);
-- For getPaymentsByPatient
CREATE INDEX IF NOT EXISTS idx_payments_patient_id ON payments (patient_id);

CREATE TRIGGER trg_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 5.15 files — File metadata (X-rays, photos, etc.)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS files (
  id                 UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id          UUID           NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
  patient_id         UUID           NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  clinical_record_id UUID           REFERENCES clinical_records(id) ON DELETE SET NULL,
  uploaded_by_id     UUID           NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  file_type          file_type_enum NOT NULL,
  -- storage_key: local disk filename pre-migration; Supabase Storage path post-migration
  storage_key        TEXT           NOT NULL,
  original_name      TEXT           NOT NULL,
  mime_type          TEXT           NOT NULL,
  size_bytes         INTEGER        NOT NULL CHECK (size_bytes >= 0),
  -- uploadedAt with default Date.now; no created_at/updated_at (timestamps: false)
  uploaded_at        TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- From fileSchema.index({ clinicId: 1, patientId: 1, uploadedAt: -1 })
CREATE INDEX IF NOT EXISTS idx_files_clinic_patient_uploaded_at
  ON files (clinic_id, patient_id, uploaded_at DESC);
-- From fileSchema.index({ storageKey: 1 }, { unique: true })
CREATE UNIQUE INDEX IF NOT EXISTS idx_files_storage_key ON files (storage_key);

-- No updated_at trigger — timestamps: false in Mongoose model

-- ---------------------------------------------------------------------------
-- 5.16 ai_reports — AI X-ray analysis results
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_reports (
  id               UUID                          PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id        UUID                          NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
  patient_id       UUID                          NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  -- RESTRICT: ai_report is meaningless without the source file
  file_id          UUID                          NOT NULL REFERENCES files(id) ON DELETE RESTRICT,
  result           ai_report_result_enum         NOT NULL,
  -- suggestions [String] → TEXT array
  suggestions      TEXT[]                        NOT NULL DEFAULT '{}',
  -- confidence is a decimal fraction (0.0000–1.0000); use NUMERIC not INTEGER
  confidence       NUMERIC(6,4)                  NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  model_version    TEXT                          NOT NULL,
  reviewed_by_id   UUID                          REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at      TIMESTAMPTZ,
  -- NULL = not yet reviewed; 'confirmed' | 'rejected' once reviewed
  doctor_review    ai_report_doctor_review_enum,
  doctor_notes     TEXT,
  -- timestamps: { createdAt: true, updatedAt: false }
  created_at       TIMESTAMPTZ                   NOT NULL DEFAULT NOW()
  -- No updated_at column
);

CREATE INDEX IF NOT EXISTS idx_ai_reports_patient_id_created_at
  ON ai_reports (patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_reports_file_id ON ai_reports (file_id);

-- No updated_at trigger — updatedAt: false in Mongoose model

-- ---------------------------------------------------------------------------
-- 5.17 notifications — In-app and external notification records
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id                 UUID                        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id          UUID                        NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
  recipient_user_id  UUID                        REFERENCES users(id) ON DELETE SET NULL,
  patient_id         UUID                        REFERENCES patients(id) ON DELETE SET NULL,
  appointment_id     UUID                        REFERENCES appointments(id) ON DELETE SET NULL,
  type               notification_type_enum      NOT NULL,
  channel            notification_channel_enum   NOT NULL,
  title              TEXT                        NOT NULL,
  message            TEXT                        NOT NULL,
  status             notification_status_enum    NOT NULL DEFAULT 'pending',
  sent_at            TIMESTAMPTZ,
  read_at            TIMESTAMPTZ,
  error_message      TEXT,
  -- timestamps: { createdAt: true, updatedAt: false }
  created_at         TIMESTAMPTZ                 NOT NULL DEFAULT NOW()
  -- No updated_at column
);

-- From notificationSchema.index({ recipientUserId: 1, status: 1, createdAt: -1 })
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_status_created
  ON notifications (recipient_user_id, status, created_at DESC);

-- No updated_at trigger — updatedAt: false in Mongoose model

-- ---------------------------------------------------------------------------
-- 5.18 audit_logs — Immutable audit trail
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
  id              UUID                    PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id       UUID                    NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
  actor_user_id   UUID                    REFERENCES users(id) ON DELETE SET NULL,
  action          audit_log_action_enum   NOT NULL,
  -- collectionName → table name post-migration
  collection_name TEXT                    NOT NULL,
  -- documentId stored as TEXT UUID; no FK enforcement (references any table)
  document_id     TEXT,
  -- before/after: Mixed → JSONB
  before          JSONB,
  after           JSONB,
  -- timestamps: { createdAt: true, updatedAt: false }; no updatedAt, no soft-delete
  created_at      TIMESTAMPTZ             NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_clinic_id_created_at
  ON audit_logs (clinic_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_user_id
  ON audit_logs (actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_collection_document
  ON audit_logs (collection_name, document_id);

-- No updated_at trigger — updatedAt: false, and audit logs are immutable

-- =============================================================================
-- PART 6: ENABLE ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE clinics             ENABLE ROW LEVEL SECURITY;
ALTER TABLE users               ENABLE ROW LEVEL SECURITY;
ALTER TABLE treatment_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients            ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinical_records    ENABLE ROW LEVEL SECURITY;
ALTER TABLE dental_findings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescriptions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescription_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE treatment_plans     ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices            ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments            ENABLE ROW LEVEL SECURITY;
ALTER TABLE files               ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_reports          ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications       ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs          ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- PART 7: RLS POLICIES
-- =============================================================================
-- The backend ALWAYS uses the service_role key which bypasses RLS.
-- These permissive policies are in place for future RLS expansion
-- (e.g., adding patient-facing or per-clinic policies) without breaking
-- the current architecture. Clinic-level enforcement is done in the
-- application layer (service functions), not in RLS at this stage.

CREATE POLICY clinics_service_role_policy
  ON clinics FOR ALL TO service_role USING (true);

CREATE POLICY users_service_role_policy
  ON users FOR ALL TO service_role USING (true);

CREATE POLICY treatment_categories_service_role_policy
  ON treatment_categories FOR ALL TO service_role USING (true);

CREATE POLICY patients_service_role_policy
  ON patients FOR ALL TO service_role USING (true);

CREATE POLICY appointments_service_role_policy
  ON appointments FOR ALL TO service_role USING (true);

CREATE POLICY doctor_availability_service_role_policy
  ON doctor_availability FOR ALL TO service_role USING (true);

CREATE POLICY clinical_records_service_role_policy
  ON clinical_records FOR ALL TO service_role USING (true);

CREATE POLICY dental_findings_service_role_policy
  ON dental_findings FOR ALL TO service_role USING (true);

CREATE POLICY prescriptions_service_role_policy
  ON prescriptions FOR ALL TO service_role USING (true);

CREATE POLICY prescription_items_service_role_policy
  ON prescription_items FOR ALL TO service_role USING (true);

CREATE POLICY treatment_plans_service_role_policy
  ON treatment_plans FOR ALL TO service_role USING (true);

CREATE POLICY invoices_service_role_policy
  ON invoices FOR ALL TO service_role USING (true);

CREATE POLICY invoice_items_service_role_policy
  ON invoice_items FOR ALL TO service_role USING (true);

CREATE POLICY payments_service_role_policy
  ON payments FOR ALL TO service_role USING (true);

CREATE POLICY files_service_role_policy
  ON files FOR ALL TO service_role USING (true);

CREATE POLICY ai_reports_service_role_policy
  ON ai_reports FOR ALL TO service_role USING (true);

CREATE POLICY notifications_service_role_policy
  ON notifications FOR ALL TO service_role USING (true);

CREATE POLICY audit_logs_service_role_policy
  ON audit_logs FOR ALL TO service_role USING (true);

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
-- Summary of objects created:
--   19 enum types
--    1 trigger function (update_updated_at_column)
--    4 sequences (patient_number_seq, appointment_number_seq,
--                 invoice_number_seq, receipt_number_seq)
--    1 helper function (next_seq_id)
--   18 tables (in dependency order)
--   34 indexes (covering all explicit Mongoose indexes + service query patterns)
--   12 updated_at triggers (on tables with Mongoose timestamps: true)
--   18 RLS ENABLE statements
--   18 RLS policies (service_role permissive FOR ALL)
-- =============================================================================
