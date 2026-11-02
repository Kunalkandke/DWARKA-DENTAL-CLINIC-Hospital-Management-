import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Phone, Mail, MapPin, User, Calendar, FileText,
  Pill, Trash2, DollarSign, PlusCircle, CreditCard, Edit3,
  Activity, CalendarPlus, RefreshCw, AlertCircle, CheckCircle2,
  Clock, TrendingUp, Wallet, Receipt, ChevronDown, ChevronUp,
  Eye, Printer, MoreVertical, Ban, IndianRupee, BadgeCheck,
  HeartPulse, FlaskConical, UserCheck, Stethoscope, X, Save,
  ShieldAlert, RotateCcw,
} from 'lucide-react';
import { StatusBadge } from '../../components/ui/Badge';
import Avatar from '../../components/ui/Avatar';
import { formatDate, formatCurrency, today } from '../../utils/formatters';
import EmptyState from '../../components/ui/EmptyState';
import { ConfirmModal } from '../../components/ui/Modal';
import Modal from '../../components/ui/Modal';
import { api } from '../../utils/api';
import { useDispatch, useSelector } from 'react-redux';
import { addToast } from '../../app/store';
import DentalChart from '../../components/clinical/DentalChart';
import BookAppointmentModal from '../../components/common/BookAppointmentModal';

// ─── Tab definitions ─────────────────────────────────────────────────────────
const TABS = [
  { id: 'overview',      label: 'Overview',        icon: User },
  { id: 'appointments',  label: 'Appointments',     icon: Calendar },
  { id: 'clinical',      label: 'Clinical History', icon: FileText },
  { id: 'odontogram',    label: 'Dental Chart',     icon: Activity },
  { id: 'billing',       label: 'Billing & Payments', icon: DollarSign },
];

// ─── Payment type colours ─────────────────────────────────────────────────────
const TYPE_STYLES = {
  advance:    'bg-blue-50 text-blue-700 border-blue-200',
  payment:    'bg-emerald-50 text-emerald-700 border-emerald-200',
  partial:    'bg-amber-50 text-amber-700 border-amber-200',
  settlement: 'bg-violet-50 text-violet-700 border-violet-200',
  refund:     'bg-rose-50 text-rose-700 border-rose-200',
};
const TYPE_LABELS = {
  advance: 'Advance',
  payment: 'Payment',
  partial: 'Partial',
  settlement: 'Settlement',
  refund: 'Refund',
};

// ─── Invoice status colours ───────────────────────────────────────────────────
const INV_STATUS_STYLES = {
  draft:          'bg-slate-100 text-slate-600 border-slate-300',
  issued:         'bg-blue-50 text-blue-700 border-blue-200',
  partially_paid: 'bg-amber-50 text-amber-700 border-amber-200',
  paid:           'bg-emerald-50 text-emerald-700 border-emerald-200',
  cancelled:      'bg-rose-50 text-rose-600 border-rose-200',
};
const INV_STATUS_LABELS = {
  draft: 'Draft', issued: 'Unpaid', partially_paid: 'Partial', paid: 'Paid', cancelled: 'Cancelled',
};

// ─── Tiny helpers ─────────────────────────────────────────────────────────────
function SummaryCard({ label, value, sub, color = 'emerald', icon: Icon }) {
  const colors = {
    emerald: 'border-emerald-500 bg-emerald-50 text-emerald-700',
    amber:   'border-amber-500 bg-amber-50 text-amber-700',
    rose:    'border-rose-500 bg-rose-50 text-rose-700',
    blue:    'border-blue-500 bg-blue-50 text-blue-700',
    violet:  'border-violet-500 bg-violet-50 text-violet-700',
    slate:   'border-slate-400 bg-slate-50 text-slate-600',
  };
  const cls = colors[color] || colors.slate;
  return (
    <div className={`rounded-xl border-l-4 p-4 ${cls.split(' ').slice(0,2).join(' ')} border flex gap-3 items-start`}>
      {Icon && <div className={`mt-0.5 ${cls.split(' ')[2]}`}><Icon size={18} /></div>}
      <div>
        <p className="text-xs font-medium text-[var(--color-text-muted)]">{label}</p>
        <p className={`text-xl font-bold mt-0.5 ${cls.split(' ')[2]}`}>{value}</p>
        {sub && <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function InfoRow({ label, value, highlight }) {
  return (
    <div className="flex items-start gap-2 py-1.5">
      <span className="text-xs text-[var(--color-text-muted)] w-36 shrink-0 mt-0.5">{label}</span>
      <span className={`text-sm font-medium flex-1 ${highlight ? 'text-amber-600' : 'text-[var(--color-text)]'}`}>
        {value || <span className="text-[var(--color-text-subtle)] font-normal">—</span>}
      </span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function PatientDetailPage({ basePath = '/admin' }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const currentUserRole = useSelector(state => state.auth.role);
  const currentUser = useSelector(state => state.auth.user);
  const isAdmin = currentUserRole === 'admin';
  const canEdit = isAdmin || currentUserRole === 'receptionist';

  const [activeTab, setActiveTab]     = useState('overview');
  const [patient, setPatient]         = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [records, setRecords]         = useState([]);
  const [payments, setPayments]       = useState([]);
  const [invoices, setInvoices]       = useState([]);
  const [financial, setFinancial]     = useState(null);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [bookAptOpen, setBookAptOpen] = useState(false);
  const [chartSaving, setChartSaving] = useState(false);

  // Edit patient modal
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [editForm, setEditForm] = useState({
    name: '', phone: '', age: '', gender: 'male', bloodGroup: 'O+',
    email: '', address: '', chiefComplaint: '', allergies: 'None', medicalHistory: 'None',
  });

  // Payment modal
  const [payModal, setPayModal]   = useState(false);
  const [payForm, setPayForm]     = useState({
    amount: '', mode: 'UPI', paymentType: 'payment',
    invoiceId: '', notes: '', date: today(), transactionRef: '',
  });
  const [payLoading, setPayLoading] = useState(false);

  // Edit payment modal
  const [editPayModal, setEditPayModal]   = useState(false);
  const [editPayTarget, setEditPayTarget] = useState(null);
  const [editPayForm, setEditPayForm]     = useState({});
  const [editPayLoading, setEditPayLoading] = useState(false);

  // Invoice modal
  const [invModal, setInvModal]   = useState(false);
  const [invForm, setInvForm]     = useState({
    description: '', discount: '0', dueDate: '',
    items: [{ description: '', quantity: 1, unitPrice: '' }],
  });
  const [invLoading, setInvLoading] = useState(false);

  // Delete payment confirm
  const [deletePayTarget, setDeletePayTarget] = useState(null);
  const [deletingPay, setDeletingPay]         = useState(false);

  // Receipt modal
  const [receiptPay, setReceiptPay] = useState(null);

  // Invoice detail expand
  const [expandedInv, setExpandedInv] = useState(null);

  // ── Data loading ──────────────────────────────────────────────────────────
  // Dedicated appointment fetch — always works, called independently
  const fetchAppointments = useCallback(async () => {
    if (!id) return;
    try {
      const res = await api.getAppointmentsByPatient(id);
      const d = res?.data;
      setAppointments(Array.isArray(d) ? d : (d?.appointments || d?.data || []));
    } catch (err) {
      console.error('[PatientDetail] Appointment fetch failed:', err.message);
    }
  }, [id]);

  const loadAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const [patRes, aptsRes, recsRes, paysRes, invsRes, finRes] = await Promise.allSettled([
        api.getPatient(id),
        api.getAppointmentsByPatient(id),
        api.getClinicalRecords(id).catch(() => null),
        api.getPaymentsByPatient(id),
        api.getInvoicesByPatient(id).catch(() => null),
        api.getPatientInvoiceSummary(id).catch(() => null),
      ]);

      if (patRes.status === 'fulfilled') {
        setPatient(patRes.value?.data?.patient || patRes.value?.data || null);
      }
      if (aptsRes.status === 'fulfilled') {
        const d = aptsRes.value?.data;
        setAppointments(Array.isArray(d) ? d : (d?.appointments || d?.data || []));
      }
      if (recsRes.status === 'fulfilled' && recsRes.value) {
        const d = recsRes.value;
        setRecords(Array.isArray(d) ? d : (d?.data || []));
      }
      if (paysRes.status === 'fulfilled') {
        const d = paysRes.value?.data;
        setPayments(Array.isArray(d?.payments) ? d.payments : (Array.isArray(d) ? d : []));
      }
      if (invsRes.status === 'fulfilled' && invsRes.value) {
        const d = invsRes.value?.data;
        setInvoices(Array.isArray(d?.invoices) ? d.invoices : (Array.isArray(d) ? d : []));
      }
      if (finRes.status === 'fulfilled' && finRes.value) {
        const d = finRes.value?.data;
        setFinancial(d?.summary || d || null);
      }
    } catch (err) {
      dispatch(addToast({ type: 'error', title: 'Load Error', message: err.message }));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id, dispatch]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Listen for cross-panel updates
  useEffect(() => {
    const handler = () => loadAll(true);
    window.addEventListener('ddc_patient_data_updated', handler);
    window.addEventListener('ddc_payment_updated', handler);
    window.addEventListener('ddc_invoice_updated', handler);
    return () => {
      window.removeEventListener('ddc_patient_data_updated', handler);
      window.removeEventListener('ddc_payment_updated', handler);
      window.removeEventListener('ddc_invoice_updated', handler);
    };
  }, [loadAll]);

  // ── Derived financial values ──────────────────────────────────────────────
  const totalBilled     = financial?.totalBilled     ?? invoices.reduce((s, i) => s + (i.totalAmount || 0), 0);
  const totalPaid       = financial?.totalPaid       ?? payments.filter(p => !p.isDeleted).reduce((s, p) => s + p.amount, 0);
  const outstanding     = financial?.outstandingBalance ?? Math.max(0, totalBilled - totalPaid);
  const advanceBalance  = financial?.advanceAvailable ?? payments.filter(p => p.paymentType === 'advance' && !p.isDeleted).reduce((s, p) => s + p.amount, 0);
  const lastPay         = payments.filter(p => !p.isDeleted).sort((a, b) => new Date(b.date) - new Date(a.date))[0];
  const unpaidInvoices  = invoices.filter(i => ['issued', 'partially_paid'].includes(i.status));

  // ── Edit patient ──────────────────────────────────────────────────────────
  function openEditModal() {
    if (!patient) return;
    setEditForm({
      name: patient.name || '',
      phone: patient.phone || '',
      age: patient.age || '',
      gender: (patient.gender || 'male').toLowerCase(),
      bloodGroup: patient.bloodGroup || 'O+',
      email: patient.email || '',
      address: patient.address || '',
      chiefComplaint: patient.chiefComplaint || '',
      allergies: patient.allergies || 'None',
      medicalHistory: patient.medicalHistory || 'None',
    });
    setEditOpen(true);
  }

  async function handleEditSubmit(e) {
    e.preventDefault();
    const cleanPhone = (editForm.phone || '').replace(/\D/g, '');
    if (!editForm.name.trim() || !editForm.phone.trim()) {
      dispatch(addToast({ type: 'error', title: 'Required', message: 'Name and Phone are required.' }));
      return;
    }
    if (cleanPhone.length !== 10) {
      dispatch(addToast({ type: 'error', title: 'Invalid Phone', message: 'Phone number must be exactly 10 digits.' }));
      return;
    }
    setSaving(true);
    try {
      await api.updatePatient(id, {
        name: editForm.name.trim(),
        phone: editForm.phone.trim(),
        age: Number(editForm.age),
        gender: editForm.gender,
        bloodGroup: editForm.bloodGroup,
        email: editForm.email.trim(),
        address: editForm.address.trim(),
        chiefComplaint: editForm.chiefComplaint.trim(),
        allergies: editForm.allergies.trim(),
        medicalHistory: editForm.medicalHistory.trim(),
      });
      dispatch(addToast({ type: 'success', title: 'Profile Updated', message: 'Patient details saved.' }));
      setEditOpen(false);
      loadAll(true);
      window.dispatchEvent(new CustomEvent('ddc_patient_data_updated', { detail: { action: 'update', patientId: id } }));
    } catch (err) {
      dispatch(addToast({ type: 'error', title: 'Update Failed', message: err.message }));
    } finally {
      setSaving(false);
    }
  }

  // ── Add payment ───────────────────────────────────────────────────────────
  function openPayModal(invoiceId = '') {
    setPayForm({
      amount: '',
      mode: 'UPI',
      paymentType: invoiceId ? 'payment' : 'advance',
      invoiceId,
      notes: '',
      date: today(),
      transactionRef: '',
    });
    setPayModal(true);
  }

  async function handlePaySubmit(e) {
    e.preventDefault();
    const amount = parseFloat(payForm.amount);
    if (!amount || amount <= 0) {
      dispatch(addToast({ type: 'error', title: 'Invalid', message: 'Enter a valid amount.' }));
      return;
    }
    setPayLoading(true);
    try {
      await api.addPayment({
        patientId: id,
        invoiceId: payForm.invoiceId || undefined,
        amount,
        mode: payForm.mode,
        paymentType: payForm.paymentType,
        notes: payForm.notes,
        date: payForm.date,
        transactionRef: payForm.transactionRef,
      });
      dispatch(addToast({ type: 'success', title: 'Payment Recorded', message: `₹${amount.toLocaleString('en-IN')} saved successfully.` }));
      setPayModal(false);
      loadAll(true);
      window.dispatchEvent(new CustomEvent('ddc_payment_updated', { detail: { patientId: id } }));
    } catch (err) {
      dispatch(addToast({ type: 'error', title: 'Payment Failed', message: err.message }));
    } finally {
      setPayLoading(false);
    }
  }

  // ── Edit payment ──────────────────────────────────────────────────────────
  function openEditPayModal(pay) {
    setEditPayTarget(pay);
    setEditPayForm({
      amount: pay.amount,
      mode: pay.mode,
      notes: pay.notes || '',
      date: pay.date?.split('T')[0] || today(),
      transactionRef: pay.transactionRef || '',
    });
    setEditPayModal(true);
  }

  async function handleEditPaySubmit(e) {
    e.preventDefault();
    if (!editPayTarget) return;
    setEditPayLoading(true);
    try {
      await api.editPayment(editPayTarget.id, {
        amount: isAdmin ? parseFloat(editPayForm.amount) : undefined,
        mode: editPayForm.mode,
        notes: editPayForm.notes,
        date: editPayForm.date,
        transactionRef: editPayForm.transactionRef,
      });
      dispatch(addToast({ type: 'success', title: 'Payment Updated', message: 'Transaction details saved.' }));
      setEditPayModal(false);
      loadAll(true);
      window.dispatchEvent(new CustomEvent('ddc_payment_updated', { detail: { patientId: id } }));
    } catch (err) {
      dispatch(addToast({ type: 'error', title: 'Update Failed', message: err.message }));
    } finally {
      setEditPayLoading(false);
    }
  }

  // ── Delete payment ────────────────────────────────────────────────────────
  async function handleDeletePay() {
    if (!deletePayTarget) return;
    setDeletingPay(true);
    try {
      await api.deletePayment(deletePayTarget.id);
      dispatch(addToast({ type: 'success', title: 'Payment Voided', message: 'Transaction removed from ledger.' }));
      setDeletePayTarget(null);
      loadAll(true);
      window.dispatchEvent(new CustomEvent('ddc_payment_updated', { detail: { patientId: id } }));
    } catch (err) {
      dispatch(addToast({ type: 'error', title: 'Delete Failed', message: err.message }));
    } finally {
      setDeletingPay(false);
    }
  }

  // ── Create invoice ────────────────────────────────────────────────────────
  function openInvModal() {
    setInvForm({ description: '', discount: '0', dueDate: '', items: [{ description: '', quantity: 1, unitPrice: '' }] });
    setInvModal(true);
  }

  async function handleInvSubmit(e) {
    e.preventDefault();
    const validItems = invForm.items.filter(i => i.description.trim() && parseFloat(i.unitPrice) > 0);
    if (!validItems.length) {
      dispatch(addToast({ type: 'error', title: 'No Items', message: 'Add at least one treatment item with a valid price.' }));
      return;
    }
    setInvLoading(true);
    try {
      await api.createInvoice({
        patientId: id,
        description: invForm.description,
        discount: parseFloat(invForm.discount) || 0,
        dueDate: invForm.dueDate || undefined,
        items: validItems.map(i => ({
          description: i.description,
          quantity: parseInt(i.quantity) || 1,
          unitPrice: parseFloat(i.unitPrice),
        })),
      });
      dispatch(addToast({ type: 'success', title: 'Invoice Created', message: 'Invoice has been issued.' }));
      setInvModal(false);
      loadAll(true);
      window.dispatchEvent(new CustomEvent('ddc_invoice_updated', { detail: { patientId: id } }));
    } catch (err) {
      dispatch(addToast({ type: 'error', title: 'Invoice Failed', message: err.message }));
    } finally {
      setInvLoading(false);
    }
  }

  // ── Loading/Error states ──────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <RefreshCw size={28} className="animate-spin text-[var(--color-primary-500)] mb-3" />
        <p className="text-sm text-[var(--color-text-muted)]">Loading patient profile…</p>
      </div>
    );
  }
  if (!patient) {
    return (
      <div className="animate-fade-in">
        <EmptyState icon={User} title="Patient not found" description="This patient record doesn't exist or was removed." />
        <div className="mt-4 text-center">
          <button onClick={() => navigate(-1)} className="btn btn-primary btn-sm">Go Back</button>
        </div>
      </div>
    );
  }

  const rolePath = currentUserRole === 'receptionist' ? '/receptionist' : currentUserRole === 'doctor' ? '/doctor' : (basePath || '/admin');
  const assignedDoctorName = patient?.doctorName || patient?.assigned_doctor?.name || '—';
  const completedApts = appointments.filter(a => a.status === 'completed').length;
  const upcomingApts  = appointments.filter(a => ['scheduled', 'confirmed'].includes(a.status)).length;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Back + refresh */}
      <div className="flex items-center justify-between">
        <Link to={`${rolePath}/patients`} className="inline-flex items-center gap-2 text-sm font-medium text-[var(--color-primary-600)] hover:underline">
          <ArrowLeft size={15} /> Back to Patients
        </Link>
        <button
          onClick={() => loadAll(true)}
          disabled={refreshing}
          className="btn btn-outline btn-xs flex items-center gap-1.5"
          title="Refresh patient data"
        >
          <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {/* ── Patient Header ─────────────────────────────────────────────── */}
      <div className="card p-6 bg-white border border-[var(--color-border)] rounded-xl shadow-sm">
        <div className="flex flex-wrap items-start gap-5">
          <Avatar name={patient.name} size="xl" />
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-2xl font-bold text-[var(--color-text)]">{patient.name}</h1>
                  <StatusBadge status={patient.status} />
                </div>
                <p className="text-sm text-[var(--color-text-muted)] font-mono mt-0.5">
                  {patient.patientId || patient.patient_number}
                </p>
              </div>
              {/* Action buttons */}
              <div className="flex flex-wrap items-center gap-2">
                {canEdit && (
                  <button
                    onClick={() => setBookAptOpen(true)}
                    className="btn btn-outline btn-xs flex items-center gap-1.5 text-emerald-600 border-emerald-200 hover:bg-emerald-50 font-semibold"
                  >
                    <CalendarPlus size={13} /> Book Appointment
                  </button>
                )}
                {canEdit && (
                  <button
                    onClick={openEditModal}
                    className="btn btn-outline btn-xs flex items-center gap-1.5 text-[var(--color-primary-600)] border-[var(--color-primary-200)] hover:bg-[var(--color-primary-50)] font-semibold"
                  >
                    <Edit3 size={13} /> Edit Details
                  </button>
                )}
                {canEdit && (
                  <button
                    onClick={() => { setActiveTab('billing'); openPayModal(); }}
                    className="btn btn-xs flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white font-semibold"
                  >
                    <IndianRupee size={13} /> Add Payment
                  </button>
                )}
              </div>
            </div>

            {/* Key stats row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mt-3 text-sm">
              {[
                { label: 'Age / Gender', value: `${patient.age || '—'} yrs · ${patient.gender ? patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1) : '—'}` },
                { label: 'Blood Group', value: patient.bloodGroup || '—' },
                { label: 'Phone', value: patient.phone || '—' },
                { label: 'Registered', value: patient.registeredAt ? formatDate(patient.registeredAt) : '—' },
                { label: 'Total Visits', value: (patient.totalVisits || completedApts || 0).toString() },
                { label: 'Doctor', value: assignedDoctorName },
              ].map(item => (
                <div key={item.label}>
                  <p className="text-xs text-[var(--color-text-subtle)] mb-0.5">{item.label}</p>
                  <p className="font-semibold text-[var(--color-text)] truncate">{item.value}</p>
                </div>
              ))}
            </div>

            {/* Financial quick-view banner */}
            {totalBilled > 0 && (
              <div className="mt-4 flex flex-wrap gap-3 pt-3 border-t border-[var(--color-border)]">
                <span className="text-xs px-2.5 py-1 rounded-full bg-[var(--color-bg-subtle)] border border-[var(--color-border)] text-[var(--color-text-muted)] font-medium">
                  Billed: <strong className="text-[var(--color-text)]">{formatCurrency(totalBilled)}</strong>
                </span>
                <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-medium">
                  Paid: <strong>{formatCurrency(totalPaid)}</strong>
                </span>
                {outstanding > 0 && (
                  <span className="text-xs px-2.5 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-600 font-semibold">
                    Outstanding: {formatCurrency(outstanding)}
                  </span>
                )}
                {advanceBalance > 0 && (
                  <span className="text-xs px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 font-medium">
                    Advance: {formatCurrency(advanceBalance)}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      <div className="flex gap-0 border-b border-[var(--color-border)] overflow-x-auto">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === tab.id
                ? 'border-[var(--color-primary-500)] text-[var(--color-primary-600)]'
                : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            <tab.icon size={14} /> {tab.label}
          </button>
        ))}
      </div>

      {/* ════════════════════════ OVERVIEW TAB ═══════════════════════════════ */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Personal Information */}
          <div className="card p-5 space-y-1 bg-white border border-[var(--color-border)] rounded-xl">
            <h2 className="text-sm font-bold text-[var(--color-text)] mb-3 flex items-center gap-2">
              <User size={15} className="text-[var(--color-primary-500)]" /> Personal Information
            </h2>
            <InfoRow label="Full Name" value={patient.name} />
            <InfoRow label="Date of Birth" value={patient.dob ? formatDate(patient.dob) : null} />
            <InfoRow label="Age / Gender" value={`${patient.age || '—'} yrs · ${patient.gender ? patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1) : '—'}`} />
            <InfoRow label="Blood Group" value={patient.bloodGroup} />
            <InfoRow label="Phone" value={patient.phone} />
            <InfoRow label="Email" value={patient.email} />
            <InfoRow label="Address" value={patient.address} />
            <InfoRow label="Registered" value={patient.registeredAt ? formatDate(patient.registeredAt) : null} />

            {patient.emergencyContact?.name && (
              <div className="pt-3 mt-2 border-t border-[var(--color-border)]">
                <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-2 flex items-center gap-1">
                  <Phone size={11} /> Emergency Contact
                </p>
                <InfoRow label="Name" value={patient.emergencyContact.name} />
                <InfoRow label="Relation" value={patient.emergencyContact.relation} />
                <InfoRow label="Phone" value={patient.emergencyContact.phone} />
              </div>
            )}
          </div>

          {/* Medical Information */}
          <div className="card p-5 space-y-1 bg-white border border-[var(--color-border)] rounded-xl">
            <h2 className="text-sm font-bold text-[var(--color-text)] mb-3 flex items-center gap-2">
              <HeartPulse size={15} className="text-rose-500" /> Medical Information
            </h2>
            <InfoRow label="Chief Complaint" value={patient.chiefComplaint} />
            <InfoRow
              label="Allergies"
              value={patient.allergies}
              highlight={patient.allergies && patient.allergies !== 'None'}
            />
            <InfoRow label="Medical History" value={patient.medicalHistory} />
            <InfoRow label="Assigned Doctor" value={assignedDoctorName} />
            <InfoRow label="Treatment" value={patient.treatmentCategoryName || patient.categoryName} />

            <div className="pt-3 mt-2 border-t border-[var(--color-border)]">
              <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-2">
                Visit Summary
              </p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Total Apts', value: appointments.length },
                  { label: 'Completed', value: completedApts },
                  { label: 'Upcoming', value: upcomingApts },
                ].map(s => (
                  <div key={s.label} className="text-center p-2 rounded-lg bg-[var(--color-bg-subtle)]">
                    <p className="text-lg font-bold text-[var(--color-text)]">{s.value}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Financial Snapshot */}
          {totalBilled > 0 && (
            <div className="card p-5 bg-white border border-[var(--color-border)] rounded-xl lg:col-span-2">
              <h2 className="text-sm font-bold text-[var(--color-text)] mb-3 flex items-center gap-2">
                <IndianRupee size={15} className="text-amber-600" /> Financial Snapshot
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <SummaryCard label="Total Billed" value={formatCurrency(totalBilled)} color="slate" icon={FileText} />
                <SummaryCard label="Total Paid" value={formatCurrency(totalPaid)} color="emerald" icon={CheckCircle2} />
                <SummaryCard label="Outstanding" value={formatCurrency(outstanding)} color={outstanding > 0 ? 'rose' : 'emerald'} icon={AlertCircle} />
                <SummaryCard label="Advance" value={formatCurrency(advanceBalance)} color="blue" icon={Wallet} />
                {lastPay && <SummaryCard label="Last Payment" value={formatCurrency(lastPay.amount)} sub={formatDate(lastPay.date)} color="violet" icon={Receipt} />}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════ APPOINTMENTS TAB ═══════════════════════════ */}
      {activeTab === 'appointments' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-[var(--color-text)]">
              Appointment History <span className="text-sm text-[var(--color-text-muted)] font-normal">({appointments.length})</span>
            </h2>
            {canEdit && (
              <button
                onClick={() => setBookAptOpen(true)}
                className="btn btn-primary btn-sm flex items-center gap-1.5"
              >
                <CalendarPlus size={14} /> Book New
              </button>
            )}
          </div>

          {appointments.length === 0 ? (
            <EmptyState icon={Calendar} title="No appointments" description="This patient has no appointment history yet." />
          ) : (
            <div className="card overflow-hidden bg-white border border-[var(--color-border)] rounded-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[var(--color-bg-subtle)] border-b border-[var(--color-border)]">
                    <tr>
                      {['Date', 'Time', 'Doctor', 'Type', 'Duration', 'Status', 'Notes', 'Action'].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)] whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {appointments.slice().sort((a, b) => new Date(b.date || b.startAt) - new Date(a.date || a.startAt)).map(apt => (
                      <tr key={apt.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-bg-subtle)] transition-colors">
                        <td className="px-4 py-3 font-medium whitespace-nowrap">{formatDate(apt.date || apt.startAt)}</td>
                        <td className="px-4 py-3 text-[var(--color-text-muted)] whitespace-nowrap">{apt.time || apt.startAt?.slice(11, 16) || '—'}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{apt.doctorName || '—'}</td>
                        <td className="px-4 py-3">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-primary-50)] text-[var(--color-primary-700)] border border-[var(--color-primary-200)] font-medium">
                            {apt.treatmentCategoryName || apt.type || 'General'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[var(--color-text-muted)]">{apt.durationMinutes ? `${apt.durationMinutes} min` : '—'}</td>
                        <td className="px-4 py-3"><StatusBadge status={apt.status} /></td>
                        <td className="px-4 py-3 text-[var(--color-text-muted)] max-w-xs truncate">{apt.notes || '—'}</td>
                        <td className="px-4 py-3">
                          {canEdit && apt.status === 'completed' && (
                            <button
                              onClick={() => { setActiveTab('billing'); openPayModal(invoices.find(i => i.appointmentId === apt.id)?.id || ''); }}
                              className="text-xs px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 font-medium transition-colors whitespace-nowrap"
                            >
                              + Payment
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════ CLINICAL HISTORY TAB ═══════════════════════ */}
      {activeTab === 'clinical' && (
        <div className="space-y-4">
          <h2 className="text-base font-semibold text-[var(--color-text)]">
            Clinical History <span className="text-sm text-[var(--color-text-muted)] font-normal">({records.length} records)</span>
          </h2>
          {records.length === 0 ? (
            <EmptyState icon={Stethoscope} title="No clinical records" description="No clinical history has been recorded for this patient." />
          ) : (
            records.slice().sort((a, b) => new Date(b.visitDate || b.date) - new Date(a.visitDate || a.date)).map(rec => (
              <div key={rec.id} className="card p-5 bg-white border border-[var(--color-border)] rounded-xl">
                <div className="flex items-start justify-between mb-4 gap-3">
                  <div>
                    <p className="font-semibold text-[var(--color-text)]">{formatDate(rec.visitDate || rec.date)}</p>
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{rec.doctorName || 'Doctor'}</p>
                  </div>
                  <StatusBadge status={rec.status || 'completed'} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  {[
                    { label: 'Chief Complaint', val: rec.chiefComplaint },
                    { label: 'Diagnosis', val: rec.diagnosis },
                    { label: 'Treatment Performed', val: rec.treatment },
                    { label: 'Clinical Notes', val: rec.clinicalNotes },
                  ].map(({ label, val }) => val ? (
                    <div key={label}>
                      <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-1">{label}</p>
                      <p className="text-[var(--color-text)]">{val}</p>
                    </div>
                  ) : null)}
                </div>
                {rec.prescription?.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
                    <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-3 flex items-center gap-1.5">
                      <Pill size={12} /> Prescription ({rec.prescription.length})
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {rec.prescription.map((rx, i) => (
                        <div key={i} className="p-2.5 rounded-lg bg-violet-50 border border-violet-100 text-sm">
                          <span className="font-semibold text-violet-800">{rx.medicine}</span>
                          <span className="text-violet-600"> — {rx.dosage}</span>
                          {rx.duration && <span className="text-violet-500"> for {rx.duration}</span>}
                          {rx.instructions && <p className="text-xs text-violet-500 mt-0.5">{rx.instructions}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* ════════════════════════ DENTAL CHART TAB ═══════════════════════════ */}
      {activeTab === 'odontogram' && (
        <DentalChart
          initialChart={records.find(r => r.dentalChart?.length > 0)?.dentalChart || []}
          saving={chartSaving}
          onSaveChart={async (chartData) => {
            // clinical_records.doctor_id is NOT NULL with an FK to users(id).
            // An empty string silently fails the insert, so always send a real doctor UUID.
            let doctorId = '';
            if (currentUserRole === 'doctor' && currentUser?.id) {
              doctorId = currentUser.id;
            } else if (patient?.assignedDoctorId) {
              doctorId = patient.assignedDoctorId;
            } else {
              doctorId = appointments.find(a => a.doctorId)?.doctorId || '';
            }
            // Last-resort fallback: first available doctor in the clinic.
            if (!doctorId) {
              try {
                const res = await api.getDoctors();
                const list = Array.isArray(res?.data) ? res.data : [];
                const doc = list.find(d => d?.id);
                doctorId = doc?.id || '';
              } catch (_) { /* handled below */ }
            }
            if (!doctorId) {
              dispatch(addToast({ type: 'error', title: 'Cannot Save Chart', message: 'No doctor found. Assign a doctor to this patient or create a doctor account first.' }));
              return false;
            }
            setChartSaving(true);
            try {
              await api.addClinicalRecord({
                patientId: id,
                doctorId,
                chiefComplaint: patient?.chiefComplaint || 'Dental Chart Update',
                diagnosis: 'Odontogram Examination',
                treatment: 'Dental Charting',
                clinicalNotes: `Updated dental chart — ${chartData.length} tooth findings recorded.`,
                dentalChart: chartData,
              });
              dispatch(addToast({ type: 'success', title: 'Dental Chart Saved', message: 'Tooth findings recorded.' }));
              loadAll(true);
              return true;
            } catch (err) {
              dispatch(addToast({ type: 'error', title: 'Save Failed', message: err.message }));
              return false;
            } finally {
              setChartSaving(false);
            }
          }}
        />
      )}

      {/* ════════════════════════ BILLING TAB ════════════════════════════════ */}
      {activeTab === 'billing' && (
        <div className="space-y-5">
          {/* Financial summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <SummaryCard label="Total Billed" value={formatCurrency(totalBilled)} color="slate" icon={FileText} />
            <SummaryCard label="Total Paid" value={formatCurrency(totalPaid)} color="emerald" icon={CheckCircle2} />
            <SummaryCard label="Outstanding" value={formatCurrency(outstanding)} color={outstanding > 0 ? 'rose' : 'emerald'} icon={AlertCircle} />
            <SummaryCard label="Advance Balance" value={formatCurrency(advanceBalance)} color="blue" icon={Wallet} />
          </div>

          {/* Outstanding alert */}
          {outstanding > 0 && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm font-medium">
              <ShieldAlert size={16} className="shrink-0" />
              <span>Outstanding balance: <strong>{formatCurrency(outstanding)}</strong> — {unpaidInvoices.length} invoice{unpaidInvoices.length > 1 ? 's' : ''} pending</span>
              {canEdit && (
                <button
                  onClick={() => openPayModal(unpaidInvoices[0]?.id || '')}
                  className="ml-auto text-xs px-3 py-1.5 rounded-lg bg-rose-600 text-white hover:bg-rose-700 font-semibold whitespace-nowrap"
                >
                  Settle Now
                </button>
              )}
            </div>
          )}

          {/* Action row */}
          {canEdit && (
            <div className="flex flex-wrap gap-2">
              <button onClick={() => openPayModal('')} className="btn btn-primary btn-sm flex items-center gap-1.5">
                <Wallet size={14} /> Receive Advance
              </button>
              {unpaidInvoices.length > 0 && (
                <button onClick={() => openPayModal(unpaidInvoices[0]?.id || '')} className="btn btn-sm flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white">
                  <IndianRupee size={14} /> Collect Payment
                </button>
              )}
              {isAdmin && (
                <button onClick={openInvModal} className="btn btn-outline btn-sm flex items-center gap-1.5 text-[var(--color-primary-600)]">
                  <PlusCircle size={14} /> Create Invoice
                </button>
              )}
            </div>
          )}

          {/* ── Invoices ─────────────────────────────────────────────────────── */}
          <div className="card overflow-hidden bg-white border border-[var(--color-border)] rounded-xl">
            <div className="px-4 py-3 border-b border-[var(--color-border)] flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[var(--color-text)]">
                Invoices <span className="text-[var(--color-text-muted)] font-normal">({invoices.length})</span>
              </h3>
            </div>
            {invoices.length === 0 ? (
              <div className="py-10">
                <EmptyState icon={FileText} title="No invoices" description="No invoices have been created for this patient." />
              </div>
            ) : (
              <div className="divide-y divide-[var(--color-border)]">
                {invoices.map(inv => {
                  const isExpanded = expandedInv === inv.id;
                  return (
                    <div key={inv.id}>
                      <div
                        className="px-4 py-3 flex items-center gap-3 hover:bg-[var(--color-bg-subtle)] cursor-pointer transition-colors"
                        onClick={() => setExpandedInv(isExpanded ? null : inv.id)}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs font-semibold text-[var(--color-primary-600)]">
                              #{inv.invoiceNumber}
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${INV_STATUS_STYLES[inv.status] || INV_STATUS_STYLES.issued}`}>
                              {INV_STATUS_LABELS[inv.status] || inv.status}
                            </span>
                            <span className="text-xs text-[var(--color-text-muted)]">{formatDate(inv.date)}</span>
                          </div>
                          <p className="text-xs text-[var(--color-text-muted)] mt-0.5 truncate">{inv.description || 'Dental treatment'}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-bold text-[var(--color-text)]">{formatCurrency(inv.totalAmount)}</p>
                          {inv.balanceDue > 0 && (
                            <p className="text-xs text-rose-600 font-medium">Due: {formatCurrency(inv.balanceDue)}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {canEdit && ['issued', 'partially_paid'].includes(inv.status) && (
                            <button
                              onClick={e => { e.stopPropagation(); openPayModal(inv.id); }}
                              className="text-xs px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 font-semibold whitespace-nowrap"
                            >
                              Pay
                            </button>
                          )}
                          {isExpanded ? <ChevronUp size={15} className="text-[var(--color-text-muted)]" /> : <ChevronDown size={15} className="text-[var(--color-text-muted)]" />}
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="px-4 pb-4 bg-[var(--color-bg-subtle)] border-t border-[var(--color-border)]">
                          <div className="pt-3 space-y-3">
                            {inv.items?.length > 0 && (
                              <div>
                                <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-2">Line Items</p>
                                <div className="rounded-lg overflow-hidden border border-[var(--color-border)]">
                                  <table className="w-full text-sm bg-white">
                                    <thead className="bg-[var(--color-bg-subtle)]">
                                      <tr>
                                        <th className="text-left px-3 py-2 text-xs font-medium text-[var(--color-text-muted)]">Treatment</th>
                                        <th className="text-center px-3 py-2 text-xs font-medium text-[var(--color-text-muted)]">Qty</th>
                                        <th className="text-right px-3 py-2 text-xs font-medium text-[var(--color-text-muted)]">Unit Price</th>
                                        <th className="text-right px-3 py-2 text-xs font-medium text-[var(--color-text-muted)]">Amount</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {inv.items.map((item, idx) => (
                                        <tr key={idx} className="border-t border-[var(--color-border)]">
                                          <td className="px-3 py-2">{item.description}</td>
                                          <td className="px-3 py-2 text-center">{item.quantity}</td>
                                          <td className="px-3 py-2 text-right">{formatCurrency(item.unitPrice)}</td>
                                          <td className="px-3 py-2 text-right font-medium">{formatCurrency(item.amount)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}
                            {/* Invoice totals */}
                            <div className="flex justify-end">
                              <div className="min-w-48 space-y-1 text-sm">
                                <div className="flex justify-between"><span className="text-[var(--color-text-muted)]">Subtotal</span><span>{formatCurrency(inv.subtotal || inv.totalAmount)}</span></div>
                                {inv.discount > 0 && <div className="flex justify-between text-emerald-600"><span>Discount</span><span>-{formatCurrency(inv.discount)}</span></div>}
                                <div className="flex justify-between font-semibold pt-1 border-t border-[var(--color-border)]"><span>Total</span><span>{formatCurrency(inv.totalAmount)}</span></div>
                                {inv.amountPaid > 0 && <div className="flex justify-between text-emerald-600"><span>Paid</span><span>-{formatCurrency(inv.amountPaid)}</span></div>}
                                <div className="flex justify-between font-bold text-base"><span className={inv.balanceDue > 0 ? 'text-rose-600' : 'text-emerald-600'}>Balance Due</span><span className={inv.balanceDue > 0 ? 'text-rose-600' : 'text-emerald-600'}>{formatCurrency(inv.balanceDue)}</span></div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Payment History ───────────────────────────────────────────────── */}
          <div className="card overflow-hidden bg-white border border-[var(--color-border)] rounded-xl">
            <div className="px-4 py-3 border-b border-[var(--color-border)] flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[var(--color-text)]">
                Payment History <span className="text-[var(--color-text-muted)] font-normal">({payments.filter(p => !p.isDeleted).length})</span>
              </h3>
              {canEdit && (
                <button
                  onClick={() => openPayModal('')}
                  className="btn btn-outline btn-xs flex items-center gap-1"
                >
                  <PlusCircle size={12} /> Add
                </button>
              )}
            </div>

            {payments.filter(p => !p.isDeleted).length === 0 ? (
              <div className="py-10">
                <EmptyState icon={CreditCard} title="No payments" description="No payments recorded for this patient." />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[var(--color-bg-subtle)] border-b border-[var(--color-border)]">
                    <tr>
                      {['Date', 'Receipt #', 'Type', 'Invoice', 'Mode', 'Notes', 'Amount', 'Actions'].map(h => (
                        <th key={h} className={`px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)] whitespace-nowrap ${h === 'Amount' ? 'text-right' : 'text-left'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {payments
                      .filter(p => !p.isDeleted)
                      .sort((a, b) => new Date(b.date) - new Date(a.date))
                      .map(pay => (
                        <tr key={pay.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-bg-subtle)] transition-colors">
                          <td className="px-4 py-3 whitespace-nowrap text-[var(--color-text)]">{formatDate(pay.date)}</td>
                          <td className="px-4 py-3 font-mono text-xs text-[var(--color-text-muted)]">
                            {pay.receiptNumber || pay.id?.slice(0, 8).toUpperCase()}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${TYPE_STYLES[pay.paymentType] || TYPE_STYLES.payment}`}>
                              {TYPE_LABELS[pay.paymentType] || pay.paymentType}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-[var(--color-text-muted)]">
                            {pay.invoiceNumber ? <span className="font-mono">{pay.invoiceNumber}</span> : '—'}
                          </td>
                          <td className="px-4 py-3 font-medium">{pay.mode}</td>
                          <td className="px-4 py-3 text-[var(--color-text-muted)] max-w-xs truncate">{pay.notes || '—'}</td>
                          <td className="px-4 py-3 text-right font-bold text-emerald-600 whitespace-nowrap">
                            {formatCurrency(pay.amount)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => setReceiptPay(pay)}
                                className="p-1.5 rounded-lg hover:bg-[var(--color-bg-subtle)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
                                title="View Receipt"
                              >
                                <Receipt size={13} />
                              </button>
                              {canEdit && (
                                <button
                                  onClick={() => openEditPayModal(pay)}
                                  className="p-1.5 rounded-lg hover:bg-blue-50 text-[var(--color-text-muted)] hover:text-blue-600 transition-colors"
                                  title="Edit Payment"
                                >
                                  <Edit3 size={13} />
                                </button>
                              )}
                              {isAdmin && (
                                <button
                                  onClick={() => setDeletePayTarget(pay)}
                                  className="p-1.5 rounded-lg hover:bg-rose-50 text-[var(--color-text-muted)] hover:text-rose-600 transition-colors"
                                  title="Void Payment"
                                >
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                  <tfoot className="bg-[var(--color-bg-subtle)] border-t-2 border-[var(--color-border)]">
                    <tr>
                      <td colSpan={6} className="px-4 py-3 text-sm font-semibold text-[var(--color-text)]">Total Received</td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-600 text-base">{formatCurrency(totalPaid)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════ MODALS ══════════════════════════════════════ */}

      {/* Edit Patient Modal */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title={`Edit Patient — ${patient.name}`} size="lg">
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-xs font-semibold text-[var(--color-text-muted)] block mb-1">Full Name *</label>
              <input required value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} className="form-input" placeholder="Full Name" />
            </div>
            <div>
              <label className="text-xs font-semibold text-[var(--color-text-muted)] block mb-1">Phone * <span className="font-normal text-[var(--color-text-subtle)]">(10 digits)</span></label>
              <input
                required
                type="tel"
                inputMode="numeric"
                maxLength={10}
                value={editForm.phone}
                onChange={e => {
                  const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                  setEditForm({ ...editForm, phone: digits });
                }}
                className="form-input"
                placeholder="9876543210"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-[var(--color-text-muted)] block mb-1">Age</label>
              <input type="number" min={1} max={120} value={editForm.age} onChange={e => setEditForm({ ...editForm, age: e.target.value })} className="form-input" />
            </div>
            <div>
              <label className="text-xs font-semibold text-[var(--color-text-muted)] block mb-1">Gender</label>
              <select value={editForm.gender} onChange={e => setEditForm({ ...editForm, gender: e.target.value })} className="form-input cursor-pointer">
                {['male', 'female', 'other'].map(g => <option key={g} value={g}>{g.charAt(0).toUpperCase() + g.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-[var(--color-text-muted)] block mb-1">Blood Group</label>
              <select value={editForm.bloodGroup} onChange={e => setEditForm({ ...editForm, bloodGroup: e.target.value })} className="form-input cursor-pointer">
                {['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map(g => <option key={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-[var(--color-text-muted)] block mb-1">Email</label>
              <input type="email" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} className="form-input" />
            </div>
            <div>
              <label className="text-xs font-semibold text-[var(--color-text-muted)] block mb-1">Allergies</label>
              <input value={editForm.allergies} onChange={e => setEditForm({ ...editForm, allergies: e.target.value })} className="form-input" placeholder="None / Penicillin…" />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-semibold text-[var(--color-text-muted)] block mb-1">Address</label>
              <input value={editForm.address} onChange={e => setEditForm({ ...editForm, address: e.target.value })} className="form-input" />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-semibold text-[var(--color-text-muted)] block mb-1">Chief Complaint</label>
              <input value={editForm.chiefComplaint} onChange={e => setEditForm({ ...editForm, chiefComplaint: e.target.value })} className="form-input" />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-semibold text-[var(--color-text-muted)] block mb-1">Medical History</label>
              <textarea rows={2} value={editForm.medicalHistory} onChange={e => setEditForm({ ...editForm, medicalHistory: e.target.value })} className="form-input" />
            </div>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setEditOpen(false)} className="btn btn-outline btn-sm">Cancel</button>
            <button type="submit" disabled={saving} className="btn btn-primary btn-sm flex items-center gap-1.5">
              <Save size={14} /> {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Add/Record Payment Modal */}
      <Modal open={payModal} onClose={() => setPayModal(false)} title="Record Payment" size="md">
        <form onSubmit={handlePaySubmit} className="space-y-4">
          {/* Payment type selector */}
          <div>
            <label className="text-xs font-semibold text-[var(--color-text-muted)] block mb-2">Payment Type</label>
            <div className="flex gap-2 flex-wrap">
              {[
                { value: 'advance', label: 'Advance', desc: 'Credit before treatment' },
                { value: 'payment', label: 'General', desc: 'Regular payment' },
                { value: 'partial', label: 'Partial', desc: 'Partial settlement' },
                { value: 'settlement', label: 'Full Settlement', desc: 'Clear outstanding' },
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPayForm(f => ({ ...f, paymentType: opt.value }))}
                  className={`flex-1 min-w-28 px-3 py-2 rounded-xl border text-left text-xs font-medium transition-all ${
                    payForm.paymentType === opt.value
                      ? 'border-[var(--color-primary-400)] bg-[var(--color-primary-50)] text-[var(--color-primary-700)]'
                      : 'border-[var(--color-border)] hover:bg-[var(--color-bg-subtle)] text-[var(--color-text-muted)]'
                  }`}
                >
                  <div className="font-semibold">{opt.label}</div>
                  <div className="text-[10px] opacity-70 mt-0.5">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Invoice selector (optional) */}
          {unpaidInvoices.length > 0 && (
            <div>
              <label className="text-xs font-semibold text-[var(--color-text-muted)] block mb-1">Link to Invoice (optional)</label>
              <select
                value={payForm.invoiceId}
                onChange={e => {
                  const inv = invoices.find(i => i.id === e.target.value);
                  setPayForm(f => ({
                    ...f,
                    invoiceId: e.target.value,
                    amount: inv ? inv.balanceDue.toString() : f.amount,
                  }));
                }}
                className="form-input cursor-pointer"
              >
                <option value="">— No specific invoice —</option>
                {unpaidInvoices.map(inv => (
                  <option key={inv.id} value={inv.id}>
                    {inv.invoiceNumber} — Due: {formatCurrency(inv.balanceDue)}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-[var(--color-text-muted)] block mb-1">Amount (₹) *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] font-semibold">₹</span>
                <input
                  required
                  type="number"
                  min="1"
                  step="1"
                  placeholder="0"
                  value={payForm.amount}
                  onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))}
                  className="form-input pl-8 font-semibold"
                />
              </div>
              {payForm.invoiceId && invoices.find(i => i.id === payForm.invoiceId) && (
                <p className="text-xs text-amber-600 mt-1">
                  Balance due: {formatCurrency(invoices.find(i => i.id === payForm.invoiceId)?.balanceDue)}
                </p>
              )}
            </div>
            <div>
              <label className="text-xs font-semibold text-[var(--color-text-muted)] block mb-1">Payment Mode *</label>
              <select value={payForm.mode} onChange={e => setPayForm(f => ({ ...f, mode: e.target.value }))} className="form-input cursor-pointer">
                <option value="UPI">UPI (GPay / PhonePe)</option>
                <option value="Cash">Cash</option>
                <option value="Card">Card</option>
                <option value="Bank Transfer">Bank Transfer</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-[var(--color-text-muted)] block mb-1">Date</label>
              <input type="date" value={payForm.date} onChange={e => setPayForm(f => ({ ...f, date: e.target.value }))} className="form-input" />
            </div>
            <div>
              <label className="text-xs font-semibold text-[var(--color-text-muted)] block mb-1">Transaction Ref.</label>
              <input placeholder="UTR / Txn ID" value={payForm.transactionRef} onChange={e => setPayForm(f => ({ ...f, transactionRef: e.target.value }))} className="form-input" />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-semibold text-[var(--color-text-muted)] block mb-1">Notes</label>
              <input placeholder="e.g. Advance for RCT, Consultation fee…" value={payForm.notes} onChange={e => setPayForm(f => ({ ...f, notes: e.target.value }))} className="form-input" />
            </div>
          </div>

          {/* Amount summary */}
          {payForm.amount && (
            <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-sm font-semibold text-emerald-700">
              <span>Recording {TYPE_LABELS[payForm.paymentType] || 'Payment'}</span>
              <span className="text-lg">{formatCurrency(parseFloat(payForm.amount) || 0)}</span>
            </div>
          )}

          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setPayModal(false)} className="btn btn-outline btn-sm">Cancel</button>
            <button type="submit" disabled={payLoading} className="btn btn-primary btn-sm flex items-center gap-1.5">
              <CheckCircle2 size={14} /> {payLoading ? 'Saving…' : 'Record Payment'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Payment Modal */}
      <Modal open={editPayModal} onClose={() => setEditPayModal(false)} title="Edit Payment" size="sm">
        <form onSubmit={handleEditPaySubmit} className="space-y-4">
          {isAdmin && (
            <div>
              <label className="text-xs font-semibold text-[var(--color-text-muted)] block mb-1">Amount (₹) <span className="text-amber-600">(Admin only)</span></label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] font-semibold">₹</span>
                <input type="number" min="1" value={editPayForm.amount || ''} onChange={e => setEditPayForm(f => ({ ...f, amount: e.target.value }))} className="form-input pl-8" />
              </div>
            </div>
          )}
          <div>
            <label className="text-xs font-semibold text-[var(--color-text-muted)] block mb-1">Payment Mode</label>
            <select value={editPayForm.mode || 'UPI'} onChange={e => setEditPayForm(f => ({ ...f, mode: e.target.value }))} className="form-input cursor-pointer">
              <option value="UPI">UPI</option>
              <option value="Cash">Cash</option>
              <option value="Card">Card</option>
              <option value="Bank Transfer">Bank Transfer</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-[var(--color-text-muted)] block mb-1">Date</label>
            <input type="date" value={editPayForm.date || ''} onChange={e => setEditPayForm(f => ({ ...f, date: e.target.value }))} className="form-input" />
          </div>
          <div>
            <label className="text-xs font-semibold text-[var(--color-text-muted)] block mb-1">Transaction Ref.</label>
            <input placeholder="UTR / Txn ID" value={editPayForm.transactionRef || ''} onChange={e => setEditPayForm(f => ({ ...f, transactionRef: e.target.value }))} className="form-input" />
          </div>
          <div>
            <label className="text-xs font-semibold text-[var(--color-text-muted)] block mb-1">Notes</label>
            <input value={editPayForm.notes || ''} onChange={e => setEditPayForm(f => ({ ...f, notes: e.target.value }))} className="form-input" />
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setEditPayModal(false)} className="btn btn-outline btn-sm">Cancel</button>
            <button type="submit" disabled={editPayLoading} className="btn btn-primary btn-sm flex items-center gap-1.5">
              <Save size={14} /> {editPayLoading ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Create Invoice Modal */}
      <Modal open={invModal} onClose={() => setInvModal(false)} title="Create Invoice" size="lg">
        <form onSubmit={handleInvSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-[var(--color-text-muted)] block mb-1">Description / Reason</label>
            <input placeholder="e.g. Orthodontic treatment — Phase 1" value={invForm.description} onChange={e => setInvForm(f => ({ ...f, description: e.target.value }))} className="form-input" />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-[var(--color-text-muted)]">Treatment Items *</label>
              <button
                type="button"
                onClick={() => setInvForm(f => ({ ...f, items: [...f.items, { description: '', quantity: 1, unitPrice: '' }] }))}
                className="text-xs text-[var(--color-primary-600)] hover:underline font-medium"
              >
                + Add Item
              </button>
            </div>
            <div className="space-y-2">
              {invForm.items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <input
                    placeholder="Treatment description"
                    value={item.description}
                    onChange={e => {
                      const items = [...invForm.items];
                      items[idx].description = e.target.value;
                      setInvForm(f => ({ ...f, items }));
                    }}
                    className="form-input col-span-6 text-sm"
                  />
                  <input
                    type="number" min={1} placeholder="Qty"
                    value={item.quantity}
                    onChange={e => {
                      const items = [...invForm.items];
                      items[idx].quantity = e.target.value;
                      setInvForm(f => ({ ...f, items }));
                    }}
                    className="form-input col-span-2 text-sm text-center"
                  />
                  <div className="col-span-3 relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] text-xs font-semibold">₹</span>
                    <input
                      type="number" min={0} placeholder="Price"
                      value={item.unitPrice}
                      onChange={e => {
                        const items = [...invForm.items];
                        items[idx].unitPrice = e.target.value;
                        setInvForm(f => ({ ...f, items }));
                      }}
                      className="form-input pl-6 text-sm"
                    />
                  </div>
                  {invForm.items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setInvForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }))}
                      className="col-span-1 p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-[var(--color-text-muted)] block mb-1">Discount (₹)</label>
              <input type="number" min={0} value={invForm.discount} onChange={e => setInvForm(f => ({ ...f, discount: e.target.value }))} className="form-input" />
            </div>
            <div>
              <label className="text-xs font-semibold text-[var(--color-text-muted)] block mb-1">Due Date</label>
              <input type="date" value={invForm.dueDate} onChange={e => setInvForm(f => ({ ...f, dueDate: e.target.value }))} className="form-input" />
            </div>
          </div>

          {/* Invoice preview total */}
          {(() => {
            const subtotal = invForm.items.reduce((s, i) => s + (parseFloat(i.unitPrice) || 0) * (parseInt(i.quantity) || 1), 0);
            const discount = parseFloat(invForm.discount) || 0;
            const total = Math.max(0, subtotal - discount);
            return subtotal > 0 ? (
              <div className="flex justify-between items-center px-4 py-3 rounded-xl bg-[var(--color-bg-subtle)] border border-[var(--color-border)] text-sm font-semibold">
                <span className="text-[var(--color-text-muted)]">Invoice Total</span>
                <span className="text-lg text-[var(--color-text)]">{formatCurrency(total)}</span>
              </div>
            ) : null;
          })()}

          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setInvModal(false)} className="btn btn-outline btn-sm">Cancel</button>
            <button type="submit" disabled={invLoading} className="btn btn-primary btn-sm flex items-center gap-1.5">
              <FileText size={14} /> {invLoading ? 'Creating…' : 'Create Invoice'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Receipt Modal */}
      {receiptPay && (
        <Modal open={true} onClose={() => setReceiptPay(null)} title="Payment Receipt">
          <div className="space-y-4">
            <div className="border border-[var(--color-border)] rounded-xl p-6 space-y-4 bg-white">
              <div className="flex justify-between items-start border-b pb-4">
                <div>
                  <h2 className="text-xl font-bold text-[var(--color-primary-600)]">Dwarka Dental Clinic</h2>
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Dwarka, New Delhi</p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    RECEIPT
                  </span>
                  {receiptPay.receiptNumber && (
                    <p className="text-xs text-[var(--color-text-muted)] mt-1 font-mono">{receiptPay.receiptNumber}</p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-[var(--color-text-muted)]">Patient</p>
                  <p className="font-semibold">{patient.name}</p>
                  <p className="text-xs text-[var(--color-text-muted)] font-mono">{patient.patientId || patient.patient_number}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--color-text-muted)]">Date</p>
                  <p className="font-semibold">{formatDate(receiptPay.date)}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--color-text-muted)]">Payment Mode</p>
                  <p className="font-semibold">{receiptPay.mode}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--color-text-muted)]">Type</p>
                  <p className="font-semibold capitalize">{receiptPay.paymentType}</p>
                </div>
                {receiptPay.transactionRef && (
                  <div className="col-span-2">
                    <p className="text-xs text-[var(--color-text-muted)]">Transaction Ref</p>
                    <p className="font-mono text-sm">{receiptPay.transactionRef}</p>
                  </div>
                )}
                {receiptPay.invoiceNumber && (
                  <div className="col-span-2">
                    <p className="text-xs text-[var(--color-text-muted)]">Invoice #</p>
                    <p className="font-mono">{receiptPay.invoiceNumber}</p>
                  </div>
                )}
              </div>
              <div className="border-t pt-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-[var(--color-text-muted)]">Description</p>
                  <p className="text-sm">{receiptPay.notes || 'Dental treatment payment'}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-[var(--color-text-muted)]">Amount Paid</p>
                  <p className="text-2xl font-bold text-emerald-600">{formatCurrency(receiptPay.amount)}</p>
                </div>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setReceiptPay(null)} className="btn btn-outline btn-sm">Close</button>
              <button onClick={() => window.print()} className="btn btn-primary btn-sm flex items-center gap-1.5">
                <Printer size={14} /> Print Receipt
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Payment Confirm */}
      <ConfirmModal
        open={!!deletePayTarget}
        onClose={() => setDeletePayTarget(null)}
        onConfirm={handleDeletePay}
        loading={deletingPay}
        title="Void Payment"
        message={`Are you sure you want to void this payment of ${deletePayTarget ? formatCurrency(deletePayTarget.amount) : ''}? This action is recorded in the audit log.`}
        confirmLabel="Void Payment"
        variant="danger"
      />

      {/* Book Appointment Modal */}
      {bookAptOpen && (
        <BookAppointmentModal
          patientId={patient.id}
          patientName={patient.name}
          onClose={() => setBookAptOpen(false)}
          onBooked={() => {
            setBookAptOpen(false);
            loadAll(true);
            fetchAppointments();
            window.dispatchEvent(new CustomEvent('ddc_patient_data_updated', { detail: { action: 'appointment_booked', patientId: id } }));
            dispatch(addToast({ type: 'success', title: 'Appointment Booked', message: 'Appointment scheduled successfully.' }));
          }}
        />
      )}
    </div>
  );
}
