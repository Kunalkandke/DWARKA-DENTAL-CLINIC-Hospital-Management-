# Phase 3 Progress Report — Dwarka Dental Clinic
## MongoDB Atlas → Supabase PostgreSQL: Backend Conversion

**Completed:** Phase 3 (Steps A–J)  
**Status:** ✅ COMPLETE — all syntax checks pass, no Mongoose imports outside model files

---

## Files Created

| File | Description |
|------|-------------|
| `Backend/src/config/supabase.js` | Supabase JS client (service-role, no session persistence) |
| `Backend/src/config/migration.sql` | Complete PostgreSQL schema — 19 enums, 4 sequences, 18 tables, 34 indexes, 12 triggers, 18 RLS policies |
| `Backend/src/db/index.js` | Re-exports all 13 db modules |
| `Backend/src/db/clinic.db.js` | `getDefaultClinic()` with auto-create fallback |
| `Backend/src/db/user.db.js` | 7 functions: findByEmail (with password_hash), findById, findDoctors, findAllStaff, createUser, updateUser, updateLastLogin |
| `Backend/src/db/patient.db.js` | findAll (with JOINs + pagination + ILIKE search), findById, findByPatientNumber, create, update, softDelete, countForClinic |
| `Backend/src/db/appointment.db.js` | findAll (with JOINs + filters), findById, findByPatient, create, updateStatus, update, softDelete, bulkSoftDeleteByPatient, checkOverlap, findRemindersToSend |
| `Backend/src/db/clinical-record.db.js` | findByPatient, findById, create (JSONB dental_chart), update, softDelete |
| `Backend/src/db/treatment-category.db.js` | findAll, findById, findByCode, create, update, toggleActive, upsertByCode |
| `Backend/src/db/payment.db.js` | findAll, findByPatient, create, softDelete, getRevenueSummary |
| `Backend/src/db/invoice.db.js` | create, createWithItems |
| `Backend/src/db/file.db.js` | create, findByPatient, findById |
| `Backend/src/db/ai-report.db.js` | create, findByPatient (with file JOIN), update |
| `Backend/src/db/notification.db.js` | create, findByUser |
| `Backend/src/db/audit-log.db.js` | create |
| `Backend/src/db/stats.db.js` | getDashboardCounts (5 parallel COUNT queries), getTodayRevenue, getTotalRevenue, getCategoryBreakdown |
| `Backend/src/utils/isValidUUID.js` | UUID regex validator replacing mongoose.Types.ObjectId.isValid() |

---

## Files Modified

| File | Change |
|------|--------|
| `Backend/package.json` | Added `@supabase/supabase-js ^2.49.4`; removed `mongoose`, `mongodb`, `sequelize`, `sqlite3` |
| `Backend/src/config/env.js` | Added `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`; startup exit in production if missing; kept JWT warning |
| `Backend/src/config/db.js` | Replaced `mongoose.connect()` with Supabase connectivity health check |
| `Backend/src/config/seed.js` | Fully rewritten to use db layer (no Mongoose); bcrypt hashed passwords; upsert-safe |
| `Backend/index.js` | Updated startup log; no Mongoose reference |
| `Backend/src/middleware/authMiddleware.js` | **SECURITY FIX**: removed 3 admin-bypass paths (missing token, demo-token literal, JWT error catch); all now return 401 |
| `Backend/src/services/auth.service.js` | **SECURITY FIX**: removed plaintext password comparison fallback; removed hardcoded demo password bypass (`acceptable` object); bcrypt-only auth |
| `Backend/src/routes/auth.routes.js` | **SECURITY FIX**: added `requireRole('admin')` to `POST /staff` and `PUT /staff/:id`; migrated inline handlers to use `userDb` |
| `Backend/src/controllers/auth.controller.js` | Replaced `User` (Mongoose model) import with `userDb` from db layer |
| `Backend/src/services/patient.service.js` | Fully migrated: all Mongoose ops → patientDb/appointmentDb/userDb/treatmentCategoryDb; mongoose.Types.ObjectId.isValid() → isValidUUID() |
| `Backend/src/services/appointment.service.js` | Fully migrated: populate chains → JOINs; overlap detection → checkOverlap(); soft-delete → db layer |
| `Backend/src/services/payment.service.js` | Fully migrated: aggregate → paymentDb.getRevenueSummary(); invoice creation → invoiceDb.createWithItems() |
| `Backend/src/services/clinical.service.js` | Fully migrated: prescription JSON.stringify dropped; clinical_records.dental_chart → JSONB; prescription saved separately |
| `Backend/src/services/treatment-category.service.js` | Fully migrated: MongoDB $or clinicId filter → simple clinic_id = $1 |
| `Backend/src/services/ai.service.js` | Fully migrated: File/AiReport Mongoose models → fileDb/aiReportDb; ML service call unchanged |
| `Backend/src/routes/index.js` | Dashboard stats → statsDb (5 parallel counts + revenue); reminders → appointmentDb.findRemindersToSend; all Mongoose model imports removed |
| `Backend/.env.example` | Added `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` |

---

## Security Fixes Applied

| Fix | File | Severity |
|-----|------|----------|
| S1: Auth middleware no longer grants admin on JWT error | `authMiddleware.js` | CRITICAL ✅ |
| S1: Missing/empty Bearer token returns 401 | `authMiddleware.js` | CRITICAL ✅ |
| S1: `demo-token` literal no longer grants admin | `authMiddleware.js` | CRITICAL ✅ |
| S2: Plaintext password comparison fallback removed | `auth.service.js` | CRITICAL ✅ |
| S2: Hardcoded demo password bypass (`acceptable` object) removed | `auth.service.js` | CRITICAL ✅ |
| S3: `POST /api/auth/staff` now requires `role: admin` | `auth.routes.js` | HIGH ✅ |
| S3: `PUT /api/auth/staff/:id` now requires `role: admin` | `auth.routes.js` | HIGH ✅ |
| S4: Supabase env vars cause `process.exit(1)` in production | `env.js` | HIGH ✅ |

---

## Syntax Check Results

All 31 files pass `node --check`:
- ✅ 7 service files
- ✅ 14 db layer files  
- ✅ 7 route files
- ✅ Config, middleware, controller files

---

## Remaining Mongoose References

`grep -r "require('mongoose')" Backend/src/services/` → **0 matches**  
`grep -r "require('.*models/')" Backend/src/{services,controllers,routes,config,db}` → **0 matches**

Mongoose remains only inside `Backend/src/models/*.js` — these 15 model files are now dead code (nothing imports them). They will be deleted in Phase 8 cleanup along with `npm uninstall mongoose`.

---

## Known Issues / Notes

1. **Supabase credentials needed**: `Backend/.env` must have `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` set before the server will start. The server gracefully degrades in dev mode (warning only) but exits in production.

2. **SQL migration must be run first**: `Backend/src/config/migration.sql` must be applied to the Supabase project (via Supabase SQL Editor or `psql`) before any API calls will succeed. Tables do not exist yet in Supabase.

3. **`ClinicalRecord.prescription` field dropped**: `clinical_records` table has no `prescription` column. The service now returns `prescription: []` for backward compatibility. A separate `GET /api/clinical/:recordId/prescriptions` endpoint can be added in Phase 6 to expose prescription data properly.

4. **File storage still local disk**: X-ray uploads still go to `Backend/uploads/`. Supabase Storage migration is Phase 5 scope.

5. **`getRevenueSummary` and `getCategoryBreakdown` aggregate in JS**: Supabase JS client lacks native GROUP BY. These aggregate in JavaScript after fetching all non-deleted rows. For large datasets, this should be moved to a PostgreSQL RPC function. Acceptable for current clinic scale.

6. **Sequential IDs (patient_number, appointment_number, etc.)**: Now generated by PostgreSQL sequences via `DEFAULT next_seq_id(...)`. The seed script no longer passes these in insert payloads. Existing seeded patients/appointments will get auto-numbered IDs (DWK-2026-0001 etc.) from the sequence.

---

## Next Steps

- **Phase 4 (Data Migration)**: Determine if existing MongoDB data needs to be preserved and migrated to Supabase.
- **Phase 5 (File Storage)**: Migrate X-ray uploads from local disk to Supabase Storage.
- **Phase 6 (Frontend)**: Verify all frontend API calls work with the new backend; update any broken response shape consumers.
- **Phase 7 (Security & Testing)**: Apply SQL migration to Supabase, run full integration tests against all endpoints.
- **Phase 8 (Cleanup)**: Remove `Backend/src/models/` directory; `npm uninstall mongoose`; remove MONGODB_URI from env files.
