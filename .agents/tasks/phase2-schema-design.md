# Phase 2 Schema Design — Dwarka Dental Clinic
## MongoDB Atlas → Supabase PostgreSQL

**Design date:** 2025  
**Workspace root:** `c:\Users\Kunal\OneDrive\Desktop\DwarkaDentalClinic-main`  
**Based on:** Phase 1 audit + direct source code verification of all 15 Mongoose models and 7 service files

---

## Summary

This document provides the complete PostgreSQL schema design for migrating the Dwarka Dental Clinic Management System from MongoDB Atlas to Supabase PostgreSQL. The design covers 18 tables (15 from Mongoose models + 3 child/junction tables: `prescription_items`, `invoice_items`, `treatment_plans` stub). Every column name, type, constraint, and index is grounded in the actual source code read during this investigation.

**Key design decisions:**
1. `dentalChart` embedded array in `ClinicalRecord` → JSONB column `dental_chart` (read/write whole chart atomically; no independent per-tooth queries in services).
2. `ClinicalRecord.prescription` stringified JSON → dropped entirely; prescriptions use `prescriptions` + `prescription_items` tables.
3. `ClinicalRecord.doctorName` denormalized field → dropped; derive via JOIN on `users`.
4. `Patient.treatmentCategoryName` denormalized cache → dropped; derive via JOIN on `treatment_categories`.
5. Monetary amounts → `INTEGER` (paise) throughout, matching the existing convention in all models.
6. `DoctorAvailability.startTime/endTime` HH:MM strings → `TIME` type.
7. Sequential human IDs (APT-YYYY-NNNN etc.) → PostgreSQL sequences + helper function, NOT countDocuments.
8. `User.qualifications` TEXT array → `TEXT[] NOT NULL DEFAULT '{}'` (no join table needed; queried whole).
9. `Patient.allergies` / `Patient.medicalAlerts` → `TEXT[] NOT NULL DEFAULT '{}'`.
10. `AiReport.suggestions` → `TEXT[] NOT NULL DEFAULT '{}'`.

---

## Section 1: Schema Design Decisions

### 1.1 `clinics`

**Purpose:** Root entity; all other entities belong to a clinic via `clinic_id`.  
**Source:** `src/models/clinic.model.js` — `timestamps: true`, `address` embedded schema inlined.

| Column | Type | Nullable | Default | Constraints | Notes |
|--------|------|----------|---------|-------------|-------|
| `id` | UUID | NOT NULL | `gen_random_uuid()` | PRIMARY KEY | Replaces MongoDB `_id` |
| `name` | TEXT | NOT NULL | — | — | clinic name |
| `phone` | TEXT | NOT NULL | — | — | |
| `email` | TEXT | NOT NULL | — | — | lowercase enforced by app layer |
| `address_line1` | TEXT | NOT NULL | — | — | from `address.line1` |
| `address_line2` | TEXT | NULL | — | — | from `address.line2` (optional) |
| `address_city` | TEXT | NOT NULL | — | — | from `address.city` |
| `address_state` | TEXT | NOT NULL | — | — | from `address.state` |
| `address_postal_code` | TEXT | NOT NULL | — | — | from `address.postalCode` |
| `address_country` | TEXT | NOT NULL | `'India'` | — | from `address.country` |
| `is_active` | BOOLEAN | NOT NULL | `TRUE` | — | `isActive` field |
| `created_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | — | Mongoose `createdAt` |
| `updated_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | — | Mongoose `updatedAt` |

**Indexes:** `idx_clinics_email` UNIQUE on `(email)` — implied by `required: true` uniqueness in practice.  
**Triggers:** `update_updated_at_column` on UPDATE.  
**Foreign keys:** None — root table.

---

### 1.2 `users`

**Purpose:** Staff accounts (admin, doctor, receptionist, assistant, lab_technician, staff).  
**Source:** `src/models/user.model.js` — `timestamps: true`.

| Column | Type | Nullable | Default | Constraints | Notes |
|--------|------|----------|---------|-------------|-------|
| `id` | UUID | NOT NULL | `gen_random_uuid()` | PRIMARY KEY | |
| `clinic_id` | UUID | NOT NULL | — | FK → `clinics(id)` ON DELETE RESTRICT | `clinicId` |
| `name` | TEXT | NOT NULL | — | — | |
| `email` | TEXT | NOT NULL | — | — | lowercase |
| `password_hash` | TEXT | NOT NULL | — | — | `passwordHash`; `select: false` in Mongoose |
| `role` | `user_role_enum` | NOT NULL | `'receptionist'` | — | enum enforced |
| `phone` | TEXT | NULL | — | — | |
| `specialization` | TEXT | NULL | — | — | doctor specialization |
| `qualifications` | TEXT[] | NOT NULL | `'{}'` | — | `qualifications [String]` |
| `experience_years` | INTEGER | NULL | — | `CHECK (experience_years >= 0)` | `experienceYears` |
| `salary` | INTEGER | NULL | — | — | in paise; `select: false` in Mongoose |
| `status` | `user_status_enum` | NOT NULL | `'active'` | — | |
| `last_login_at` | TIMESTAMPTZ | NULL | — | — | `lastLoginAt` |
| `created_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | — | |
| `updated_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | — | |

**Indexes:**
- `idx_users_clinic_email` UNIQUE on `(clinic_id, email)` — from `userSchema.index({ clinicId: 1, email: 1 }, { unique: true })`.
- `idx_users_clinic_id` on `(clinic_id)` — from `clinicId: { index: true }`.
- `idx_users_role_status` on `(clinic_id, role, status)` — implied by `auth.service.js` querying `User.find({ role, status })` and seed querying `{ clinicId, role: 'doctor', status: 'active' }`.

**Foreign keys:** `clinic_id` → `clinics(id)` ON DELETE RESTRICT.  
**Triggers:** `update_updated_at_column` on UPDATE.

---

### 1.3 `treatment_categories`

**Purpose:** Dental treatment types with default durations and follow-up intervals.  
**Source:** `src/models/treatment-category.model.js` — `timestamps: true`.

| Column | Type | Nullable | Default | Constraints | Notes |
|--------|------|----------|---------|-------------|-------|
| `id` | UUID | NOT NULL | `gen_random_uuid()` | PRIMARY KEY | |
| `clinic_id` | UUID | NOT NULL | — | FK → `clinics(id)` ON DELETE RESTRICT | |
| `name` | TEXT | NOT NULL | — | — | |
| `code` | TEXT | NOT NULL | — | — | stored uppercase |
| `default_duration_minutes` | INTEGER | NULL | — | `CHECK (default_duration_minutes >= 1)` | `defaultDurationMinutes` |
| `default_follow_up_days` | INTEGER | NULL | — | `CHECK (default_follow_up_days >= 0)` | `defaultFollowUpDays` |
| `is_active` | BOOLEAN | NOT NULL | `TRUE` | — | |
| `created_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | — | |
| `updated_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | — | |

**Indexes:**
- `idx_treatment_categories_clinic_code` UNIQUE on `(clinic_id, code)` — from `treatmentCategorySchema.index({ clinicId: 1, code: 1 }, { unique: true })`.

**Foreign keys:** `clinic_id` → `clinics(id)` ON DELETE RESTRICT.  
**Triggers:** `update_updated_at_column` on UPDATE.

---

### 1.4 `patients`

**Purpose:** Patient registry with medical, contact, and visit summary data.  
**Source:** `src/models/patient.model.js` — `timestamps: true`, `isDeleted` soft-delete.  
**Note:** `treatmentCategoryName` (denormalized cache) is dropped; derive via JOIN. `registeredAt` is kept as a separate column alongside `created_at` since it's set explicitly by the seed and has semantic meaning distinct from row creation.

| Column | Type | Nullable | Default | Constraints | Notes |
|--------|------|----------|---------|-------------|-------|
| `id` | UUID | NOT NULL | `gen_random_uuid()` | PRIMARY KEY | |
| `clinic_id` | UUID | NOT NULL | — | FK → `clinics(id)` ON DELETE RESTRICT | |
| `patient_number` | TEXT | NOT NULL | `next_seq_id('patient_number_seq', 'DWK', EXTRACT(YEAR FROM NOW())::INT)` | — | e.g. `DWK-2026-0001` |
| `name` | TEXT | NOT NULL | — | — | |
| `date_of_birth` | DATE | NULL | — | — | `dateOfBirth` |
| `gender` | `patient_gender_enum` | NULL | — | — | `male\|female\|other` |
| `phone` | TEXT | NOT NULL | — | — | |
| `email` | TEXT | NULL | — | — | |
| `address` | TEXT | NULL | — | — | flat string per frontend |
| `emergency_contact_name` | TEXT | NULL | — | — | from `emergencyContact.name` |
| `emergency_contact_relation` | TEXT | NULL | — | — | from `emergencyContact.relation` |
| `emergency_contact_phone` | TEXT | NULL | — | — | from `emergencyContact.phone` |
| `chief_complaint` | TEXT | NULL | — | — | `chiefComplaint` |
| `medical_history` | TEXT | NULL | — | — | `medicalHistory` |
| `blood_group` | TEXT | NULL | — | — | `bloodGroup` |
| `allergies` | TEXT[] | NOT NULL | `'{}'` | — | `allergies [String]` |
| `medical_alerts` | TEXT[] | NOT NULL | `'{}'` | — | `medicalAlerts [String]` |
| `general_medical_history` | TEXT | NULL | — | — | `generalMedicalHistory` |
| `assigned_doctor_id` | UUID | NULL | — | FK → `users(id)` ON DELETE SET NULL | `assignedDoctorId` |
| `treatment_category_id` | UUID | NULL | — | FK → `treatment_categories(id)` ON DELETE SET NULL | `treatmentCategoryId` |
| `status` | `patient_status_enum` | NOT NULL | `'new'` | — | `new\|follow_up\|completed\|inactive` |
| `registered_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | — | `registeredAt` — explicit registration timestamp |
| `last_visit_at` | TIMESTAMPTZ | NULL | — | — | `lastVisitAt` |
| `next_follow_up_at` | TIMESTAMPTZ | NULL | — | — | `nextFollowUpAt` |
| `total_visits` | INTEGER | NOT NULL | `0` | `CHECK (total_visits >= 0)` | `totalVisits` |
| `is_deleted` | BOOLEAN | NOT NULL | `FALSE` | — | soft delete |
| `deleted_at` | TIMESTAMPTZ | NULL | — | — | set when `is_deleted = true` |
| `created_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | — | |
| `updated_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | — | |

**Indexes:**
- `idx_patients_clinic_patient_number` UNIQUE on `(clinic_id, patient_number)` — from `patientSchema.index({ clinicId: 1, patientNumber: 1 }, { unique: true })`.
- `idx_patients_clinic_phone` on `(clinic_id, phone)` — from `patientSchema.index({ clinicId: 1, phone: 1 })`.
- `idx_patients_is_deleted` on `(is_deleted)` — implied by all service queries filtering `isDeleted: false`.
- `idx_patients_assigned_doctor_id` on `(assigned_doctor_id)` — queried in `getAllPatients` filter by doctorId.

**Foreign keys:** `clinic_id` → RESTRICT; `assigned_doctor_id` → SET NULL; `treatment_category_id` → SET NULL.  
**Triggers:** `update_updated_at_column` on UPDATE.

---

### 1.5 `appointments`

**Purpose:** Scheduled dental appointments with status lifecycle and reminders.  
**Source:** `src/models/appointment.model.js` — `timestamps: true`, `isDeleted`, 4 explicit indexes, `pre('validate')` hook.

| Column | Type | Nullable | Default | Constraints | Notes |
|--------|------|----------|---------|-------------|-------|
| `id` | UUID | NOT NULL | `gen_random_uuid()` | PRIMARY KEY | |
| `clinic_id` | UUID | NOT NULL | — | FK → `clinics(id)` ON DELETE RESTRICT | |
| `appointment_number` | TEXT | NOT NULL | `next_seq_id('appointment_number_seq', 'APT', EXTRACT(YEAR FROM NOW())::INT)` | — | e.g. `APT-2026-0001` |
| `patient_id` | UUID | NOT NULL | — | FK → `patients(id)` ON DELETE RESTRICT | |
| `doctor_id` | UUID | NOT NULL | — | FK → `users(id)` ON DELETE RESTRICT | |
| `treatment_category_id` | UUID | NULL | — | FK → `treatment_categories(id)` ON DELETE SET NULL | |
| `start_at` | TIMESTAMPTZ | NOT NULL | — | — | `startAt` |
| `end_at` | TIMESTAMPTZ | NOT NULL | — | `CHECK (end_at > start_at)` | `endAt`; replaces Mongoose pre-validate hook |
| `duration_minutes` | INTEGER | NOT NULL | — | `CHECK (duration_minutes >= 1)` | `durationMinutes` |
| `status` | `appointment_status_enum` | NOT NULL | `'scheduled'` | — | |
| `priority` | `appointment_priority_enum` | NOT NULL | `'normal'` | — | |
| `notes` | TEXT | NULL | — | — | |
| `rescheduled_from_id` | UUID | NULL | — | FK → `appointments(id)` ON DELETE SET NULL | self-reference |
| `created_by_id` | UUID | NULL | — | FK → `users(id)` ON DELETE SET NULL | `createdById` |
| `confirmed_at` | TIMESTAMPTZ | NULL | — | — | `confirmedAt` |
| `arrived_at` | TIMESTAMPTZ | NULL | — | — | `arrivedAt` |
| `completed_at` | TIMESTAMPTZ | NULL | — | — | `completedAt` |
| `reminder_sent` | BOOLEAN | NOT NULL | `FALSE` | — | WhatsApp dedup |
| `reminder_sent_at` | TIMESTAMPTZ | NULL | — | — | `reminderSentAt` |
| `is_deleted` | BOOLEAN | NOT NULL | `FALSE` | — | soft delete |
| `deleted_at` | TIMESTAMPTZ | NULL | — | — | |
| `created_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | — | |
| `updated_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | — | |

**Indexes:**
- `idx_appointments_clinic_number` UNIQUE on `(clinic_id, appointment_number)`.
- `idx_appointments_clinic_doctor_start` on `(clinic_id, doctor_id, start_at)`.
- `idx_appointments_clinic_patient_start` on `(clinic_id, patient_id, start_at DESC)`.
- `idx_appointments_clinic_status_start` on `(clinic_id, status, start_at)`.
- `idx_appointments_is_deleted` on `(is_deleted)`.
- `idx_appointments_reminder` on `(start_at, status, reminder_sent)` where `is_deleted = FALSE` — for `send-reminders` query.

**Foreign keys:** `clinic_id`, `patient_id`, `doctor_id` → RESTRICT; `treatment_category_id`, `rescheduled_from_id`, `created_by_id` → SET NULL.  
**CHECK constraints:** `CHECK (end_at > start_at)`, `CHECK (duration_minutes >= 1)`.  
**Triggers:** `update_updated_at_column` on UPDATE.

---

### 1.6 `doctor_availability`

**Purpose:** Weekly schedule slots per doctor.  
**Source:** `src/models/doctor-availability.model.js` — `timestamps: true`. Note: no explicit Mongoose indexes.

| Column | Type | Nullable | Default | Constraints | Notes |
|--------|------|----------|---------|-------------|-------|
| `id` | UUID | NOT NULL | `gen_random_uuid()` | PRIMARY KEY | |
| `clinic_id` | UUID | NOT NULL | — | FK → `clinics(id)` ON DELETE RESTRICT | |
| `doctor_id` | UUID | NOT NULL | — | FK → `users(id)` ON DELETE CASCADE | cascade: availability meaningless without the doctor |
| `day_of_week` | SMALLINT | NOT NULL | — | `CHECK (day_of_week BETWEEN 0 AND 6)` | 0=Sunday … 6=Saturday |
| `start_time` | TIME | NOT NULL | — | — | was `HH:MM` string |
| `end_time` | TIME | NOT NULL | — | `CHECK (end_time > start_time)` | was `HH:MM` string |
| `effective_from` | DATE | NOT NULL | — | — | `effectiveFrom` |
| `effective_to` | DATE | NULL | — | — | `effectiveTo` |
| `is_active` | BOOLEAN | NOT NULL | `TRUE` | — | |
| `created_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | — | |
| `updated_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | — | |

**Indexes:**
- `idx_doctor_availability_clinic_doctor` on `(clinic_id, doctor_id)` — implied; any schedule lookup is by clinic+doctor.
- `idx_doctor_availability_doctor_day` on `(doctor_id, day_of_week)` — for slot lookup.

**Foreign keys:** `clinic_id` → RESTRICT; `doctor_id` → CASCADE.  
**CHECK constraints:** `CHECK (day_of_week BETWEEN 0 AND 6)`, `CHECK (end_time > start_time)`.  
**Triggers:** `update_updated_at_column` on UPDATE.

---

### 1.7 `clinical_records`

**Purpose:** Per-visit clinical notes, diagnosis, treatment, and dental chart.  
**Source:** `src/models/clinical-record.model.js` — `timestamps: true`, `isDeleted`.  
**Design notes:**  
- `prescription` (stringified JSON) column is **dropped**; prescriptions live in `prescriptions` + `prescription_items`.  
- `doctorName` denormalized field is **dropped**; derive via JOIN on `users`.  
- `dentalChart` embedded array → JSONB `dental_chart` column; JSONB items: `[{"tooth_number": int, "status": string, "surfaces": string[], "notes": string}]`.  
- `dentalChart[].status` enum from Mongoose: `healthy|decay|filled|crown|rct|missing` (verified from model source — NOT the values listed in Phase 1 audit which said `healthy|cavity|restored|...`; the actual model has `healthy|decay|filled|crown|rct|missing`).

| Column | Type | Nullable | Default | Constraints | Notes |
|--------|------|----------|---------|-------------|-------|
| `id` | UUID | NOT NULL | `gen_random_uuid()` | PRIMARY KEY | |
| `clinic_id` | UUID | NOT NULL | — | FK → `clinics(id)` ON DELETE RESTRICT | |
| `patient_id` | UUID | NOT NULL | — | FK → `patients(id)` ON DELETE RESTRICT | |
| `appointment_id` | UUID | NULL | — | FK → `appointments(id)` ON DELETE SET NULL | optional |
| `doctor_id` | UUID | NOT NULL | — | FK → `users(id)` ON DELETE RESTRICT | |
| `visit_date` | TIMESTAMPTZ | NOT NULL | — | — | `visitDate` |
| `chief_complaint` | TEXT | NULL | — | — | |
| `diagnosis` | TEXT | NULL | — | — | |
| `treatment` | TEXT | NULL | — | — | |
| `clinical_notes` | TEXT | NULL | — | — | `clinicalNotes` |
| `dental_chart` | JSONB | NOT NULL | `'[]'::jsonb` | — | replaces `dentalChart` embedded array |
| `follow_up_date` | TIMESTAMPTZ | NULL | — | — | `followUpDate` |
| `follow_up_instructions` | TEXT | NULL | — | — | `followUpInstructions` |
| `status` | `clinical_record_status_enum` | NOT NULL | `'draft'` | — | `draft\|completed\|edited` |
| `is_deleted` | BOOLEAN | NOT NULL | `FALSE` | — | |
| `deleted_at` | TIMESTAMPTZ | NULL | — | — | |
| `created_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | — | |
| `updated_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | — | |

**Indexes:**
- `idx_clinical_records_clinic_patient_visit` on `(clinic_id, patient_id, visit_date DESC)` — from `clinicalRecordSchema.index({ clinicId: 1, patientId: 1, visitDate: -1 })`.
- `idx_clinical_records_is_deleted` on `(is_deleted)`.

**Foreign keys:** `clinic_id`, `patient_id`, `doctor_id` → RESTRICT; `appointment_id` → SET NULL.  
**Triggers:** `update_updated_at_column` on UPDATE.

---

### 1.8 `dental_findings`

**Purpose:** Individual tooth-level clinical findings per clinical record visit.  
**Source:** `src/models/dental-finding.model.js` — `timestamps: false` (no `updatedAt`); explicit `recorded_at`.

| Column | Type | Nullable | Default | Constraints | Notes |
|--------|------|----------|---------|-------------|-------|
| `id` | UUID | NOT NULL | `gen_random_uuid()` | PRIMARY KEY | |
| `clinic_id` | UUID | NOT NULL | — | FK → `clinics(id)` ON DELETE RESTRICT | |
| `patient_id` | UUID | NOT NULL | — | FK → `patients(id)` ON DELETE RESTRICT | |
| `clinical_record_id` | UUID | NOT NULL | — | FK → `clinical_records(id)` ON DELETE CASCADE | |
| `tooth_number` | TEXT | NOT NULL | — | — | `toothNumber` (String in model) |
| `surface` | `dental_finding_surface_enum` | NOT NULL | — | — | `mesial\|distal\|occlusal\|buccal\|lingual\|all` |
| `condition` | `dental_finding_condition_enum` | NOT NULL | — | — | `healthy\|cavity\|restored\|missing\|fractured\|root_canal\|implant\|crown\|other` |
| `notes` | TEXT | NULL | — | — | |
| `recorded_by_id` | UUID | NOT NULL | — | FK → `users(id)` ON DELETE RESTRICT | `recordedById` |
| `recorded_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | — | `recordedAt` |

**Note:** No `created_at`/`updated_at` — Mongoose model has `timestamps: false`; only `recorded_at`.

**Indexes:**
- `idx_dental_findings_clinic_patient_tooth` on `(clinic_id, patient_id, tooth_number)` — from `dentalFindingSchema.index({ clinicId: 1, patientId: 1, toothNumber: 1 })`.

**Foreign keys:** `clinic_id`, `patient_id`, `recorded_by_id` → RESTRICT; `clinical_record_id` → CASCADE.

---

### 1.9 `prescriptions`

**Purpose:** Prescription header records per clinical visit.  
**Source:** `src/models/prescription.model.js` — `timestamps: { createdAt: true, updatedAt: false }`.

| Column | Type | Nullable | Default | Constraints | Notes |
|--------|------|----------|---------|-------------|-------|
| `id` | UUID | NOT NULL | `gen_random_uuid()` | PRIMARY KEY | |
| `clinic_id` | UUID | NOT NULL | — | FK → `clinics(id)` ON DELETE RESTRICT | |
| `patient_id` | UUID | NOT NULL | — | FK → `patients(id)` ON DELETE RESTRICT | |
| `clinical_record_id` | UUID | NOT NULL | — | FK → `clinical_records(id)` ON DELETE CASCADE | |
| `doctor_id` | UUID | NOT NULL | — | FK → `users(id)` ON DELETE RESTRICT | |
| `issued_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | — | `issuedAt` |
| `created_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | — | Mongoose `createdAt` only |

**Note:** No `updated_at` — Mongoose has `updatedAt: false`.

**Indexes:**
- `idx_prescriptions_clinical_record_id` on `(clinical_record_id)` — child records of a clinical record.
- `idx_prescriptions_patient_id` on `(patient_id)` — lookup by patient.

**Foreign keys:** `clinic_id`, `patient_id`, `doctor_id` → RESTRICT; `clinical_record_id` → CASCADE.

---

### 1.10 `prescription_items`

**Purpose:** Individual line items within a prescription (medicines).  
**Source:** `prescriptionItemSchema` embedded in `prescription.model.js` (`_id: false`).

| Column | Type | Nullable | Default | Constraints | Notes |
|--------|------|----------|---------|-------------|-------|
| `id` | UUID | NOT NULL | `gen_random_uuid()` | PRIMARY KEY | |
| `prescription_id` | UUID | NOT NULL | — | FK → `prescriptions(id)` ON DELETE CASCADE | |
| `medicine_name` | TEXT | NOT NULL | — | — | `medicineName` |
| `dosage` | TEXT | NOT NULL | — | — | |
| `frequency` | TEXT | NOT NULL | — | — | |
| `duration_days` | INTEGER | NOT NULL | — | `CHECK (duration_days >= 1)` | `durationDays` |
| `instructions` | TEXT | NULL | — | — | |

**Note:** No timestamps — was `_id: false` embedded subdoc.

**Indexes:**
- `idx_prescription_items_prescription_id` on `(prescription_id)` — for fetching items by prescription.

**Foreign keys:** `prescription_id` → CASCADE.

---

### 1.11 `treatment_plans` (stub)

**Purpose:** Stub table to satisfy the FK from `invoices.treatment_plan_id`. The `TreatmentPlan` model does not exist in the codebase; this table allows future expansion without schema changes.  
**Source:** `Invoice.treatmentPlanId` in `src/models/invoice.model.js` references `'TreatmentPlan'` which has no corresponding model file.

| Column | Type | Nullable | Default | Constraints | Notes |
|--------|------|----------|---------|-------------|-------|
| `id` | UUID | NOT NULL | `gen_random_uuid()` | PRIMARY KEY | |
| `clinic_id` | UUID | NOT NULL | — | FK → `clinics(id)` ON DELETE RESTRICT | |
| `created_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | — | |

**Note:** Intentionally minimal. No `updated_at`. Expand when TreatmentPlan feature is built.

**Foreign keys:** `clinic_id` → RESTRICT.

---

### 1.12 `invoices`

**Purpose:** Billing records per patient visit.  
**Source:** `src/models/invoice.model.js` — `timestamps: true`. All monetary amounts in paise (INTEGER).

| Column | Type | Nullable | Default | Constraints | Notes |
|--------|------|----------|---------|-------------|-------|
| `id` | UUID | NOT NULL | `gen_random_uuid()` | PRIMARY KEY | |
| `clinic_id` | UUID | NOT NULL | — | FK → `clinics(id)` ON DELETE RESTRICT | |
| `invoice_number` | TEXT | NOT NULL | `next_seq_id('invoice_number_seq', 'INV', EXTRACT(YEAR FROM NOW())::INT)` | — | e.g. `INV-2026-0001` |
| `patient_id` | UUID | NOT NULL | — | FK → `patients(id)` ON DELETE RESTRICT | financial record |
| `appointment_id` | UUID | NULL | — | FK → `appointments(id)` ON DELETE SET NULL | optional |
| `treatment_plan_id` | UUID | NULL | — | FK → `treatment_plans(id)` ON DELETE SET NULL | nullable stub FK |
| `subtotal` | INTEGER | NOT NULL | — | `CHECK (subtotal >= 0)` | paise |
| `discount` | INTEGER | NOT NULL | `0` | `CHECK (discount >= 0)` | paise |
| `tax` | INTEGER | NOT NULL | `0` | `CHECK (tax >= 0)` | paise |
| `total` | INTEGER | NOT NULL | — | `CHECK (total >= 0)` | paise |
| `amount_paid` | INTEGER | NOT NULL | `0` | `CHECK (amount_paid >= 0)` | `amountPaid`, paise |
| `balance_due` | INTEGER | NOT NULL | — | `CHECK (balance_due >= 0)` | paise |
| `status` | `invoice_status_enum` | NOT NULL | `'draft'` | — | `draft\|issued\|partially_paid\|paid\|cancelled` |
| `issued_at` | TIMESTAMPTZ | NULL | — | — | `issuedAt` |
| `due_at` | TIMESTAMPTZ | NULL | — | — | `dueAt` |
| `created_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | — | |
| `updated_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | — | |

**Indexes:**
- `idx_invoices_clinic_invoice_number` UNIQUE on `(clinic_id, invoice_number)` — from `invoiceSchema.index({ clinicId: 1, invoiceNumber: 1 }, { unique: true })`.
- `idx_invoices_patient_id` on `(patient_id)` — for `getPaymentsByPatient` which creates invoices per payment.

**Foreign keys:** `clinic_id`, `patient_id` → RESTRICT; `appointment_id`, `treatment_plan_id` → SET NULL.  
**CHECK constraints:** `subtotal >= 0`, `discount >= 0`, `tax >= 0`, `total >= 0`, `amount_paid >= 0`, `balance_due >= 0`.  
**Triggers:** `update_updated_at_column` on UPDATE.

---

### 1.13 `invoice_items`

**Purpose:** Line items within an invoice.  
**Source:** `invoiceItemSchema` embedded in `invoice.model.js` (`_id: false`). All monetary amounts in paise.

| Column | Type | Nullable | Default | Constraints | Notes |
|--------|------|----------|---------|-------------|-------|
| `id` | UUID | NOT NULL | `gen_random_uuid()` | PRIMARY KEY | |
| `invoice_id` | UUID | NOT NULL | — | FK → `invoices(id)` ON DELETE CASCADE | |
| `description` | TEXT | NOT NULL | — | — | |
| `treatment_category_id` | UUID | NULL | — | FK → `treatment_categories(id)` ON DELETE SET NULL | optional |
| `quantity` | INTEGER | NOT NULL | — | `CHECK (quantity >= 1)` | |
| `unit_price` | INTEGER | NOT NULL | — | `CHECK (unit_price >= 0)` | paise; `unitPrice` |
| `discount` | INTEGER | NOT NULL | `0` | `CHECK (discount >= 0)` | paise |
| `amount` | INTEGER | NOT NULL | — | `CHECK (amount >= 0)` | paise; computed: `(unit_price * quantity) - discount` |

**Note:** No timestamps — was `_id: false` embedded subdoc.

**Indexes:**
- `idx_invoice_items_invoice_id` on `(invoice_id)`.

**Foreign keys:** `invoice_id` → CASCADE; `treatment_category_id` → SET NULL.

---

### 1.14 `payments`

**Purpose:** Actual payment records against invoices.  
**Source:** `src/models/payment.model.js` — `timestamps: true`, `isDeleted`.

| Column | Type | Nullable | Default | Constraints | Notes |
|--------|------|----------|---------|-------------|-------|
| `id` | UUID | NOT NULL | `gen_random_uuid()` | PRIMARY KEY | |
| `clinic_id` | UUID | NOT NULL | — | FK → `clinics(id)` ON DELETE RESTRICT | |
| `receipt_number` | TEXT | NOT NULL | `next_seq_id('receipt_number_seq', 'RCPT', EXTRACT(YEAR FROM NOW())::INT)` | — | e.g. `RCPT-2026-0001` |
| `invoice_id` | UUID | NOT NULL | — | FK → `invoices(id)` ON DELETE RESTRICT | financial record; RESTRICT prevents orphan |
| `patient_id` | UUID | NOT NULL | — | FK → `patients(id)` ON DELETE RESTRICT | financial record |
| `amount` | INTEGER | NOT NULL | — | `CHECK (amount > 0)` | paise; `min: 1` in model |
| `method` | `payment_method_enum` | NOT NULL | — | — | `cash\|upi\|card\|bank_transfer` |
| `status` | `payment_status_enum` | NOT NULL | `'pending'` | — | `pending\|paid\|failed\|refunded` |
| `transaction_reference` | TEXT | NULL | — | — | `transactionReference` |
| `paid_at` | TIMESTAMPTZ | NULL | — | — | `paidAt` |
| `notes` | TEXT | NULL | — | — | |
| `recorded_by_id` | UUID | NOT NULL | — | FK → `users(id)` ON DELETE RESTRICT | `recordedById` |
| `is_deleted` | BOOLEAN | NOT NULL | `FALSE` | — | |
| `deleted_at` | TIMESTAMPTZ | NULL | — | — | |
| `created_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | — | |
| `updated_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | — | |

**Indexes:**
- `idx_payments_clinic_receipt_number` UNIQUE on `(clinic_id, receipt_number)` — from `paymentSchema.index({ clinicId: 1, receiptNumber: 1 }, { unique: true })`.
- `idx_payments_clinic_invoice_paid_at` on `(clinic_id, invoice_id, paid_at DESC)` — from `paymentSchema.index({ clinicId: 1, invoiceId: 1, paidAt: -1 })`.
- `idx_payments_is_deleted_paid_at` on `(is_deleted, paid_at)` — for revenue aggregation queries in `payment.service.js` and `routes/index.js`.
- `idx_payments_patient_id` on `(patient_id)` — for `getPaymentsByPatient`.

**Foreign keys:** `clinic_id`, `invoice_id`, `patient_id`, `recorded_by_id` → RESTRICT.  
**CHECK constraints:** `CHECK (amount > 0)`.  
**Triggers:** `update_updated_at_column` on UPDATE.

---

### 1.15 `files`

**Purpose:** File metadata for uploaded X-rays, photos, prescriptions, and documents.  
**Source:** `src/models/file.model.js` — `timestamps: false`; only `uploaded_at`.

| Column | Type | Nullable | Default | Constraints | Notes |
|--------|------|----------|---------|-------------|-------|
| `id` | UUID | NOT NULL | `gen_random_uuid()` | PRIMARY KEY | |
| `clinic_id` | UUID | NOT NULL | — | FK → `clinics(id)` ON DELETE RESTRICT | |
| `patient_id` | UUID | NOT NULL | — | FK → `patients(id)` ON DELETE RESTRICT | |
| `clinical_record_id` | UUID | NULL | — | FK → `clinical_records(id)` ON DELETE SET NULL | optional |
| `uploaded_by_id` | UUID | NOT NULL | — | FK → `users(id)` ON DELETE RESTRICT | `uploadedById` |
| `file_type` | `file_type_enum` | NOT NULL | — | — | `xray\|photo\|prescription\|document` |
| `storage_key` | TEXT | NOT NULL | — | UNIQUE | Supabase Storage path post-migration |
| `original_name` | TEXT | NOT NULL | — | — | `originalName` |
| `mime_type` | TEXT | NOT NULL | — | — | `mimeType` |
| `size_bytes` | INTEGER | NOT NULL | — | `CHECK (size_bytes >= 0)` | `sizeBytes` |
| `uploaded_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | — | `uploadedAt` |

**Note:** No `created_at`/`updated_at` — Mongoose model has `timestamps: false`.

**Indexes:**
- `idx_files_clinic_patient_uploaded_at` on `(clinic_id, patient_id, uploaded_at DESC)` — from `fileSchema.index({ clinicId: 1, patientId: 1, uploadedAt: -1 })`.
- `idx_files_storage_key` UNIQUE on `(storage_key)` — from `fileSchema.index({ storageKey: 1 }, { unique: true })`.

**Foreign keys:** `clinic_id`, `patient_id`, `uploaded_by_id` → RESTRICT; `clinical_record_id` → SET NULL.

---

### 1.16 `ai_reports`

**Purpose:** AI X-ray analysis results with doctor review status.  
**Source:** `src/models/ai-report.model.js` — `timestamps: { createdAt: true, updatedAt: false }`.

| Column | Type | Nullable | Default | Constraints | Notes |
|--------|------|----------|---------|-------------|-------|
| `id` | UUID | NOT NULL | `gen_random_uuid()` | PRIMARY KEY | |
| `clinic_id` | UUID | NOT NULL | — | FK → `clinics(id)` ON DELETE RESTRICT | |
| `patient_id` | UUID | NOT NULL | — | FK → `patients(id)` ON DELETE RESTRICT | |
| `file_id` | UUID | NOT NULL | — | FK → `files(id)` ON DELETE RESTRICT | source X-ray file |
| `result` | `ai_report_result_enum` | NOT NULL | — | — | `cavity\|normal\|uncertain` |
| `suggestions` | TEXT[] | NOT NULL | `'{}'` | — | AI suggestion strings |
| `confidence` | NUMERIC(6,4) | NOT NULL | — | `CHECK (confidence BETWEEN 0 AND 1)` | 0–1 float; NUMERIC not INTEGER |
| `model_version` | TEXT | NOT NULL | — | — | `modelVersion` |
| `reviewed_by_id` | UUID | NULL | — | FK → `users(id)` ON DELETE SET NULL | `reviewedById` |
| `reviewed_at` | TIMESTAMPTZ | NULL | — | — | `reviewedAt` |
| `doctor_review` | `ai_report_doctor_review_enum` | NULL | `NULL` | — | `confirmed\|rejected` (null means not yet reviewed) |
| `doctor_notes` | TEXT | NULL | — | — | `doctorNotes` |
| `created_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | — | Mongoose `createdAt` only |

**Note:** No `updated_at` — Mongoose has `updatedAt: false`. `confidence` uses `NUMERIC(6,4)` because it is a genuine decimal fraction (0.0000 – 1.0000), not a monetary amount.

**Indexes:**
- `idx_ai_reports_patient_id_created_at` on `(patient_id, created_at DESC)` — implied by `getAiReportsByPatient` sort.
- `idx_ai_reports_file_id` on `(file_id)` — for FK lookups.

**Foreign keys:** `clinic_id`, `patient_id`, `file_id` → RESTRICT; `reviewed_by_id` → SET NULL.

---

### 1.17 `notifications`

**Purpose:** In-app, WhatsApp, email, and SMS notification records.  
**Source:** `src/models/notification.model.js` — `timestamps: { createdAt: true, updatedAt: false }`.

| Column | Type | Nullable | Default | Constraints | Notes |
|--------|------|----------|---------|-------------|-------|
| `id` | UUID | NOT NULL | `gen_random_uuid()` | PRIMARY KEY | |
| `clinic_id` | UUID | NOT NULL | — | FK → `clinics(id)` ON DELETE RESTRICT | |
| `recipient_user_id` | UUID | NULL | — | FK → `users(id)` ON DELETE SET NULL | `recipientUserId` |
| `patient_id` | UUID | NULL | — | FK → `patients(id)` ON DELETE SET NULL | optional |
| `appointment_id` | UUID | NULL | — | FK → `appointments(id)` ON DELETE SET NULL | optional |
| `type` | `notification_type_enum` | NOT NULL | — | — | `appointment_reminder\|follow_up\|payment\|system` |
| `channel` | `notification_channel_enum` | NOT NULL | — | — | `in_app\|whatsapp\|email\|sms` |
| `title` | TEXT | NOT NULL | — | — | |
| `message` | TEXT | NOT NULL | — | — | |
| `status` | `notification_status_enum` | NOT NULL | `'pending'` | — | `pending\|sent\|failed\|read` |
| `sent_at` | TIMESTAMPTZ | NULL | — | — | `sentAt` |
| `read_at` | TIMESTAMPTZ | NULL | — | — | `readAt` |
| `error_message` | TEXT | NULL | — | — | `errorMessage` |
| `created_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | — | Mongoose `createdAt` only |

**Note:** No `updated_at` — Mongoose has `updatedAt: false`.

**Indexes:**
- `idx_notifications_recipient_status_created` on `(recipient_user_id, status, created_at DESC)` — from `notificationSchema.index({ recipientUserId: 1, status: 1, createdAt: -1 })`.

**Foreign keys:** `clinic_id` → RESTRICT; `recipient_user_id`, `patient_id`, `appointment_id` → SET NULL.

---

### 1.18 `audit_logs`

**Purpose:** Immutable audit trail of all create/update/delete/login/export actions.  
**Source:** `src/models/audit-log.model.js` — `timestamps: { createdAt: true, updatedAt: false }`.

| Column | Type | Nullable | Default | Constraints | Notes |
|--------|------|----------|---------|-------------|-------|
| `id` | UUID | NOT NULL | `gen_random_uuid()` | PRIMARY KEY | |
| `clinic_id` | UUID | NOT NULL | — | FK → `clinics(id)` ON DELETE RESTRICT | |
| `actor_user_id` | UUID | NULL | — | FK → `users(id)` ON DELETE SET NULL | `actorUserId` |
| `action` | `audit_log_action_enum` | NOT NULL | — | — | `create\|update\|delete\|login\|export` |
| `collection_name` | TEXT | NOT NULL | — | — | `collectionName`; becomes table name post-migration |
| `document_id` | TEXT | NULL | — | — | UUID string; no FK enforcement (generic reference) |
| `before` | JSONB | NULL | — | — | `before` Mixed → JSONB |
| `after` | JSONB | NULL | — | — | `after` Mixed → JSONB |
| `created_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | — | Mongoose `createdAt` only |

**Note:** No `updated_at` — audit logs are immutable. No `is_deleted` — audit logs must never be soft-deleted.

**Indexes:**
- `idx_audit_logs_clinic_id_created_at` on `(clinic_id, created_at DESC)` — for paginated audit queries.
- `idx_audit_logs_actor_user_id` on `(actor_user_id)` — for per-user audit trail.
- `idx_audit_logs_collection_document` on `(collection_name, document_id)` — for per-record history lookup.

**Foreign keys:** `clinic_id` → RESTRICT; `actor_user_id` → SET NULL.

---

## Section 2: Enum Types

| Enum Name | Values |
|-----------|--------|
| `user_role_enum` | `admin`, `doctor`, `receptionist`, `assistant`, `lab_technician`, `staff` |
| `user_status_enum` | `active`, `inactive` |
| `patient_gender_enum` | `male`, `female`, `other` |
| `patient_status_enum` | `new`, `follow_up`, `completed`, `inactive` |
| `appointment_status_enum` | `scheduled`, `confirmed`, `arrived`, `in_progress`, `completed`, `missed`, `cancelled`, `rescheduled` |
| `appointment_priority_enum` | `normal`, `high`, `emergency` |
| `clinical_record_status_enum` | `draft`, `completed`, `edited` |
| `dental_finding_surface_enum` | `mesial`, `distal`, `occlusal`, `buccal`, `lingual`, `all` |
| `dental_finding_condition_enum` | `healthy`, `cavity`, `restored`, `missing`, `fractured`, `root_canal`, `implant`, `crown`, `other` |
| `invoice_status_enum` | `draft`, `issued`, `partially_paid`, `paid`, `cancelled` |
| `payment_method_enum` | `cash`, `upi`, `card`, `bank_transfer` |
| `payment_status_enum` | `pending`, `paid`, `failed`, `refunded` |
| `file_type_enum` | `xray`, `photo`, `prescription`, `document` |
| `ai_report_result_enum` | `cavity`, `normal`, `uncertain` |
| `ai_report_doctor_review_enum` | `confirmed`, `rejected` |
| `notification_type_enum` | `appointment_reminder`, `follow_up`, `payment`, `system` |
| `notification_channel_enum` | `in_app`, `whatsapp`, `email`, `sms` |
| `notification_status_enum` | `pending`, `sent`, `failed`, `read` |
| `audit_log_action_enum` | `create`, `update`, `delete`, `login`, `export` |

**Total: 19 enum types**

---

## Section 3: Sequences

| Sequence Name | Entity | Format | Example |
|---------------|--------|--------|---------|
| `patient_number_seq` | patients | `DWK-YYYY-NNNN` | `DWK-2026-0001` |
| `appointment_number_seq` | appointments | `APT-YYYY-NNNN` | `APT-2026-0001` |
| `invoice_number_seq` | invoices | `INV-YYYY-NNNN` | `INV-2026-0001` |
| `receipt_number_seq` | payments | `RCPT-YYYY-NNNN` | `RCPT-2026-0001` |

**Helper function:** `next_seq_id(seq_name TEXT, prefix TEXT, year INT) RETURNS TEXT`  
- Increments the named sequence and formats: `prefix || '-' || year || '-' || LPAD(nextval::TEXT, 4, '0')`
- Called as column DEFAULT: `DEFAULT next_seq_id('patient_number_seq', 'DWK', EXTRACT(YEAR FROM NOW())::INT)`

**Important note on year rollover:** The sequences are global counters — they do not reset per year. For YYYY in the formatted string, the year is injected from `NOW()` at insert time. This means a sequence started in 2026 will continue into 2027 with the same sequential counter (e.g., `DWK-2027-0016` after `DWK-2026-0015`). This matches the original `countDocuments()` behavior and avoids complexity. If per-year reset is required in the future, a dedicated counter table with a `(prefix, year)` key would be needed.

---

## Section 4: RLS Policies

RLS is enabled on ALL tables. The application always uses the `service_role` key which bypasses RLS. A single permissive `FOR ALL USING (true)` policy is created per table to allow future RLS expansion without breaking the current architecture.

| Table | Policy Name | Role | Command | Using |
|-------|-------------|------|---------|-------|
| `clinics` | `clinics_service_role_policy` | `service_role` | `ALL` | `true` |
| `users` | `users_service_role_policy` | `service_role` | `ALL` | `true` |
| `treatment_categories` | `treatment_categories_service_role_policy` | `service_role` | `ALL` | `true` |
| `patients` | `patients_service_role_policy` | `service_role` | `ALL` | `true` |
| `appointments` | `appointments_service_role_policy` | `service_role` | `ALL` | `true` |
| `doctor_availability` | `doctor_availability_service_role_policy` | `service_role` | `ALL` | `true` |
| `clinical_records` | `clinical_records_service_role_policy` | `service_role` | `ALL` | `true` |
| `dental_findings` | `dental_findings_service_role_policy` | `service_role` | `ALL` | `true` |
| `prescriptions` | `prescriptions_service_role_policy` | `service_role` | `ALL` | `true` |
| `prescription_items` | `prescription_items_service_role_policy` | `service_role` | `ALL` | `true` |
| `treatment_plans` | `treatment_plans_service_role_policy` | `service_role` | `ALL` | `true` |
| `invoices` | `invoices_service_role_policy` | `service_role` | `ALL` | `true` |
| `invoice_items` | `invoice_items_service_role_policy` | `service_role` | `ALL` | `true` |
| `payments` | `payments_service_role_policy` | `service_role` | `ALL` | `true` |
| `files` | `files_service_role_policy` | `service_role` | `ALL` | `true` |
| `ai_reports` | `ai_reports_service_role_policy` | `service_role` | `ALL` | `true` |
| `notifications` | `notifications_service_role_policy` | `service_role` | `ALL` | `true` |
| `audit_logs` | `audit_logs_service_role_policy` | `service_role` | `ALL` | `true` |

---

## Section 5: Complete SQL Migration

```sql
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
```

---

## Appendix: Design Decision Log

| Decision | Chosen approach | Rationale grounded in source |
|----------|----------------|------------------------------|
| `ClinicalRecord.prescription` | Dropped; use `prescriptions` + `prescription_items` | `clinical.service.js:L34-36` calls `JSON.stringify(prescription)` / `JSON.parse(r.prescription)` — classic anti-pattern; `prescription.model.js` already exists with a proper schema |
| `ClinicalRecord.doctorName` | Dropped | Denormalized cache written in `clinical.service.js:L39`; derivable via `JOIN users ON users.id = clinical_records.doctor_id` |
| `Patient.treatmentCategoryName` | Dropped | Denormalized cache written in `patient.service.js:L113`; derivable via JOIN |
| `dentalChart` storage | JSONB column | `clinical.service.js` reads/writes whole array atomically; no service code queries individual tooth records independently |
| `dentalChart` status enum values | `healthy\|decay\|filled\|crown\|rct\|missing` | Read directly from `src/models/clinical-record.model.js:L22` — Phase 1 audit had wrong values (`healthy\|cavity\|restored\|...`) |
| `DoctorAvailability.startTime/endTime` | `TIME` type | Was regex-validated `HH:MM` strings; `TIME` is the correct semantic type |
| Sequential IDs | PostgreSQL sequences + `next_seq_id()` | Replaces `countDocuments() + 1` race condition visible in `appointment.service.js:L95`, `patient.service.js:L90`, `payment.service.js:L56` |
| Monetary values | `INTEGER` (paise) | All models comment "Amount is stored in paise"; services divide by 100 for display |
| `ai_reports.confidence` | `NUMERIC(6,4)` | Genuine decimal fraction 0.0000–1.0000; not a monetary value; exception to INTEGER rule |
| `users.salary` | `INTEGER` | Kept as paise; `select: false` in Mongoose; no RLS column restriction at this stage (future work) |
| `audit_logs.document_id` | `TEXT` | Generic ObjectId → UUID string post-migration; no FK enforcement appropriate for audit logs |
| Foreign key cascades — financial | `ON DELETE RESTRICT` on `payments.invoice_id`, `payments.patient_id`, `invoices.patient_id` | Prevent accidental financial record loss |
| Foreign key cascades — child records | `ON DELETE CASCADE` on `prescription_items`, `invoice_items`, `dental_findings.clinical_record_id`, `prescriptions.clinical_record_id`, `doctor_availability.doctor_id` | Child records have no semantic meaning without parent |
| `treatment_plans` | Stub table with minimal columns | `Invoice.treatmentPlanId` references non-existent model; stub prevents FK violations |
| `appointments.rescheduled_from_id` | `ON DELETE SET NULL` | Optional self-reference; appointment history retained even if source appointment deleted |

---

*End of Phase 2 Schema Design Report*
