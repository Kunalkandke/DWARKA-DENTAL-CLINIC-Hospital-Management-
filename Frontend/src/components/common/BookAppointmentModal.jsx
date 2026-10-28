import { useState, useEffect } from 'react';
import { X, Calendar, Clock, User, Stethoscope, AlertTriangle, Loader2 } from 'lucide-react';
import { api } from '../../utils/api';

/**
 * BookAppointmentModal — shared modal for booking an appointment.
 * Can be used from PatientDetailPage, AppointmentsPage, etc.
 *
 * Props:
 *   patientId?   — pre-filled patient UUID (if opening from patient profile)
 *   patientName? — pre-filled patient name (display only)
 *   onClose()    — close handler
 *   onBooked()   — called after successful booking
 */
export default function BookAppointmentModal({ patientId, patientName, onClose, onBooked }) {
  const [doctors, setDoctors] = useState([]);
  const [categories, setCategories] = useState([]);
  const [chairs, setChairs] = useState([]);
  const [patients, setPatients] = useState([]);

  const [form, setForm] = useState({
    patientId: patientId || '',
    patientSearch: patientName || '',
    doctorId: '',
    categoryId: '',
    chairId: '',
    date: new Date().toISOString().split('T')[0],
    time: '10:00',
    notes: '',
    isEmergency: false,
  });

  const [patientPickerOpen, setPatientPickerOpen] = useState(!patientId);
  const [patientSearchInput, setPatientSearchInput] = useState('');
  const [patientSearchLoading, setPatientSearchLoading] = useState(false);
  const [patientResults, setPatientResults] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [loadingData, setLoadingData] = useState(true);

  // Load dropdown data
  useEffect(() => {
    Promise.all([
      api.getDoctors().catch(() => ({ data: [] })),
      api.getCategories({ status: 'active' }).catch(() => ({ data: [] })),
      api.getChairs().catch(() => ({ data: { chairs: [] } })),
    ]).then(([docRes, catRes, chairRes]) => {
      setDoctors(Array.isArray(docRes.data) ? docRes.data : (docRes.data?.doctors || []));
      setCategories(Array.isArray(catRes.data) ? catRes.data : []);
      const chairList = chairRes?.data?.chairs || chairRes?.data || [];
      setChairs(Array.isArray(chairList) ? chairList.filter(c => c.is_active !== false) : []);
    }).finally(() => setLoadingData(false));
  }, []);

  // Patient search (when no pre-filled patient)
  useEffect(() => {
    if (patientId || !patientSearchInput.trim() || patientSearchInput.length < 2) {
      setPatientResults([]);
      return;
    }
    setPatientSearchLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await api.getPatients({ search: patientSearchInput, limit: 10 });
        const list = res?.data?.data ?? (Array.isArray(res?.data) ? res.data : []);
        setPatientResults(list);
      } catch { setPatientResults([]); }
      finally { setPatientSearchLoading(false); }
    }, 350);
    return () => clearTimeout(t);
  }, [patientSearchInput, patientId]);

  // Auto-fill duration from category
  const selectedCategory = categories.find(c => c.id === form.categoryId);

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.patientId) { setError('Please select a patient.'); return; }
    if (!form.doctorId) { setError('Please select a doctor.'); return; }
    if (!form.date) { setError('Please select a date.'); return; }
    if (!form.time) { setError('Please select a time.'); return; }

    setSubmitting(true);
    try {
      const payload = {
        patientId: form.patientId,
        doctorId: form.doctorId,
        date: form.date,
        time: form.time,
        notes: form.notes,
        isEmergency: form.isEmergency,
      };
      if (form.categoryId) payload.treatmentCategoryId = form.categoryId;
      if (form.chairId) payload.chairId = form.chairId;

      await api.bookAppointment(payload);
      onBooked?.();
    } catch (err) {
      setError(err.message || 'Failed to book appointment. Please check the details and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[var(--color-primary-50)] flex items-center justify-center">
              <Calendar size={16} className="text-[var(--color-primary-600)]" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[var(--color-text)]">Book Appointment</h2>
              {patientName && <p className="text-xs text-[var(--color-text-muted)]">for {patientName}</p>}
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--color-bg-subtle)] transition-colors text-[var(--color-text-muted)]">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {loadingData ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-[var(--color-primary-500)]" />
            </div>
          ) : (
            <form id="book-apt-form" onSubmit={handleSubmit} className="space-y-4">

              {/* Patient selector (only if not pre-filled) */}
              {!patientId && (
                <div>
                  <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1.5">
                    Patient *
                  </label>
                  {form.patientId ? (
                    <div className="flex items-center justify-between p-3 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-subtle)]">
                      <div className="flex items-center gap-2">
                        <User size={14} className="text-[var(--color-primary-500)]" />
                        <span className="text-sm font-medium">{form.patientSearch}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => { set('patientId', ''); set('patientSearch', ''); setPatientPickerOpen(true); }}
                        className="text-xs text-[var(--color-primary-500)] hover:underline"
                      >
                        Change
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Search patient by name or phone…"
                        value={patientSearchInput}
                        onChange={e => setPatientSearchInput(e.target.value)}
                        className="form-input text-sm"
                        autoFocus
                      />
                      {(patientSearchLoading || patientResults.length > 0) && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-[var(--color-border)] rounded-lg shadow-lg max-h-48 overflow-y-auto">
                          {patientSearchLoading ? (
                            <div className="p-3 text-sm text-[var(--color-text-muted)] flex items-center gap-2">
                              <Loader2 size={14} className="animate-spin" /> Searching…
                            </div>
                          ) : patientResults.map(p => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => {
                                set('patientId', p.id);
                                set('patientSearch', p.name);
                                setPatientPickerOpen(false);
                                setPatientResults([]);
                                setPatientSearchInput('');
                              }}
                              className="w-full text-left px-3 py-2.5 hover:bg-[var(--color-bg-subtle)] transition-colors"
                            >
                              <p className="text-sm font-medium text-[var(--color-text)]">{p.name}</p>
                              <p className="text-xs text-[var(--color-text-muted)]">{p.phone} · {p.patientId}</p>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Doctor */}
              <div>
                <label htmlFor="apt-doctor" className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1.5">
                  Doctor *
                </label>
                <select
                  id="apt-doctor"
                  value={form.doctorId}
                  onChange={e => set('doctorId', e.target.value)}
                  className="form-select text-sm"
                  required
                >
                  <option value="">Select Doctor</option>
                  {doctors.map(d => (
                    <option key={d.id} value={d.id}>{d.name}{d.specialization ? ` — ${d.specialization}` : ''}</option>
                  ))}
                </select>
              </div>

              {/* Treatment Category */}
              <div>
                <label htmlFor="apt-category" className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1.5">
                  Treatment Category
                </label>
                <select
                  id="apt-category"
                  value={form.categoryId}
                  onChange={e => set('categoryId', e.target.value)}
                  className="form-select text-sm"
                >
                  <option value="">General Consultation</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.defaultDurationMinutes ? `(${c.defaultDurationMinutes} min)` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="apt-date" className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1.5">
                    Date *
                  </label>
                  <input
                    id="apt-date"
                    type="date"
                    value={form.date}
                    onChange={e => set('date', e.target.value)}
                    min={form.isEmergency ? undefined : new Date().toISOString().split('T')[0]}
                    className="form-input text-sm"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="apt-time" className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1.5">
                    Time *
                  </label>
                  <input
                    id="apt-time"
                    type="time"
                    value={form.time}
                    onChange={e => set('time', e.target.value)}
                    className="form-input text-sm"
                    required
                  />
                </div>
              </div>

              {/* Chair (optional) */}
              {chairs.length > 0 && (
                <div>
                  <label htmlFor="apt-chair" className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1.5">
                    Chair / Station (optional)
                  </label>
                  <select
                    id="apt-chair"
                    value={form.chairId}
                    onChange={e => set('chairId', e.target.value)}
                    className="form-select text-sm"
                  >
                    <option value="">No specific chair</option>
                    {chairs.map(c => (
                      <option key={c.id} value={c.id}>{c.name}{c.room ? ` — ${c.room}` : ''}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Notes */}
              <div>
                <label htmlFor="apt-notes" className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1.5">
                  Notes / Chief Complaint
                </label>
                <textarea
                  id="apt-notes"
                  value={form.notes}
                  onChange={e => set('notes', e.target.value)}
                  rows={2}
                  placeholder="Brief description of the visit reason…"
                  className="form-textarea text-sm"
                />
              </div>

              {/* Emergency toggle */}
              <label className="flex items-center gap-3 p-3 rounded-lg border border-[var(--color-border)] cursor-pointer hover:bg-[var(--color-bg-subtle)] transition-colors">
                <input
                  type="checkbox"
                  checked={form.isEmergency}
                  onChange={e => set('isEmergency', e.target.checked)}
                  className="w-4 h-4 rounded cursor-pointer"
                />
                <div>
                  <p className="text-sm font-medium text-[var(--color-text)]">🚨 Emergency Appointment</p>
                  <p className="text-xs text-[var(--color-text-muted)]">Bypasses schedule conflicts. Use only for genuine emergencies.</p>
                </div>
              </label>

              {/* Conflict summary */}
              {selectedCategory && (
                <div className="text-xs text-[var(--color-text-muted)] bg-[var(--color-bg-subtle)] rounded-lg p-3">
                  <strong>Duration:</strong> {selectedCategory.defaultDurationMinutes || 30} minutes
                  {form.date && form.time && (
                    <> · <strong>Ends:</strong> {(() => {
                      const [h, m] = form.time.split(':').map(Number);
                      const end = new Date(0, 0, 0, h, m + (selectedCategory.defaultDurationMinutes || 30));
                      return `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`;
                    })()}</>
                  )}
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                  <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 justify-end p-4 border-t border-[var(--color-border)] bg-[var(--color-bg-subtle)] rounded-b-2xl">
          <button type="button" onClick={onClose} className="btn btn-outline btn-sm">
            Cancel
          </button>
          <button
            type="submit"
            form="book-apt-form"
            disabled={submitting || loadingData}
            className="btn btn-primary btn-sm flex items-center gap-1.5 min-w-[120px] justify-center"
          >
            {submitting ? (
              <><Loader2 size={14} className="animate-spin" /> Booking…</>
            ) : (
              <><Calendar size={14} /> Book Appointment</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
