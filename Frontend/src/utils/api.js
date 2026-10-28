/**
 * Frontend API client — communicates with the backend via Vite proxy.
 * All authenticated requests send the JWT token from localStorage in
 * the Authorization: Bearer header. Role is NEVER sent from the client.
 */

const SESSION_KEY = 'ddc:session';

/** Read JWT token from localStorage session */
function getToken() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    return session?.token || null;
  } catch {
    return null;
  }
}

const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

/** Core HTTP client — attaches JWT, handles JSON/FormData, auto-refreshes on 401 */
async function apiCall(endpoint, options = {}) {
  const url = `${API_BASE}/api${endpoint}`;
  const isFormData = options.body instanceof FormData;

  const headers = { ...options.headers };
  if (!isFormData) headers['Content-Type'] = 'application/json';

  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let response = await fetch(url, { ...options, headers });

  // Auto-refresh token on 401 (token expired)
  if (response.status === 401 && !options._isRetry) {
    console.log('[API] Token expired, attempting refresh...');
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      // Retry original request with new token
      options._isRetry = true; // Prevent infinite loop
      return apiCall(endpoint, options);
    } else {
      // Refresh failed, redirect to login
      console.warn('[API] Token refresh failed, redirecting to login');
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem('ddc:refresh');
      window.location.href = '/login';
      throw new Error('Session expired. Please log in again.');
    }
  }

  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; }
  catch { data = { error: text }; }

  if (!response.ok) {
    throw new Error(data.message || data.error || `HTTP ${response.status}`);
  }

  return data;
}

/** Refresh access token using stored refresh token */
async function refreshAccessToken() {
  try {
    const refreshToken = localStorage.getItem('ddc:refresh');
    if (!refreshToken) {
      console.warn('[API] No refresh token found');
      return false;
    }

    const response = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      console.warn('[API] Refresh request failed:', response.status);
      return false;
    }

    const data = await response.json();
    
    // Store new tokens
    const session = { token: data.accessToken, user: data.user || {} };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    localStorage.setItem('ddc:refresh', data.refreshToken);
    
    console.log('[API] Token refreshed successfully');
    return true;
  } catch (err) {
    console.error('[API] Token refresh error:', err);
    return false;
  }
}

export const api = {
  // ── Auth ────────────────────────────────────────────────────────────────────
  login: (email, password) =>
    apiCall('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  logout: async () => {
    try {
      const refreshToken = localStorage.getItem('ddc:refresh');
      if (refreshToken) {
        await apiCall('/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken }) });
      }
    } catch (err) {
      console.error('[API] Logout error:', err);
    } finally {
      // Always clear local storage
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem('ddc:refresh');
    }
  },
  me: () => apiCall('/auth/me'),

  // ── Dashboard ───────────────────────────────────────────────────────────────
  getDashboardStats: () => apiCall('/stats/dashboard'),
  getDashboardStatsEnhanced: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return apiCall(`/stats/dashboard${q ? '?' + q : ''}`);
  },

  // ── Treatment Categories ────────────────────────────────────────────────────
  getCategories: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return apiCall(`/categories${q ? '?' + q : ''}`);
  },
  createCategory: (data) =>
    apiCall('/categories', { method: 'POST', body: JSON.stringify(data) }),
  updateCategory: (id, data) =>
    apiCall(`/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  toggleCategory: (id, isActive) =>
    apiCall(`/categories/${id}/toggle`, { method: 'PATCH', body: JSON.stringify({ isActive }) }),

  // ── Patients ────────────────────────────────────────────────────────────────
  getPatients: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return apiCall(`/patients${q ? '?' + q : ''}`);
  },
  getPatient: (id) => apiCall(`/patients/${id}`),
  addPatient: (data) =>
    apiCall('/patients', { method: 'POST', body: JSON.stringify(data) }),
  updatePatient: (id, data) =>
    apiCall(`/patients/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deletePatient: (id) =>
    apiCall(`/patients/${id}`, { method: 'DELETE' }),

  // ── Appointments ────────────────────────────────────────────────────────────
  getAppointments: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return apiCall(`/appointments${q ? '?' + q : ''}`);
  },
  getAppointment: (id) => apiCall(`/appointments/${id}`),
  getAppointmentsByPatient: (patientId) =>
    apiCall(`/appointments/patient/${patientId}`),
  bookAppointment: (data) =>
    apiCall('/appointments', { method: 'POST', body: JSON.stringify(data) }),
  updateAppointmentStatus: (id, body) =>
    apiCall(`/appointments/${id}/status`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteAppointment: (id) =>
    apiCall(`/appointments/${id}`, { method: 'DELETE' }),

  // ── Payments ────────────────────────────────────────────────────────────────
  getPayments: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return apiCall(`/payments${q ? '?' + q : ''}`);
  },
  getPaymentsByPatient: (patientId) =>
    apiCall(`/payments/patient/${patientId}`),
  addPayment: (data) =>
    apiCall('/payments', { method: 'POST', body: JSON.stringify(data) }),
  deletePayment: (id) =>
    apiCall(`/payments/${id}`, { method: 'DELETE' }),
  getRevenueSummary: () => apiCall('/payments/summary'),

  // ── Clinical Records ────────────────────────────────────────────────────────
  getClinicalRecords: (patientId) => apiCall(`/clinical/${patientId}`),
  addClinicalRecord: (data) =>
    apiCall('/clinical', { method: 'POST', body: JSON.stringify(data) }),

  // ── AI X-Ray ────────────────────────────────────────────────────────────────
  uploadXray: (patientId, file) => {
    const formData = new FormData();
    formData.append('patientId', patientId);
    formData.append('xray', file);
    return apiCall('/ai/upload', { method: 'POST', body: formData });
  },
  getAiReports: (patientId) => apiCall(`/ai/reports/${patientId}`),
  reviewAiReport: (reportId, body) =>
    apiCall(`/ai/reports/${reportId}/review`, { method: 'PATCH', body: JSON.stringify(body) }),

  // ── Notifications ───────────────────────────────────────────────────────────
  sendWhatsAppReminders: () =>
    apiCall('/notifications/send-reminders', { method: 'POST' }),

  // ── Staff (doctors list for dropdowns & management) ─────────────────────────
  getDoctors: () => apiCall('/auth/doctors'),
  getStaff: () => apiCall('/auth/staff'),
  createStaff: (data) => apiCall('/auth/staff', { method: 'POST', body: JSON.stringify(data) }),
  updateStaff: (id, data) => apiCall(`/auth/staff/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  // ── Chairs ───────────────────────────────────────────────────────────────────
  getChairs: () => apiCall('/availability/chairs'),
  createChair: (data) => apiCall('/availability/chairs', { method: 'POST', body: JSON.stringify(data) }),
  updateChair: (id, data) => apiCall(`/availability/chairs/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteChair: (id) => apiCall(`/availability/chairs/${id}`, { method: 'DELETE' }),

  // ── Doctor Availability ───────────────────────────────────────────────────────
  getDoctorAvailability: (doctorId) => apiCall(`/availability/doctors/${doctorId}/slots`),
  createDoctorAvailability: (doctorId, data) =>
    apiCall(`/availability/doctors/${doctorId}/slots`, { method: 'POST', body: JSON.stringify(data) }),
  updateDoctorAvailability: (doctorId, slotId, data) =>
    apiCall(`/availability/doctors/${doctorId}/slots/${slotId}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteDoctorAvailability: (doctorId, slotId) =>
    apiCall(`/availability/doctors/${doctorId}/slots/${slotId}`, { method: 'DELETE' }),

  // ── Doctor Blocks (leave / unavailability) ───────────────────────────────────
  getDoctorBlocks: (doctorId) => apiCall(`/availability/doctors/${doctorId}/blocks`),
  createDoctorBlock: (doctorId, data) =>
    apiCall(`/availability/doctors/${doctorId}/blocks`, { method: 'POST', body: JSON.stringify(data) }),
  deleteDoctorBlock: (doctorId, blockId) =>
    apiCall(`/availability/doctors/${doctorId}/blocks/${blockId}`, { method: 'DELETE' }),

  // ── Clinic Holidays ──────────────────────────────────────────────────────────
  getHolidays: () => apiCall('/settings/holidays'),
  createHoliday: (data) => apiCall('/settings/holidays', { method: 'POST', body: JSON.stringify(data) }),
  updateHoliday: (id, data) => apiCall(`/settings/holidays/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteHoliday: (id) => apiCall(`/settings/holidays/${id}`, { method: 'DELETE' }),

  // ── Audit Logs ───────────────────────────────────────────────────────────────
  getAuditLogs: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return apiCall(`/audit-logs${q ? '?' + q : ''}`);
  },

  // ── Attendance ──────────────────────────────────────────────────────────────
  getAttendance: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return apiCall(`/attendance${q ? '?' + q : ''}`);
  },
  getAttendanceCalendar: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return apiCall(`/attendance/calendar${q ? '?' + q : ''}`);
  },
  getAttendanceStats: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return apiCall(`/attendance/stats${q ? '?' + q : ''}`);
  },
  markAttendance: (data) =>
    apiCall('/attendance', { method: 'POST', body: JSON.stringify(data) }),
  updateAttendance: (id, data) =>
    apiCall(`/attendance/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteAttendance: (id) =>
    apiCall(`/attendance/${id}`, { method: 'DELETE' }),
  importAttendance: (formData) =>
    apiCall('/attendance/import', { method: 'POST', body: formData }),
  exportAttendance: async (params = {}) => {
    const q = new URLSearchParams(params).toString();
    const url = `${API_BASE}/api/attendance/export${q ? '?' + q : ''}`;
    const token = getToken();
    const response = await fetch(url, {
      headers: { ...(token && { Authorization: `Bearer ${token}` }) },
    });
    if (!response.ok) throw new Error('Export failed');
    return await response.blob();
  },
};
