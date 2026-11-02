import { useState, useEffect, useCallback } from 'react';
import { CalendarX, Plus, Trash2, RefreshCw, AlertTriangle, CheckCircle } from 'lucide-react';
import { api } from '../../utils/api';
import { formatDate } from '../../utils/formatters';

export default function SettingsPage() {
  // ── Holidays State ───────────────────────────────────────────────────────────
  const [holidays, setHolidays] = useState([]);
  const [holidayLoading, setHolidayLoading] = useState(true);
  const [holidayError, setHolidayError] = useState('');
  const [newHoliday, setNewHoliday] = useState({ date: '', reason: '' });
  const [addingHoliday, setAddingHoliday] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [holidaySuccess, setHolidaySuccess] = useState('');

  const fetchHolidays = useCallback(async () => {
    setHolidayLoading(true);
    setHolidayError('');
    try {
      const res = await api.getHolidays();
      const list = res?.data?.holidays || res?.data || [];
      setHolidays(Array.isArray(list) ? list : []);
    } catch (err) {
      setHolidayError(err.message || 'Failed to load holidays');
    } finally {
      setHolidayLoading(false);
    }
  }, []);

  useEffect(() => { fetchHolidays(); }, [fetchHolidays]);

  const handleAddHoliday = async (e) => {
    e.preventDefault();
    if (!newHoliday.date || !newHoliday.reason.trim()) {
      setHolidayError('Date and reason are required.');
      return;
    }
    setAddingHoliday(true);
    setHolidayError('');
    try {
      await api.createHoliday({ date: newHoliday.date, reason: newHoliday.reason.trim() });
      setNewHoliday({ date: '', reason: '' });
      setHolidaySuccess('Holiday added successfully.');
      setTimeout(() => setHolidaySuccess(''), 3000);
      fetchHolidays();
    } catch (err) {
      setHolidayError(err.message || 'Failed to add holiday');
    } finally {
      setAddingHoliday(false);
    }
  };

  const handleDeleteHoliday = async (id) => {
    if (!window.confirm('Remove this clinic holiday? Bookings on this day will no longer be blocked.')) return;
    setDeletingId(id);
    try {
      await api.deleteHoliday(id);
      setHolidays(prev => prev.filter(h => h.id !== id));
      setHolidaySuccess('Holiday removed.');
      setTimeout(() => setHolidaySuccess(''), 3000);
    } catch (err) {
      setHolidayError(err.message || 'Failed to delete holiday');
    } finally {
      setDeletingId(null);
    }
  };

  const today = new Date().toISOString().split('T')[0];
  const upcomingHolidays = holidays.filter(h => h.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const pastHolidays    = holidays.filter(h => h.date <  today).sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold text-[var(--color-text)]">Settings</h1>
        <p className="text-sm text-[var(--color-text-muted)]">Clinic configuration, holidays, and preferences</p>
      </div>

      {/* Clinic Information */}
      <div className="card p-6 space-y-5">
        <h2 className="text-base font-semibold text-[var(--color-text)]">Clinic Information</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { label: 'Clinic Name', value: 'Dwarka Dental Clinic' },
            { label: 'Registration Number', value: 'DEN-DL-2012-0847' },
            { label: 'Phone', value: '+91 11 2345 6789' },
            { label: 'Email', value: 'info@dwarkadental.com' },
            { label: 'Address', value: 'Sector 7, Dwarka, New Delhi 110075' },
            { label: 'Working Hours', value: 'Mon–Sat: 9 AM – 9 PM' },
          ].map(({ label, value }) => (
            <div key={label}>
              <label className="text-xs text-[var(--color-text-muted)] block mb-1">{label}</label>
              <input defaultValue={value} className="form-input" readOnly />
            </div>
          ))}
        </div>
        <button className="text-sm px-4 h-9 rounded-lg bg-[var(--color-primary-500)] text-white opacity-60 cursor-not-allowed" disabled>
          Save Changes (coming soon)
        </button>
      </div>

      {/* ── Clinic Holidays ──────────────────────────────────────────────────── */}
      <div className="card p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarX size={18} className="text-[var(--color-primary-600)]" />
            <div>
              <h2 className="text-base font-semibold text-[var(--color-text)]">Clinic Holidays</h2>
              <p className="text-xs text-[var(--color-text-muted)]">Appointment booking is blocked on these dates</p>
            </div>
          </div>
          <button
            onClick={fetchHolidays}
            className="btn btn-outline btn-xs flex items-center gap-1"
          >
            <RefreshCw size={12} className={holidayLoading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Add Holiday Form */}
        <form onSubmit={handleAddHoliday} className="flex flex-wrap gap-3 items-end p-4 bg-[var(--color-bg-subtle)] rounded-xl border border-[var(--color-border)]">
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">Holiday Date *</label>
            <input
              type="date"
              id="holiday-date"
              value={newHoliday.date}
              onChange={e => setNewHoliday(h => ({ ...h, date: e.target.value }))}
              min={today}
              className="form-input text-sm"
              required
            />
          </div>
          <div className="flex-[2] min-w-[200px]">
            <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">Reason *</label>
            <input
              type="text"
              id="holiday-reason"
              placeholder="e.g. Diwali, National Holiday, Clinic Maintenance"
              value={newHoliday.reason}
              onChange={e => setNewHoliday(h => ({ ...h, reason: e.target.value }))}
              className="form-input text-sm"
              required
            />
          </div>
          <button
            type="submit"
            disabled={addingHoliday || !newHoliday.date || !newHoliday.reason.trim()}
            className="btn btn-primary btn-sm flex items-center gap-1.5 h-[38px]"
          >
            <Plus size={14} /> {addingHoliday ? 'Adding…' : 'Add Holiday'}
          </button>
        </form>

        {/* Alerts */}
        {holidayError && (
          <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 p-3 rounded-lg">
            <AlertTriangle size={14} className="shrink-0" /> {holidayError}
          </div>
        )}
        {holidaySuccess && (
          <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 p-3 rounded-lg">
            <CheckCircle size={14} className="shrink-0" /> {holidaySuccess}
          </div>
        )}

        {/* Upcoming Holidays */}
        {holidayLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-10 bg-[var(--color-border)] rounded-lg animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            {upcomingHolidays.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-2">
                  Upcoming ({upcomingHolidays.length})
                </p>
                <div className="space-y-2">
                  {upcomingHolidays.map(h => (
                    <div
                      key={h.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-[var(--color-border)] bg-white hover:bg-[var(--color-bg-subtle)] transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 flex-shrink-0">
                          <CalendarX size={16} />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-[var(--color-text)]">{h.reason || h.name}</p>
                          <p className="text-xs text-[var(--color-text-muted)]">{formatDate(h.date)}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteHoliday(h.id)}
                        disabled={deletingId === h.id}
                        className="btn btn-ghost btn-xs text-rose-500 hover:text-rose-700 hover:bg-rose-50 p-1.5 opacity-0 group-hover:opacity-100 transition-all"
                        title="Remove holiday"
                      >
                        {deletingId === h.id ? '…' : <Trash2 size={13} />}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {upcomingHolidays.length === 0 && (
              <div className="text-center py-8 text-[var(--color-text-muted)]">
                <CalendarX size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">No upcoming holidays scheduled.</p>
                <p className="text-xs mt-1">Add holidays above to block appointment booking on those dates.</p>
              </div>
            )}

            {pastHolidays.length > 0 && (
              <details className="mt-2">
                <summary className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide cursor-pointer hover:text-[var(--color-text)] select-none">
                  Past Holidays ({pastHolidays.length}) ▸
                </summary>
                <div className="space-y-1.5 mt-2">
                  {pastHolidays.slice(0, 10).map(h => (
                    <div key={h.id} className="flex items-center justify-between p-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-subtle)] opacity-70">
                      <div>
                        <p className="text-xs font-medium text-[var(--color-text)]">{h.reason || h.name}</p>
                        <p className="text-xs text-[var(--color-text-subtle)]">{formatDate(h.date)}</p>
                      </div>
                      <button
                        onClick={() => handleDeleteHoliday(h.id)}
                        disabled={deletingId === h.id}
                        className="text-rose-400 hover:text-rose-600 p-1 transition-colors"
                        title="Remove"
                      >
                        {deletingId === h.id ? '…' : <Trash2 size={12} />}
                      </button>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </>
        )}
      </div>

      {/* Notification Preferences */}
      <div className="card p-6">
        <h2 className="text-base font-semibold text-[var(--color-text)] mb-4">Notification Preferences</h2>
        {['Follow-up reminders', 'New appointment alerts', 'Cancellation alerts', 'Daily summary email'].map(pref => (
          <label key={pref} className="flex items-center justify-between py-3 border-b border-[var(--color-border)] last:border-0 cursor-pointer">
            <span className="text-sm text-[var(--color-text)]">{pref}</span>
            <input type="checkbox" defaultChecked className="rounded" />
          </label>
        ))}
      </div>
    </div>
  );
}
