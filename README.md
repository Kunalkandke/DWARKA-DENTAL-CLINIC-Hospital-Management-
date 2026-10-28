# Dwarka Dental Clinic — Management System

A full-stack dental clinic management system with role-based dashboards for **Admin**, **Doctor**, and **Receptionist** panels. Built with React, Express, and Supabase PostgreSQL.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite 8, Redux Toolkit, RTK Query, React Router 8, TailwindCSS 4, Recharts, Lucide Icons |
| Backend | Node.js, Express 5, JWT auth, bcryptjs, Multer file uploads, Twilio WhatsApp |
| Database | Supabase (PostgreSQL 15) — 18 tables, UUID primary keys, Row Level Security |
| AI Integration | External ML service for dental X-ray cavity detection (Axios HTTP call) |

---

## Features

### Role-Based Access

The system has three role panels, each with protected routes enforced by JWT + role middleware:

#### Admin Panel

| Page | Route | Features |
|------|-------|----------|
| Dashboard | `/admin` | Total patients, today's appointments, missed/upcoming counts, today's & total revenue, appointment breakdown by treatment category |
| Patients | `/admin/patients` | Searchable, paginated patient list with status filters (all / new / follow-up / completed / inactive) |
| Patient Detail | `/admin/patients/:id` | Full patient profile, medical history, assigned doctor, appointment history, clinical records, payment history, AI X-ray reports |
| Appointments | `/admin/appointments` | All appointments with filters: today / upcoming / missed / all, view by doctor, status timeline (scheduled → confirmed → arrived → in-progress → completed) |
| Treatment Categories | `/admin/categories` | CRUD for treatment types (consultation, RCT, extraction, filling, cleaning, implant, crown, etc.) with default duration and follow-up days |
| Doctors | `/admin/doctors` | List of active doctors with specialization and contact info |
| Staff Management | `/admin/staff` | Create and manage staff accounts (admin, doctor, receptionist, assistant, lab technician), set passwords, activate/deactivate |
| Revenue | `/admin/revenue` | Payment records, revenue summary by method (cash / UPI / card / bank transfer), invoice and receipt tracking |
| Reports | `/admin/reports` | Clinical and operational reporting |
| Notifications | `/admin/notifications` | Dispatch WhatsApp appointment reminders to patients for tomorrow's appointments |
| Settings | `/admin/settings` | Clinic configuration |

#### Doctor Panel

| Page | Route | Features |
|------|-------|----------|
| Dashboard | `/doctor` | Doctor's daily view: today's appointments, patient counts, follow-up reminders |
| Appointments | `/doctor/appointments` | Doctor's appointment calendar with status management: confirm, mark arrived, start treatment, complete, reschedule, cancel |
| Patients | `/doctor/patients` | Doctor's patient list |
| Patient Detail | `/doctor/patients/:id` | Patient profile, medical history, clinical record creation with dental chart (tooth-by-tooth findings), diagnosis, treatment notes, prescription, follow-up scheduling |
| Follow-ups | `/doctor/follow-ups` | Patients needing follow-up appointments based on treatment category defaults |
| History | `/doctor/history` | Past consultations and completed treatments |
| Notifications | `/doctor/notifications` | In-app notifications for appointments and follow-ups |
| Profile | `/doctor/profile` | Doctor's profile: name, specialization, qualifications, contact |

#### Receptionist Panel

| Page | Route | Features |
|------|-------|----------|
| Dashboard | `/receptionist` | Today's appointments, quick stats, recent patient registrations |
| Register Patient | `/receptionist/register` | New patient registration form: name, DOB, gender, phone, email, address, emergency contact, chief complaint, medical history, allergies, blood group, assigned doctor, treatment category |
| Patients | `/receptionist/patients` | Patient directory with search and filters |
| Patient Detail | `/receptionist/patients/:id` | Patient profile with appointment and payment history, ability to book new appointments |
| Appointments | `/receptionist/appointments` | Book and manage appointments, conflict detection (no double-booking of doctors), status updates |
| Billing | `/receptionist/payments` | Process payments, create invoices, record receipts (shared with Admin Revenue page) |
| Staff | `/receptionist/staff` | View staff directory (shared with Admin Staff page) |
| Follow-ups | `/receptionist/follow-ups` | Track patients requiring follow-up |
| Notifications | `/receptionist/notifications` | WhatsApp reminder dispatch |
| Profile | `/receptionist/profile` | Receptionist profile settings |

#### Shared

| Page | Route | Features |
|------|-------|----------|
| Login | `/login` | Email/password authentication, role-based redirect to correct panel |
| AI X-ray Analysis | Available in patient detail pages | Upload dental X-ray, ML service analyzes for cavity/normal/uncertain, doctor reviews and confirms/rejects result |
| Unauthorized | `/unauthorized` | Access denied page for wrong role attempts |
| 404 | `*` | Not found page |

---

## Cross-Panel Workflows

### Patient Registration → Consultation → Billing

1. **Receptionist** registers a new patient → patient auto-assigned a sequential number (`DWK-2026-0001`) → initial appointment and advance payment created in the same flow
2. **Doctor** sees the new patient in their appointment list → opens patient profile → conducts consultation → creates clinical record with diagnosis, treatment notes, dental chart (tooth-level findings), and prescription
3. **Doctor** completes the appointment → patient status updates to `follow_up` → follow-up date auto-calculated from treatment category defaults
4. **Receptionist/Billing** processes payment → creates invoice with line items → records payment receipt (`RCPT-2026-0001`) → invoice status updates to `paid` / `partially_paid`
5. **Admin** sees updated revenue totals, patient counts, and appointment statistics on the dashboard

### Appointment Scheduling

1. **Receptionist** books an appointment → system checks for doctor schedule conflicts (no overlapping appointments) → appointment number auto-generated (`APT-2026-0001`)
2. **Doctor** sees the appointment → confirms it → patient arrives → doctor marks `arrived` → starts treatment (`in_progress`) → completes it
3. On completion, patient's `lastVisitAt` and `totalVisits` update automatically; follow-up appointment can be auto-created
4. **Admin** sees appointment counts and status breakdowns on dashboard

### WhatsApp Reminders

1. **Receptionist/Admin** triggers `POST /api/notifications/send-reminders`
2. Backend fetches all appointments for tomorrow with `status` in `scheduled` or `confirmed` and `reminderSent = false`
3. Twilio sends WhatsApp message to each patient with appointment date and time
4. Appointment marked `reminderSent = true` to prevent duplicate sends

### AI X-ray Analysis

1. **Doctor/Receptionist** uploads a dental X-ray image via the patient detail page
2. Backend stores file metadata, forwards image to external ML service (`ML_SERVICE_URL/predict`)
3. ML service returns prediction: `cavity` / `normal` / `uncertain` with confidence score and suggestions
4. Result stored as AI report → doctor reviews and confirms or rejects with notes
5. All AI reports visible in patient detail page under the AI reports section

---

## Database Schema (Supabase PostgreSQL)

18 tables with UUID primary keys, foreign key relationships, CHECK constraints, and Row Level Security:

| Table | Purpose | Key Relationships |
|-------|---------|-------------------|
| `clinics` | Root entity | — |
| `users` | Staff accounts | → clinics |
| `treatment_categories` | Treatment types | → clinics |
| `patients` | Patient registry | → clinics, users (doctor), treatment_categories |
| `appointments` | Scheduling | → clinics, patients, users (doctor), treatment_categories, self (reschedule) |
| `doctor_availability` | Weekly doctor schedules | → clinics, users |
| `clinical_records` | Visit notes + dental chart (JSONB) | → clinics, patients, appointments, users |
| `dental_findings` | Per-tooth findings | → clinics, patients, clinical_records, users |
| `prescriptions` | Prescription headers | → clinics, patients, clinical_records, users |
| `prescription_items` | Medicine line items | → prescriptions |
| `treatment_plans` | Stub for future use | → clinics |
| `invoices` | Billing records (paise) | → clinics, patients, appointments, treatment_plans |
| `invoice_items` | Invoice line items | → invoices, treatment_categories |
| `payments` | Payment receipts (paise) | → clinics, invoices, patients, users |
| `files` | Uploaded file metadata | → clinics, patients, clinical_records, users |
| `ai_reports` | AI X-ray analysis | → clinics, patients, files, users (reviewer) |
| `notifications` | In-app and external notifications | → clinics, users, patients, appointments |
| `audit_logs` | Immutable audit trail | → clinics, users |

**Design highlights:**
- All monetary values stored as INTEGER (paise) — never floating point
- Sequential human-readable IDs via PostgreSQL sequences: `DWK-2026-0001`, `APT-2026-0001`, `INV-2026-0001`, `RCPT-2026-0001`
- `dental_chart` stored as JSONB (read/written atomically)
- `audit_logs.before` / `audit_logs.after` stored as JSONB
- 19 PostgreSQL enum types enforce valid values for status, role, gender, method, etc.
- CHECK constraints replace Mongoose validation hooks (e.g. `end_at > start_at` on appointments)
- RLS enabled on all tables; backend uses service-role key (bypasses RLS, enforces authorization in application layer)

---

## API Reference

All endpoints are prefixed with `/api` and protected by JWT authentication unless noted.

### Authentication
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/login` | Public | Login with email/password → returns JWT + user + role |
| GET | `/api/auth/me` | JWT | Validate token, return current user profile |
| GET | `/api/auth/doctors` | JWT | List active doctors (for dropdowns) |
| GET | `/api/auth/staff` | JWT | List all staff |
| POST | `/api/auth/staff` | Admin | Create new staff member |
| PUT | `/api/auth/staff/:id` | Admin | Update staff member / reset password |

### Patients
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/patients` | JWT | Paginated list with search, status filter, doctor filter |
| GET | `/api/patients/:id` | JWT | Full patient profile with doctor + category JOINs |
| POST | `/api/patients` | JWT | Register patient (auto-creates initial appointment + payment) |
| PUT | `/api/patients/:id` | JWT | Update patient details |
| DELETE | `/api/patients/:id | Admin | Soft-delete patient (cancels all appointments) |

### Appointments
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/appointments` | JWT | List with filters: today / upcoming / missed / all, by doctor |
| POST | `/api/appointments` | JWT | Book appointment (conflict detection on doctor schedule) |
| PUT | `/api/appointments/:id/status` | JWT | Update status (confirm, arrive, in-progress, complete, reschedule) |
| DELETE | `/api/appointments/:id` | Admin | Soft-delete appointment |

### Clinical Records
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/clinical/:patientId` | JWT | List clinical records for a patient (visit date DESC) |
| POST | `/api/clinical` | JWT | Create clinical record (diagnosis, treatment, dental chart, notes) |

### Payments & Billing
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/payments` | JWT | Paginated payment list with patient JOIN |
| GET | `/api/payments/summary` | JWT | Revenue summary grouped by payment method |
| GET | `/api/payments/:patientId` | JWT | Payment history for a patient |
| POST | `/api/payments` | JWT | Record payment (creates invoice + updates invoice status) |
| DELETE | `/api/payments/:id` | Admin | Soft-delete payment |

### Treatment Categories
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/categories` | JWT | List active treatment categories |
| POST | `/api/categories` | Admin, Doctor, Receptionist | Create category |
| PUT | `/api/categories/:id` | Admin | Update / toggle active |

### AI X-ray Analysis
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/ai/upload` | Doctor, Admin, Receptionist | Upload X-ray, call ML service, store result |
| GET | `/api/ai/reports/:patientId` | JWT | List AI reports for a patient (with file JOIN) |
| PATCH | `/api/ai/reports/:id/review` | Doctor, Admin | Doctor review (confirm/reject + notes) |

### Dashboard & Notifications
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/stats/dashboard` | JWT | Dashboard stats: patient count, appointment counts, revenue, category breakdown |
| POST | `/api/notifications/send-reminders` | JWT | Dispatch WhatsApp reminders for tomorrow's appointments |

---

## Project Structure

```
DwarkaDentalClinic-main/
├── Backend/
│   ├── index.js                        # Server entry: connectDB → seed → listen
│   ├── package.json
│   ├── .env.example
│   ├── supabase/
│   │   └── migrations/
│   │       └── 20260101000000_initial_schema.sql   # Full PostgreSQL schema
│   └── src/
│       ├── app.js                      # Express setup: CORS, routes, error handling
│       ├── config/
│       │   ├── env.js                  # Environment loader + validation
│       │   ├── supabase.js             # Supabase client (service-role key)
│       │   ├── db.js                   # Connection health check
│       │   └── seed.js                 # Auto-seed: clinic, staff, categories, patients, appointments
│       ├── db/                          # Data-access layer (replaces Mongoose models)
│       │   ├── index.js                # Re-exports all db modules
│       │   ├── clinic.db.js
│       │   ├── user.db.js
│       │   ├── patient.db.js
│       │   ├── appointment.db.js
│       │   ├── clinical-record.db.js
│       │   ├── prescription.db.js (via clinical-record)
│       │   ├── treatment-category.db.js
│       │   ├── payment.db.js
│       │   ├── invoice.db.js
│       │   ├── file.db.js
│       │   ├── ai-report.db.js
│       │   ├── notification.db.js
│       │   ├── audit-log.db.js
│       │   └── stats.db.js              # Dashboard aggregation queries
│       ├── controllers/                # Thin HTTP layer
│       ├── services/                   # Business logic + validation
│       ├── routes/                     # Express routers with auth + role guards
│       ├── middleware/
│       │   ├── authMiddleware.js        # JWT verification + requireRole()
│       │   ├── errorHandler.js
│       │   ├── asyncHandler.js
│       │   ├── validateRequest.js
│       │   └── notFound.js
│       ├── models/                      # Legacy Mongoose models (dead code)
│       └── utils/
│           ├── ApiError.js
│           ├── ApiResponse.js
│           ├── generateToken.js         # JWT sign/verify
│           ├── scheduler.js             # Follow-up date calculation
│           ├── whatsapp.js              # Twilio WhatsApp integration
│           └── isValidUUID.js            # UUID validation helper
│
├── Frontend/
│   ├── package.json
│   ├── vite.config.js
│   ├── .env.example
│   └── src/
│       ├── main.jsx                     # App bootstrap (Redux + Router)
│       ├── app/
│       │   ├── store.js                 # Redux store: authSlice, patientsSlice, appointmentsSlice
│       │   └── router.jsx               # React Router configuration
│       ├── services/
│       │   └── apiSlice.js              # RTK Query base slice
│       ├── features/
│       │   ├── patients/
│       │   │   ├── patientsApi.js       # RTK Query: getPatients, addPatient, updatePatient, deletePatient
│       │   │   └── patientsSlice.js     # UI state: search, filter, selected patient
│       │   └── appointments/
│       │       ├── appointmentsApi.js    # RTK Query: getAppointments, bookAppointment, updateStatus, delete
│       │       └── appointmentsSlice.js  # UI state: date/doctor/status filters
│       ├── routes/
│       │   └── AppRoutes.jsx            # All route definitions with ProtectedRoute guards
│       ├── constants/
│       │   ├── routes.js                # Route path constants
│       │   └── apiEndpoints.js          # API path constants
│       ├── components/
│       │   ├── clinical/                # Dental chart, prescription form, clinical record components
│       │   ├── common/                  # Shared UI elements
│       │   ├── dashboard/               # Stat cards, charts, tables
│       │   └── ui/                       # Buttons, modals, inputs, badges
│       ├── pages/
│       │   ├── auth/LoginPage.jsx
│       │   ├── admin/                    # 11 admin pages
│       │   ├── doctor/                   # 8 doctor pages
│       │   ├── receptionist/             # 8 receptionist pages
│       │   ├── shared/AiXrayPage.jsx
│       │   ├── NotFoundPage.jsx
│       │   └── UnauthorizedPage.jsx
│       └── utils/
│           ├── api.js                    # Vanilla fetch client (Bearer token)
│           └── formatters.js             # Date, currency, phone formatters
│
└── README.md
```

---

## Getting Started

### Prerequisites

- Node.js v18+
- A Supabase project (free tier works) at [supabase.com](https://supabase.com)

### 1. Database Setup

1. Create a Supabase project
2. Open the **SQL Editor** in your Supabase dashboard
3. Copy the entire contents of `Backend/supabase/migrations/20260101000000_initial_schema.sql`
4. Paste and run it — this creates all 18 tables, enum types, sequences, indexes, triggers, and RLS policies

### 2. Backend Setup

```bash
cd Backend

# Install dependencies
npm install

# Create .env file
cp .env.example .env
```

Edit `Backend/.env` and fill in your Supabase credentials:

```env
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
JWT_SECRET=change-this-to-a-long-random-string
```

Get `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from your Supabase dashboard → **Settings → API**.

```bash
# Start the backend
npm run dev
```

The server starts on `http://localhost:5000`. On first boot, it automatically seeds:
- 1 clinic (Dwarka Dental Clinic)
- 6 staff users (1 admin, 4 doctors, 1 receptionist) with bcrypt-hashed passwords
- 10 treatment categories
- 15 sample patients
- 19 sample appointments (today, upcoming, missed, and past completed)

### 3. Frontend Setup

```bash
cd Frontend

# Install dependencies
npm install

# Start the dev server
npm run dev
```

Open `http://localhost:5173`. Vite proxies `/api` requests to the backend at `http://localhost:5000`.

---

## Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@dwarkadental.com` | `admin123` |
| Doctor | `doctor@dwarkadental.com` | `doctor123` |
| Doctor | `rohan@dwarkadental.com` | `doctor123` |
| Doctor | `kavita@dwarkadental.com` | `doctor123` |
| Doctor | `arjun@dwarkadental.com` | `doctor123` |
| Receptionist | `receptionist@dwarkadental.com` | `receptionist123` |

All passwords are bcrypt-hashed in the database. Authentication uses JWT with an 8-hour expiry.

---

## Authentication & Security

- **JWT-based auth**: Tokens issued at `/api/auth/login`, stored in `localStorage` as `ddc:session`, sent as `Authorization: Bearer <token>`
- **Role enforcement**: Backend `authMiddleware` verifies JWT and extracts role; `requireRole()` guards privileged routes
- **Password hashing**: All passwords hashed with bcrypt (12 rounds in seed, 10 rounds for new staff)
- **Staff management**: Only admin role can create/update staff accounts
- **Environment validation**: Backend exits in production if `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, or `JWT_SECRET` are missing
- **RLS**: Row Level Security enabled on all database tables; backend uses service-role key (server-side only, never exposed to frontend)

---

## Integrations

### WhatsApp Notifications (Twilio)

Automated appointment reminders via Twilio WhatsApp Business API. Configure with `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_PHONE_NUMBER` in `.env`. If credentials are absent, the system runs in log-only mode (prints messages to console instead of sending).

### AI X-ray Analysis (External ML Service)

Dental X-ray images are forwarded to an external ML service (`ML_SERVICE_URL/predict`) for cavity detection. The service returns a classification (`cavity` / `normal` / `uncertain`), confidence score (0–1), and suggestions. Doctors review and confirm or reject AI findings. The ML service runs separately (Python/FastAPI) and is not included in this repository.

---

## Tech Stack Details

### Backend Dependencies

| Package | Purpose |
|---------|---------|
| `@supabase/supabase-js` | Supabase PostgreSQL client (server-side, service-role) |
| `express` | Web framework |
| `bcryptjs` | Password hashing |
| `jsonwebtoken` | JWT token generation and verification |
| `cors` | Cross-origin resource sharing |
| `dotenv` | Environment variable loading |
| `multer` | Multipart file upload handling (X-ray images) |
| `twilio` | WhatsApp message dispatch |
| `axios` | HTTP client for ML service calls |
| `form-data` | Multipart form data construction for ML service |
| `nodemon` | Dev dependency — auto-restart on file changes |

### Frontend Dependencies

| Package | Purpose |
|---------|---------|
| `react` / `react-dom` | UI library (v19) |
| `vite` | Build tool and dev server (v8) |
| `@reduxjs/toolkit` | State management + RTK Query |
| `react-redux` | React bindings for Redux |
| `react-router-dom` | Client-side routing (v8) |
| `tailwindcss` | Utility-first CSS framework (v4) |
| `recharts` | Composable charting library for dashboards |
| `lucide-react` | Icon library |

---

## License

ISC
