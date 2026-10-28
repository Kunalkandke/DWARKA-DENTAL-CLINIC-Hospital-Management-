/**
 * RTK Query API root slice with token refresh interceptor.
 *
 * All feature-specific endpoint definitions are injected via apiSlice.injectEndpoints()
 * inside their respective feature files (e.g. patientsApi.js, appointmentsApi.js).
 * This keeps feature code co-located without polluting this central file.
 */
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { Mutex } from 'async-mutex';

const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const SESSION_KEY = 'ddc:session';

// Mutex to prevent multiple simultaneous refresh attempts
const mutex = new Mutex();

const baseQuery = fetchBaseQuery({
  baseUrl: `${API_BASE}/api`,
  prepareHeaders: (headers) => {
    // Attach JWT token from localStorage
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) {
        const session = JSON.parse(raw);
        const token = session?.token || session?.accessToken;
        if (token) {
          headers.set('Authorization', `Bearer ${token}`);
        }
      }
    } catch (_) {}
    return headers;
  },
});

const baseQueryWithReauth = async (args, api, extraOptions) => {
  // Wait if another refresh is in progress
  await mutex.waitForUnlock();
  
  let result = await baseQuery(args, api, extraOptions);
  
  if (result.error && result.error.status === 401) {
    // Check if already refreshing
    if (!mutex.isLocked()) {
      const release = await mutex.acquire();
      
      try {
        const refreshToken = localStorage.getItem('ddc:refresh');
        if (!refreshToken) {
          // No refresh token, redirect to login
          localStorage.removeItem(SESSION_KEY);
          window.location.href = '/login';
          return result;
        }

        // Try to refresh token
        const refreshResult = await baseQuery(
          {
            url: '/auth/refresh',
            method: 'POST',
            body: { refreshToken },
          },
          api,
          extraOptions
        );

        if (refreshResult.data) {
          // Store new tokens
          const { accessToken, refreshToken: newRefreshToken, user } = refreshResult.data;
          const session = { token: accessToken, user: user || {} };
          localStorage.setItem(SESSION_KEY, JSON.stringify(session));
          localStorage.setItem('ddc:refresh', newRefreshToken);
          
          console.log('[RTK Query] Token refreshed successfully');
          
          // Retry original request with new token
          result = await baseQuery(args, api, extraOptions);
        } else {
          // Refresh failed, redirect to login
          console.warn('[RTK Query] Token refresh failed');
          localStorage.removeItem(SESSION_KEY);
          localStorage.removeItem('ddc:refresh');
          window.location.href = '/login';
        }
      } finally {
        release();
      }
    } else {
      // Wait for ongoing refresh to complete
      await mutex.waitForUnlock();
      // Retry original request
      result = await baseQuery(args, api, extraOptions);
    }
  }
  
  return result;
};

export const apiSlice = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithReauth,
  tagTypes: ['Patient', 'Appointment', 'Payment', 'ClinicalRecord', 'AiReport'],
  // Endpoints injected by feature files below
  endpoints: () => ({}),
});
