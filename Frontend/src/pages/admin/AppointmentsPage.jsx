import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Calendar, Search, RefreshCw, AlertTriangle, Clock, X, ChevronDown,
  ChevronRight, Tag, Users, Plus, ChevronLeft, Stethoscope, LayoutGrid, List,
} from 'lucide-react';
import { StatusBadge } from '../../components/ui/Badge';
import { formatDate } from '../../utils/formatters';
import EmptyState from '../../components/ui/EmptyState';
import { api } from '../../utils/api';
import { useAuth } from '../../hooks/useAuth';
import { useDispatch } from 'react-redux';
import { addToast } from '../../app/store';
import BookAppointmentModal from '../../components/common/BookAppointmentModal';

// ─── Status Configuration ──────────────────────────────────────────────────────
const STATUS_ACTIONS = {
  scheduled: ['arrived', 'cancelled', 'missed'],
  confirmed: ['arrived', 'cancelled'],
  arrived: ['in_progress', 'completed', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  missed: ['rescheduled'],
  cancelled: [],
  rescheduled: [],
};

const STATUS_COLORS = {
  scheduled:   'bg-blue-50 text-blue-700 border-blue-200',
  confirmed:   'bg-indigo-50 text-indigo-700 border-indigo-200',
  arrived:     'bg-amber-50 text-amber-700 border-amber-200',
  in_progress: 'bg-orange-50 text-orange-700 border-orange-200',
  completed:   'bg-emerald-50 text-emerald-700 border-emerald-200',
  missed:      'bg-rose-50 text-rose-700 border-rose-200',
  cancelled:   'bg-slate-100 text-slate-500 border-slate-200',
  rescheduled: 'bg-violet-50 text-violet-700 border-violet-200',
};

const STAT_CONFIGS = [
  { key: 'today',      label: "Today's Total",  color: 'text-[var(--color-primary-600)]', bg: 'bg-[var(--color-primary-50)]', border: 'border-[var(--color-primary-200)]' },
  { key: 'confirmed',  label: 'Confirmed',       color: 'text-indigo-700',                 bg: 'bg-indigo-50',                 border: 'border-indigo-200' },
  { key: 'arrived',    label: 'Checked In',      color: 'text-amber-700',                  bg: 'bg-amber-50',                  border: 'border-amber-200' },
  { key: 'missed',     label: 'Missed / No-show',color: 'text-rose-700',                   bg: 'bg-rose-50',                   border: 'border-rose-200' },
];

// ─── Reschedule Modal ──────────────────────────────────────────────────────────
function RescheduleModal({ apt, onClose, onConfirm }) {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('09:00');
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="card p-6 w-full max-w-sm space-y-4 bg-white rounded-2xl shadow-2xl">
        <h3 className="font-semibold text-[var(--color-text)]">Reschedule Appointment</h3>
        <p className="text-sm text-[var(--color-text-muted)]">{apt.patientName} — {apt.doctorName}</p>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-[var(--color-text-muted)]">New Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="input mt-1 w-full" />
          </div>
          <div>
            <label className="text-xs font-medium text-[var(--color-text-muted)]">New Time</label>
            <input type="time" value={time} onChange={e => setTime(e.target.value)} className="input mt-1 w-full" />
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="btn btn-outline btn-sm">Cancel</button>
          <button onClick={() => date && time && onConfirm(apt.id, date, time)} disabled={!date} className="btn btn-primary btn-sm">Reschedule</button>
        </div>
      </div>
    </div>
  );
}

// ─── Calendar View Component ───────────────────────────────────────────────────
function CalendarView({ appointments, onStatusChange, role, onNewAppointment }) {
  const [calMode, setCalMode] = useState('week'); // 'day' | 'week' | 'month'
  const [currentDate, setCurrentDate] = useState(new Date());

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Helper: get start of week (Monday)
  const getWeekStart = (d) => {
    const dt = new Date(d);
    const day = dt.getDay();
    const diff = (day === 0 ? -6 : 1) - day;
    dt.setDate(dt.getDate() + diff);
    dt.setHours(0, 0, 0, 0);
    return dt;
  };

  const getMonthStart = (d) => new Date(d.getFullYear(), d.getMonth(), 1);

  const navigate = (dir) => {
    const d = new Date(currentDate);
    if (calMode === 'day') d.setDate(d.getDate() + dir);
    else if (calMode === 'week') d.setDate(d.getDate() + dir * 7);
    else d.setMonth(d.getMonth() + dir);
    setCurrentDate(d);
  };

  const goToday = () => setCurrentDate(new Date());

  // Build the day columns to display
  let days = [];
  if (calMode === 'day') {
    days = [new Date(currentDate)];
    days[0].setHours(0, 0, 0, 0);
  } else if (calMode === 'week') {
    const ws = getWeekStart(currentDate);
    for (let i = 0; i < 7; i++) {
      const d = new Date(ws);
      d.setDate(d.getDate() + i);
      days.push(d);
    }
  } else {
    const ms = getMonthStart(currentDate);
    const daysInMonth = new Date(ms.getFullYear(), ms.getMonth() + 1, 0).getDate();
    for (let i = 0; i < daysInMonth; i++) {
      const d = new Date(ms);
      d.setDate(d.getDate() + i);
      days.push(d);
    }
  }

  // Group appointments by date
  const aptsByDate = {};
  appointments.forEach(a => {
    if (!a.date) return;
    if (!aptsByDate[a.date]) aptsByDate[a.date] = [];
    aptsByDate[a.date].push(a);
  });

  const formatHeaderDate = () => {
    if (calMode === 'day') return currentDate.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    if (calMode === 'week') {
      const ws = getWeekStart(currentDate);
      const we = new Date(ws); we.setDate(we.getDate() + 6);
      return `${ws.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – ${we.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    }
    return currentDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  };

  const isToday = (d) => {
    const t = new Date(); t.setHours(0,0,0,0);
    return d.getTime() === t.getTime();
  };

  const dayIsoStr = (d) => d.toISOString().split('T')[0];

  return (
    <div className="card overflow-hidden border border-[var(--color-border)]">
      {/* Calendar toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-bg-subtle)]">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-[var(--color-border)] transition-colors text-[var(--color-text-muted)]">
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-semibold text-[var(--color-text)] min-w-[200px] text-center">{formatHeaderDate()}</span>
          <button onClick={() => navigate(1)} className="p-1.5 rounded-lg hover:bg-[var(--color-border)] transition-colors text-[var(--color-text-muted)]">
            <ChevronRight size={16} />
          </button>
          <button onClick={goToday} className="btn btn-outline btn-xs ml-2">Today</button>
        </div>
        <div className="flex gap-1 bg-white border border-[var(--color-border)] p-0.5 rounded-lg">
          {['day', 'week', 'month'].map(m => (
            <button
              key={m}
              onClick={() => setCalMode(m)}
              className={`px-3 py-1 rounded text-xs font-medium capitalize transition-colors ${calMode === m ? 'bg-[var(--color-primary-500)] text-white' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'}`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Calendar Grid */}
      {calMode === 'month' ? (
        // Month grid
        <div>
          {/* Weekday headers */}
          <div className="grid grid-cols-7 border-b border-[var(--color-border)]">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
              <div key={d} className="px-2 py-2 text-center text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide border-r border-[var(--color-border)] last:border-0">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {/* Fill leading blank days */}
            {(() => {
              const ms = getMonthStart(currentDate);
              const dayOfWeek = ms.getDay(); // 0=Sun
              const blanks = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
              return Array.from({ length: blanks }).map((_, i) => (
                <div key={`blank-${i}`} className="min-h-[90px] border-r border-b border-[var(--color-border)] bg-[var(--color-bg-subtle)] last:border-r-0" />
              ));
            })()}
            {days.map((d, idx) => {
              const iso = dayIsoStr(d);
              const dayApts = aptsByDate[iso] || [];
              const isTdy = isToday(d);
              const colIndex = (d.getDay() === 0 ? 7 : d.getDay()); // 1=Mon, 7=Sun
              return (
                <div
                  key={iso}
                  className={`min-h-[90px] p-2 border-r border-b border-[var(--color-border)] ${colIndex === 7 ? 'border-r-0' : ''} ${isTdy ? 'bg-[var(--color-primary-50)]' : 'hover:bg-[var(--color-bg-subtle)]'} transition-colors`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full ${isTdy ? 'bg-[var(--color-primary-500)] text-white' : 'text-[var(--color-text-muted)]'}`}>
                      {d.getDate()}
                    </span>
                    {dayApts.length > 0 && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[var(--color-primary-100)] text-[var(--color-primary-700)]">{dayApts.length}</span>
                    )}
                  </div>
                  <div className="space-y-0.5">
                    {dayApts.slice(0, 3).map(a => (
                      <div
                        key={a.id}
                        className={`text-[10px] px-1.5 py-0.5 rounded truncate font-medium border ${STATUS_COLORS[a.status] || 'bg-slate-50 text-slate-600 border-slate-200'}`}
                        title={`${a.time} · ${a.patientName} · ${a.doctorName}`}
                      >
                        {a.time} {a.patientName}
                      </div>
                    ))}
                    {dayApts.length > 3 && (
                      <div className="text-[10px] text-[var(--color-text-muted)] px-1">+{dayApts.length - 3} more</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        // Day / Week column view
        <div className="overflow-x-auto">
          <div className={`grid ${calMode === 'day' ? 'grid-cols-1' : 'grid-cols-7'} min-w-[600px]`}>
            {days.map(d => {
              const iso = dayIsoStr(d);
              const dayApts = aptsByDate[iso] || [];
              const isTdy = isToday(d);
              return (
                <div key={iso} className="border-r border-[var(--color-border)] last:border-r-0">
                  {/* Day header */}
                  <div className={`px-3 py-2 border-b border-[var(--color-border)] text-center ${isTdy ? 'bg-[var(--color-primary-50)]' : 'bg-[var(--color-bg-subtle)]'}`}>
                    <p className={`text-xs font-semibold uppercase tracking-wide ${isTdy ? 'text-[var(--color-primary-600)]' : 'text-[var(--color-text-muted)]'}`}>
                      {d.toLocaleDateString('en-IN', { weekday: 'short' })}
                    </p>
                    <p className={`text-lg font-bold leading-tight ${isTdy ? 'text-[var(--color-primary-600)]' : 'text-[var(--color-text)]'}`}>
                      {d.getDate()}
                    </p>
                    {dayApts.length > 0 && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[var(--color-primary-100)] text-[var(--color-primary-700)]">{dayApts.length}</span>
                    )}
                  </div>
                  {/* Appointments for this day */}
                  <div className="p-1.5 space-y-1 min-h-[120px]">
                    {dayApts.length === 0 ? (
                      <div className="text-[11px] text-[var(--color-text-subtle)] text-center pt-4">—</div>
                    ) : dayApts.map(a => (
                      <div
                        key={a.id}
                        className={`rounded-lg p-2 border text-xs cursor-pointer hover:shadow-sm transition-all ${STATUS_COLORS[a.status] || 'bg-slate-50 text-slate-600 border-slate-200'}`}
                        title={`${a.patientName} · ${a.doctorName} · ${a.treatmentCategoryName}`}
                      >
                        <p className="font-semibold truncate">{a.time} · {a.patientName}</p>
                        <p className="truncate opacity-75 mt-0.5">{a.doctorName}</p>
                        <p className="truncate opacity-70">{a.treatmentCategoryName}</p>
                        <div className="flex flex-wrap gap-0.5 mt-1">
                          {(STATUS_ACTIONS[a.status] || []).slice(0, 2).map(action =>
                            action === 'rescheduled'
                              ? null
                              : (
                                <button
                                  key={action}
                                  onClick={(e) => { e.stopPropagation(); onStatusChange(a.id, action); }}
                                  className="text-[10px] font-semibold px-1.5 py-0.5 bg-white/70 hover:bg-white rounded border border-current capitalize transition-colors"
                                >
                                  {action.replace('_', ' ')}
                                </button>
                              )
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function AppointmentsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { role } = useAuth();
  const dispatch = useDispatch();

  const getInitialView = () => {
    const viewParam = searchParams.get('view');
    const statusParam = searchParams.get('status');
    if (viewParam && ['today', 'upcoming', 'missed', 'all'].includes(viewParam)) return viewParam;
    if (statusParam === 'missed') return 'missed';
    return 'today';
  };

  const [displayMode, setDisplayMode] = useState('list'); // 'list' | 'calendar'
  const [view, setView] = useState(getInitialView);
  const [allApts,      setAllApts]      = useState([]);
  const [todayApts,    setTodayApts]    = useState([]);
  const [upcomingApts, setUpcomingApts] = useState([]);
  const [missedApts,   setMissedApts]   = useState([]);
  const [loading,        setLoading]       = useState(true);
  const [actionLoading,  setActionLoading] = useState(null);
  const [rescheduleTarget, setRescheduleTarget] = useState(null);
  const [error,          setError]         = useState(null);
  const [search,         setSearch]        = useState(searchParams.get('q') || '');
  const [expandedCats,   setExpandedCats]  = useState({});
  const [catFilter,      setCatFilter]     = useState('');
  const [doctorFilter,   setDoctorFilter]  = useState('');
  const [categories,     setCategories]    = useState([]);
  const [doctors,        setDoctors]       = useState([]);
  const [bookAptOpen,    setBookAptOpen]   = useState(false);

  // Sync view with URL
  useEffect(() => {
    const vp = searchParams.get('view');
    const sp = searchParams.get('status');
    if (vp && ['today', 'upcoming', 'missed', 'all'].includes(vp)) setView(vp);
    else if (sp === 'missed') setView('missed');
    const q = searchParams.get('q');
    if (q !== null) setSearch(q);
  }, [searchParams]);

  const fetchApts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [allRes, todayRes, upcomingRes, missedRes, catsRes, docsRes] = await Promise.all([
        api.getAppointments({ view: 'all',      limit: 500 }).catch(() => ({ data: [] })),
        api.getAppointments({ view: 'today',    limit: 200 }).catch(() => ({ data: [] })),
        api.getAppointments({ view: 'upcoming', limit: 200 }).catch(() => ({ data: [] })),
        api.getAppointments({ view: 'missed',   limit: 200 }).catch(() => ({ data: [] })),
        api.getCategories({ status: 'active' }).catch(() => ({ data: [] })),
        api.getDoctors().catch(() => ({ data: [] })),
      ]);

      const extract = (res) => res?.data?.data ?? (Array.isArray(res?.data) ? res.data : []);

      setAllApts(extract(allRes));
      setTodayApts(extract(todayRes));
      setUpcomingApts(extract(upcomingRes));
      setMissedApts(extract(missedRes));

      const cats = catsRes?.data || [];
      if (Array.isArray(cats) && cats.length > 0) setCategories(cats);

      const docs = Array.isArray(docsRes.data) ? docsRes.data : (docsRes.data?.doctors || []);
      if (docs.length > 0) setDoctors(docs);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchApts(); }, [fetchApts]);

  // Real-time sync
  useEffect(() => {
    const handler = () => fetchApts();
    window.addEventListener('ddc_patient_data_updated', handler);
    window.addEventListener('focus', handler);
    const pollInterval = setInterval(fetchApts, 30000);
    return () => {
      window.removeEventListener('ddc_patient_data_updated', handler);
      window.removeEventListener('focus', handler);
      clearInterval(pollInterval);
    };
  }, [fetchApts]);

  const handleViewChange = (key) => {
    setView(key);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('view', key);
      next.delete('status');
      return next;
    }, { replace: true });
  };

  const handleSearchChange = (val) => {
    setSearch(val);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (val.trim()) next.set('q', val.trim()); else next.delete('q');
      return next;
    }, { replace: true });
  };

  // Which appointments to show
  const currentApts = (() => {
    switch (view) {
      case 'today':    return todayApts;
      case 'upcoming': return upcomingApts;
      case 'missed':   return missedApts;
      default:         return allApts;
    }
  })();

  // Apply filters
  const filtered = currentApts.filter(a => {
    if (catFilter) {
      const cat = categories.find(c => c.id === catFilter);
      if (cat && (a.treatmentCategoryName || '').toLowerCase() !== (cat.name || '').toLowerCase()) return false;
    }
    if (doctorFilter && a.doctorId !== doctorFilter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase().trim();
    return (
      (a.patientName || '').toLowerCase().includes(q) ||
      (a.patientPhone || '').toLowerCase().includes(q) ||
      (a.doctorName || '').toLowerCase().includes(q) ||
      (a.appointmentNumber || '').toLowerCase().includes(q) ||
      (a.treatmentCategoryName || '').toLowerCase().includes(q) ||
      (a.status || '').toLowerCase().includes(q)
    );
  });

  // Group by category (for list view)
  const grouped = {};
  filtered.forEach(a => {
    const cat = a.treatmentCategoryName || 'Uncategorized';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(a);
  });
  const groupKeys = Object.keys(grouped).sort();
  const toggleCat = (cat) => setExpandedCats(prev => ({ ...prev, [cat]: !prev[cat] }));

  async function handleStatusChange(aptId, status) {
    setActionLoading(aptId);
    try {
      await api.updateAppointmentStatus(aptId, { status });
      dispatch(addToast({ type: 'success', title: 'Status Updated', message: `Appointment marked as ${status.replace('_', ' ')}.` }));
      fetchApts();
    } catch (err) {
      dispatch(addToast({ type: 'error', title: 'Update Failed', message: err.message }));
    } finally {
      setActionLoading(null);
    }
  }

  async function handleReschedule(aptId, nextDate, nextTime) {
    setActionLoading(aptId);
    try {
      await api.updateAppointmentStatus(aptId, { status: 'rescheduled', nextDate, nextTime });
      setRescheduleTarget(null);
      dispatch(addToast({ type: 'success', title: 'Rescheduled', message: 'Appointment rescheduled successfully.' }));
      fetchApts();
    } catch (err) {
      dispatch(addToast({ type: 'error', title: 'Reschedule Failed', message: err.message }));
    } finally {
      setActionLoading(null);
    }
  }

  const priorityBadge = (p) => {
    if (p === 'emergency') return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700 border border-red-200">🚨 Emergency</span>;
    if (p === 'high')      return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200">⚡ High</span>;
    return null;
  };

  // Stats for today
  const todayStats = {
    today: todayApts.length,
    confirmed: todayApts.filter(a => ['confirmed', 'scheduled'].includes(a.status)).length,
    arrived: todayApts.filter(a => ['arrived', 'in_progress'].includes(a.status)).length,
    missed: todayApts.filter(a => a.status === 'missed').length,
  };

  const VIEW_TABS = [
    { key: 'today',    label: 'Today',    icon: Calendar,       count: todayApts.length,    color: 'text-amber-600' },
    { key: 'upcoming', label: 'Upcoming', icon: Clock,          count: upcomingApts.length, color: 'text-blue-600'  },
    { key: 'missed',   label: 'Missed',   icon: AlertTriangle,  count: missedApts.length,   color: 'text-rose-600'  },
    { key: 'all',      label: 'All',      icon: Users,          count: allApts.length,      color: 'text-slate-600' },
  ];

  const viewLabels = { today: "Today's", upcoming: 'Upcoming', missed: 'Missed', all: 'All' };

  return (
    <div className="space-y-5 animate-fade-in">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-text)]">Appointments & Calendar</h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            {loading ? 'Loading…' : `${filtered.length} ${viewLabels[view] || ''} appointment${filtered.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Display Mode Toggle */}
          <div className="flex gap-1 bg-[var(--color-bg-subtle)] p-1 rounded-lg border border-[var(--color-border)]">
            <button
              onClick={() => setDisplayMode('list')}
              title="List View"
              className={`p-1.5 rounded transition-colors ${displayMode === 'list' ? 'bg-white shadow text-[var(--color-primary-600)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'}`}
            >
              <List size={15} />
            </button>
            <button
              onClick={() => setDisplayMode('calendar')}
              title="Calendar View"
              className={`p-1.5 rounded transition-colors ${displayMode === 'calendar' ? 'bg-white shadow text-[var(--color-primary-600)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'}`}
            >
              <LayoutGrid size={15} />
            </button>
          </div>

          <button onClick={fetchApts} className="btn btn-outline btn-sm flex items-center gap-1">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>

          {(role === 'admin' || role === 'receptionist') && (
            <button
              onClick={() => setBookAptOpen(true)}
              className="btn btn-primary btn-sm flex items-center gap-1.5"
              id="book-appointment-btn"
            >
              <Plus size={15} /> Book Appointment
            </button>
          )}
        </div>
      </div>

      {/* Stats Cards — Today's Summary */}
      {!loading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {STAT_CONFIGS.map(s => (
            <div key={s.key} className={`card p-4 flex items-center gap-3 border-l-4 ${s.border}`}>
              <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center flex-shrink-0`}>
                <Calendar size={18} className={s.color} />
              </div>
              <div>
                <p className="text-xs text-[var(--color-text-muted)] font-medium leading-tight">{s.label}</p>
                <p className={`text-2xl font-bold ${s.color} leading-tight`}>{todayStats[s.key]}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* View Tabs with live counts */}
      <div className="flex flex-wrap gap-1 bg-[var(--color-bg-subtle)] p-1 rounded-xl w-fit">
        {VIEW_TABS.map((tab) => {
          const Icon = tab.icon;
          const active = view === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => handleViewChange(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                active
                  ? 'bg-white shadow text-[var(--color-primary-600)]'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
              }`}
            >
              {Icon && <Icon size={14} className={active ? tab.color : ''} />}
              {tab.label}
              {!loading && (
                <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ml-0.5 ${
                  active
                    ? 'bg-[var(--color-primary-100)] text-[var(--color-primary-700)]'
                    : 'bg-[var(--color-bg)] text-[var(--color-text-muted)]'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Search + Filters */}
      <div className="flex flex-wrap gap-3">
        {/* Search */}
        <div className="card p-3 flex items-center gap-2 flex-1 min-w-[260px]">
          <Search size={16} className="text-[var(--color-text-muted)] shrink-0" />
          <input
            type="search"
            id="appointment-search"
            placeholder="Search by patient, doctor, category, or appointment ID…"
            value={search}
            onChange={e => handleSearchChange(e.target.value)}
            className="flex-1 text-sm bg-transparent outline-none text-[var(--color-text)]"
          />
          {search && (
            <button
              onClick={() => handleSearchChange('')}
              className="text-xs font-bold text-slate-400 hover:text-slate-600 px-1 cursor-pointer"
            >
              <X size={15} />
            </button>
          )}
        </div>

        {/* Category filter */}
        {categories.length > 0 && (
          <div className="card p-2.5 flex items-center gap-2">
            <Tag size={14} className="text-[var(--color-text-muted)]" />
            <select
              id="apt-category-filter"
              value={catFilter}
              onChange={e => setCatFilter(e.target.value)}
              className="text-sm bg-transparent outline-none text-[var(--color-text)] cursor-pointer pr-1"
            >
              <option value="">All Categories</option>
              {categories.map(c => (
                <option key={c.id || c._id} value={c.id || c._id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Doctor filter */}
        {doctors.length > 0 && (
          <div className="card p-2.5 flex items-center gap-2">
            <Stethoscope size={14} className="text-[var(--color-text-muted)]" />
            <select
              id="apt-doctor-filter"
              value={doctorFilter}
              onChange={e => setDoctorFilter(e.target.value)}
              className="text-sm bg-transparent outline-none text-[var(--color-text)] cursor-pointer pr-1"
            >
              <option value="">All Doctors</option>
              {doctors.map(d => (
                <option key={d.id} value={d.id}>{d.name}{d.specialization ? ` · ${d.specialization}` : ''}</option>
              ))}
            </select>
          </div>
        )}

        {(catFilter || doctorFilter) && (
          <button
            onClick={() => { setCatFilter(''); setDoctorFilter(''); }}
            className="text-xs text-[var(--color-primary-600)] underline hover:text-[var(--color-primary-700)] self-center"
          >
            Clear filters
          </button>
        )}
      </div>

      {error && (
        <div className="card p-3 border border-red-200 bg-red-50 text-red-700 text-sm">{error}</div>
      )}

      {/* Skeleton loader */}
      {loading && (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="card p-4 space-y-3">
              <div className="h-4 bg-[var(--color-border)] rounded w-1/4 animate-pulse" />
              <div className="h-3 bg-[var(--color-border)] rounded w-3/4 animate-pulse" />
              <div className="h-3 bg-[var(--color-border)] rounded w-1/2 animate-pulse" />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && filtered.length === 0 && (
        <div className="card py-16 text-center">
          <EmptyState
            icon={Calendar}
            title={`No ${viewLabels[view] || ''} appointments`}
            description={search || catFilter || doctorFilter ? 'Try clearing your search or filters.' : 'No appointments match this view.'}
          />
        </div>
      )}

      {/* Calendar View */}
      {!loading && filtered.length > 0 && displayMode === 'calendar' && (
        <CalendarView
          appointments={filtered}
          onStatusChange={handleStatusChange}
          role={role}
          onNewAppointment={() => setBookAptOpen(true)}
        />
      )}

      {/* List View — Category-wise grouped */}
      {!loading && filtered.length > 0 && displayMode === 'list' && (
        <div className="space-y-4">
          {groupKeys.map(catName => {
            const catApts = grouped[catName];
            const isOpen = expandedCats[catName] !== false;
            return (
              <div key={catName} className="card overflow-hidden border border-[var(--color-border)]">
                {/* Category header */}
                <button
                  onClick={() => toggleCat(catName)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-[var(--color-bg-subtle)] hover:bg-[var(--color-border)] transition-colors border-b border-[var(--color-border)]"
                >
                  <div className="flex items-center gap-2">
                    {isOpen ? <ChevronDown size={15} className="text-[var(--color-text-muted)]" /> : <ChevronRight size={15} className="text-[var(--color-text-muted)]" />}
                    <span className="font-semibold text-sm text-[var(--color-text)]">{catName}</span>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[var(--color-primary-100)] text-[var(--color-primary-700)]">
                      {catApts.length}
                    </span>
                  </div>
                  <span className="text-xs text-[var(--color-text-muted)]">
                    {catApts.filter(a => a.status === 'completed').length} completed
                    {catApts.filter(a => a.status === 'missed').length > 0 && ` · ${catApts.filter(a => a.status === 'missed').length} missed`}
                  </span>
                </button>

                {/* Appointments table */}
                {isOpen && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-[var(--color-bg-subtle)] border-b border-[var(--color-border)]">
                        <tr>
                          {['Apt #', 'Patient', 'Doctor', 'Date', 'Time', 'Status', 'Priority', 'Actions'].map(h => (
                            <th key={h} className="text-left px-4 py-2.5 font-medium text-[var(--color-text-muted)] whitespace-nowrap text-xs uppercase tracking-wide">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {catApts.map((apt) => {
                          const actions = STATUS_ACTIONS[apt.status] || [];
                          const statusCls = STATUS_COLORS[apt.status] || 'bg-slate-50 text-slate-600 border-slate-200';
                          return (
                            <tr key={apt.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-bg-subtle)] transition-colors">
                              <td className="px-4 py-3 font-mono text-xs text-[var(--color-text-muted)] whitespace-nowrap">
                                {apt.appointmentNumber || '–'}
                              </td>
                              <td className="px-4 py-3">
                                <div className="font-medium text-[var(--color-text)] whitespace-nowrap">{apt.patientName || '–'}</div>
                                {apt.patientPhone && <div className="text-xs text-[var(--color-text-muted)]">{apt.patientPhone}</div>}
                              </td>
                              <td className="px-4 py-3 text-[var(--color-text-muted)] whitespace-nowrap">{apt.doctorName || '–'}</td>
                              <td className="px-4 py-3 text-[var(--color-text-muted)] whitespace-nowrap">{apt.date ? formatDate(apt.date) : '–'}</td>
                              <td className="px-4 py-3 text-[var(--color-text-muted)] whitespace-nowrap">{apt.time || '–'}</td>
                              <td className="px-4 py-3">
                                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border capitalize ${statusCls}`}>
                                  {(apt.status || '').replace('_', ' ')}
                                </span>
                              </td>
                              <td className="px-4 py-3">{priorityBadge(apt.priority)}</td>
                              <td className="px-4 py-3">
                                <div className="flex flex-wrap gap-1">
                                  {actionLoading === apt.id ? (
                                    <span className="text-xs text-[var(--color-text-muted)]">Updating…</span>
                                  ) : (
                                    <>
                                      {actions.map(action =>
                                        action === 'rescheduled'
                                          ? <button key={action} onClick={() => setRescheduleTarget(apt)} className="btn btn-outline btn-xs">Reschedule</button>
                                          : <button key={action} onClick={() => handleStatusChange(apt.id, action)} className="btn btn-outline btn-xs capitalize">{action.replace('_', ' ')}</button>
                                      )}
                                      {apt.patientId && (
                                        <Link to={`/${role || 'admin'}/patients/${apt.patientId}`} className="btn btn-outline btn-xs">View</Link>
                                      )}
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Reschedule Modal */}
      {rescheduleTarget && (
        <RescheduleModal apt={rescheduleTarget} onClose={() => setRescheduleTarget(null)} onConfirm={handleReschedule} />
      )}

      {/* Book Appointment Modal */}
      {bookAptOpen && (
        <BookAppointmentModal
          onClose={() => setBookAptOpen(false)}
          onBooked={() => {
            setBookAptOpen(false);
            fetchApts();
            dispatch(addToast({ type: 'success', title: 'Appointment Booked', message: 'New appointment has been scheduled.' }));
          }}
        />
      )}
    </div>
  );
}
