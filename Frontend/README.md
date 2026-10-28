# Dwarka Dental Clinic — Frontend

React 19 + Vite 8 + Redux Toolkit + RTK Query + TailwindCSS 4 + React Router 8.

Connects to the Express backend (default: `http://localhost:5000`). See the root [README](../README.md) for the full system overview.

---

## Quick Start

```bash
npm install
npm run dev      # starts on http://localhost:5173
```

Vite proxies `/api` requests to `http://localhost:5000` (configured in `vite.config.js`).

## Environment

Create `.env` from `.env.example`:

```env
VITE_API_URL=http://localhost:5000
```

## Build

```bash
npm run build    # production build to dist/
npm run preview  # preview the production build
npm run lint     # run Oxlint
```

## Structure

```
src/
├── main.jsx               # App entry (Redux Provider + RouterProvider)
├── app/
│   ├── store.js            # Redux store (authSlice, patientsSlice, appointmentsSlice, thunks)
│   └── router.jsx          # React Router configuration
├── routes/
│   └── AppRoutes.jsx       # All routes with ProtectedRoute role guards
├── services/
│   └── apiSlice.js          # RTK Query base slice
├── features/
│   ├── patients/            # patientsApi.js (RTK Query) + patientsSlice.js (UI state)
│   └── appointments/        # appointmentsApi.js + appointmentsSlice.js
├── constants/
│   ├── routes.js            # Route path constants
│   └── apiEndpoints.js      # API endpoint constants
├── components/
│   ├── clinical/            # Dental chart, prescription form, clinical record cards
│   ├── common/              # Page headers, stat cards, empty states
│   ├── dashboard/            # Charts, summary tables, appointment widgets
│   └── ui/                  # Buttons, modals, inputs, badges, dropdowns
├── pages/
│   ├── auth/LoginPage.jsx
│   ├── admin/               # 11 pages (dashboard, patients, appointments, staff, revenue, reports, etc.)
│   ├── doctor/              # 8 pages (dashboard, appointments, patients, follow-ups, history, etc.)
│   ├── receptionist/        # 8 pages (dashboard, register patient, patients, appointments, billing, etc.)
│   ├── shared/AiXrayPage.jsx
│   ├── NotFoundPage.jsx
│   └── UnauthorizedPage.jsx
└── utils/
    ├── api.js                # Vanilla fetch client with Bearer token
    └── formatters.js         # Date, currency, phone formatters
```

## State Management

**Redux Toolkit** with two parallel API patterns:

1. **RTK Query** (`apiSlice.js` + feature slices) — used for patients and appointments with automatic cache invalidation via tags (`Patient`, `Appointment`)
2. **Vanilla fetch** (`utils/api.js`) — used by most page components directly; sends `Authorization: Bearer <token>` from the persisted auth session

**Auth state** (`authSlice`) — persisted to `localStorage` as `ddc:session` with `{ user, role, token, isAuthenticated }`. On app load, the stored token is used for all API requests.

## Routing & Role Protection

All dashboard routes are wrapped in `ProtectedRoute` which checks `authSlice.role`:

- `/admin/*` — requires `role === 'admin'`
- `/doctor/*` — requires `role === 'doctor'`
- `/receptionist/*` — requires `role` in `['receptionist', 'admin']`

Unauthenticated users are redirected to `/login`. Wrong-role users see `/unauthorized`.

## Dependencies

| Package | Purpose |
|---------|---------|
| `react` `react-dom` | UI library v19 |
| `vite` `@vitejs/plugin-react` | Build tool v8 |
| `@reduxjs/toolkit` `react-redux` | State management + RTK Query |
| `react-router-dom` | Client routing v8 |
| `tailwindcss` `@tailwindcss/vite` | Utility CSS v4 |
| `recharts` | Dashboard charts |
| `lucide-react` | Icon set |
