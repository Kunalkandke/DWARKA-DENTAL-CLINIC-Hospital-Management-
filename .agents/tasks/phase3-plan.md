# Phase 3 Implementation Plan — MongoDB Atlas → Supabase PostgreSQL Migration
## Dwarka Dental Clinic Management System

**Plan date:** 2025  
**Workspace root:** `c:\Users\Kunal\OneDrive\Desktop\DwarkaDentalClinic-main`  
**Based on:** Phase 1 audit + Phase 2 schema design + direct source code reading of all service files

---

## 0. Preliminary: Module System & Project Conventions

**Module system: CommonJS (`require`/`module.exports`).**  
There is NO `"type": "module"` field in `Backend/package.json`. Every existing file uses `require()`/`module.exports`. All new files must use CommonJS.

**Node/Express version:** Express 5 (`^5.2.1`), Node 18+.

**No test framework is currently configured** in `package.json`. Verification is done by starting the server and confirming expected behavior. The implementing agent must start the server manually with `node index.js` from the `Backend/` directory to verify each step.

**Run command:** `cd Backend && node index.js` (or `npm start`).  
**Dev command:** `cd Backend && npm run dev` (uses nodemon).

**`.env` location:** `Backend/.env` (parsed with `dotenv.config({ path: path.join(__dirname, '..', '..', '.env') })` from `src/config/env.js`).

---

## 1. Critical Security Fixes (Step A) — Auth Middleware and Auth Service

These must be fixed first. They are independent of the database and can be verified before any DB work begins.

### 1.1 Exact Broken Patterns in `authMiddleware.js`

File: `Backend/src/middleware/authMiddleware.js`

**Problem 1 — Missing/empty token grants admin:**
```js
if (!authHeader || !authHeader.startsWith('Bearer ')) {
  req.user = { id: 'admin-1', role: 'admin', email: 'admin@dwarkadental.com' };
  return next();   // ← MUST return 401, not grant admin
}
```

**Problem 2 — `demo-token` literal grants admin:**
```js
if (!token || token === 'demo-token') {
  req.user = { id: 'admin-1', role: 'admin', email: 'admin@dwarkadental.com' };
  return next();   // ← MUST return 401
}
```

**Problem 3 — Any JWT error (expired, malformed, wrong secret) grants admin:**
```js
} catch (err) {
  req.user = { id: 'admin-1', role: 'admin', email: 'admin@dwarkadental.com' };
  next();   // ← MUST return 401
}
```

**Fix:** All three cases must call `return next(ApiError.unauthorized('Authentication required.'))` instead of granting the admin identity.

### 1.2 Exact Broken Patterns in `auth.service.js`

File: `Backend/src/services/auth.service.js`

**Problem 1 — Plaintext password comparison fallback (lines 30–32):**
```js
if (!isMatch && user.passwordHash === password) {
  isMatch = true;   // ← MUST be removed; bcrypt alone is sufficient
}
```

**Problem 2 — Hardcoded demo password bypass (lines 34–48):**
```js
if (!isMatch) {
  const acceptable = {
    'admin@dwarkadental.com': ['admin123'],
    // ... 6 more hardcoded email+password pairs
  };
  const validList = acceptable[normalizedEmail];
  if (validList && validList.includes(password)) {
    isMatch = true;   // ← entire block MUST be removed
  }
}
```

Both blocks must be deleted. The seed (`src/config/seed.js`) already properly hashes passwords with `bcrypt.hash(password, 12)`, so bcrypt.compare will work correctly on the seeded data.

**Note:** `auth.routes.js` — `POST /api/auth/staff` and `PUT /api/auth/staff/:id` have no `requireRole` guard. Add `requireRole('admin')` to both after `authMiddleware` in the route chain.

---

## 2. Step B — Supabase Client Setup & Environment

### Files to create/modify:
- **Modify:** `Backend/package.json` — add `@supabase/supabase-js`, remove `mongoose`, `mongodb`, `sequelize`, `sqlite3`
- **Modify:** `Backend/src/config/env.js` — add `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`; validate both on startup; keep `MONGODB_URI` validation removed (or made optional)
- **Create:** `Backend/src/config/supabase.js` — instantiates and exports the Supabase client using `createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)`
- **Modify:** `Backend/src/config/db.js` — replace `mongoose.connect()` with a Supabase connectivity test (a simple `SELECT 1` via the `pg` client or a Supabase `.rpc()` ping)
- **Modify:** `Backend/index.js` — update startup log message; keep `connectDB()` call but rename it to reflect Supabase

### Key transformations:

**`env.js`** must add:
```js
SUPABASE_URL: process.env.SUPABASE_URL,
SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
```
And add startup enforcement:
```js
if (!config.SUPABASE_URL || !config.SUPABASE_SERVICE_ROLE_KEY) {
  if (config.NODE_ENV === 'production') process.exit(1);
  else console.warn('WARNING: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set.');
}
```

**`supabase.js`** (new file):
```js
const { createClient } = require('@supabase/supabase-js');
const config = require('./env');
const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY);
module.exports = supabase;
```

**`db.js`** replaces `mongoose.connect()` with a health check against Supabase:
```js
const supabase = require('./supabase');
async function connectDB() {
  const { error } = await supabase.from('clinics').select('id').limit(1);
  if (error) throw new Error(`Supabase connection failed: ${error.message}`);
  console.log('[DB] Supabase connected successfully');
}
module.exports = { connectDB };
```

**`package.json`** dependency changes:
- Add: `"@supabase/supabase-js": "^2.49.4"` (or latest stable 2.x)
- Remove: `"mongoose"`, `"mongodb"`, `"sequelize"`, `"sqlite3"`

**`.env` additions** (implementer adds to `Backend/.env`):
```
SUPABASE_URL=https://<project-id>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

### Edge cases:
- `index.js` catches DB startup errors and continues in demo mode — this behavior is fine to keep; just update the log message.
- The `seedDefaultData()` in the old `db.js` is now superseded by the new `seed.js` — remove it from `db.js`.

---

## 3. Step C — SQL Migration File

### Files to create:
- **Create:** `Backend/src/config/migration.sql` — the complete SQL from Section 5 of `phase2-schema-design.md`

This file is the authoritative schema. Copy the SQL verbatim from Section 5 of phase2-schema-design.md. The implementing agent must run this SQL in the Supabase SQL editor or via `psql` to create all tables before the services are migrated.

**Important:** The SQL must be run ONCE on the Supabase project before any service can be tested.

---

## 4. Step D — Data Access Layer (`src/db/`)

Create one query file per entity. These replace all Mongoose model calls. All files export plain async functions; no classes.

### Files to create:
- `Backend/src/db/index.js` — re-exports all db modules for convenient imports
- `Backend/src/db/clinic.db.js`
- `Backend/src/db/user.db.js`
- `Backend/src/db/patient.db.js`
- `Backend/src/db/appointment.db.js`
- `Backend/src/db/treatment-category.db.js`
- `Backend/src/db/clinical-record.db.js`
- `Backend/src/db/payment.db.js`
- `Backend/src/db/invoice.db.js`
- `Backend/src/db/ai-report.db.js`
- `Backend/src/db/file.db.js`
- `Backend/src/db/notification.db.js`
- `Backend/src/db/audit-log.db.js`

### Pattern for all db files:

All db files `require('../config/supabase')` and use the Supabase JS client. Simple CRUD uses `.from('table').select/insert/update/delete`. Complex queries (multi-table joins, aggregations) use `supabase.rpc('function_name', args)` or raw SQL via `supabase.rpc` with a helper function.

**ID validation:** Replace all `mongoose.Types.ObjectId.isValid(id)` calls with a UUID regex check:
```js
function isValidUUID(id) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}
```
This function should be placed in `Backend/src/utils/isValidUUID.js` and imported wherever needed.

### Key functions per db file:

**`clinic.db.js`:**
- `getDefaultClinic()` → `supabase.from('clinics').select('*').limit(1).single()` — replaces the 5 scattered `Clinic.findOne({})` calls across all services

**`user.db.js`:**
- `findByEmail(email)` — with `password_hash` included: `select('*, password_hash')`
- `findById(id)` — standard select
- `findDoctors({ status })` — filter by role = 'doctor'
- `findAllStaff()` — all users
- `createUser(data)` — insert
- `updateUser(id, data)` — update by id
- `updateLastLogin(id)` — `update({ last_login_at: new Date() })`

**`patient.db.js`:**
- `findAll(filter)` — complex filter with pagination; uses `ilike` for search
- `findById(id)` — with JOINs to users (assigned_doctor) and treatment_categories
- `create(data)` — insert; `patient_number` generated by DB sequence via DEFAULT
- `update(id, data)` — update
- `softDelete(id)` — `update({ is_deleted: true, deleted_at: new Date() })`

**`appointment.db.js`:**
- `findAll(filter)` — complex filter with JOINs to patients, users, treatment_categories
- `findById(id)` — with JOINs
- `create(data)` — insert; `appointment_number` by DB sequence
- `updateStatus(id, data)` — update
- `softDelete(id)` — update is_deleted
- `countForClinic(clinicId)` — for any remaining number checks (should be avoided; sequence handles this)
- `bulkSoftDeleteByPatient(patientId)` — replaces `Appointment.updateMany({ patientId: {$in: idList} }, ...)`

**`clinical-record.db.js`:**
- `findByPatient(patientId)` — sort by visit_date DESC
- `create(data)` — insert with dental_chart as JSONB

**`payment.db.js`:**
- `findAll(filter)` — with patient JOIN
- `findByPatient(patientId)` — with sort
- `create(data)` — insert; `receipt_number` by DB sequence
- `softDelete(id)` — update is_deleted
- `getRevenueSummary(clinicId)` — `SELECT method, SUM(amount) FROM payments WHERE is_deleted = false GROUP BY method`
- `getDashboardStats(clinicId, todayStart, todayEnd)` — all 5 count queries + 2 revenue aggregates in a single RPC or Promise.all

**`invoice.db.js`:**
- `create(data)` — insert header; returns new invoice id
- `createWithItems(invoiceData, items)` — insert invoice then insert invoice_items in sequence

**`ai-report.db.js`:**
- `create(data)` — insert
- `findByPatient(patientId)` — with file JOIN
- `update(id, data)` — for doctor review

**`file.db.js`:**
- `create(data)` — insert file metadata

**`treatment-category.db.js`:**
- `findAll(filter)` — with search/sort
- `findByCode(code)` — lookup
- `create(data)` — insert
- `update(id, data)` — update
- `upsertByCode(code, data)` — for seed; uses `upsert` with `onConflict('code')`

**`notification.db.js`** and **`audit-log.db.js`:** create/findByRecipient as needed.

### Edge case: Supabase client select with password_hash

`user.db.js:findByEmail()` needs to SELECT `password_hash`. In Supabase with RLS, the `service_role` key bypasses all restrictions, so this is safe. Never return `password_hash` in API responses.

---

## 5. Step E — Service Migration (auth → patient → appointment → payment → clinical → AI → categories)

### 5.1 `auth.service.js` migration

**File:** `Backend/src/services/auth.service.js`

Remove all `require('../models/user.model')` calls. Import `userDb` from `../db/user.db`.

**`login()` function transformation:**
1. Replace `User.findOne({ email }).select('+passwordHash')` → `userDb.findByEmail(normalizedEmail)` (which includes password_hash)
2. Remove the plaintext comparison fallback `if (!isMatch && user.passwordHash === password)`
3. Remove the entire `acceptable` hardcoded password block
4. Replace `User.findByIdAndUpdate(user._id, { lastLoginAt: new Date() })` → `userDb.updateLastLogin(user.id)`
5. Replace `user._id.toString()` → `user.id` (UUID is already a string)

**`/api/auth/doctors` route handler** (in `auth.routes.js`):
Replace `User.find({ role: 'doctor', status: 'active' }).select(...).lean()` with `userDb.findDoctors({ status: 'active' })`.  
The inline doctor-seeding fallback (if `doctors.length === 0`, creates 2 doctors) should be removed — use the seed instead.  
Remove the inline `require('bcryptjs')` and `require('../models/clinic.model')` — these are anti-patterns.

**`/api/auth/staff` GET, POST, PUT handlers** (in `auth.routes.js`):
Replace all `User.find({})`/`User.findOne()`/`User.create()`/`User.findById()` + `.save()` → `userDb.findAllStaff()`, `userDb.findByEmail()`, `userDb.createUser()`, `userDb.findById()`, `userDb.updateUser()`.  
Add `requireRole('admin')` before the `asyncHandler` on POST and PUT routes.

**`GET /api/auth/me`** (in `auth.controller.js` — read before modifying):
Reads token from header manually — may use User model. Replace with `userDb.findById(decoded.id)` if needed.

### 5.2 `patient.service.js` migration

**File:** `Backend/src/services/patient.service.js`

Remove all Mongoose model imports. Import `patientDb`, `userDb`, `treatmentCategoryDb`, `appointmentDb`, `paymentService` (lazy circular import pattern already exists — keep as lazy require of the service, not the db module).

**`getAllPatients()` transformation:**
- Replace `Patient.find(filter).populate(...).sort(...).skip(...).limit(...).lean()` with a parameterized SQL query in `patientDb.findAll(filter)` that JOINs `users` and `treatment_categories`.
- Replace Mongoose `$regex` search → PostgreSQL `ILIKE '%' || $1 || '%'` across `name`, `phone`, `patient_number`, `email`, `chief_complaint`.
- Replace `mongoose.Types.ObjectId.isValid(doctorId)` → `isValidUUID(doctorId)`.
- The `$nin` deleted patients exclusion (lines 85-93) should be replaced by an additional `AND is_deleted = false` filter on the appointments sub-join for the `categoryId` path; the main filter already has `is_deleted = false`.

**`getPatientById()` transformation:**
- Replace with `patientDb.findById(id)` which includes the 2-table JOIN.

**`createPatient()` transformation:**
- `Patient.countDocuments({ clinicId })` → removed; sequence handles `patient_number`.
- `Patient.create({...})` → `patientDb.create(data)`.
- The inline appointment creation block → calls `appointmentDb.create(...)` directly (not through bookAppointment service to avoid complexity).
- The inline advance payment block → keep lazy `require('./payment.service')` as-is.
- Remove `treatmentCategoryName` from the patient create payload (dropped field).
- Remove all inline `require('mongoose')` calls.
- The `normalizeCategory()` function stays unchanged.

**`updatePatient()` transformation:**
- Remove `patientNumber` from allowed fields (it's read-only now, generated by sequence).
- Remove `treatmentCategoryName` from allowed fields (dropped).
- Replace `.findById(id)` + `.save()` → `patientDb.update(id, body)`.

**`softDeletePatient()` transformation:**
- Replace `Patient.findById(id)` + `patient.isDeleted = true; await patient.save()` → `patientDb.softDelete(id)`.
- Replace `Appointment.updateMany({patientId: {$in: idList}}, ...)` → `appointmentDb.bulkSoftDeleteByPatient(patientId)`.
- Remove the complicated `idList` construction — PostgreSQL accepts a single UUID string.

### 5.3 `appointment.service.js` migration

**File:** `Backend/src/services/appointment.service.js`

Remove all Mongoose model imports. Import `appointmentDb`, `patientDb`, `userDb`, `treatmentCategoryDb`.

**`getAllAppointments()` transformation:**
- Replace the entire Mongoose filter/populate/sort/skip/limit chain → `appointmentDb.findAll(query)`.
- The `deletedPatients = await Patient.find({ isDeleted: true }).distinct('_id')` exclusion pattern → replace with `AND p.is_deleted = false` in the JOIN condition in the SQL query.
- Inline `require('mongoose')` calls → `isValidUUID()`.
- The `$nin: deletedPatients` filter → handled in SQL via JOIN condition.

**`bookAppointment()` transformation:**
- `Patient.findById(patientId)` → `patientDb.findById(patientId)`.
- `User.findById(doctorId)` → `userDb.findById(doctorId)`.
- `TreatmentCategory.findById(treatmentCategoryId)` → `treatmentCategoryDb.findById(treatmentCategoryId)`.
- Conflict detection: `Appointment.findOne({ doctorId, isDeleted: false, status: {$nin: [...]}, $or: [{startAt: {$lt: endAt}, endAt: {$gt: startAt}}] })` → SQL overlap query:  
  ```sql
  SELECT id FROM appointments
  WHERE doctor_id = $1 AND is_deleted = false
    AND status NOT IN ('cancelled','rescheduled','completed','missed')
    AND start_at < $3 AND end_at > $2
  LIMIT 1
  ```
- `Appointment.countDocuments({ clinicId })` → removed; sequence handles `appointment_number`.
- `Appointment.create({...})` → `appointmentDb.create(data)`.
- `patient.assignedDoctorId !== doctorId` check → `patientDb.update(patientId, { assigned_doctor_id: doctorId })`.

**`updateAppointmentStatus()` transformation:**
- `Appointment.findById(id)` → `appointmentDb.findById(id)`.
- Status-specific save → `appointmentDb.updateStatus(id, updateFields)`.
- `Patient.findById(...)` + save → `patientDb.update(patientId, fields)`.
- Auto-followup appointment creation → `appointmentDb.create(...)`.
- `Appointment.countDocuments(...)` → removed; sequence handles number.

**`getAppointmentsByPatient()` transformation:**
- Replace `.find({ patientId, isDeleted: false }).populate(...).sort(...)` → `appointmentDb.findByPatient(patientId)`.

### 5.4 `payment.service.js` migration

**File:** `Backend/src/services/payment.service.js`

Remove all Mongoose imports. Import `paymentDb`, `invoiceDb`, `patientDb`.

**`addPayment()` transformation:**
- `Payment.countDocuments({ clinicId })` → removed; sequence handles `receipt_number`.
- `Invoice.countDocuments({ clinicId })` → removed; sequence handles `invoice_number`.
- `Invoice.create({...})` → `invoiceDb.createWithItems(invoiceData, items)`.
- `Payment.create({...})` → `paymentDb.create(data)`.
- `amountPaise = Math.round(parseFloat(amount) * 100)` — keep this conversion.

**`getRevenueSummary()` transformation:**
- Replace `Payment.aggregate([...])` → `paymentDb.getRevenueSummary(clinicId)`.
- SQL: `SELECT method, SUM(amount) AS value FROM payments WHERE is_deleted = false GROUP BY method`

**`getAllPayments()` and `getPaymentsByPatient()` transformation:**
- Replace `.find(filter).populate(...)` → `paymentDb.findAll(filter)` and `paymentDb.findByPatient(patientId)`.

### 5.5 `clinical.service.js` migration

**File:** `Backend/src/services/clinical.service.js`

Remove all Mongoose imports. Import `clinicalRecordDb`, `patientDb`, `appointmentDb`.

**`getClinicalRecordsByPatient()` transformation:**
- Replace `ClinicalRecord.find({ patientId, isDeleted: false }).sort({ visitDate: -1 }).lean()` → `clinicalRecordDb.findByPatient(patientId)`.
- Remove `JSON.parse(r.prescription)` — the `prescription` field no longer exists on clinical_records. Prescriptions are in the `prescriptions` table. For each record, optionally fetch prescriptions with `prescriptionDb.findByRecord(recordId)` or return an empty array for now.
- **Important:** The frontend reads `record.prescription` as a parsed array (`getClinicalRecordsByPatient` returns `{ ...r, prescription: [] }`). Keep returning `prescription: []` for backward compatibility — a separate prescription endpoint can be added later.

**`addClinicalRecord()` transformation:**
- Remove `JSON.stringify(prescription)` — do not store prescription on clinical_records.
- `ClinicalRecord.create({...})` → `clinicalRecordDb.create(data)`, passing `dentalChart` directly as a JS array (Supabase serializes it to JSONB automatically).
- Remove `doctorName` from create payload (dropped field).
- `Patient.findById(patientId)` + save → `patientDb.update(patientId, fields)`.
- `Appointment.findById(appointmentId)` + save → `appointmentDb.updateStatus(appointmentId, { status: 'completed', completed_at: new Date() })`.

### 5.6 `treatment-category.service.js` migration

**File:** `Backend/src/services/treatment-category.service.js`

Remove Mongoose imports. Import `treatmentCategoryDb`.

**`getCategories()` transformation:**
- The Mongoose filter `{ $or: [{ clinicId: clinic._id }, { clinicId: { $exists: false } }] }` is a MongoDB-ism for "any clinic OR no clinic assigned". In PostgreSQL, all categories have a `clinic_id`. Remove the OR; filter by `clinic_id = $1` only.
- Replace `.find(filter).sort({...}).lean()` → `treatmentCategoryDb.findAll(filter)`.

**`createCategory()`, `updateCategory()`, `toggleActive()` transformation:**
- Replace Mongoose CRUD with `treatmentCategoryDb.create()`, `treatmentCategoryDb.update()`, `treatmentCategoryDb.toggleActive()`.

### 5.7 `ai.service.js` migration

**File:** `Backend/src/services/ai.service.js`

Remove Mongoose imports for `AiReport`, `File`, `Patient`, `Clinic`. Import `aiReportDb`, `fileDb`, `patientDb`.

**`uploadAndAnalyzeXray()` transformation:**
- `Patient.findById(patientId)` → `patientDb.findById(patientId)`.
- `File.create({...})` → `fileDb.create(data)` — note: `fileDoc.id` (not `fileDoc._id`).
- `AiReport.create({...})` → `aiReportDb.create(data)`.
- Keep the `UPLOAD_DIR` and `callMlService()` logic unchanged — file storage migration (to Supabase Storage) is Step I.

**`getAiReportsByPatient()` transformation:**
- `AiReportModel.find({ patientId }).populate('fileId', ...).sort({...}).lean()` → `aiReportDb.findByPatient(patientId)` which JOINs `files`.

**`reviewAiReport()` transformation:**
- `AiReport.findById(reportId)` + save → `aiReportDb.update(reportId, fields)`.

---

## 6. Step F — Dashboard Aggregation Migration

**File:** `Backend/src/routes/index.js`

This file has inline Mongoose model imports and 9 direct DB calls. Migrate to service calls.

**`GET /api/stats/dashboard` transformation:**

Replace all Mongoose model imports at the top of the file with service imports:
```js
const patientService = require('../services/patient.service');
const appointmentService = require('../services/appointment.service');
const paymentService = require('../services/payment.service');
const treatmentCategoryService = require('../services/treatment-category.service');
```

Replace the `Promise.all` of 5 `countDocuments` calls → SQL:
```sql
SELECT
  (SELECT COUNT(*) FROM patients WHERE is_deleted = false) AS total_patients,
  (SELECT COUNT(*) FROM appointments WHERE is_deleted = false AND start_at >= $1 AND start_at <= $2 AND status NOT IN ('cancelled')) AS today_appointments,
  (SELECT COUNT(*) FROM appointments WHERE is_deleted = false AND start_at < NOW() AND status IN ('scheduled','confirmed')) AS missed_appointments,
  (SELECT COUNT(*) FROM appointments WHERE is_deleted = false AND start_at > $2 AND status IN ('scheduled','confirmed')) AS upcoming_appointments,
  (SELECT COUNT(*) FROM appointments WHERE is_deleted = false AND status = 'completed') AS completed_appointments
```
Add a `getDashboardCounts(todayStart, todayEnd)` function to a new `paymentDb` or `appointmentDb` method, or expose it as `getDashboardStats()` in a new `src/db/stats.db.js`.

Replace `Payment.aggregate([...])` revenue queries → SQL:
```sql
-- Today revenue
SELECT COALESCE(SUM(amount), 0) AS total FROM payments
WHERE is_deleted = false AND paid_at >= $1 AND paid_at <= $2;

-- Total revenue
SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE is_deleted = false;

-- Category breakdown
SELECT treatment_category_id, COUNT(*) AS count FROM appointments
WHERE is_deleted = false AND treatment_category_id IS NOT NULL
GROUP BY treatment_category_id;
```

Create `Backend/src/db/stats.db.js` with:
- `getDashboardCounts(todayStart, todayEnd)` — returns all 5 counts
- `getTodayRevenue(todayStart, todayEnd)` — returns total paise
- `getTotalRevenue()` — returns total paise
- `getCategoryBreakdown()` — returns `[{ treatment_category_id, count }]`

**`POST /api/notifications/send-reminders` transformation:**

Replace `Appointment.find({...}).lean()` → `appointmentDb.findRemindersToSend(tomorrowStart, tomorrowEnd)`.
Replace `Patient.findById(apt.patientId).lean()` → `patientDb.findById(apt.patient_id)`.
Replace `Appointment.findByIdAndUpdate(apt._id, ...)` → `appointmentDb.updateStatus(apt.id, { reminder_sent: true, reminder_sent_at: new Date() })`.

---

## 7. Step G — Seed Migration

**File:** `Backend/src/config/seed.js`

Replace all Mongoose model operations with db-layer calls. The seed logic (structure, data, dynamic dates) stays the same — only the persistence layer changes.

**Transformations:**

1. **Clinic seed:**  
   `Clinic.findOne({})` → `clinicDb.getDefaultClinic()` (already wrote this in db layer).  
   `Clinic.create({...})` → `clinicDb.create(data)`. Remove old `address` structure (MongoDB sub-doc) — use `address_line1`, `address_city`, etc. flat columns.

2. **User seed:**  
   `User.findOne({ email })` → `userDb.findByEmail(email)`.  
   `User.create({...})` → `userDb.create(data)`.  
   `await existing.save()` (for password hash refresh) → `userDb.updateUser(existing.id, { password_hash: newHash })`.  
   Remove `clinicId` field name — use `clinic_id`.

3. **Treatment category seed:**  
   `TreatmentCategory.findOneAndUpdate({ code }, ..., { upsert: true })` → `treatmentCategoryDb.upsertByCode(code, data)`.

4. **Patient seed:**  
   `Patient.findOne({ clinicId, patientNumber })` → `patientDb.findByPatientNumber(patientNumber)`.  
   `Patient.create({...})` → `patientDb.create(data)`.  
   Remove `patientNumber` from the create payload — sequence auto-generates it; OR if you want the exact seed numbers (DWK-2026-0001 etc.), you must advance the sequence and insert with an explicit value, OR accept that seeded patients get different numbers.  
   **Recommended:** Accept auto-generated numbers in seed; the patient_number in the seed data is used only for `findOne` lookup checks.

5. **Appointment seed:**  
   `Appointment.countDocuments({ clinicId })` → removed; sequence handles number.  
   `Appointment.create({...})` → `appointmentDb.create(data)`.  
   Remove `isDeleted` from create payload (defaults to false in DB).

6. **`Backend/seed.js`** (root-level standalone seed) — leave this as-is or update it to call `seedDatabase()` from the updated `src/config/seed.js`.

---

## 8. Step H — Remove Mongoose Dependencies

Once all services are migrated and server starts cleanly:

1. `npm uninstall mongoose mongodb sequelize sqlite3` in `Backend/`.
2. Verify `package.json` no longer lists them.
3. Remove any remaining `require('mongoose')` — search all files in `Backend/src/`.
4. Delete all files in `Backend/src/models/` — they are now dead code.

---

## 9. Step I — File Storage Migration (Supabase Storage)

**File:** `Backend/src/services/ai.service.js`

Current behavior: Multer writes files to `Backend/uploads/`. `storageKey` stores the filename (e.g., `xray-1234567890-123456789.jpg`). Files are served at `/uploads/:filename`.

**Target behavior:** Files are uploaded to a Supabase Storage bucket `xrays`. `storageKey` stores the Supabase Storage path. Files are served via signed URLs from Supabase.

**Transformations:**

1. In `ai.service.js`, after `callMlService()` succeeds, upload the file to Supabase Storage:
   ```js
   const { data: uploadData, error: uploadError } = await supabase.storage
     .from('xrays')
     .upload(`${patientId}/${file.filename}`, fs.createReadStream(file.path), {
       contentType: file.mimetype,
       upsert: false,
     });
   if (uploadError) throw ApiError.internal(`Storage upload failed: ${uploadError.message}`);
   const storagePath = uploadData.path;
   ```

2. Delete the local file after successful upload to avoid disk accumulation:
   ```js
   fs.unlink(file.path, () => {});
   ```

3. Store `storagePath` as `storage_key` in `fileDb.create()`.

4. When returning AI report results, generate a signed URL:
   ```js
   const { data: signedData } = await supabase.storage
     .from('xrays')
     .createSignedUrl(storageKey, 3600); // 1 hour
   const imageUrl = signedData?.signedUrl || null;
   ```

5. Add the `xrays` bucket creation note — the bucket must be created in the Supabase Storage dashboard or via `supabase.storage.createBucket('xrays', { public: false })` called once at startup.

6. Add a route `GET /api/files/:id/signed-url` that returns a fresh signed URL for a file — the frontend's current hardcoded `/uploads/:filename` URL pattern must be updated to use this endpoint. **Note:** This requires a frontend change (out of scope for this phase) — for now, return the signed URL in the AI report response and the frontend's existing `image` field will carry it.

---

## 10. Step J — Validation & API Contract Testing

**File-by-file verification checklist:**

1. **`POST /api/auth/login`** with `admin@dwarkadental.com` / `admin123` → returns JWT, no demo bypass.
2. **`GET /api/auth/me`** with valid token → returns user.
3. **`GET /api/auth/doctors`** → returns list of seeded doctors.
4. **`GET /api/patients`** → returns `{ data: [...], pagination: {...} }` shape.
5. **`POST /api/patients`** with valid body → creates patient, returns `{ patient, appointment, payment }`.
6. **`GET /api/appointments?view=today`** → returns today's appointments with populated patient/doctor/category names.
7. **`POST /api/appointments`** with overlap → returns 400 conflict error.
8. **`GET /api/payments`** → returns paginated list.
9. **`POST /api/payments`** → creates payment + invoice, returns receipt shape.
10. **`GET /api/clinical/:patientId`** → returns array with `prescription: []`.
11. **`POST /api/clinical`** → creates clinical record with `dentalChart` JSONB.
12. **`GET /api/categories`** → returns treatment category list.
13. **`GET /api/stats/dashboard`** → returns `{ totalPatients, todayAppointments, ... }`.
14. **`POST /api/notifications/send-reminders`** → returns `{ processedCount, details }`.
15. **`POST /api/ai/upload`** (with ML service running) → returns AI report shape.

**Response shape verification — the frontend expects these exact shapes:**

| Route | Required shape |
|-------|----------------|
| `GET /api/patients` | `res.data.data` (array) + `res.data.pagination` |
| `GET /api/patients/:id` | `res.data.patient` OR `res.data` |
| `GET /api/appointments` | `res.data` (array) OR `res.data.data` (array) |
| `GET /api/payments/:patientId` | `res.data.payments` (array) |
| `GET /api/clinical/:patientId` | raw array (no wrapper) |
| `GET /api/ai/reports/:patientId` | `res.data.report` OR `res.data` (array) |
| `GET /api/stats/dashboard` | `res.data` object with named stats |

All `toFrontendShape()` functions in the services must be preserved and continue returning the exact same field names as they do today.

---

## 11. Edge Cases & Gotchas Found During Source Reading

### 11.1 Inline `require('mongoose')` inside functions (anti-pattern)
Both `appointment.service.js` (lines ~90, ~145) and `patient.service.js` (lines ~55, ~74) use `const mongoose = require('mongoose')` inside function bodies. These must all be removed when the service is migrated. Search for `require('mongoose')` across all service files before declaring a service migration complete.

### 11.2 `getDefaultClinic()` duplicated in every service
All 7 service files (`appointment`, `patient`, `payment`, `clinical`, `ai`, `treatment-category`, `auth.routes`) define their own `getDefaultClinic()` function. After migration, all use `clinicDb.getDefaultClinic()` from the db layer — one implementation, no duplicates.

### 11.3 `patient.service.js:createPatient()` stores extra denormalized fields on Appointment
When creating a patient's initial appointment, `patient.service.js` passes `patientName`, `patientPhone`, `doctorName`, `date`, `time`, `treatmentCategoryName` into `Appointment.create()`. These are **not columns** in the new `appointments` table. These fields must be stripped from the appointment create payload — they are derived from JOINs in the SELECT path.

### 11.4 `auth.routes.js` inline bcrypt and Clinic creation
`auth.routes.js` contains inline `require('bcryptjs')` and `Clinic.create()` calls inside route handlers (in `GET /doctors`, `POST /staff`). These are anti-patterns that must be cleaned up — use `bcrypt` imported once at the top, and replace `Clinic.create()` with `clinicDb.getDefaultClinic()`.

### 11.5 `seed.js` passes MongoDB-style address to `Clinic.create()`
The main `src/config/seed.js` calls `Clinic.create({ address: 'Dwarka, New Delhi', settings: {} })` — this is an incorrect simplified address vs the full address schema. In PostgreSQL, the clinic insert must use the flat columns: `address_line1`, `address_city`, `address_state`, `address_postal_code`. The seed.js clinic creation block must be fixed to use the correct column names.

### 11.6 `appointment.service.js:toFrontendShape()` relies on populated sub-objects
The `toFrontendShape()` function checks `typeof a.patientId === 'object'` to detect populated vs. raw ID. After migration, JOIN results will always be objects. The shape function should be updated to expect the JOIN result structure: `a.patient_name` (alias from JOIN), `a.doctor_name`, etc. rather than checking for object type.

### 11.7 Concurrent number generation race condition — already present
The `countDocuments() + 1` number generation (used for APT, DWK, INV, RCPT numbers) is a known race condition. PostgreSQL sequences eliminate this. **The sequences are defined in the migration SQL and the DEFAULT clause on each column calls `next_seq_id()` automatically on INSERT.** The implementer must NOT pass `appointment_number`, `patient_number`, `invoice_number`, or `receipt_number` in INSERT payloads — let the database generate them, then read them back from the INSERT RETURNING clause.

### 11.8 `updateAppointmentStatus()` — `status === 'rescheduled'` modifies startAt/endAt in place
The current code modifies the appointment's own `startAt`/`endAt` when status is `'rescheduled'` (rather than creating a new appointment). This is preserved in the migration — the `appointments` table allows updating `start_at`/`end_at`, and the CHECK constraint `end_at > start_at` will enforce validity.

### 11.9 `payment.service.js` uses `mode` parameter but stores as `method`
The `addPayment()` function accepts `mode` in body and stores it as `method` (with `method: mode.toLowerCase()`). The `toFrontendShape()` returns it as `mode: p.method`. This mapping must be preserved in the migrated version.

### 11.10 Dashboard route imports models directly (not via services)
`src/routes/index.js` directly imports `Appointment`, `Patient`, `Payment` models at the module level. After migration, these must be replaced with db-layer imports or delegated to service functions. If moving to the db layer, the implementation should use `statsDb.getDashboardCounts()`.

### 11.11 `auth.routes.js:GET /doctors` inline seeding fallback
If no doctors are found, the route handler creates 2 hardcoded doctors (Dr. Bhagwan Rakh, Dr. H M Sanap). This inline seeding is redundant post-migration — the proper seed creates 4 doctors. Remove this fallback after confirming seed works.

### 11.12 `ClinicalRecord` seed not present
The current seed only creates: clinic, users, categories, patients, appointments. It does NOT seed clinical records, payments, invoices, or AI reports. This is correct — those are created through the application. No change needed for seed.

---

## 12. Potential Blockers

| # | Blocker | Severity | Resolution |
|---|---------|----------|------------|
| B1 | No `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` set | HIGH | Must be provided before any Supabase call works. Add to `Backend/.env`. |
| B2 | SQL migration not run in Supabase | HIGH | `migration.sql` must be executed in the Supabase SQL editor before any table operations. |
| B3 | `@supabase/supabase-js` not installed | HIGH | `npm install @supabase/supabase-js` in `Backend/`. |
| B4 | Supabase `xrays` storage bucket not created | MEDIUM | Create in Supabase Storage dashboard before Step I. |
| B5 | ML service not running for AI upload test | LOW | Step J AI test can be skipped if ML service unavailable; service returns 503 cleanly. |
| B6 | `Backend/.env` is `.gitignore`d | LOW | Normal — just ensure it exists locally with Supabase credentials. |
| B7 | `toFrontendShape()` functions use `._id.toString()` | MEDIUM | Must be changed to `.id` (UUID already a string) in every shape function across all services. |
| B8 | Circular import: `patient.service.js` lazy-requires `payment.service.js` | LOW | Already handled via lazy `require()` inside the function — this pattern is fine in CommonJS. Keep it. |
| B9 | `isValidUUID` utility missing | LOW | Create `Backend/src/utils/isValidUUID.js` in Step D before services use it. |
| B10 | `db.js:seedDefaultData()` function references Mongoose models | HIGH | Remove `seedDefaultData()` from `db.js` entirely in Step B — it duplicates `src/config/seed.js`. |

---

## 13. Step Ordering Summary

```
Step A: Fix auth security gaps (authMiddleware.js, auth.service.js, auth.routes.js)
  └── Independent of DB. Do first.
  
Step B: Install Supabase client, update env.js, create supabase.js, update db.js
  └── Prerequisite: Steps C and D.

Step C: Create migration.sql, run against Supabase
  └── Prerequisite for all service tests.

Step D: Create src/db/ layer (all db files) + isValidUUID utility
  └── Prerequisite for Step E.

Step E: Migrate all services (auth → patient → appointment → payment → clinical → ai → categories)
  └── Order within Step E: auth (no deps) → categories (needed by patient) → patient → appointment → payment → clinical → ai

Step F: Migrate dashboard/reminders in routes/index.js
  └── Depends on Step E (stats.db.js added in this step).

Step G: Migrate src/config/seed.js
  └── Depends on Step D (uses db layer).

Step H: Remove Mongoose packages + delete src/models/
  └── Do after Step G confirms server starts cleanly.

Step I: Migrate file storage to Supabase Storage
  └── Depends on Step E (ai.service.js already migrated).

Step J: Full validation pass
  └── Final step; test all endpoints.
```

---

*End of Phase 3 Implementation Plan*
