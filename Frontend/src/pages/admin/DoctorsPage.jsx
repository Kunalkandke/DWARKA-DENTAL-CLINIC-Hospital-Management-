import { useState, useEffect, useCallback } from 'react';
import { Stethoscope, RefreshCw, Search, Edit3, Plus, CalendarDays, Clock, Ban, ChevronDown, ChevronRight, Trash2, AlertTriangle } from 'lucide-react';
import Avatar from '../../components/ui/Avatar';
import EmptyState from '../../components/ui/EmptyState';
import Modal from '../../components/ui/Modal';
import { api } from '../../utils/api';

const DEFAULT_DOCTORS = [
  { id: 'doc-1', name: 'Dr. Bhagwan Rakh', specialization: 'Senior Dental Surgeon & Orthodontist', email: 'dr.bhagwan@dwarkadental.com', phone: '+91 98765 11111', status: 'active' },
  { id: 'doc-2', name: 'Dr. H M Sanap', specialization: 'Endodontist & Root Canal Specialist', email: 'dr.sanap@dwarkadental.com', phone: '+91 98765 22222', status: 'active' },
];

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

// ─── Doctor Availability Panel ─────────────────────────────────────────────────
function DoctorAvailabilityPanel({ doctor, onClose }) {
  const docId = doctor.id || doctor._id;
  const [slots, setSlots]   = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]    = useState('');
  const [activeTab, setActiveTab] = useState('slots'); // 'slots' | 'blocks'

  // Add slot form
  const [addingSlot, setAddingSlot] = useState(false);
  const [slotForm, setSlotForm] = useState({ day_of_week: 0, start_time: '09:00', end_time: '17:00', effective_from: new Date().toISOString().split('T')[0] });
  const [savingSlot, setSavingSlot] = useState(false);
  const [deletingSlotId, setDeletingSlotId] = useState(null);

  // Add block form
  const [addingBlock, setAddingBlock] = useState(false);
  const [blockForm, setBlockForm] = useState({ start_at: '', end_at: '', reason: '' });
  const [savingBlock, setSavingBlock] = useState(false);
  const [deletingBlockId, setDeletingBlockId] = useState(null);

  const load = useCallback(async () => {
    if (!docId || String(docId).startsWith('doc-')) {
      setError('Availability management is only available for doctors registered in the system (with a database ID).');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const [slotsRes, blocksRes] = await Promise.all([
        api.getDoctorAvailability(docId).catch(() => ({ data: { availability: [] } })),
        api.getDoctorBlocks(docId).catch(() => ({ data: { blocks: [] } })),
      ]);
      setSlots(slotsRes?.data?.availability || []);
      setBlocks(blocksRes?.data?.blocks || []);
    } catch (err) {
      setError(err.message || 'Failed to load availability');
    } finally {
      setLoading(false);
    }
  }, [docId]);

  useEffect(() => { load(); }, [load]);

  const handleAddSlot = async (e) => {
    e.preventDefault();
    setSavingSlot(true);
    try {
      await api.createDoctorAvailability(docId, {
        ...slotForm,
        day_of_week: Number(slotForm.day_of_week),
        is_active: true,
      });
      setAddingSlot(false);
      setSlotForm({ day_of_week: 0, start_time: '09:00', end_time: '17:00', effective_from: new Date().toISOString().split('T')[0] });
      load();
    } catch (err) {
      setError(err.message || 'Failed to add slot');
    } finally {
      setSavingSlot(false);
    }
  };

  const handleDeleteSlot = async (slotId) => {
    if (!window.confirm('Remove this availability slot?')) return;
    setDeletingSlotId(slotId);
    try {
      await api.deleteDoctorAvailability(docId, slotId);
      setSlots(prev => prev.filter(s => s.id !== slotId));
    } catch (err) {
      setError(err.message || 'Failed to remove slot');
    } finally {
      setDeletingSlotId(null);
    }
  };

  const handleAddBlock = async (e) => {
    e.preventDefault();
    if (!blockForm.start_at || !blockForm.end_at) { setError('Start and end dates are required.'); return; }
    if (blockForm.end_at <= blockForm.start_at) { setError('End date must be after start date.'); return; }
    setSavingBlock(true);
    setError('');
    try {
      await api.createDoctorBlock(docId, {
        start_at: new Date(blockForm.start_at).toISOString(),
        end_at: new Date(blockForm.end_at).toISOString(),
        reason: blockForm.reason || 'Leave',
      });
      setAddingBlock(false);
      setBlockForm({ start_at: '', end_at: '', reason: '' });
      load();
    } catch (err) {
      setError(err.message || 'Failed to add block');
    } finally {
      setSavingBlock(false);
    }
  };

  const handleDeleteBlock = async (blockId) => {
    if (!window.confirm('Remove this leave/block?')) return;
    setDeletingBlockId(blockId);
    try {
      await api.deleteDoctorBlock(docId, blockId);
      setBlocks(prev => prev.filter(b => b.id !== blockId));
    } catch (err) {
      setError(err.message || 'Failed to remove block');
    } finally {
      setDeletingBlockId(null);
    }
  };

  const today = new Date().toISOString().split('T')[0];

  return (
    <Modal open={true} onClose={onClose} title={`Availability — ${doctor.name}`} size="lg">
      <div className="space-y-4">
        {/* Tabs */}
        <div className="flex gap-1 bg-[var(--color-bg-subtle)] p-1 rounded-lg w-fit">
          {[
            { key: 'slots',  label: '📅 Working Hours', count: slots.length },
            { key: 'blocks', label: '🚫 Leave / Blocks', count: blocks.length },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`px-4 py-1.5 text-sm font-medium rounded transition-colors ${activeTab === t.key ? 'bg-white shadow text-[var(--color-primary-600)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'}`}
            >
              {t.label}
              {t.count > 0 && <span className="ml-1.5 text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-[var(--color-primary-100)] text-[var(--color-primary-700)]">{t.count}</span>}
            </button>
          ))}
        </div>

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" /> {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => <div key={i} className="h-10 bg-[var(--color-border)] rounded-lg animate-pulse" />)}
          </div>
        ) : (
          <>
            {/* ── Slots Tab ── */}
            {activeTab === 'slots' && (
              <div className="space-y-3">
                {slots.length === 0 ? (
                  <div className="text-center py-6 text-[var(--color-text-muted)] text-sm">
                    <Clock size={28} className="mx-auto mb-2 opacity-30" />
                    <p>No working hours defined. Add a slot to enable booking.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {slots.map(s => (
                      <div key={s.id} className="flex items-center justify-between p-3 rounded-lg border border-[var(--color-border)] bg-white group hover:bg-[var(--color-bg-subtle)] transition-colors">
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${s.is_active !== false ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                          <div>
                            <p className="text-sm font-semibold text-[var(--color-text)] capitalize">{DAYS[s.day_of_week] || `Day ${s.day_of_week}`}</p>
                            <p className="text-xs text-[var(--color-text-muted)]">{s.start_time} – {s.end_time} · From {s.effective_from?.split('T')[0] || '—'}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteSlot(s.id)}
                          disabled={deletingSlotId === s.id}
                          className="btn btn-ghost btn-xs text-rose-500 hover:text-rose-700 hover:bg-rose-50 p-1.5 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          {deletingSlotId === s.id ? '…' : <Trash2 size={12} />}
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add Slot Form */}
                {addingSlot ? (
                  <form onSubmit={handleAddSlot} className="p-4 bg-[var(--color-bg-subtle)] rounded-xl border border-[var(--color-border)] space-y-3">
                    <p className="text-sm font-semibold text-[var(--color-text)]">Add Working Hours Slot</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">Day of Week *</label>
                        <select
                          value={slotForm.day_of_week}
                          onChange={e => setSlotForm(f => ({ ...f, day_of_week: e.target.value }))}
                          className="form-select text-sm"
                          required
                        >
                          {DAYS.map((d, i) => <option key={d} value={i}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">Effective From *</label>
                        <input type="date" value={slotForm.effective_from} onChange={e => setSlotForm(f => ({ ...f, effective_from: e.target.value }))} className="form-input text-sm" required />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">Start Time *</label>
                        <input type="time" value={slotForm.start_time} onChange={e => setSlotForm(f => ({ ...f, start_time: e.target.value }))} className="form-input text-sm" required />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">End Time *</label>
                        <input type="time" value={slotForm.end_time} onChange={e => setSlotForm(f => ({ ...f, end_time: e.target.value }))} className="form-input text-sm" required />
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button type="button" onClick={() => setAddingSlot(false)} className="btn btn-outline btn-sm">Cancel</button>
                      <button type="submit" disabled={savingSlot} className="btn btn-primary btn-sm">{savingSlot ? 'Saving…' : 'Add Slot'}</button>
                    </div>
                  </form>
                ) : (
                  <button onClick={() => setAddingSlot(true)} className="w-full py-2.5 border border-dashed border-[var(--color-border)] rounded-lg text-sm text-[var(--color-primary-600)] hover:bg-[var(--color-primary-50)] transition-colors flex items-center justify-center gap-1.5 font-medium">
                    <Plus size={14} /> Add Working Hours Slot
                  </button>
                )}
              </div>
            )}

            {/* ── Blocks Tab ── */}
            {activeTab === 'blocks' && (
              <div className="space-y-3">
                {blocks.length === 0 ? (
                  <div className="text-center py-6 text-[var(--color-text-muted)] text-sm">
                    <Ban size={28} className="mx-auto mb-2 opacity-30" />
                    <p>No leave or blocks recorded for this doctor.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {blocks.slice().sort((a, b) => a.start_at.localeCompare(b.start_at)).map(b => {
                      const isPast = b.end_at < new Date().toISOString();
                      return (
                        <div key={b.id} className={`flex items-center justify-between p-3 rounded-lg border ${isPast ? 'border-[var(--color-border)] bg-[var(--color-bg-subtle)] opacity-60' : 'border-rose-200 bg-rose-50'} group transition-colors`}>
                          <div className="flex items-center gap-3">
                            <Ban size={14} className={isPast ? 'text-[var(--color-text-muted)]' : 'text-rose-600'} />
                            <div>
                              <p className="text-sm font-semibold text-[var(--color-text)]">{b.reason || 'Leave'}</p>
                              <p className="text-xs text-[var(--color-text-muted)]">
                                {new Date(b.start_at).toLocaleDateString('en-IN')} → {new Date(b.end_at).toLocaleDateString('en-IN')}
                                {isPast && ' · Past'}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => handleDeleteBlock(b.id)}
                            disabled={deletingBlockId === b.id}
                            className="btn btn-ghost btn-xs text-rose-500 hover:text-rose-700 hover:bg-rose-50 p-1.5 opacity-0 group-hover:opacity-100 transition-all"
                          >
                            {deletingBlockId === b.id ? '…' : <Trash2 size={12} />}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Add Block Form */}
                {addingBlock ? (
                  <form onSubmit={handleAddBlock} className="p-4 bg-[var(--color-bg-subtle)] rounded-xl border border-[var(--color-border)] space-y-3">
                    <p className="text-sm font-semibold text-[var(--color-text)]">Add Leave / Unavailability Block</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">From Date & Time *</label>
                        <input type="datetime-local" value={blockForm.start_at} onChange={e => setBlockForm(f => ({ ...f, start_at: e.target.value }))} className="form-input text-sm" required />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">Until Date & Time *</label>
                        <input type="datetime-local" value={blockForm.end_at} onChange={e => setBlockForm(f => ({ ...f, end_at: e.target.value }))} className="form-input text-sm" required />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">Reason</label>
                      <input type="text" placeholder="e.g. Annual Leave, Conference, Sick Leave" value={blockForm.reason} onChange={e => setBlockForm(f => ({ ...f, reason: e.target.value }))} className="form-input text-sm" />
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button type="button" onClick={() => setAddingBlock(false)} className="btn btn-outline btn-sm">Cancel</button>
                      <button type="submit" disabled={savingBlock} className="btn btn-primary btn-sm">{savingBlock ? 'Saving…' : 'Add Block'}</button>
                    </div>
                  </form>
                ) : (
                  <button onClick={() => setAddingBlock(true)} className="w-full py-2.5 border border-dashed border-rose-200 rounded-lg text-sm text-rose-600 hover:bg-rose-50 transition-colors flex items-center justify-center gap-1.5 font-medium">
                    <Plus size={14} /> Add Leave / Unavailability Block
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

// ─── Main DoctorsPage ──────────────────────────────────────────────────────────
export default function DoctorsPage() {
  const [doctors, setDoctors] = useState(DEFAULT_DOCTORS);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Edit & Add State
  const [editDoc, setEditDoc] = useState(null);
  const [isAdding, setIsAdding] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', specialization: 'General Dentistry' });
  const [saving, setSaving] = useState(false);

  // Availability Management
  const [availabilityDoc, setAvailabilityDoc] = useState(null);

  const loadDoctors = useCallback(async () => {
    setLoading(true);
    let localDocs = [];
    try {
      const raw = localStorage.getItem('ddc_doctors_v1');
      if (raw) localDocs = JSON.parse(raw);
    } catch (_) {}

    try {
      const res = await api.getDoctors();
      const apiDocs = Array.isArray(res.data) && res.data.length > 0 ? res.data : [];
      const mergedMap = new Map();
      DEFAULT_DOCTORS.forEach(d => mergedMap.set(d.name.toLowerCase(), d));
      localDocs.forEach(d => mergedMap.set(d.name.toLowerCase(), d));
      apiDocs.forEach(d => mergedMap.set(d.name.toLowerCase(), d));

      const mergedList = Array.from(mergedMap.values());
      setDoctors(mergedList);
      localStorage.setItem('ddc_doctors_v1', JSON.stringify(mergedList));
    } catch (err) {
      console.error(err);
      const mergedMap = new Map();
      DEFAULT_DOCTORS.forEach(d => mergedMap.set(d.name.toLowerCase(), d));
      localDocs.forEach(d => mergedMap.set(d.name.toLowerCase(), d));
      setDoctors(Array.from(mergedMap.values()));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadDoctors(); }, [loadDoctors]);

  function handleEditClick(doc) {
    setEditDoc(doc);
    setForm({
      name: doc.name || '',
      email: doc.email || '',
      phone: doc.phone || '',
      specialization: doc.specialization || 'General Dentistry',
      password: '',
    });
  }

  function handleAddClick() {
    setIsAdding(true);
    setForm({ name: '', email: '', phone: '', specialization: 'General Dentistry', password: 'Password@123' });
  }

  async function handleSaveSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (isAdding) {
        const res = await api.createStaff({ ...form, role: 'doctor' }).catch(() => null);
        const newObj = res?.data || { id: `doc-${Date.now()}`, ...form, role: 'doctor', status: 'active' };
        setDoctors(prev => {
          const updated = [newObj, ...prev];
          try { localStorage.setItem('ddc_doctors_v1', JSON.stringify(updated)); } catch (_) {}
          return updated;
        });
        setIsAdding(false);
      } else if (editDoc) {
        const targetId = editDoc.id || editDoc._id;
        await api.updateStaff(targetId, form).catch(() => null);
        setDoctors(prev => {
          const updated = prev.map(d => (d.id === targetId || d._id === targetId || d.name === editDoc.name) ? { ...d, ...form } : d);
          try { localStorage.setItem('ddc_doctors_v1', JSON.stringify(updated)); } catch (_) {}
          return updated;
        });
        setEditDoc(null);
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  const filtered = search
    ? doctors.filter(d =>
        d.name.toLowerCase().includes(search.toLowerCase()) ||
        (d.specialization || '').toLowerCase().includes(search.toLowerCase())
      )
    : doctors;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-text)]">Doctors Directory</h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            {loading ? 'Loading…' : `${doctors.length} active doctor(s)`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadDoctors} className="btn btn-outline btn-sm flex items-center gap-1">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={handleAddClick} className="btn btn-primary btn-sm flex items-center gap-1.5 font-semibold">
            <Plus size={16} /> Add Doctor
          </button>
        </div>
      </div>

      <div className="card p-4 flex items-center gap-2 bg-white border border-[var(--color-border)] rounded-xl shadow-xs">
        <Search size={16} className="text-[var(--color-text-muted)]" />
        <input
          type="search"
          placeholder="Search by doctor name or specialization…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="form-input flex-1 bg-transparent border-none outline-none text-sm"
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card p-5 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-[var(--color-border)] animate-pulse" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-[var(--color-border)] rounded animate-pulse" />
                  <div className="h-3 bg-[var(--color-border)] rounded animate-pulse w-2/3" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.length === 0 ? (
            <div className="col-span-3">
              <EmptyState icon={Stethoscope} title="No doctors found" description="No active doctors in the database." />
            </div>
          ) : (
            filtered.map(doc => {
              const docId = doc.id || doc._id;
              return (
                <div key={docId} className="card p-5 hover:shadow-md transition-shadow bg-white border border-[var(--color-border)] rounded-xl space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar name={doc.name} size="lg" />
                      <div>
                        <p className="font-bold text-base text-[var(--color-text)]">{doc.name}</p>
                        <p className="text-xs font-semibold text-[var(--color-primary-600)]">{doc.specialization || 'General Dentistry'}</p>
                      </div>
                    </div>
                    <span className="badge badge-green text-xs">Active</span>
                  </div>

                  <div className="space-y-1.5 text-xs text-[var(--color-text-muted)] border-t border-[var(--color-border)] pt-3">
                    {doc.phone && <p>📞 {doc.phone}</p>}
                    {doc.email && <p>✉️ {doc.email}</p>}
                  </div>

                  <div className="pt-1 flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => handleEditClick(doc)}
                      className="btn btn-outline btn-xs flex items-center gap-1 text-[var(--color-primary-600)] cursor-pointer"
                    >
                      <Edit3 size={12} /> Edit Info
                    </button>
                    <button
                      onClick={() => setAvailabilityDoc(doc)}
                      className="btn btn-outline btn-xs flex items-center gap-1 text-emerald-600 border-emerald-200 hover:bg-emerald-50 cursor-pointer"
                      id={`manage-availability-${docId}`}
                    >
                      <CalendarDays size={12} /> Availability
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Edit / Add Doctor Modal */}
      {(editDoc || isAdding) && (
        <Modal open={true} onClose={() => { setEditDoc(null); setIsAdding(false); }} title={isAdding ? "Add New Doctor" : `Edit Doctor Info — ${editDoc?.name}`} size="md">
          <form onSubmit={handleSaveSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">Doctor Full Name *</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                className="form-input text-sm"
                placeholder="e.g. Dr. Bhagwan Rakh"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">Specialization *</label>
                <input
                  type="text"
                  required
                  value={form.specialization}
                  onChange={e => setForm({ ...form, specialization: e.target.value })}
                  className="form-input text-sm"
                  placeholder="e.g. Orthodontist, Endodontist"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  className="form-input text-sm"
                  placeholder="doctor@dwarkadental.com"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={e => setForm({ ...form, phone: e.target.value })}
                  className="form-input text-sm"
                  placeholder="+91 98765 00000"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">
                  {isAdding ? "Set Account Password *" : "Reset Password (Optional)"}
                </label>
                <input
                  type="text"
                  required={isAdding}
                  value={form.password || ''}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  className="form-input text-sm font-mono text-violet-700 font-bold"
                  placeholder={isAdding ? "Type Login Password (e.g. DocPass123)" : "Leave blank to keep unchanged"}
                />
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button type="button" onClick={() => { setEditDoc(null); setIsAdding(false); }} className="btn btn-outline btn-sm">Cancel</button>
              <button type="submit" disabled={saving} className="btn btn-primary btn-sm font-semibold">
                {saving ? 'Saving...' : 'Save Doctor Info'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Doctor Availability Modal */}
      {availabilityDoc && (
        <DoctorAvailabilityPanel
          doctor={availabilityDoc}
          onClose={() => setAvailabilityDoc(null)}
        />
      )}
    </div>
  );
}
