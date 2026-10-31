import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Search, Plus, Eye, Loader2, RefreshCw, Filter, LayoutGrid, List,
  Tag, Users, Trash2, Download, ChevronUp, ChevronDown, X,
  UserCheck, UserX, Clock, CalendarDays,
} from 'lucide-react';
import { StatusBadge } from '../../components/ui/Badge';
import { formatDate } from '../../utils/formatters';
import EmptyState from '../../components/ui/EmptyState';
import { ConfirmModal } from '../../components/ui/Modal';
import { api } from '../../utils/api';
import { useAuth } from '../../hooks/useAuth';
import { useDispatch } from 'react-redux';
import { addToast } from '../../app/store';

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'new', label: 'New' },
  { value: 'follow_up', label: 'Follow-up' },
  { value: 'completed', label: 'Completed' },
  { value: 'inactive', label: 'Inactive' },
];

const SORT_FIELDS = [
  { value: 'registeredAt', label: 'Date Registered' },
  { value: 'name', label: 'Name' },
  { value: 'lastVisit', label: 'Last Visit' },
  { value: 'nextFollowUp', label: 'Next Follow-up' },
];

function StatCard({ label, value, icon: Icon, color = 'text-[var(--color-primary-600)]', bg = 'bg-[var(--color-primary-50)]' }) {
  return (
    <div className="card p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}>
        <Icon size={18} className={color} />
      </div>
      <div>
        <p className="text-xs text-[var(--color-text-muted)] font-medium">{label}</p>
        <p className="text-xl font-bold text-[var(--color-text)] leading-tight">{value}</p>
      </div>
    </div>
  );
}

function SortHeader({ label, field, sortBy, sortOrder, onSort }) {
  const active = sortBy === field;
  return (
    <button
      onClick={() => onSort(field)}
      className="flex items-center gap-1 text-left font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
    >
      {label}
      {active ? (
        sortOrder === 'asc' ? <ChevronUp size={13} /> : <ChevronDown size={13} />
      ) : (
        <ChevronDown size={13} className="opacity-30" />
      )}
    </button>
  );
}

export default function PatientsPage() {
  const { role } = useAuth();
  const dispatch = useDispatch();
  const [searchParams, setSearchParams] = useSearchParams();

  const [viewMode, setViewMode] = useState('list');
  const [patients, setPatients] = useState([]);
  const [categories, setCategories] = useState([]);
  const [stats, setStats] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 1 });
  const [searchInput, setSearchInput] = useState(searchParams.get('q') || '');
  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const [categoryFilter, setCategoryFilter] = useState(searchParams.get('categoryId') || '');
  const [sortBy, setSortBy] = useState('registeredAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [exporting, setExporting] = useState(false);
  const debounceRef = useRef(null);

  // Load categories once
  useEffect(() => {
    api.getCategories({ status: 'active' })
      .then(res => setCategories(res.data || []))
      .catch(() => {});
  }, []);

  // Load real-data stats from API — combines dashboard totals + per-status counts
  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const [dashRes, inactiveRes, followRes] = await Promise.allSettled([
        api.getDashboardStatsEnhanced({ dateFrom: '', dateTo: '' }),
        api.getPatients({ status: 'inactive', limit: 1 }),
        api.getPatients({ status: 'follow_up', limit: 1 }),
      ]);

      const d = dashRes.status === 'fulfilled' ? (dashRes.value?.data || dashRes.value) : {};
      const inactiveTot = inactiveRes.status === 'fulfilled' ? (inactiveRes.value?.data?.pagination?.total ?? 0) : 0;
      const followTot = followRes.status === 'fulfilled' ? (followRes.value?.data?.pagination?.total ?? 0) : 0;
      const total = d.totalPatients ?? 0;

      setStats({
        total,
        newThisMonth: d.newPatientsInPeriod ?? 0,
        active: Math.max(0, total - inactiveTot),
        inactive: inactiveTot,
        followUp: followTot,
      });
    } catch { /* silently fail */ }
    finally { setStatsLoading(false); }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const fetchPatients = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        search,
        sortBy,
        sortOrder,
        page,
        limit: 50,
      };
      if (statusFilter) params.status = statusFilter;
      if (categoryFilter) params.categoryId = categoryFilter;

      const res = await api.getPatients(params);
      const result = res?.data;
      const list = result?.data ?? (Array.isArray(result) ? result : []);
      const pag = result?.pagination;

      setPatients(list);
      setPagination(pag || { page, limit: 50, total: list.length, totalPages: 1 });
    } catch (err) {
      dispatch(addToast({ type: 'error', title: 'Load Failed', message: err.message || 'Failed to load patients.' }));
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, categoryFilter, sortBy, sortOrder, page]);

  useEffect(() => { fetchPatients(); }, [fetchPatients]);

  // Listen for patient_data_updated events (e.g., after registration)
  useEffect(() => {
    const handler = () => fetchPatients();
    window.addEventListener('ddc_patient_data_updated', handler);
    window.addEventListener('focus', handler);
    const interval = setInterval(handler, 15000);
    return () => {
      window.removeEventListener('ddc_patient_data_updated', handler);
      window.removeEventListener('focus', handler);
      clearInterval(interval);
    };
  }, [fetchPatients]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [searchInput]);

  // Sync URL params → state
  useEffect(() => {
    const catParam = searchParams.get('categoryId') || '';
    const statusParam = searchParams.get('status') || '';
    if (catParam !== categoryFilter) { setCategoryFilter(catParam); setPage(1); }
    if (statusParam !== statusFilter) { setStatusFilter(statusParam); setPage(1); }
  }, [searchParams]);

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(o => o === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
    setPage(1);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    const p = deleteTarget;
    setDeleteTarget(null);
    try {
      await api.deletePatient(p.id);
      dispatch(addToast({ type: 'success', title: 'Patient Deleted', message: `"${p.name}" has been removed.` }));
      fetchPatients();
      fetchStats();
      window.dispatchEvent(new CustomEvent('ddc_patient_data_updated', { detail: { action: 'delete', patientId: p.id } }));
    } catch (err) {
      dispatch(addToast({ type: 'error', title: 'Delete Failed', message: err.message }));
    }
  };

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const res = await api.getPatients({ search, status: statusFilter, categoryId: categoryFilter, limit: 2000, sortBy, sortOrder });
      const result = res?.data;
      const list = result?.data ?? (Array.isArray(result) ? result : []);
      if (!list.length) { dispatch(addToast({ type: 'info', title: 'No Data', message: 'No patients to export.' })); return; }

      const headers = ['Patient ID', 'Name', 'Phone', 'Email', 'Gender', 'Age', 'Blood Group', 'Status', 'Category', 'Registered At', 'Last Visit', 'Next Follow-up', 'Total Visits'];
      const rows = list.map(p => [
        p.patientId || '',
        `"${(p.name || '').replace(/"/g, '""')}"`,
        p.phone || '',
        p.email || '',
        p.gender || '',
        p.age || '',
        p.bloodGroup || '',
        p.status || '',
        `"${(p.treatmentCategoryName || '').replace(/"/g, '""')}"`,
        p.registeredAt ? new Date(p.registeredAt).toLocaleDateString('en-IN') : '',
        p.lastVisit ? new Date(p.lastVisit).toLocaleDateString('en-IN') : '',
        p.nextFollowUp ? new Date(p.nextFollowUp).toLocaleDateString('en-IN') : '',
        p.totalVisits || 0,
      ]);

      const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `patients_export_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      dispatch(addToast({ type: 'success', title: 'Export Ready', message: `${list.length} patients exported.` }));
    } catch (err) {
      dispatch(addToast({ type: 'error', title: 'Export Failed', message: err.message }));
    } finally {
      setExporting(false);
    }
  };

  const clearFilters = () => {
    setSearchInput('');
    setSearch('');
    setStatusFilter('');
    setCategoryFilter('');
    setPage(1);
    setSearchParams({});
  };

  const hasActiveFilters = search || statusFilter || categoryFilter;
  const activeCategoryObj = categories.find(c => c.id === categoryFilter);

  // Use API-sourced patient status counts (accurate totals from DB)
  const activeCount = statsLoading ? 0 : (stats?.active ?? 0);
  const inactiveCount = statsLoading ? 0 : (stats?.inactive ?? 0);
  const followUpCount = statsLoading ? 0 : (stats?.followUp ?? 0);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-text)]">
            {activeCategoryObj ? `${activeCategoryObj.name} Patients` : 'Patient Management'}
          </h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            {loading ? 'Loading…' : `${pagination.total.toLocaleString('en-IN')} patients`}
            {activeCategoryObj && (
              <button
                onClick={() => { setCategoryFilter(''); setSearchParams({}); }}
                className="ml-2 text-xs text-[var(--color-primary-500)] underline"
              >
                Clear filter
              </button>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex gap-1 bg-[var(--color-bg-subtle)] p-1 rounded-lg">
            <button
              onClick={() => setViewMode('list')}
              title="Table View"
              className={`p-1.5 rounded text-sm transition-colors ${viewMode === 'list' ? 'bg-white shadow text-[var(--color-primary-600)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'}`}
            >
              <List size={16} />
            </button>
            <button
              onClick={() => setViewMode('category-grid')}
              title="Category View"
              className={`p-1.5 rounded text-sm transition-colors ${viewMode === 'category-grid' ? 'bg-white shadow text-[var(--color-primary-600)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'}`}
            >
              <LayoutGrid size={16} />
            </button>
          </div>

          <button
            onClick={handleExportCSV}
            disabled={exporting}
            className="btn btn-secondary btn-sm flex items-center gap-1.5"
            title="Export to CSV"
          >
            {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            Export
          </button>

          {(role === 'receptionist' || role === 'admin') && (
            <Link
              to={categoryFilter ? `/receptionist/register?categoryId=${categoryFilter}` : '/receptionist/register'}
              className="btn btn-primary btn-sm flex items-center gap-1"
            >
              <Plus size={13} /> Register Patient
            </Link>
          )}
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="Total Patients"
          value={statsLoading ? '…' : (stats?.total ?? 0).toLocaleString('en-IN')}
          icon={Users}
          color="text-[var(--color-primary-600)]"
          bg="bg-[var(--color-primary-50)]"
        />
        <StatCard
          label="Active / Follow-up"
          value={statsLoading ? '…' : activeCount.toLocaleString('en-IN')}
          icon={UserCheck}
          color="text-emerald-600"
          bg="bg-emerald-50"
        />
        <StatCard
          label="Inactive"
          value={statsLoading ? '…' : inactiveCount.toLocaleString('en-IN')}
          icon={UserX}
          color="text-slate-500"
          bg="bg-slate-100"
        />
        <StatCard
          label="Follow-up Patients"
          value={statsLoading ? '…' : followUpCount.toLocaleString('en-IN')}
          icon={Clock}
          color="text-violet-600"
          bg="bg-violet-50"
        />
      </div>

      {/* Category Grid Mode */}
      {viewMode === 'category-grid' ? (
        <div className="space-y-4">
          <p className="text-sm text-[var(--color-text-muted)] font-medium">Select a Treatment Category to view its patients:</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {categories.map(cat => {
              const isSelected = categoryFilter === cat.id;
              return (
                <div
                  key={cat.id}
                  onClick={() => {
                    setCategoryFilter(isSelected ? '' : cat.id);
                    setSearchParams(isSelected ? {} : { categoryId: cat.id });
                    setViewMode('list');
                  }}
                  className={`card p-5 cursor-pointer hover:shadow-md transition-all border-2 ${isSelected ? 'border-[var(--color-primary-500)] bg-[var(--color-primary-50)]' : 'border-transparent hover:border-[var(--color-border)]'}`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-[var(--color-primary-100)] text-[var(--color-primary-700)]">
                      {cat.code}
                    </span>
                    <span className="text-xs text-[var(--color-text-muted)]">{cat.defaultDurationMinutes} min</span>
                  </div>
                  <h3 className="font-semibold text-[var(--color-text)] text-base mb-1">{cat.name}</h3>
                  <p className="text-xs text-[var(--color-text-muted)] mb-3">
                    Follow-up: {cat.defaultFollowUpDays === 0 ? 'None' : `${cat.defaultFollowUpDays} days`}
                  </p>
                  <div className="flex items-center justify-between pt-3 border-t border-[var(--color-border)] text-xs text-[var(--color-primary-600)] font-medium">
                    <span className="flex items-center gap-1"><Users size={13} /> View Patients</span>
                    <Link
                      to={`/receptionist/register?categoryId=${cat.id}`}
                      onClick={e => e.stopPropagation()}
                      className="hover:underline font-semibold flex items-center gap-0.5 text-[var(--color-primary-700)] bg-[var(--color-primary-50)] px-2 py-0.5 rounded"
                    >
                      + Register
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <>
          {/* Filters */}
          <div className="card p-3 flex flex-wrap gap-3 items-center">
            {/* Search */}
            <div className="flex items-center gap-2 flex-1 min-w-48 bg-[var(--color-bg-subtle)] px-3 py-2 rounded-lg">
              <Search size={15} className="text-[var(--color-text-muted)] shrink-0" />
              <input
                type="search"
                id="patient-search"
                placeholder="Search by name, ID, or phone…"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                className="flex-1 text-sm bg-transparent outline-none text-[var(--color-text)] placeholder:text-[var(--color-text-subtle)]"
              />
              {searchInput && (
                <button onClick={() => { setSearchInput(''); }} className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Category filter */}
            <select
              id="patient-category-filter"
              value={categoryFilter}
              onChange={e => {
                const val = e.target.value;
                setCategoryFilter(val);
                setSearchParams(val ? { categoryId: val } : {});
                setPage(1);
              }}
              className="form-select text-sm"
              style={{ height: '36px', width: 'auto', minWidth: '140px' }}
            >
              <option value="">All Categories</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>

            {/* Status filter */}
            <select
              id="patient-status-filter"
              value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
              className="form-select text-sm"
              style={{ height: '36px', width: 'auto', minWidth: '130px' }}
            >
              {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>

            {/* Sort */}
            <select
              id="patient-sort"
              value={`${sortBy}:${sortOrder}`}
              onChange={e => {
                const [f, o] = e.target.value.split(':');
                setSortBy(f); setSortOrder(o); setPage(1);
              }}
              className="form-select text-sm"
              style={{ height: '36px', width: 'auto', minWidth: '150px' }}
            >
              {SORT_FIELDS.map(o => (
                <>
                  <option key={`${o.value}:desc`} value={`${o.value}:desc`}>{o.label} ↓</option>
                  <option key={`${o.value}:asc`} value={`${o.value}:asc`}>{o.label} ↑</option>
                </>
              ))}
            </select>

            <button
              onClick={fetchPatients}
              className="btn btn-outline btn-sm flex items-center gap-1 p-2"
              title="Refresh"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>

            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-xs text-[var(--color-primary-600)] underline hover:text-[var(--color-primary-700)]"
              >
                Clear all filters
              </button>
            )}
          </div>

          {/* Table */}
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[var(--color-bg-subtle)] border-b border-[var(--color-border)]">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-[var(--color-text-muted)] whitespace-nowrap">
                      <SortHeader label="Patient ID" field="patientId" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-[var(--color-text-muted)] whitespace-nowrap">
                      <SortHeader label="Name" field="name" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-[var(--color-text-muted)] whitespace-nowrap">Phone</th>
                    <th className="text-left px-4 py-3 font-medium text-[var(--color-text-muted)] whitespace-nowrap">Gender / Age</th>
                    <th className="text-left px-4 py-3 font-medium text-[var(--color-text-muted)] whitespace-nowrap">Treatment Category</th>
                    <th className="text-left px-4 py-3 font-medium text-[var(--color-text-muted)] whitespace-nowrap">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-[var(--color-text-muted)] whitespace-nowrap">
                      <SortHeader label="Last Visit" field="lastVisit" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-[var(--color-text-muted)] whitespace-nowrap">
                      <SortHeader label="Next Follow-up" field="nextFollowUp" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-[var(--color-text-muted)] whitespace-nowrap">
                      <SortHeader label="Registered" field="registeredAt" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
                    </th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 8 }).map((_, i) => (
                      <tr key={i} className="border-b border-[var(--color-border)]">
                        {Array.from({ length: 10 }).map((_, j) => (
                          <td key={j} className="px-4 py-3">
                            <div className="h-4 bg-[var(--color-border)] rounded animate-pulse" />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : patients.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-16 text-center">
                        <EmptyState
                          icon={Users}
                          title={hasActiveFilters ? 'No patients match your filters' : 'No patients found'}
                          description={hasActiveFilters ? 'Try clearing your search or filters.' : 'Register a patient to get started.'}
                        />
                      </td>
                    </tr>
                  ) : (
                    patients.map((p) => (
                      <tr
                        key={p.id}
                        className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-bg-subtle)] transition-colors group"
                      >
                        <td className="px-4 py-3 font-mono text-xs text-[var(--color-text-muted)]">{p.patientId || '—'}</td>
                        <td className="px-4 py-3 font-medium text-[var(--color-text)]">
                          <Link
                            to={`/${role}/patients/${p.id}`}
                            className="hover:text-[var(--color-primary-600)] hover:underline"
                          >
                            {p.name}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-[var(--color-text-muted)]">{p.phone || '—'}</td>
                        <td className="px-4 py-3 text-[var(--color-text-muted)] capitalize">
                          {[p.gender, p.age ? `${p.age}y` : null].filter(Boolean).join(' · ') || '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
                            <Tag size={11} />
                            {p.treatmentCategoryName || p.categoryName || 'General Consultation'}
                          </span>
                        </td>
                        <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                        <td className="px-4 py-3 text-[var(--color-text-muted)] text-xs">{p.lastVisit ? formatDate(p.lastVisit) : '—'}</td>
                        <td className="px-4 py-3 text-[var(--color-text-muted)] text-xs">
                          {p.nextFollowUp ? (
                            <span className={new Date(p.nextFollowUp) < new Date() ? 'text-rose-500 font-medium' : ''}>
                              {formatDate(p.nextFollowUp)}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3 text-[var(--color-text-muted)] text-xs">{p.registeredAt ? formatDate(p.registeredAt) : '—'}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Link to={`/${role}/patients/${p.id}`} className="btn btn-outline btn-xs flex items-center gap-1">
                              <Eye size={13} /> View
                            </Link>
                            {role === 'admin' && (
                              <button
                                onClick={() => setDeleteTarget(p)}
                                className="btn btn-ghost btn-xs text-rose-500 hover:text-rose-700 hover:bg-rose-50 p-1.5 rounded-lg transition-colors cursor-pointer"
                                title="Delete Patient"
                                id={`delete-patient-${p.id}`}
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {!loading && pagination.totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--color-border)] text-sm">
                <span className="text-[var(--color-text-muted)]">
                  Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="btn btn-secondary btn-xs"
                  >
                    ← Prev
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                    disabled={page >= pagination.totalPages}
                    className="btn btn-secondary btn-xs"
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Delete Confirmation */}
      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Patient Record"
        message={`Are you sure you want to permanently delete "${deleteTarget?.name || 'this patient'}"? All associated appointments will also be cancelled. This action cannot be undone.`}
        confirmLabel="Delete Patient"
        variant="danger"
      />
    </div>
  );
}

