# Phase 1 Migration Audit — Dwarka Dental Clinic
## MongoDB Atlas → Supabase PostgreSQL

**Audit date:** 2025  
**Workspace root:** `c:\Users\Kunal\OneDrive\Desktop\DwarkaDentalClinic-main`  
**Auditor:** Automated code-first analysis (all claims grounded in source code)

---

## 1. Executive Summary

The Dwarka Dental Clinic Management System is a MERN-stack application in active use. The backend is a Node.js/Express server using **Mongoose ^9.9.3** as its ORM against MongoDB Atlas. The frontend is React 19 + Vite 8 + Redux Toolkit + RTK Query. The application has **15 Mongoose models** spread across clinic management, patient records, appointments, clinical records, billing, AI X-ray analysis, and audit logging.

**Key migration-readiness findings:**

1. **Full MongoDB dependency** — every database operation is performed through Mongoose models. There are no raw SQL queries, no Sequelize calls in the active source (Sequelize and sqlite3 are listed in `package.json` as dead dependencies from a prior prototype and are never imported in the current source).
2. **Multi-entity transactions are missing** — patient creation triggers appointment and payment creation in a single service function (`createPatient`) without a transaction; a partial failure would leave orphan records. This must be replaced with PostgreSQL transactions.
3. **ObjectId identity strategy** — all inter-model references use Mongoose `ObjectId`. These must be mapped to UUID in PostgreSQL; every `populate()` call must become a JOIN.
4. **Embedded sub-documents** — `ClinicalRecord.dentalChart` (array), `Invoice.items` (array of sub-docs), `Prescription.items` (array of sub-docs), and `Patient.emergencyContact` (single embedded doc) must be normalised into child tables or stored as JSONB.
5. **Prescription stored as JSON string** — `ClinicalRecord.prescription` is a stringified JSON array written with `JSON.stringify(prescription)` and parsed back with `JSON.parse()`. This anti-pattern must be replaced with a proper relational structure or a JSONB column.
6. **Aggregation pipelines** — three `Payment.aggregate()` calls (revenue summary, dashboard stats) must be rewritten as SQL aggregate queries.
7. **Broken auth middleware** — `authMiddleware` swallows every JWT verification failure and falls back to a hardcoded admin identity. This is a critical security gap.
8. **Hardcoded demo fallback passwords** in `auth.service.js` bypass bcrypt entirely for a list of known accounts.
9. **File storage is local disk** (`Backend/uploads/`). Migration to Supabase Storage is needed as part of this migration.
10. **`sequelize` and `sqlite3` in `package.json`** are unused dead weight — safe to remove during migration.

---

## 2. Project Architecture Overview

```
DwarkaDentalClinic-main/
├── Backend/                    ← Node.js 18+ / Express 5 / Mongoose 9 server
│   ├── index.js                ← Entry: connectDB → seedDatabase → app.listen
│   ├── seed.js                 ← Standalone seed script (CLI usage)
│   └── src/
│       ├── app.js              ← Express middleware stack + route registration
│       ├── config/
│       │   ├── db.js           ← mongoose.connect() with options
│       │   ├── env.js          ← dotenv, config object, startup warnings
│       │   └── seed.js         ← Full seed (clinic, staff, categories, patients, appointments)
│       ├── models/             ← 15 Mongoose models
│       ├── controllers/        ← Thin layer, delegates to services
│       ├── services/           ← All business logic and database queries
│       ├── routes/             ← Express routers
│       ├── middleware/         ← auth, error handler, asyncHandler, validateRequest
│       └── utils/              ← ApiError, ApiResponse, generateToken, scheduler, whatsapp
├── Frontend/                   ← React 19 / Vite 8 / RTK Query / React Router 8
│   └── src/
│       ├── app/store.js        ← Redux store, authSlice, thunks, authFetch helper
│       ├── services/apiSlice.js← RTK Query base slice
│       ├── features/           ← patientsApi.js, appointmentsApi.js (RTK Query endpoints)
│       ├── utils/api.js        ← Vanilla fetch client (used by most pages)
│       ├── constants/apiEndpoints.js ← all endpoint path constants
│       └── pages/              ← role-gated pages (admin, doctor, receptionist, shared)
├── databaseDesign.md           ← MongoDB schema reference document
└── PROJECT_DOCUMENTATION.md   ← Project overview
```

**Data flow:** React pages → `utils/api.js` (Bearer token) → Express routes → controllers → services → Mongoose models → MongoDB Atlas.  
**Auth flow:** JWT issued at `/api/auth/login` → stored in `localStorage` as `ddc:session.token` → sent as `Authorization: Bearer <token>` → verified in `authMiddleware` → `req.user = { id, role, email }`.

---

## 3. Backend Dependency Inventory

### `Backend/package.json` — all dependencies

| Package | Version | Classification |
|---------|---------|---------------|
| `mongoose` | `^9.9.3` | **MongoDB ORM — primary migration target** |
| `mongodb` | `^7.5.0` | **MongoDB driver — listed but not directly imported** |
| `express` | `^5.2.1` | Core web framework — keep |
| `bcryptjs` | `^3.0.3` | Password hashing — keep |
| `jsonwebtoken` | `^9.0.3` | JWT — keep |
| `cors` | `^2.8.6` | CORS middleware — keep |
| `dotenv` | `^17.4.2` | Environment config — keep |
| `axios` | `^1.19.0` | HTTP client for ML service — keep |
| `form-data` | `^4.0.6` | Multipart data for ML service — keep |
| `multer` | `^2.2.0` | File upload middleware — keep |
| `twilio` | `^6.1.0` | WhatsApp reminders — keep |
| `sequelize` | `^6.37.8` | **Dead dependency — never imported, safe to remove** |
| `sqlite3` | `^6.0.1` | **Dead dependency — never imported, safe to remove** |

**To add during migration:**
- `@supabase/supabase-js` (server-side Supabase client)

### MongoDB/Mongoose surface area

- **`mongoose.connect()`** called in `src/config/db.js`
- **`mongoose.Schema`** used in all 15 model files
- **`mongoose.model()`** used in all 15 model files
- **`mongoose.Types.ObjectId`** used inline in `appointment.service.js`, `patient.service.js`, `payment.service.js`
- **`mongoose.Types.ObjectId.isValid()`** used for input validation in multiple services
- **`require('mongoose')`** appears inline inside service functions (lazy require anti-pattern)

---

## 4. Database Models & Schema Analysis

### 4.1 Clinic

**File:** `src/models/clinic.model.js`  
**Collection:** `clinics`  
**Timestamps:** yes (`createdAt`, `updatedAt`)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `name` | String | ✓ | trim |
| `phone` | String | ✓ | trim |
| `email` | String | ✓ | lowercase, trim |
| `address` | Embedded `addressSchema` | ✓ | `{ line1, line2, city, state, postalCode, country }` — all strings |
| `isActive` | Boolean | — | default `true` |

**Embedded:** `addressSchema` (`_id: false`) with fields `line1` (required), `line2`, `city` (required), `state` (required), `postalCode` (required), `country` (required, default `'India'`).

**Indexes:** none explicit; `_id` only.

**Migration note:** `address` becomes separate columns `address_line1`, `address_line2`, `address_city`, `address_state`, `address_postal_code`, `address_country` on the `clinics` table (or a JSONB column).

---

### 4.2 User

**File:** `src/models/user.model.js`  
**Collection:** `users`  
**Timestamps:** yes

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `clinicId` | ObjectId → Clinic | ✓ | index |
| `name` | String | ✓ | |
| `email` | String | ✓ | lowercase |
| `passwordHash` | String | ✓ | `select: false` |
| `role` | String enum | ✓ | `admin\|doctor\|receptionist\|assistant\|lab_technician\|staff` |
| `phone` | String | — | |
| `specialization` | String | — | |
| `qualifications` | [String] | — | |
| `experienceYears` | Number | — | min 0 |
| `salary` | Number | — | `select: false` |
| `status` | String enum | — | `active\|inactive` default `active` |
| `lastLoginAt` | Date | — | |

**Indexes:** `{ clinicId, email }` unique composite.  
**Migration note:** `qualifications` (array of strings) → separate `user_qualifications` table or `TEXT[]` PostgreSQL array column. `role` becomes a PostgreSQL ENUM or `TEXT` with CHECK constraint. `salary` requires column-level RLS in Supabase.

---

### 4.3 Patient

**File:** `src/models/patient.model.js`  
**Collection:** `patients`  
**Timestamps:** yes

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `clinicId` | ObjectId → Clinic | ✓ | |
| `patientNumber` | String | ✓ | e.g. `DWK-2026-0001` |
| `name` | String | ✓ | |
| `dateOfBirth` | Date | — | |
| `gender` | String enum | — | `male\|female\|other` |
| `phone` | String | ✓ | |
| `email` | String | — | lowercase |
| `address` | String | — | flat string (note in code: should be structured) |
| `emergencyContact` | Embedded | — | `{ name, relation, phone }` (`_id: false`) |
| `chiefComplaint` | String | — | |
| `medicalHistory` | String | — | |
| `bloodGroup` | String | — | |
| `allergies` | [String] | — | |
| `medicalAlerts` | [String] | — | |
| `generalMedicalHistory` | String | — | |
| `assignedDoctorId` | ObjectId → User | — | |
| `treatmentCategoryId` | ObjectId → TreatmentCategory | — | |
| `treatmentCategoryName` | String | — | denormalised |
| `status` | String enum | — | `new\|follow_up\|completed\|inactive` default `new` |
| `registeredAt` | Date | — | default `Date.now` |
| `lastVisitAt` | Date | — | |
| `nextFollowUpAt` | Date | — | |
| `totalVisits` | Number | — | min 0, default 0 |
| `isDeleted` | Boolean | — | default `false` |

**Indexes:** `{ clinicId, patientNumber }` unique; `{ clinicId, phone }`.  
**Migration notes:**
- `emergencyContact` → inline columns `emergency_contact_name`, `emergency_contact_relation`, `emergency_contact_phone` (or JSONB).
- `allergies` and `medicalAlerts` (arrays of strings) → `TEXT[]` or separate junction table.
- `treatmentCategoryName` is a denormalised cache — omit in PostgreSQL, derive via JOIN.
- `address` is already a flat string (frontend sends plain text) — store as `TEXT`.

---

### 4.4 TreatmentCategory

**File:** `src/models/treatment-category.model.js`  
**Collection:** `treatmentcategories`  
**Timestamps:** yes

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `clinicId` | ObjectId → Clinic | ✓ | |
| `name` | String | ✓ | |
| `code` | String | ✓ | uppercase |
| `defaultDurationMinutes` | Number | — | min 1 |
| `defaultFollowUpDays` | Number | — | min 0 |
| `isActive` | Boolean | — | default `true` |

**Indexes:** `{ clinicId, code }` unique.

---

### 4.5 Appointment

**File:** `src/models/appointment.model.js`  
**Collection:** `appointments`  
**Timestamps:** yes

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `clinicId` | ObjectId → Clinic | ✓ | |
| `appointmentNumber` | String | ✓ | e.g. `APT-2026-0001` |
| `patientId` | ObjectId → Patient | ✓ | |
| `doctorId` | ObjectId → User | ✓ | |
| `treatmentCategoryId` | ObjectId → TreatmentCategory | — | |
| `startAt` | Date | ✓ | |
| `endAt` | Date | ✓ | |
| `durationMinutes` | Number | ✓ | min 1 |
| `status` | String enum | — | `scheduled\|confirmed\|arrived\|in_progress\|completed\|missed\|cancelled\|rescheduled` |
| `priority` | String enum | — | `normal\|high\|emergency` default `normal` |
| `notes` | String | — | |
| `rescheduledFromId` | ObjectId → Appointment | — | self-reference |
| `createdById` | ObjectId → User | — | |
| `confirmedAt` | Date | — | |
| `arrivedAt` | Date | — | |
| `completedAt` | Date | — | |
| `reminderSent` | Boolean | — | default `false` |
| `reminderSentAt` | Date | — | |
| `isDeleted` | Boolean | — | default `false` |

**Indexes:** `{ clinicId, appointmentNumber }` unique; `{ clinicId, doctorId, startAt }`; `{ clinicId, patientId, startAt DESC }`; `{ clinicId, status, startAt }`.  
**Mongoose hook:** `pre('validate')` validates `endAt > startAt` — must be replicated as a PostgreSQL CHECK constraint.

---

### 4.6 DoctorAvailability

**File:** `src/models/doctor-availability.model.js`  
**Collection:** `doctoravailabilities`  
**Timestamps:** yes

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `clinicId` | ObjectId → Clinic | ✓ | |
| `doctorId` | ObjectId → User | ✓ | |
| `dayOfWeek` | Number | ✓ | 0–6 |
| `startTime` | String | ✓ | regex `HH:MM` |
| `endTime` | String | ✓ | regex `HH:MM` |
| `effectiveFrom` | Date | ✓ | |
| `effectiveTo` | Date | — | |
| `isActive` | Boolean | — | default `true` |

**Migration note:** `startTime`/`endTime` stored as `HH:MM` strings — migrate to PostgreSQL `TIME` type.

---

### 4.7 ClinicalRecord

**File:** `src/models/clinical-record.model.js`  
**Collection:** `clinicalrecords`  
**Timestamps:** yes

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `clinicId` | ObjectId → Clinic | ✓ | |
| `patientId` | ObjectId → Patient | ✓ | |
| `appointmentId` | ObjectId → Appointment | — | |
| `doctorId` | ObjectId → User | ✓ | |
| `visitDate` | Date | ✓ | |
| `chiefComplaint` | String | — | |
| `diagnosis` | String | — | |
| `treatment` | String | — | |
| `clinicalNotes` | String | — | |
| `prescription` | String | — | **Stringified JSON array** — anti-pattern |
| `dentalChart` | Array of sub-docs | — | `[{ toothNumber: Number, status: enum, surfaces: [String], notes: String }]` |
| `doctorName` | String | — | denormalised cache |
| `followUpDate` | Date | — | |
| `followUpInstructions` | String | — | |
| `status` | String enum | — | `draft\|completed\|edited` default `draft` |
| `isDeleted` | Boolean | — | default `false` |

**Indexes:** `{ clinicId, patientId, visitDate DESC }`.  
**Migration notes:**
- `prescription` (stringified JSON): migrate to a separate `prescriptions` table using the `Prescription` model schema, OR store as JSONB. The `Prescription` model already exists and is the right normalised approach.
- `dentalChart` (array of sub-docs with `{ toothNumber, status, surfaces[], notes }`): normalise into a `dental_chart_entries` child table or store as `JSONB`. Given its query pattern (read whole chart at once, update whole chart), JSONB is pragmatic.
- `doctorName` denormalised field: remove, derive via JOIN on `users`.

---

### 4.8 DentalFinding

**File:** `src/models/dental-finding.model.js`  
**Collection:** `dentalfindings`  
**Timestamps:** none (explicit `timestamps: false`)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `clinicId` | ObjectId → Clinic | ✓ | |
| `patientId` | ObjectId → Patient | ✓ | |
| `clinicalRecordId` | ObjectId → ClinicalRecord | ✓ | |
| `toothNumber` | String | ✓ | |
| `surface` | String enum | ✓ | `mesial\|distal\|occlusal\|buccal\|lingual\|all` |
| `condition` | String enum | ✓ | `healthy\|cavity\|restored\|missing\|fractured\|root_canal\|implant\|crown\|other` |
| `notes` | String | — | |
| `recordedById` | ObjectId → User | ✓ | |
| `recordedAt` | Date | — | default `Date.now` |

**Indexes:** `{ clinicId, patientId, toothNumber }`.

---

### 4.9 Prescription

**File:** `src/models/prescription.model.js`  
**Collection:** `prescriptions`  
**Timestamps:** `{ createdAt: true, updatedAt: false }`

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `clinicId` | ObjectId → Clinic | ✓ | |
| `patientId` | ObjectId → Patient | ✓ | |
| `clinicalRecordId` | ObjectId → ClinicalRecord | ✓ | |
| `doctorId` | ObjectId → User | ✓ | |
| `items` | Array of `prescriptionItemSchema` | ✓ | min 1 item |
| `issuedAt` | Date | — | default `Date.now` |

**Embedded `prescriptionItemSchema`** (`_id: false`):

| Field | Type | Required |
|-------|------|----------|
| `medicineName` | String | ✓ |
| `dosage` | String | ✓ |
| `frequency` | String | ✓ |
| `durationDays` | Number | ✓ |
| `instructions` | String | — |

**Migration note:** `items` array → `prescription_items` child table with FK `prescription_id`.

---

### 4.10 Invoice

**File:** `src/models/invoice.model.js`  
**Collection:** `invoices`  
**Timestamps:** yes

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `clinicId` | ObjectId → Clinic | ✓ | |
| `invoiceNumber` | String | ✓ | e.g. `INV-2026-0001` |
| `patientId` | ObjectId → Patient | ✓ | |
| `appointmentId` | ObjectId → Appointment | — | |
| `treatmentPlanId` | ObjectId → TreatmentPlan | — | **References non-existent model** |
| `items` | Array of `invoiceItemSchema` | — | default `[]` |
| `subtotal` | Number | ✓ | min 0, stored in **paise** |
| `discount` | Number | — | min 0 |
| `tax` | Number | — | min 0 |
| `total` | Number | ✓ | min 0 |
| `amountPaid` | Number | — | min 0 |
| `balanceDue` | Number | ✓ | min 0 |
| `status` | String enum | — | `draft\|issued\|partially_paid\|paid\|cancelled` |
| `issuedAt` | Date | — | |
| `dueAt` | Date | — | |

**Embedded `invoiceItemSchema`** (`_id: false`):

| Field | Type | Required |
|-------|------|----------|
| `description` | String | ✓ |
| `treatmentCategoryId` | ObjectId → TreatmentCategory | — |
| `quantity` | Number | ✓ |
| `unitPrice` | Number | ✓ |
| `discount` | Number | — |
| `amount` | Number | ✓ |

**Indexes:** `{ clinicId, invoiceNumber }` unique.  
**Migration notes:**
- `items` array → `invoice_items` child table.
- `treatmentPlanId` references a `TreatmentPlan` model that does not exist in the codebase — set nullable FK to a `treatment_plans` table to be created later.
- All monetary fields are in **paise** (integer cents) — use `INTEGER` or `BIGINT` in PostgreSQL, not `NUMERIC`.

---

### 4.11 Payment

**File:** `src/models/payment.model.js`  
**Collection:** `payments`  
**Timestamps:** yes

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `clinicId` | ObjectId → Clinic | ✓ | |
| `receiptNumber` | String | ✓ | |
| `invoiceId` | ObjectId → Invoice | ✓ | |
| `patientId` | ObjectId → Patient | ✓ | |
| `amount` | Number | ✓ | min 1, stored in **paise** |
| `method` | String enum | ✓ | `cash\|upi\|card\|bank_transfer` |
| `status` | String enum | — | `pending\|paid\|failed\|refunded` default `pending` |
| `transactionReference` | String | — | |
| `paidAt` | Date | — | |
| `notes` | String | — | |
| `recordedById` | ObjectId → User | ✓ | |
| `isDeleted` | Boolean | — | default `false` |

**Indexes:** `{ clinicId, receiptNumber }` unique; `{ clinicId, invoiceId, paidAt DESC }`.

---

### 4.12 File

**File:** `src/models/file.model.js`  
**Collection:** `files`  
**Timestamps:** none (explicit `timestamps: false`)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `clinicId` | ObjectId → Clinic | ✓ | |
| `patientId` | ObjectId → Patient | ✓ | |
| `clinicalRecordId` | ObjectId → ClinicalRecord | — | |
| `uploadedById` | ObjectId → User | ✓ | |
| `fileType` | String enum | ✓ | `xray\|photo\|prescription\|document` |
| `storageKey` | String | ✓ | filename on local disk |
| `originalName` | String | ✓ | |
| `mimeType` | String | ✓ | |
| `sizeBytes` | Number | ✓ | |
| `uploadedAt` | Date | — | default `Date.now` |

**Indexes:** `{ clinicId, patientId, uploadedAt DESC }`; `{ storageKey }` unique.  
**Migration note:** `storageKey` currently stores the local disk filename (e.g. `xray-1234567890-123456789.jpg`). After migration, this should store the Supabase Storage path.

---

### 4.13 AiReport

**File:** `src/models/ai-report.model.js`  
**Collection:** `aireports`  
**Timestamps:** `{ createdAt: true, updatedAt: false }`

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `clinicId` | ObjectId → Clinic | ✓ | |
| `patientId` | ObjectId → Patient | ✓ | |
| `fileId` | ObjectId → File | ✓ | |
| `result` | String enum | ✓ | `cavity\|normal\|uncertain` |
| `suggestions` | [String] | — | |
| `confidence` | Number | ✓ | 0–1 |
| `modelVersion` | String | ✓ | |
| `reviewedById` | ObjectId → User | — | |
| `reviewedAt` | Date | — | |
| `doctorReview` | String enum | — | `confirmed\|rejected\|null` |
| `doctorNotes` | String | — | |

**Migration note:** `suggestions` (array of strings) → `TEXT[]` column or separate table.

---

### 4.14 Notification

**File:** `src/models/notification.model.js`  
**Collection:** `notifications`  
**Timestamps:** `{ createdAt: true, updatedAt: false }`

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `clinicId` | ObjectId → Clinic | ✓ | |
| `recipientUserId` | ObjectId → User | — | |
| `patientId` | ObjectId → Patient | — | |
| `appointmentId` | ObjectId → Appointment | — | |
| `type` | String enum | ✓ | `appointment_reminder\|follow_up\|payment\|system` |
| `channel` | String enum | ✓ | `in_app\|whatsapp\|email\|sms` |
| `title` | String | ✓ | |
| `message` | String | ✓ | |
| `status` | String enum | — | `pending\|sent\|failed\|read` default `pending` |
| `sentAt` | Date | — | |
| `readAt` | Date | — | |
| `errorMessage` | String | — | |

**Indexes:** `{ recipientUserId, status, createdAt DESC }`.

---

### 4.15 AuditLog

**File:** `src/models/audit-log.model.js`  
**Collection:** `auditlogs`  
**Timestamps:** `{ createdAt: true, updatedAt: false }`

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `clinicId` | ObjectId → Clinic | ✓ | |
| `actorUserId` | ObjectId → User | — | |
| `action` | String enum | ✓ | `create\|update\|delete\|login\|export` |
| `collectionName` | String | ✓ | |
| `documentId` | ObjectId | — | untyped ref |
| `before` | Mixed | — | any shape |
| `after` | Mixed | — | any shape |

**Migration note:** `before`/`after` are `Mixed` (any JSON) → store as `JSONB`. `documentId` (generic ObjectId) → store as `UUID TEXT` column post-migration.

---

## 5. Entity Relationship Map

```
Clinic (1)
  ├── User (N)                      clinicId FK
  ├── Patient (N)                   clinicId FK
  │     ├── assignedDoctorId → User
  │     └── treatmentCategoryId → TreatmentCategory
  ├── TreatmentCategory (N)         clinicId FK
  ├── Appointment (N)               clinicId FK
  │     ├── patientId → Patient
  │     ├── doctorId → User
  │     ├── treatmentCategoryId → TreatmentCategory
  │     ├── createdById → User
  │     └── rescheduledFromId → Appointment (self-ref)
  ├── DoctorAvailability (N)        clinicId FK
  │     └── doctorId → User
  ├── ClinicalRecord (N)            clinicId FK
  │     ├── patientId → Patient
  │     ├── appointmentId → Appointment
  │     ├── doctorId → User
  │     └── dentalChart[] (embedded array)
  ├── DentalFinding (N)             clinicId FK
  │     ├── patientId → Patient
  │     ├── clinicalRecordId → ClinicalRecord
  │     └── recordedById → User
  ├── Prescription (N)              clinicId FK
  │     ├── patientId → Patient
  │     ├── clinicalRecordId → ClinicalRecord
  │     ├── doctorId → User
  │     └── items[] (embedded array)
  ├── Invoice (N)                   clinicId FK
  │     ├── patientId → Patient
  │     ├── appointmentId → Appointment
  │     └── items[] (embedded array)
  ├── Payment (N)                   clinicId FK
  │     ├── invoiceId → Invoice
  │     ├── patientId → Patient
  │     └── recordedById → User
  ├── File (N)                      clinicId FK
  │     ├── patientId → Patient
  │     ├── clinicalRecordId → ClinicalRecord
  │     └── uploadedById → User
  ├── AiReport (N)                  clinicId FK
  │     ├── patientId → Patient
  │     ├── fileId → File
  │     └── reviewedById → User
  ├── Notification (N)              clinicId FK
  │     ├── recipientUserId → User
  │     ├── patientId → Patient
  │     └── appointmentId → Appointment
  └── AuditLog (N)                  clinicId FK
        └── actorUserId → User
```

**Cardinalities:**
- Clinic : User = 1:N
- Clinic : Patient = 1:N
- Patient : Appointment = 1:N
- Doctor (User) : Appointment = 1:N
- Appointment : ClinicalRecord = 1:0..1 (optional)
- ClinicalRecord : DentalFinding = 1:N
- ClinicalRecord : Prescription = 1:0..1 (in model) or 1:N (model supports multiple)
- Patient : AiReport = 1:N
- AiReport : File = 1:1
- Invoice : Payment = 1:N (one invoice can have multiple partial payments)

---

## 6. Query & Operation Complexity Inventory

### 6.1 Simple CRUD (low migration risk)

| Operation | Location | Pattern |
|-----------|----------|---------|
| `Clinic.findOne({})` | Multiple services | Simple select |
| `User.findOne({ email })` | `auth.service.js` | Filtered select |
| `User.find({ role, status })` | `auth.routes.js` | Filtered select |
| `User.findById(id)` | Multiple | PK lookup |
| `Patient.findById(id)` | Multiple | PK lookup |
| `Patient.findOne({ clinicId, patientNumber })` | `seed.js` | Filtered select |
| `TreatmentCategory.findOneAndUpdate(...)` | `seed.js` | Upsert |
| `ClinicalRecord.find({ patientId, isDeleted: false })` | `clinical.service.js` | Filtered |
| `Payment.find({ patientId, isDeleted: false })` | `payment.service.js` | Filtered |
| `AiReport.find({ patientId })` | `ai.service.js` | Filtered |
| `Appointment.find({ patientId, isDeleted: false })` | `appointment.service.js` | Filtered |

### 6.2 Populate chains (medium risk — must become JOINs)

| Operation | Location | Fields populated |
|-----------|----------|-----------------|
| `Appointment.find(...).populate('patientId', 'name patientNumber phone isDeleted').populate('doctorId', 'name specialization').populate('treatmentCategoryId', 'name code defaultDurationMinutes defaultFollowUpDays')` | `appointment.service.getAllAppointments()` | 3-table join |
| `Appointment.findById(id).populate(...)` | `appointment.service.bookAppointment()` | Same 3-table join |
| `Patient.find(...).populate('assignedDoctorId', 'name specialization').populate('treatmentCategoryId', 'name code ...')` | `patient.service.getAllPatients()` | 2-table join |
| `Patient.findById(id).populate('assignedDoctorId', ...).populate('treatmentCategoryId', ...)` | `patient.service.getPatientById()` | 2-table join |
| `AiReport.find({ patientId }).populate('fileId', 'storageKey originalName')` | `ai.service.getAiReportsByPatient()` | 1-table join |
| `Payment.find(filter).populate('patientId', 'name patientNumber')` | `payment.service.getAllPayments()` | 1-table join |

### 6.3 Aggregation pipelines (high risk — must become SQL)

| Operation | Location | Pipeline stages |
|-----------|----------|-----------------|
| `Payment.aggregate([{ $match: { clinicId, isDeleted: false } }, { $group: { _id: '$method', value: { $sum: '$amount' } } }])` | `payment.service.getRevenueSummary()` | GROUP BY method |
| `Payment.aggregate([{ $match: { paidAt range } }, { $group: { _id: null, total: { $sum: '$amount' } } }])` | `routes/index.js` dashboard stats (today revenue) | GROUP BY null |
| `Payment.aggregate([{ $match: { isDeleted: false } }, { $group: { _id: null, total: { $sum: '$amount' } } }])` | `routes/index.js` dashboard stats (total revenue) | COUNT all |
| `Appointment.aggregate([{ $match: { isDeleted: false, treatmentCategoryId: exists } }, { $group: { _id: '$treatmentCategoryId', count: { $sum: 1 } } }])` | `routes/index.js` category breakdown | GROUP BY category |

**SQL equivalents:**
```sql
-- getRevenueSummary
SELECT method, SUM(amount) AS value FROM payments WHERE is_deleted = false GROUP BY method;

-- Today revenue
SELECT SUM(amount) FROM payments WHERE is_deleted = false AND paid_at BETWEEN $1 AND $2;

-- Category breakdown
SELECT treatment_category_id, COUNT(*) FROM appointments WHERE is_deleted = false AND treatment_category_id IS NOT NULL GROUP BY treatment_category_id;
```

### 6.4 Complex filter queries (medium risk)

| Operation | Location | Complexity |
|-----------|----------|-----------|
| `Appointment.find({ isDeleted:false, $or:[{status:'missed'}, {startAt:{$lt:todayStart}, status:{$in:[...]}}] })` | `appointment.service.getAllAppointments()` | OR condition with date range |
| `Patient.find({ $or: [{name:regex}, {phone:regex}, {patientNumber:regex}, {email:regex}, {chiefComplaint:regex}] })` | `patient.service.getAllPatients()` | Full-text-like multi-field regex search |
| `TreatmentCategory.findOne({ $or: [{code:upper}, {name:regex}] })` | Multiple services | Two-field OR lookup |
| `Appointment.find({ patientId: {$nin: deletedPatients} })` | `appointment.service.getAllAppointments()` | NOT IN subquery pattern |
| `Appointment.find({ doctorId, isDeleted:false, status:{$nin:[...]}, $or:[{startAt:{$lt:endAt}, endAt:{$gt:startAt}}] })` | `appointment.service.bookAppointment()` | Overlap detection |

**Overlap detection SQL:**
```sql
SELECT 1 FROM appointments
WHERE doctor_id = $1 AND is_deleted = false
  AND status NOT IN ('cancelled', 'rescheduled', 'completed', 'missed')
  AND start_at < $3 AND end_at > $2   -- $2=new startAt, $3=new endAt
LIMIT 1;
```

### 6.5 Bulk operations

| Operation | Location | Pattern |
|-----------|----------|---------|
| `Appointment.updateMany({ patientId: {$in: idList} }, { $set: {isDeleted:true, status:'cancelled'} })` | `patient.service.softDeletePatient()` | Bulk UPDATE |
| `Appointment.countDocuments({ clinicId })` | `appointment.service.bookAppointment()` | COUNT for sequence generation |
| `Patient.countDocuments({ clinicId })` | `patient.service.createPatient()` | COUNT for sequence generation |
| `Payment.countDocuments({ clinicId })` | `payment.service.addPayment()` | COUNT for sequence generation |

**Migration note:** Using `countDocuments()` for sequential number generation (e.g. `APT-2026-0001`) is a race condition in concurrent environments. Replace with a PostgreSQL sequence or `gen_random_uuid()` with a separate counter table.

---

## 7. Authentication & Authorization Analysis

### 7.1 JWT flow

- **Issue:** `POST /api/auth/login` → `auth.service.login()` → `generateToken({ id, role, email })` → `jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' })`.
- **Storage:** Frontend stores `{ user, role, token }` in `localStorage` under key `ddc:session`.
- **Transport:** Frontend sends `Authorization: Bearer <token>` from `utils/api.js` (JWT from session) and `app/store.js` (authFetch helper). The `apiSlice.js` base query still sends `x-user-role` header from `persist:auth` which is a legacy/unused mechanism.
- **Verification:** `authMiddleware` calls `verifyToken(token)` which calls `jwt.verify(token, JWT_SECRET)`.
- **Token expiry:** 8 hours. `JWT_EXPIRES_IN` is configurable via env.

### 7.2 Role mapping

The JWT `role` field for non-admin, non-doctor users is mapped to `'receptionist'` regardless of actual role (`assistant`, `lab_technician`, `staff`). This is done in `auth.service.js`:
```js
const mappedRole = ['admin', 'doctor'].includes(user.role) ? user.role : 'receptionist';
```

### 7.3 Critical security gap — auth middleware bypass

**File:** `src/middleware/authMiddleware.js`

```js
function authMiddleware(req, res, next) {
  try {
    // ...
    const decoded = verifyToken(token);
    req.user = { id: decoded.id, role: decoded.role, email: decoded.email };
    next();
  } catch (err) {
    // CRITICAL: silently falls back to hardcoded admin on ANY error
    req.user = { id: 'admin-1', role: 'admin', email: 'admin@dwarkadental.com' };
    next();
  }
}
```

Any request with a missing, expired, malformed, or invalid JWT will be granted full admin access. This must be fixed before or during migration.

**Additional bypass:** tokens `undefined`, empty string, or the literal string `'demo-token'` also result in the admin fallback.

### 7.4 Hardcoded demo passwords in auth service

**File:** `src/services/auth.service.js`

```js
const acceptable = {
  'admin@dwarkadental.com': ['admin123'],
  'doctor@dwarkadental.com': ['doctor123'],
  // ...
};
```

These bypass bcrypt entirely for known demo accounts. This must be removed before production deployment.

### 7.5 Route protection summary

| Route group | `authMiddleware` applied | `requireRole` applied |
|-------------|------------------------|-----------------------|
| `POST /api/auth/login` | ✗ (public) | — |
| `GET /api/auth/me` | reads header manually | — |
| `GET /api/auth/doctors` | ✓ | none |
| `GET /api/auth/staff` | ✓ | none — any auth role can list all staff |
| `POST /api/auth/staff` | ✓ | **none — any auth role can create staff** |
| `PUT /api/auth/staff/:id` | ✓ | **none — any auth role can update staff** |
| `GET /api/patients` | ✓ | none |
| `POST /api/patients` | ✓ | none |
| `DELETE /api/patients/:id` | ✓ | inline `req.user.role` check in controller |
| `GET /api/appointments` | ✓ | none |
| `POST /api/appointments` | ✓ | none |
| `DELETE /api/appointments/:id` | ✓ | `requireRole('admin')` |
| `GET /api/payments` | ✓ | none |
| `POST /api/payments` | ✓ | none |
| `DELETE /api/payments/:id` | ✓ | `requireRole('admin')` |
| `GET /api/clinical/:patientId` | ✓ | none |
| `POST /api/clinical` | ✓ | none |
| `GET /api/categories` | ✓ | none |
| `POST /api/categories` | ✓ | `requireRole('admin', 'receptionist', 'doctor')` |
| `PUT /api/categories/:id` | ✓ | `requireRole('admin')` |
| `POST /api/ai/upload` | ✓ | `requireRole('doctor', 'admin', 'receptionist')` |
| `GET /api/ai/reports/:patientId` | ✓ | none |
| `PATCH /api/ai/reports/:id/review` | ✓ | `requireRole('doctor', 'admin')` |
| `GET /api/stats/dashboard` | ✓ | none |
| `POST /api/notifications/send-reminders` | ✓ | none — any auth role can dispatch |

**Security gaps:** Staff creation/update (`POST /PUT /api/auth/staff`) has no role restriction — any authenticated user can create admin accounts. Given the auth middleware bypass, this is effectively open to unauthenticated callers.

---

## 8. Seed Data Analysis

### 8.1 Seed entry points

Two overlapping seed mechanisms exist:

1. **`Backend/seed.js`** — standalone CLI script, connects to MongoDB directly, seeds clinic + 4 users. Run with `node seed.js`.
2. **`Backend/src/config/seed.js`** — called from `index.js` at server startup via `seedDatabase()`. Seeds clinic, 6 staff users, 10 treatment categories, 15 patients, 19 appointments.

### 8.2 Entities and volumes

| Entity | Count in seed | Order dependency |
|--------|--------------|-----------------|
| Clinic | 1 | First |
| Users (staff) | 6 | After Clinic |
| TreatmentCategories | 10 | After Clinic |
| Patients | 15 | After Clinic + Users |
| Appointments | 19 | After Patients + Users + Categories |

### 8.3 Seed patterns

- **Upsert pattern:** `TreatmentCategory` uses `findOneAndUpdate({ code }, ..., { upsert: true, new: true })`.
- **Check-and-create:** all other entities use `findOne(...)` → if not found, `create(...)`.
- **Dynamic dates:** appointment `startAt`/`endAt` are calculated relative to today using `makeDateTime(dayOffset, hour, minute)` — seeds include today's appointments, upcoming (+1/+2/+3/+5 days), and missed (-1/-2 days).
- **Password hashing:** seed uses `bcrypt.hash(password, 12)` for bcrypt strength 12.
- **Sequential number generation:** appointment numbers use `countDocuments() + 1` with string padding — potential race condition.

---

## 9. Frontend Integration Analysis

### 9.1 API client architecture

The frontend has **two parallel API clients** that both need to work post-migration:

1. **`src/utils/api.js`** — vanilla `fetch` wrapper. Used by most page components directly (`api.getPatients()`, `api.uploadXray()`, etc.). Sends `Authorization: Bearer <token>` from `ddc:session.token`.
2. **`src/services/apiSlice.js` + RTK Query** — `createApi` base slice. Used by `patientsApi.js` and `appointmentsApi.js` via `injectEndpoints`. The base query still sends `x-user-role` header (from legacy `persist:auth` key) alongside the token — this is a bug since the backend `authMiddleware` doesn't read `x-user-role`.
3. **`src/app/store.js` thunks** — `fetchPatientsList`, `fetchAppointmentsList`, `savePatientThunk`, `bookAppointmentThunk`, `updateAppointmentStatusThunk` — use `authFetch` which reads from `ddc:session`.

### 9.2 RTK Query slices

**`src/features/patients/patientsApi.js`**

| Endpoint | HTTP | URL | Tags |
|----------|------|-----|------|
| `getPatients` | GET | `/patients` | provides `['Patient']` |
| `addPatient` | POST | `/patients` | invalidates `['Patient']` |
| `updatePatient` | PUT | `/patients/:id` | invalidates `['Patient']` |
| `deletePatient` | DELETE | `/patients/:id` | invalidates `['Patient']` |

`transformResponse: (res) => res.data` — expects `{ success, data: { data: [...], pagination: {...} } }`.

**`src/features/appointments/appointmentsApi.js`**

| Endpoint | HTTP | URL | Tags |
|----------|------|-----|------|
| `getAppointments` | GET | `/appointments` | provides `['Appointment']` |
| `bookAppointment` | POST | `/appointments` | invalidates `['Appointment', 'Patient']` |
| `updateAppointmentStatus` | PUT | `/appointments/:id/status` | invalidates `['Appointment', 'Patient']` |
| `deleteAppointment` | DELETE | `/appointments/:id` | invalidates `['Appointment']` |

### 9.3 Redux local state

**`authSlice`** (in `store.js`): `{ user, role, token, isAuthenticated, isLoading, error }` — persisted to `localStorage` as `ddc:session`.

**`patientsSlice`**: `{ list: [], selectedPatient: null, searchQuery: '', filterStatus: 'all', isLoading: false }`.

**`appointmentsSlice`**: `{ list: [], filterDate: '', filterDoctor: 'all', filterStatus: 'all', isLoading: false }`.

**`notificationSlice`**: `{ list: [] }` — in-app notifications list.

**`uiSlice`**: sidebar, toasts, modal state.

### 9.4 Frontend routing

Three role-based sections, each behind a `ProtectedRoute` component:
- `/admin/*` — requires `role === 'admin'`
- `/doctor/*` — requires `role === 'doctor'`
- `/receptionist/*` — requires `role` in `['receptionist', 'admin']`

### 9.5 Key API response shapes expected by frontend

**Patient list:** `res.data.data` (array) or `res.data` (array).  
**Patient detail:** `res.data.patient` or `res.data`.  
**Appointments:** `res.data` (array) or `res.data.data` (array).  
**Payments by patient:** `res.data.payments` (array) or `res.data` (array).  
**Clinical records:** raw array (not wrapped).  
**AI reports:** `res.data.report` object.  
**Dashboard stats:** `res.data` object with `totalPatients`, `todayAppointments`, etc.

These response shapes **must be preserved** in the migrated backend.

---

## 10. Environment Variable Inventory

### 10.1 Backend (`Backend/.env.example`)

| Variable | Classification | Required | Default / Notes |
|----------|---------------|----------|----------------|
| `MONGODB_URI` | **MongoDB — primary migration target** | Yes | `mongodb+srv://...` |
| `PORT` | Server config | No | `5000` |
| `NODE_ENV` | Environment | No | `development` |
| `JWT_SECRET` | Auth | **Production required** | Default in `env.js`: `'dwarka-dental-jwt-secret-change-in-production'` |
| `JWT_EXPIRES_IN` | Auth | No | `'8h'` |
| `ML_SERVICE_URL` | AI integration | No | `http://localhost:8000` |
| `TWILIO_ACCOUNT_SID` | WhatsApp | No | Falls back to log-only mode |
| `TWILIO_AUTH_TOKEN` | WhatsApp | No | Falls back to log-only mode |
| `TWILIO_PHONE_NUMBER` | WhatsApp | No | Default Twilio sandbox `+14155238886` |

**Post-migration variables to add:**
- `SUPABASE_URL` — Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` — server-side key (never expose to frontend)

### 10.2 Frontend (`Frontend/.env.example`)

| Variable | Classification | Required | Notes |
|----------|---------------|----------|-------|
| `VITE_API_URL` | Backend URL | No | `http://localhost:5000` |

**Note:** No `VITE_SUPABASE_*` variables needed — frontend communicates with Supabase only through the backend.

---

## 11. Background Jobs & Integrations

### 11.1 WhatsApp reminders (Twilio)

**File:** `src/utils/whatsapp.js`  
**Trigger:** `POST /api/notifications/send-reminders` (manually triggered from frontend, no cron job).  
**Database operations:**
1. `Appointment.find({ startAt in tomorrow range, status in ['scheduled', 'confirmed'], reminderSent: false })` — reads appointments
2. `Patient.findById(apt.patientId)` — reads patient phone
3. `Appointment.findByIdAndUpdate(apt._id, { reminderSent: true, reminderSentAt: new Date() })` — marks sent

**Migration:** Straightforward — becomes two SELECT queries + one UPDATE.

### 11.2 Scheduler utility

**File:** `src/utils/scheduler.js`  
**No database access** — pure date arithmetic utility. `calculateNextAppointmentDate()` is called from `appointment.service.js` when completing an appointment.

### 11.3 ML / AI service

**File:** `src/services/ai.service.js`  
**External:** POSTs image files to `ML_SERVICE_URL/predict` (a separate FastAPI/Python service).  
**Database operations after ML call:**
1. `File.create(...)` — stores file metadata
2. `AiReport.create(...)` — stores analysis result

**File storage:** Files are written to `Backend/uploads/` via `multer.diskStorage`. The `storageKey` field stores the filename.  
**Migration:** After migration, files should be uploaded to **Supabase Storage** and `storageKey` should store the Supabase storage path.

### 11.4 Dashboard aggregation (inline route handler)

**File:** `src/routes/index.js` — `GET /api/stats/dashboard`  
Contains 5 `countDocuments()` calls and 4 `aggregate()` calls executed in parallel via `Promise.all`. This must be refactored into service-level functions and converted to SQL.

---

## 12. Migration Risk Register

| # | Risk | Severity | Description | Proposed Mitigation |
|---|------|----------|-------------|---------------------|
| R1 | ObjectId → UUID mapping | **HIGH** | All 15 models use MongoDB ObjectId. Cross-references (populate chains) must be remapped to UUID foreign keys. Existing seed data IDs will change. | Use `gen_random_uuid()` as PK type. Rebuild all FK references. Re-seed from scratch on new DB. |
| R2 | Auth middleware security bypass | **CRITICAL** | Any JWT error silently grants admin access. | Fix before migration: throw 401 on invalid token. Remove demo password fallback. |
| R3 | Missing transaction wrapping | **HIGH** | `patient.service.createPatient()` creates Patient + Appointment + Payment without a transaction. Partial failure leaves orphan records. | Wrap in PostgreSQL transaction using Supabase client's `rpc()` or a DB-level function. |
| R4 | `populate()` → JOIN conversion | **HIGH** | 6 service functions use populate chains over 2–3 models. Must become SQL JOINs with identical output shapes. | Write SQL JOINs per query; use `toFrontendShape()` helpers to normalize to existing API response. |
| R5 | Aggregation pipeline → SQL | **HIGH** | 4 MongoDB aggregation pipelines in payment service and dashboard route. | Rewrite as GROUP BY SQL queries; dashboard handler moves to a service. |
| R6 | Embedded arrays → tables | **MEDIUM** | `ClinicalRecord.dentalChart[]`, `Invoice.items[]`, `Prescription.items[]` are embedded arrays. | Option A: normalise to child tables. Option B: store as JSONB. Recommend JSONB for `dentalChart` (read/write whole chart), relational tables for invoice/prescription items. |
| R7 | Prescription stringified JSON | **MEDIUM** | `ClinicalRecord.prescription` is a `JSON.stringify()` string. Frontend parses it back with `JSON.parse()`. | Migrate to the `prescriptions` table (model already exists). Update `clinical.service.js` to write to `Prescription` model instead. |
| R8 | Sequential number generation | **MEDIUM** | `APT-2026-NNNN`, `DWK-2026-NNNN`, `INV-2026-NNNN`, `RCPT-2026-NNNN` are generated with `countDocuments() + 1` — race condition under concurrency. | Use PostgreSQL sequences or `serial`/`generated always as identity` columns, or a dedicated counter table with `FOR UPDATE` lock. |
| R9 | File storage — local disk | **MEDIUM** | X-ray images stored in `Backend/uploads/`. Incompatible with horizontal scaling or Supabase deployment. | Migrate file upload in `ai.service.js` to Supabase Storage. Update `storageKey` to store storage path. Serve files via signed Supabase URLs. |
| R10 | `mongoose.Types.ObjectId.isValid()` input validation | **LOW** | Multiple services call `ObjectId.isValid(id)` to guard against invalid IDs. | Replace with `isUUID(id)` validation (regex or `uuid` package) for UUID primary keys. |
| R11 | Inline lazy `require('mongoose')` | **LOW** | `appointment.service.js` and `patient.service.js` call `const mongoose = require('mongoose')` inside functions. | Remove all mongoose dependencies; replace with Supabase client. |
| R12 | `TreatmentPlan` reference without model | **LOW** | `Invoice.treatmentPlanId` references a `TreatmentPlan` model that does not exist in source. | Create a stub `treatment_plans` table in migration; FK nullable. |
| R13 | Denormalised fields in production | **LOW** | `ClinicalRecord.doctorName`, `Patient.treatmentCategoryName`, `Appointment` stores `patientName`/`doctorName` inline in some service calls. | Remove denormalised string fields; derive via JOIN. Update `toFrontendShape()` helpers. |
| R14 | Appointment endAt/startAt constraint | **LOW** | Mongoose `pre('validate')` hook enforces `endAt > startAt`. | Add PostgreSQL `CHECK (end_at > start_at)` constraint on `appointments` table. |
| R15 | `Clinic.findOne({})` without ID | **LOW** | Services use `getDefaultClinic()` which fetches the first clinic without using a clinic ID from context. Single-clinic assumption. | Add `clinicId` to JWT payload and propagate through request context. For single-clinic MVP, keep `getDefaultClinic()` but bind to a fixed UUID from env. |
| R16 | Role sub-mapping | **LOW** | `assistant`, `lab_technician`, `staff` roles are mapped to `receptionist` in JWT. | Decide whether to expose sub-roles in PostgreSQL or keep the mapping. Currently safe to preserve mapping. |
| R17 | `DoctorAvailability.startTime/endTime` as strings | **LOW** | Stored as `HH:MM` strings with regex validation. | Migrate to PostgreSQL `TIME` type. |
| R18 | `AuditLog.documentId` generic ObjectId | **LOW** | Stores any entity's ID as an untyped ObjectId. | Store as `TEXT` UUID post-migration; no FK enforcement is appropriate for audit logs. |
| R19 | `apiSlice.js` sends `x-user-role` header | **LOW** | RTK Query base query reads from `persist:auth` and sends `x-user-role`. Backend `authMiddleware` ignores this header. Frontend security relies on JWT only. | Remove `x-user-role` header from `prepareHeaders`; confirm backend ignores it entirely. |
| R20 | Missing `withCredentials`/CORS config | **LOW** | CORS is open (`app.use(cors())`). | Restrict CORS to known frontend origin in production. |

---

## 13. Security Gap Register

| # | Gap | Severity | Evidence | Recommended Fix |
|---|-----|----------|----------|----------------|
| S1 | **Auth middleware grants admin on any JWT error** | **CRITICAL** | `authMiddleware.js:catch(err) { req.user = { id:'admin-1', role:'admin', ... }; next(); }` | Return 401 on invalid/expired JWT. Only grant `req.user = null` fallback for truly optional-auth routes. |
| S2 | **Hardcoded demo passwords bypass bcrypt** | **CRITICAL** | `auth.service.js`: `acceptable['admin@dwarkadental.com'] = ['admin123']` | Remove hardcoded password fallback entirely. All accounts must use bcrypt. |
| S3 | **Staff management routes have no role restriction** | **HIGH** | `POST /api/auth/staff`, `PUT /api/auth/staff/:id` — both apply only `authMiddleware` with no `requireRole` guard | Add `requireRole('admin')` to staff create and update routes. |
| S4 | **JWT_SECRET has a weak default** | **HIGH** | `env.js`: `JWT_SECRET: process.env.JWT_SECRET \|\| 'dwarka-dental-jwt-secret-change-in-production'` with a warning only | Enforce `if (!process.env.JWT_SECRET && NODE_ENV === 'production') { process.exit(1); }` |
| S5 | **MONGODB_URI missing triggers warning, not failure** | **MEDIUM** | `env.js`: `if (!config.MONGODB_URI) { console.warn(...) }` — server starts in demo mode | Post-migration: if `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` is missing, exit with error. |
| S6 | **CORS open to all origins** | **MEDIUM** | `app.js`: `app.use(cors())` — allows any origin | Restrict to configured frontend origin in production using `cors({ origin: process.env.ALLOWED_ORIGIN })`. |
| S7 | **`salary` field not protected by RLS** | **MEDIUM** | `User.salary` is `select: false` in Mongoose — but no server-side RLS exists; any admin query returns it | Add row-level security in Supabase: only `admin` role can SELECT `salary`. |
| S8 | **`/api/notifications/send-reminders` has no role restriction** | **LOW** | Any authenticated user (due to bypass, any caller) can dispatch WhatsApp messages | Add `requireRole('admin', 'receptionist')`. |
| S9 | **`/api/auth/doctors` has no role restriction** | **LOW** | Any authenticated user can enumerate doctors including email and phone | Acceptable for internal app; restrict if multi-tenant. |
| S10 | **Frontend stores token in localStorage** | **LOW** | `store.js`: `localStorage.setItem(SESSION_KEY, JSON.stringify({...}))` — XSS risk | Consider `httpOnly` cookie for token storage post-migration. Current approach is common in SPAs but has XSS exposure. |

---

## 14. Proposed Migration Strategy Summary

### Phase overview

| Phase | Work | Deliverable |
|-------|------|-------------|
| **A** | Fix critical security gaps (S1, S2, S3, S4) | Secure backend, independent of DB |
| **B** | Design PostgreSQL schema, create Supabase migration files | SQL migration files |
| **C** | Install `@supabase/supabase-js`, add `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` to env | Supabase client configured |
| **D** | Create a data-access layer (`src/db/`) with one file per entity | Replaces Mongoose model calls |
| **E** | Migrate services one-by-one: auth → patient → appointment → payment → clinical → AI → categories | Services use PostgreSQL, not Mongoose |
| **F** | Migrate dashboard aggregation (routes/index.js) to SQL | Stats endpoint uses SQL |
| **G** | Migrate seed logic to SQL-based seed | New seed script |
| **H** | Remove `mongoose`, `mongodb`, `sequelize`, `sqlite3` from package.json | Lean dependency tree |
| **I** | Migrate file storage from local disk to Supabase Storage | X-ray images in Supabase |
| **J** | Validate all API contracts against frontend expectations | All tests pass |

### Target PostgreSQL tables

Based on the model analysis, the PostgreSQL schema requires these tables (seeded in dependency order):

1. `clinics`
2. `users`
3. `treatment_categories`
4. `patients`
5. `appointments`
6. `doctor_availability`
7. `clinical_records`
8. `dental_chart_entries` (or JSONB column on `clinical_records`)
9. `dental_findings`
10. `prescriptions`
11. `prescription_items`
12. `invoices`
13. `invoice_items`
14. `payments`
15. `files`
16. `ai_reports`
17. `notifications`
18. `audit_logs`

### Architecture decisions

| Decision | Recommendation | Rationale |
|----------|---------------|-----------|
| ORM vs. raw client | Use `@supabase/supabase-js` PostgREST client for simple CRUD; raw `pg` / Supabase RPC for complex queries | Avoids introducing Prisma/Drizzle; matches stated goal; PostgREST covers all CRUD needs |
| ID type | `UUID` with `gen_random_uuid()` as default | Standard Supabase approach; eliminates ObjectId dependency |
| Sequential human IDs | PostgreSQL `SEQUENCE` per entity per clinic | `APT-2026-0001` generated from sequence, not count-based |
| Monetary amounts | `INTEGER` (paise) | Already stored as paise in MongoDB; preserves existing behaviour |
| `dentalChart` | JSONB column on `clinical_records` | Read/written as a whole; no independent querying needed |
| `prescription` migration | Dedicated `prescription_items` table | Normalise the stringified JSON anti-pattern |
| File storage | Supabase Storage bucket `xrays` | Local disk incompatible with cloud deployment |
| Auth | Keep Express JWT middleware; fix security gaps | Not replacing with Supabase Auth (would require frontend changes) |
| RLS | Enable Supabase RLS on `salary` column, `audit_logs` | Protect sensitive fields at DB level |
| Connection | `SUPABASE_SERVICE_ROLE_KEY` server-side only | Never expose to frontend |

---

*End of Phase 1 Audit Report*
