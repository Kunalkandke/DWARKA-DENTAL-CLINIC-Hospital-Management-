import { useEffect, useState, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Users, Calendar, CheckCircle, AlertTriangle, DollarSign, Clock, TrendingUp,
  Activity, RefreshCw, X, AlertCircle, Stethoscope, Brain, BarChart2,
  ChevronRight, ArrowUpRight, ArrowDownRight, Minus, Eye, Zap,
  UserCheck, Timer, Layers,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { KPICard, Card, CardHeader, CardTitle } from '../../components/ui/Card';
import { StatusBadge } from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { api } from '../../utils/api';
import { useAuth } from '../../hooks/useAuth';

// ─── Design tokens ────────────────────────────────────────────────────────────
const CHART_COLORS = ['#0b6ba7', '#0d9c8e', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4'];

const PRESET_RANGES = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: 'Last 7 Days' },
  { key: 'month', label: 'This Month' },
  { key: 'custom', label: 'Custom' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getDateRange(preset) {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const fmt = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  if (preset === 'today') {
    const t = fmt(now);
    return { dateFrom: t, dateTo: t };
  }
  if (preset === '7d') {
    const from = new Date(now); from.setDate(from.getDate() - 6);
    return { dateFrom: fmt(from), dateTo: fmt(now) };
  }
  if (preset === 'month') {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    return { dateFrom: fmt(from), dateTo: fmt(now) };
  }
  return null; // custom
}

function Skeleton({ className = '' }) {
  return <div className={`skeleton ${className}`} />;
}

function TrendChip({ pct }) {
  if (pct === null || pct === undefined) return null;
  const up = pct > 0;
  const flat = pct === 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold px-1.5 py-0.5 rounded-full
      ${flat ? 'bg-slate-100 text-slate-500' : up ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
      {flat ? <Minus size={10} /> : up ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
      {flat ? 'No change' : `${up ? '+' : ''}${pct}%`}
    </span>
  );
}

function UnavailableCard({ title, message }) {
  return (
    <div className="card p-5 border-dashed border-2 border-slate-200 bg-slate-50/60">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
          <AlertCircle size={15} className="text-slate-400" />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="text-xs text-slate-400 mt-0.5">{message}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Custom tooltip for charts ────────────────────────────────────────────────
function RevenueTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="card px-3 py-2 text-xs shadow-lg border border-[var(--color-border)]">
      <p className="font-semibold text-[var(--color-text)] mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>{p.name}: {formatCurrency(p.value)}</p>
      ))}
    </div>
  );
}

function AptTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="card px-3 py-2 text-xs shadow-lg border border-[var(--color-border)]">
      <p className="font-semibold text-[var(--color-text)] mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>{p.name}: {p.value}</p>
      ))}
    </div>
  );
}

// ─── Section Heading ──────────────────────────────────────────────────────────
function SectionHeading({ icon: Icon, title, sub, action }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-[var(--color-primary-50)] flex items-center justify-center">
          <Icon size={16} className="text-[var(--color-primary-600)]" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-[var(--color-text)]">{title}</h2>
          {sub && <p className="text-xs text-[var(--color-text-muted)]">{sub}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

// ─── Status chip for live queue ───────────────────────────────────────────────
function QueueStatusChip({ status }) {
  const MAP = {
    scheduled:   { bg: 'bg-blue-50',   text: 'text-blue-700',   label: 'Scheduled' },
    confirmed:   { bg: 'bg-indigo-50', text: 'text-indigo-700', label: 'Confirmed' },
    arrived:     { bg: 'bg-amber-50',  text: 'text-amber-700',  label: 'Arrived' },
    in_progress: { bg: 'bg-emerald-50',text: 'text-emerald-700',label: 'In Progress' },
    completed:   { bg: 'bg-slate-100', text: 'text-slate-500',  label: 'Done' },
    missed:      { bg: 'bg-red-50',    text: 'text-red-600',    label: 'Missed' },
    cancelled:   { bg: 'bg-red-50',    text: 'text-red-400',    label: 'Cancelled' },
  };
  const s = MAP[status] || MAP.scheduled;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  );
}

// ─── Result chip for AI reports ───────────────────────────────────────────────
function AiResultChip({ result }) {
  const MAP = {
    cavity:    { bg: 'bg-red-50',    text: 'text-red-600',    label: '⚠ Cavity Detected' },
    normal:    { bg: 'bg-emerald-50',text: 'text-emerald-600',label: '✓ Normal' },
    uncertain: { bg: 'bg-amber-50',  text: 'text-amber-700',  label: '? Uncertain' },
  };
  const s = MAP[result] || { bg: 'bg-slate-100', text: 'text-slate-500', label: result };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AdminDashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Date filter state
  const [preset, setPreset] = useState('today');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [compareEnabled, setCompareEnabled] = useState(false);

  // Data state
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);

  // Live queue refresh interval
  const refreshTimerRef = useRef(null);

  // ── Compute active date range ──────────────────────────────────────────────
  const getActiveRange = useCallback(() => {
    if (preset === 'custom') {
      if (customFrom && customTo) return { dateFrom: customFrom, dateTo: customTo };
      return null;
    }
    return getDateRange(preset);
  }, [preset, customFrom, customTo]);

  // ── Load data ──────────────────────────────────────────────────────────────
  const loadData = useCallback(async (silent = false) => {
    const range = getActiveRange();
    if (!range) return;

    if (!silent) { setLoading(true); setError(null); }

    try {
      const params = {
        dateFrom: range.dateFrom,
        dateTo: range.dateTo,
        compare: compareEnabled ? 'true' : 'false',
      };
      const res = await api.getDashboardStatsEnhanced(params);
      const d = res?.data || res;
      setData(d);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [getActiveRange, compareEnabled]);

  // ── Initial load + preset change ──────────────────────────────────────────
  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Silent refresh every 60 seconds for live queue ────────────────────────
  useEffect(() => {
    refreshTimerRef.current = setInterval(() => { loadData(true); }, 60_000);
    return () => clearInterval(refreshTimerRef.current);
  }, [loadData]);

  // ── Storage events from Receptionist ─────────────────────────────────────
  useEffect(() => {
    const handler = () => loadData(true);
    window.addEventListener('ddc_patient_data_updated', handler);
    window.addEventListener('focus', handler);
    return () => {
      window.removeEventListener('ddc_patient_data_updated', handler);
      window.removeEventListener('focus', handler);
    };
  }, [loadData]);

  // ── Formatted date label ──────────────────────────────────────────────────
  const todayDateStr = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  // ── Derive comparison data ────────────────────────────────────────────────
  const cmp = data?.comparison;

  // ── Build KPI cards array ─────────────────────────────────────────────────
  const kpiCards = data ? [
    {
      label: 'Total Patients',
      value: (data.totalPatients ?? 0).toLocaleString('en-IN'),
      icon: Users,
      iconColor: 'text-[var(--color-primary-500)]',
      iconBg: 'bg-[var(--color-primary-50)]',
      trendLabel: cmp ? <TrendChip pct={cmp.totalPatients} /> : null,
      to: '/admin/patients',
    },
    {
      label: 'New Patients',
      value: (data.newPatientsInPeriod ?? 0).toLocaleString('en-IN'),
      icon: UserCheck,
      iconColor: 'text-emerald-600',
      iconBg: 'bg-emerald-50',
      trendLabel: cmp ? <TrendChip pct={cmp.newPatientsInPeriod} /> : null,
      to: '/admin/patients',
    },
    {
      label: "Today's Appointments",
      value: (data.todayAppointments ?? 0).toLocaleString('en-IN'),
      icon: Calendar,
      iconColor: 'text-amber-500',
      iconBg: 'bg-amber-50',
      trendLabel: null,
      to: '/admin/appointments',
    },
    {
      label: 'Completed (Period)',
      value: (data.completedAppointmentsInPeriod ?? 0).toLocaleString('en-IN'),
      icon: CheckCircle,
      iconColor: 'text-emerald-500',
      iconBg: 'bg-emerald-50',
      trendLabel: cmp ? <TrendChip pct={cmp.completedAppointmentsInPeriod} /> : null,
      to: '/admin/appointments?status=completed',
    },
    {
      label: 'Upcoming',
      value: (data.upcomingAppointments ?? 0).toLocaleString('en-IN'),
      icon: Clock,
      iconColor: 'text-violet-500',
      iconBg: 'bg-violet-50',
      trendLabel: null,
      to: '/admin/appointments?status=scheduled',
    },
    {
      label: 'Cancelled / No-Shows',
      value: ((data.cancelledAppointmentsInPeriod ?? 0) + (data.noShowCount ?? 0)).toLocaleString('en-IN'),
      icon: AlertTriangle,
      iconColor: 'text-red-500',
      iconBg: 'bg-red-50',
      trendLabel: cmp ? <TrendChip pct={cmp.noShowCount} /> : null,
      to: '/admin/appointments?status=missed',
    },
    {
      label: "Today's Collections",
      value: formatCurrency(data.todayCollections ?? 0),
      icon: DollarSign,
      iconColor: 'text-emerald-600',
      iconBg: 'bg-emerald-50',
      trendLabel: null,
      to: '/admin/revenue',
    },
    {
      label: 'Period Collections',
      value: formatCurrency(data.periodCollections ?? 0),
      icon: TrendingUp,
      iconColor: 'text-[var(--color-primary-500)]',
      iconBg: 'bg-[var(--color-primary-50)]',
      trendLabel: cmp ? <TrendChip pct={cmp.periodCollections} /> : null,
      to: '/admin/revenue',
    },
    {
      label: 'Outstanding Dues',
      value: formatCurrency(data.outstandingDues ?? 0),
      icon: AlertCircle,
      iconColor: data.outstandingDues > 0 ? 'text-red-500' : 'text-slate-400',
      iconBg: data.outstandingDues > 0 ? 'bg-red-50' : 'bg-slate-100',
      trendLabel: null,
      to: '/admin/revenue',
    },
    {
      label: 'Avg Bill Value',
      value: data.avgBillValue > 0 ? formatCurrency(data.avgBillValue) : '—',
      icon: BarChart2,
      iconColor: 'text-cyan-500',
      iconBg: 'bg-cyan-50',
      trendLabel: null,
      to: '/admin/revenue',
    },
    {
      label: 'Unreviewed AI Reports',
      value: (data.unreviewedAiReportsCount ?? 0).toLocaleString('en-IN'),
      icon: Brain,
      iconColor: data.unreviewedAiReportsCount > 0 ? 'text-amber-500' : 'text-slate-400',
      iconBg: data.unreviewedAiReportsCount > 0 ? 'bg-amber-50' : 'bg-slate-100',
      trendLabel: null,
      to: '/admin/ai-xray',
    },
    {
      label: 'Active Staff',
      value: (data.doctorPerformance?.length ?? 0) > 0 ? String(data.doctorPerformance.length) : '—',
      icon: Activity,
      iconColor: 'text-indigo-500',
      iconBg: 'bg-indigo-50',
      trendLabel: null,
      to: '/admin/staff',
    },
  ] : [];

  // ── Chart data processing ─────────────────────────────────────────────────
  const revenueSeriesFormatted = (data?.revenueTimeSeries || []).map(d => ({
    ...d,
    label: new Date(d.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
  }));

  const aptSeriesFormatted = (data?.appointmentTimeSeries || []).map(d => ({
    ...d,
    label: new Date(d.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
  }));

  const aptStatusData = data ? [
    { name: 'Completed', value: data.completedAppointmentsInPeriod || 0 },
    { name: 'Upcoming', value: data.upcomingAppointments || 0 },
    { name: 'Today', value: data.todayAppointments || 0 },
    { name: 'Cancelled', value: data.cancelledAppointmentsInPeriod || 0 },
    { name: 'No-Show', value: data.noShowCount || 0 },
  ].filter(d => d.value > 0) : [];

  const methodData = (data?.revenueByMethod || []).map(m => ({
    name: m.label,
    value: m.value,
  }));

  const categoryData = (data?.categoryRevenue || []).slice(0, 8).map(c => ({
    name: c.name,
    count: c.count,
  }));

  // ── Live queue ────────────────────────────────────────────────────────────
  const liveQueue = data?.liveQueue || { waiting: 0, inTreatment: 0, completed: 0, queue: [] };

  // ── Unreviewed AI reports ─────────────────────────────────────────────────
  const aiReports = data?.unreviewedAiReports || [];

  // ── Doctor performance ────────────────────────────────────────────────────
  const doctorPerf = data?.doctorPerformance || [];

  return (
    <div className="space-y-5 animate-fade-in">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Clinic Dashboard</h1>
          <p className="page-subtitle">{todayDateStr}</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {lastRefresh && (
            <span className="text-[11px] text-[var(--color-text-muted)] bg-[var(--color-bg-subtle)] px-2.5 py-1 rounded-lg border border-[var(--color-border)]">
              Updated {lastRefresh.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <Button variant="outline" size="xs" onClick={() => loadData()} loading={loading} className="gap-1">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Refresh
          </Button>
        </div>
      </div>

      {/* ── Date Filter Bar ─────────────────────────────────────────────────── */}
      <div className="card p-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 p-1 bg-[var(--color-bg-subtle)] rounded-lg">
          {PRESET_RANGES.map(p => (
            <button
              key={p.key}
              onClick={() => setPreset(p.key)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer
                ${preset === p.key
                  ? 'bg-[var(--color-primary-600)] text-white shadow-sm'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-white/60'
                }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {preset === 'custom' && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={customFrom}
              onChange={e => setCustomFrom(e.target.value)}
              className="input text-sm py-1.5 h-auto"
              max={customTo || undefined}
            />
            <span className="text-[var(--color-text-muted)] text-xs">to</span>
            <input
              type="date"
              value={customTo}
              onChange={e => setCustomTo(e.target.value)}
              className="input text-sm py-1.5 h-auto"
              min={customFrom || undefined}
            />
          </div>
        )}

        <label className="flex items-center gap-2 text-xs text-[var(--color-text-muted)] cursor-pointer ml-auto select-none">
          <input
            type="checkbox"
            checked={compareEnabled}
            onChange={e => setCompareEnabled(e.target.checked)}
            className="rounded cursor-pointer"
          />
          <span>Compare with previous period</span>
        </label>
      </div>

      {/* ── Error Banner ────────────────────────────────────────────────────── */}
      {error && (
        <div className="card p-4 border border-red-200 bg-red-50 text-red-700 text-sm flex items-center gap-2">
          <AlertTriangle size={16} />
          {error}
          <button onClick={() => loadData()} className="ml-auto underline font-medium cursor-pointer">
            Retry
          </button>
        </div>
      )}

      {/* ── KPI Grid ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-3">
        {loading
          ? Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="card p-4 space-y-3">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-7 w-16" />
              </div>
            ))
          : kpiCards.map(kpi => <KPICard key={kpi.label} {...kpi} />)
        }
      </div>

      {/* ── Revenue & Appointment Charts Row ───────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Revenue over time */}
        <Card noPad>
          <div className="p-5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp size={16} className="text-[var(--color-primary-500)]" />
                Collections Over Time
              </CardTitle>
              <Link to="/admin/revenue" className="text-xs text-[var(--color-primary-500)] hover:text-[var(--color-primary-700)] font-semibold flex items-center gap-0.5 transition-colors">
                Details <ChevronRight size={13} />
              </Link>
            </CardHeader>
          </div>
          <div className="px-5 pb-5">
            {loading ? <Skeleton className="h-52" /> : revenueSeriesFormatted.length === 0 ? (
              <div className="h-52 flex items-center justify-center text-sm text-[var(--color-text-muted)]">
                No payment records in this period
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={210}>
                <AreaChart data={revenueSeriesFormatted} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} width={44} axisLine={false} tickLine={false} />
                  <Tooltip content={<RevenueTooltip />} />
                  <Area type="monotone" dataKey="amount" name="Collections" stroke="#2563eb" strokeWidth={2.5} fill="url(#revGradient)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        {/* Payment method breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign size={16} className="text-[var(--color-primary-600)]" />
              Collections by Payment Mode
            </CardTitle>
            <Link to="/admin/revenue" className="text-xs text-[var(--color-primary-500)] hover:underline font-medium flex items-center gap-0.5">
              Details <ChevronRight size={13} />
            </Link>
          </CardHeader>
          <div className="px-4 pb-4">
            {loading ? <Skeleton className="h-52" /> : methodData.length === 0 ? (
              <div className="h-52 flex items-center justify-center text-sm text-[var(--color-text-muted)]">
                No payment records in this period
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={210}>
                <PieChart>
                  <Pie data={methodData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                    {methodData.map((_, idx) => <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={v => formatCurrency(v)} />
                  <Legend iconType="circle" iconSize={10} formatter={v => v} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      {/* ── Appointment Analytics Row ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Appointment status donut */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar size={16} className="text-[var(--color-primary-600)]" />
              Appointment Status Distribution
            </CardTitle>
            <Link to="/admin/appointments" className="text-xs text-[var(--color-primary-500)] hover:underline font-medium flex items-center gap-0.5">
              All appointments <ChevronRight size={13} />
            </Link>
          </CardHeader>
          <div className="px-4 pb-4">
            {loading ? <Skeleton className="h-52" /> : aptStatusData.length === 0 ? (
              <div className="h-52 flex items-center justify-center text-sm text-[var(--color-text-muted)]">
                No appointments in this period
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={210}>
                <PieChart>
                  <Pie data={aptStatusData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                    {aptStatusData.map((_, idx) => <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={v => v.toLocaleString('en-IN')} />
                  <Legend iconType="circle" iconSize={10} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        {/* Appointments by category */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers size={16} className="text-[var(--color-primary-600)]" />
              Visits by Treatment Category
            </CardTitle>
            <Link to="/admin/categories" className="text-xs text-[var(--color-primary-500)] hover:underline font-medium flex items-center gap-0.5">
              Manage <ChevronRight size={13} />
            </Link>
          </CardHeader>
          <div className="px-4 pb-4">
            {loading ? <Skeleton className="h-52" /> : categoryData.length === 0 ? (
              <div className="h-52 flex items-center justify-center text-sm text-[var(--color-text-muted)]">
                No completed appointments in this period
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(210, categoryData.length * 36)}>
                <BarChart data={categoryData} layout="vertical" margin={{ top: 0, right: 16, left: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={110} />
                  <Tooltip formatter={v => [`${v} visits`, 'Completed']} />
                  <Bar dataKey="count" name="Completed Visits" radius={[0, 6, 6, 0]}>
                    {categoryData.map((_, idx) => <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      {/* ── Doctor Performance Table ────────────────────────────────────────── */}
      <Card>
        <div className="p-5">
          <SectionHeading
            icon={Stethoscope}
            title="Doctor Performance"
            sub={`For selected period · ${doctorPerf.length} doctor${doctorPerf.length !== 1 ? 's' : ''}`}
            action={
              <Link to="/admin/doctors" className="text-xs text-[var(--color-primary-500)] hover:underline font-medium flex items-center gap-0.5">
                Manage Doctors <ChevronRight size={13} />
              </Link>
            }
          />
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-5 space-y-2">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
            </div>
          ) : doctorPerf.length === 0 ? (
            <div className="py-12 text-center text-sm text-[var(--color-text-muted)]">
              No doctor activity recorded in this period.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-t border-[var(--color-border)] bg-[var(--color-bg-subtle)]">
                  {['Doctor', 'Specialization', 'Patients Seen', 'Completed Visits', 'Avg Duration'].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {doctorPerf.map(d => (
                  <tr
                    key={d.doctorId}
                    className="hover:bg-[var(--color-bg-subtle)] transition-colors cursor-pointer"
                    onClick={() => navigate('/admin/doctors')}
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-[var(--color-primary-100)] flex items-center justify-center text-[10px] font-bold text-[var(--color-primary-700)] flex-shrink-0">
                          {d.doctorName?.slice(0, 2).toUpperCase()}
                        </div>
                        <span className="font-medium text-[var(--color-text)]">{d.doctorName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-[var(--color-text-muted)]">{d.specialization || '—'}</td>
                    <td className="px-4 py-2.5 font-semibold text-[var(--color-text)]">{d.patientsCount.toLocaleString('en-IN')}</td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center gap-1 font-semibold text-emerald-600">
                        <CheckCircle size={13} />
                        {d.completedVisits.toLocaleString('en-IN')}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-[var(--color-text-muted)]">
                      {d.avgDurationMinutes > 0 ? `${d.avgDurationMinutes} min` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      {/* ── Live Clinic Operations Board ───────────────────────────────────── */}
      <Card>
        <div className="p-5">
          <SectionHeading
            icon={Zap}
            title="Live Operations Board"
            sub="Today's appointment queue · auto-refreshes every 60s"
            action={
              <div className="flex items-center gap-4">
                {/* Live status pills */}
                {!loading && (
                  <div className="flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1.5 text-amber-600 font-medium">
                      <Timer size={12} />
                      {liveQueue.waiting} waiting
                    </span>
                    <span className="flex items-center gap-1.5 text-emerald-600 font-medium">
                      <Activity size={12} />
                      {liveQueue.inTreatment} in treatment
                    </span>
                    <span className="flex items-center gap-1.5 text-slate-500 font-medium">
                      <CheckCircle size={12} />
                      {liveQueue.completed} done
                    </span>
                  </div>
                )}
                <Link to="/admin/appointments" className="text-xs text-[var(--color-primary-500)] hover:underline font-medium flex items-center gap-0.5">
                  Full schedule <ChevronRight size={13} />
                </Link>
              </div>
            }
          />
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-5 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
            </div>
          ) : liveQueue.queue.length === 0 ? (
            <div className="py-12 text-center">
              <Calendar size={32} className="mx-auto text-slate-200 mb-2" />
              <p className="text-sm text-[var(--color-text-muted)]">No appointments scheduled for today.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-t border-[var(--color-border)] bg-[var(--color-bg-subtle)]">
                  {['#', 'Patient', 'Time', 'Doctor', 'Category', 'Status', ''].map((h, i) => (
                    <th key={i} className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {liveQueue.queue.map(apt => (
                  <tr
                    key={apt.id}
                    className="hover:bg-[var(--color-bg-subtle)] transition-colors group"
                  >
                    <td className="px-4 py-3 font-mono text-[11px] text-[var(--color-text-muted)]">
                      {apt.appointmentNumber}
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <Link
                          to={`/admin/patients/${apt.patientId}`}
                          className="font-semibold text-[var(--color-text)] hover:text-[var(--color-primary-600)]"
                        >
                          {apt.patientName}
                        </Link>
                        <p className="text-[11px] text-[var(--color-text-muted)]">{apt.patientNumber}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-muted)] whitespace-nowrap">
                      {apt.startAt
                        ? new Date(apt.startAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-muted)]">{apt.doctorName}</td>
                    <td className="px-4 py-3 text-[var(--color-text-muted)]">{apt.categoryName || 'General'}</td>
                    <td className="px-4 py-3">
                      <QueueStatusChip status={apt.status} />
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        to="/admin/appointments"
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-[var(--color-primary-500)] hover:text-[var(--color-primary-700)]"
                      >
                        <Eye size={14} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      {/* ── Action Centre — Unreviewed AI Reports ───────────────────────────── */}
      {!loading && (
        <Card>
          <div className="p-5">
            <SectionHeading
              icon={Brain}
              title="Action Centre — Unreviewed AI Reports"
              sub={
                aiReports.length > 0
                  ? `${data?.unreviewedAiReportsCount ?? aiReports.length} report${data?.unreviewedAiReportsCount !== 1 ? 's' : ''} awaiting doctor review`
                  : 'All AI reports have been reviewed'
              }
              action={
                <Link to="/admin/ai-xray" className="text-xs text-[var(--color-primary-500)] hover:underline font-medium flex items-center gap-0.5">
                  AI X-Ray Portal <ChevronRight size={13} />
                </Link>
              }
            />
          </div>

          {aiReports.length === 0 ? (
            <div className="px-5 pb-6 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center">
                <CheckCircle size={16} className="text-emerald-500" />
              </div>
              <p className="text-sm text-[var(--color-text-muted)]">All AI X-ray reports have been reviewed. No pending items.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-t border-[var(--color-border)] bg-[var(--color-bg-subtle)]">
                    {['Patient', 'Patient #', 'AI Finding', 'Uploaded', 'Action'].map(h => (
                      <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {aiReports.map(r => (
                    <tr key={r.id} className="hover:bg-[var(--color-bg-subtle)] transition-colors">
                      <td className="px-4 py-2.5 font-medium text-[var(--color-text)]">{r.patientName}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-[var(--color-text-muted)]">{r.patientNumber}</td>
                      <td className="px-4 py-2.5"><AiResultChip result={r.result} /></td>
                      <td className="px-4 py-2.5 text-[var(--color-text-muted)]">{formatDate(r.createdAt)}</td>
                      <td className="px-4 py-2.5">
                        <Link
                          to={`/admin/patients/${r.patientId}`}
                          className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-primary-600)] hover:underline"
                        >
                          Review <ArrowUpRight size={12} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(data?.unreviewedAiReportsCount ?? 0) > aiReports.length && (
                <div className="px-5 py-3 border-t border-[var(--color-border)] text-xs text-[var(--color-text-muted)] flex items-center justify-between">
                  <span>Showing 10 of {data.unreviewedAiReportsCount} unreviewed reports</span>
                  <Link to="/admin/ai-xray" className="text-[var(--color-primary-500)] hover:underline font-medium">
                    View all in AI Portal →
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* Unavailable action items — documented honestly */}
          <div className="p-5 border-t border-[var(--color-border)] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-2">
            <UnavailableCard
              title="Expense Approvals"
              message="Expense tracking module not yet implemented. Will appear here once built."
            />
            <UnavailableCard
              title="Leave Requests"
              message="HR / leave management module not yet implemented."
            />
            <UnavailableCard
              title="Inventory Alerts"
              message="Inventory module not yet implemented. Stock alerts will appear here once built."
            />
          </div>
        </Card>
      )}

      {/* ── Appointment Time-Series (secondary chart) ───────────────────────── */}
      {!loading && aptSeriesFormatted.length > 1 && (
        <Card noPad>
          <div className="p-5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart2 size={16} className="text-[var(--color-primary-500)]" />
                Daily Appointment Volume
              </CardTitle>
              <Link to="/admin/appointments" className="text-xs text-[var(--color-primary-500)] hover:text-[var(--color-primary-700)] font-semibold flex items-center gap-0.5 transition-colors">
                All appointments <ChevronRight size={13} />
              </Link>
            </CardHeader>
          </div>
          <div className="px-5 pb-5">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={aptSeriesFormatted} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} width={32} axisLine={false} tickLine={false} />
                <Tooltip content={<AptTooltip />} />
                <Bar dataKey="total" name="Total" radius={[4, 4, 0, 0]} fill="#2563eb" fillOpacity={0.85} />
                <Bar dataKey="completed" name="Completed" radius={[4, 4, 0, 0]} fill="#14b8a6" fillOpacity={0.9} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

    </div>
  );
}

