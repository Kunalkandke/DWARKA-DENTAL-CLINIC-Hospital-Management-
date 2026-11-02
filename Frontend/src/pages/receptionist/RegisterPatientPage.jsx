import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, ChevronRight, ChevronLeft, CheckCircle2, Calendar,
  Users, User, Phone, Stethoscope, IndianRupee, AlertCircle,
  PlusCircle, Eye, Info,
} from 'lucide-react';
import { useDispatch } from 'react-redux';
import { savePatientThunk, addToast } from '../../app/store';
import { today } from '../../utils/formatters';
import { api } from '../../utils/api';
import { normalizeCategoryName } from '../../components/dashboard/CategoryBoardDashboard';

// ─── Steps ────────────────────────────────────────────────────────────────────
const STEPS = [
  { id: 1, label: 'Personal Info',          icon: User },
  { id: 2, label: 'Contact & Emergency',    icon: Phone },
  { id: 3, label: 'Medical & Appointment',  icon: Stethoscope },
];

const GENDER_OPTIONS = [
  { value: 'male',   label: 'Male'   },
  { value: 'female', label: 'Female' },
  { value: 'other',  label: 'Other'  },
];

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const PAYMENT_MODES = [
  { value: 'UPI',           label: 'UPI (GPay / PhonePe / Paytm)' },
  { value: 'Cash',          label: 'Cash' },
  { value: 'Card',          label: 'Credit / Debit Card' },
  { value: 'Bank Transfer', label: 'Bank Transfer / NEFT / IMPS' },
];

const CATEGORY_FOLLOW_DAYS = {
  orthodontics: 28, orthodontic: 28, ortho: 28,
  'root canal treatment': 10, 'root canal': 10, rct: 10,
  'cavity filling': 30, filling: 30,
  'general consultation': 30, consultation: 30,
  'dental implant': 14, implant: 14,
  'tooth extraction': 7, extraction: 7,
  'prosthodontics & crown': 7, crown: 7,
  'cleaning & scaling': 180, scaling: 180,
  'emergency dental': 3, emergency: 3,
  'x-ray & diagnosis': 7, xray: 7,
};

const DEFAULT_CATEGORIES = [
  { id: 'CONSULT', name: 'General Consultation', defaultDurationMinutes: 30, defaultFollowUpDays: 30 },
  { id: 'ORTHO',   name: 'Orthodontics',          defaultDurationMinutes: 45, defaultFollowUpDays: 28 },
  { id: 'RCT',     name: 'Root Canal Treatment',  defaultDurationMinutes: 60, defaultFollowUpDays: 10 },
  { id: 'EXTRACT', name: 'Tooth Extraction',      defaultDurationMinutes: 30, defaultFollowUpDays: 7  },
  { id: 'FILL',    name: 'Cavity Filling',         defaultDurationMinutes: 45, defaultFollowUpDays: 30 },
  { id: 'SCALE',   name: 'Cleaning & Scaling',     defaultDurationMinutes: 45, defaultFollowUpDays: 180},
  { id: 'IMPLANT', name: 'Dental Implant',         defaultDurationMinutes: 90, defaultFollowUpDays: 14 },
  { id: 'CROWN',   name: 'Prosthodontics & Crown', defaultDurationMinutes: 60, defaultFollowUpDays: 7  },
  { id: 'EMERG',   name: 'Emergency Dental',       defaultDurationMinutes: 30, defaultFollowUpDays: 3  },
  { id: 'XRAY',    name: 'X-Ray & Diagnosis',      defaultDurationMinutes: 20, defaultFollowUpDays: 7  },
];

function addDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + Number(days || 0));
  return d.toISOString().split('T')[0];
}

// ─── Reusable field components ────────────────────────────────────────────────
function Field({ label, required, error, hint, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1.5">
        {label}{required && <span className="text-rose-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && (
        <p className="mt-1 text-xs text-rose-600 flex items-center gap-1">
          <AlertCircle size={11} />{error}
        </p>
      )}
      {hint && !error && (
        <p className="mt-1 text-xs text-[var(--color-text-muted)] flex items-center gap-1">
          <Info size={10} />{hint}
        </p>
      )}
    </div>
  );
}

/** Phone input — enforces 10 digits, strips non-digits */
function PhoneInput({ error, ...props }) {
  return (
    <input
      className={`form-input w-full text-sm ${error ? 'border-rose-400 focus:ring-rose-300' : ''}`}
      type="tel"
      inputMode="numeric"
      maxLength={10}
      onInput={e => {
        // Strip everything except digits, cap at 10
        const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
        if (e.target.value !== digits) e.target.value = digits;
      }}
      {...props}
    />
  );
}

function TextInput({ error, ...props }) {
  return (
    <input
      className={`form-input w-full text-sm ${error ? 'border-rose-400 focus:ring-rose-300' : ''}`}
      {...props}
    />
  );
}

function SelectInput({ options, placeholder, error, ...props }) {
  return (
    <select
      className={`form-input w-full text-sm cursor-pointer ${error ? 'border-rose-400 focus:ring-rose-300' : ''}`}
      {...props}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map(o => (
        <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>
      ))}
    </select>
  );
}

// ─── Initial form state ───────────────────────────────────────────────────────
const BLANK = {
  // Step 1
  name: '', dob: '', age: '', gender: '', bloodGroup: '',
  // Step 2
  phone: '', altPhone: '', email: '', address: '', city: '', pincode: '',
  emergencyName: '', emergencyRelation: '', emergencyPhone: '',
  // Step 3
  chiefComplaint: '', allergies: 'None', medicalHistory: 'No significant medical history',
  currentMedications: '',
  assignedDoctorId: '', treatmentCategoryId: '',
  appointmentDate: today(), appointmentTime: '',
  notes: '',
  // Payment
  advancePayment: '', totalFee: '', paymentMode: 'UPI', paymentNotes: '',
};

// ─── Main component ───────────────────────────────────────────────────────────
export default function RegisterPatientPage() {
  const dispatch  = useDispatch();
  const navigate  = useNavigate();
  const [searchParams] = useSearchParams();

  const [step, setStep]               = useState(1);
  const [form, setForm]               = useState(BLANK);
  const [errors, setErrors]           = useState({});
  const [loading, setLoading]         = useState(false);
  const [done, setDone]               = useState(false);
  const [registered, setRegistered]   = useState(null);
  const [autoHint, setAutoHint]       = useState(null);

  const [doctors,    setDoctors]    = useState([]);
  const [categories, setCategories] = useState([]);

  // Category add modal
  const [showAddCat, setShowAddCat] = useState(false);
  const [newCat, setNewCat]         = useState({ name: '', code: '', defaultDurationMinutes: 30, defaultFollowUpDays: 30 });
  const [catSaving, setCatSaving]   = useState(false);

  // ── Load doctors + categories ─────────────────────────────────────────────
  useEffect(() => {
    loadDoctors();
  }, []);

  async function loadDoctors() {
    try {
      const res = await api.getDoctors();
      const list = Array.isArray(res?.data) ? res.data : [];
      setDoctors(list);
    } catch (_) {}
  }

  useEffect(() => {
    loadCategories();
  }, []);

  function loadCategories() {
    api.getCategories({ status: 'active' }).then(res => {
      const apiCats = Array.isArray(res?.data) ? res.data : [];
      const map = new Map();
      DEFAULT_CATEGORIES.forEach(c => map.set(normalizeCategoryName(c.name).toLowerCase(), { ...c }));
      apiCats.forEach(c => map.set(normalizeCategoryName(c.name).toLowerCase(), { ...c, id: c.id || c._id }));
      const list = Array.from(map.values());
      setCategories(list);

      // Pre-select from URL param
      const qCat = searchParams.get('categoryId') || searchParams.get('category') || '';
      if (qCat) {
        const found = list.find(c =>
          String(c.id) === qCat ||
          normalizeCategoryName(c.name).toLowerCase() === normalizeCategoryName(qCat).toLowerCase()
        );
        if (found) handleCategoryChange(found.id || found._id, list, doctors);
      }
    }).catch(() => setCategories(DEFAULT_CATEGORIES));
  }

  function handleCategoryChange(selectedId, catList = categories, docList = doctors) {
    update('treatmentCategoryId', selectedId);
    const matched = catList.find(c => String(c.id || c._id) === String(selectedId));
    if (!matched) return;

    const normName = normalizeCategoryName(matched.name).toLowerCase();
    const days = matched.defaultFollowUpDays || CATEGORY_FOLLOW_DAYS[normName] || 28;
    const autoDate = addDays(days);
    update('appointmentDate', autoDate);
    setAutoHint({ days, catName: matched.name, date: autoDate });

    // Auto-assign a matching doctor
    const matchedDoc = docList.find(d => {
      const spec = normalizeCategoryName(d.specialization || '').toLowerCase();
      return spec === normName || spec.includes(normName) || normName.includes(spec);
    });
    if (matchedDoc && !form.assignedDoctorId) {
      update('assignedDoctorId', String(matchedDoc.id || matchedDoc._id));
    }
  }

  async function handleCreateCategory() {
    if (!newCat.name.trim() || !newCat.code.trim()) return;
    setCatSaving(true);
    try {
      const created = await api.createCategory({
        name: newCat.name.trim(),
        code: newCat.code.trim().toUpperCase(),
        defaultDurationMinutes: Number(newCat.defaultDurationMinutes) || 30,
        defaultFollowUpDays: Number(newCat.defaultFollowUpDays) || 30,
        isActive: true,
      });
      const catObj = created?.data;
      loadCategories();
      if (catObj?.id) update('treatmentCategoryId', catObj.id);
      setShowAddCat(false);
      setNewCat({ name: '', code: '', defaultDurationMinutes: 30, defaultFollowUpDays: 30 });
    } catch (err) {
      dispatch(addToast({ type: 'error', title: 'Failed', message: err.message }));
    } finally {
      setCatSaving(false);
    }
  }

  // ── Form helpers ──────────────────────────────────────────────────────────
  const update = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => { const e = { ...prev }; delete e[field]; return e; });
  };

  // ── Validation ────────────────────────────────────────────────────────────
  function validateStep(s) {
    const errs = {};
    if (s === 1) {
      if (!form.name.trim()) errs.name = 'Full name is required.';
      if (!form.gender)      errs.gender = 'Gender is required.';
      if (!form.age && !form.dob) {
        errs.age = 'Age or Date of Birth is required.';
      } else if (form.age && (isNaN(form.age) || Number(form.age) <= 0 || Number(form.age) > 120)) {
        errs.age = 'Enter a valid age (1–120).';
      }
    }
    if (s === 2) {
      const ph = (form.phone || '').replace(/\D/g, '');
      if (!form.phone.trim())           errs.phone = 'Mobile number is required.';
      else if (ph.length !== 10)       errs.phone = 'Mobile number must be exactly 10 digits.';
      if (form.email?.trim()) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
          errs.email = 'Enter a valid email address.';
      }
      if (!form.address.trim()) errs.address = 'Address is required.';
      if (form.emergencyPhone?.trim()) {
        const eph = form.emergencyPhone.replace(/\D/g, '');
        if (eph.length !== 10) errs.emergencyPhone = 'Emergency phone must be 10 digits.';
      }
    }
    if (s === 3) {
      if (!form.chiefComplaint.trim()) errs.chiefComplaint = 'Chief complaint is required.';
      if (!form.assignedDoctorId)      errs.assignedDoctorId = 'Please assign a doctor.';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function next() { if (validateStep(step)) setStep(s => s + 1); }
  function prev() { setStep(s => s - 1); }

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!validateStep(3)) return;
    setLoading(true);

    const selectedCat = categories.find(c =>
      String(c.id || c._id) === String(form.treatmentCategoryId)
    );
    const catName = normalizeCategoryName(selectedCat?.name || 'General Consultation');
    const catId   = selectedCat?.id || selectedCat?._id || form.treatmentCategoryId || null;

    const advance   = parseFloat(form.advancePayment) || 0;
    const totalFee  = parseFloat(form.totalFee) || 0;
    const dueAmount = Math.max(0, totalFee - advance);

    try {
      const response = await dispatch(savePatientThunk({
        name:           form.name.trim(),
        age:            form.age ? parseInt(form.age) : undefined,
        dob:            form.dob || undefined,
        gender:         form.gender,
        bloodGroup:     form.bloodGroup || undefined,
        phone:          form.phone.trim(),
        altPhone:       form.altPhone?.trim() || undefined,
        email:          form.email?.trim() || undefined,
        address:        form.address.trim(),
        city:           form.city?.trim() || undefined,
        pincode:        form.pincode?.trim() || undefined,
        emergencyContact: {
          name:     form.emergencyName?.trim() || undefined,
          relation: form.emergencyRelation?.trim() || undefined,
          phone:    form.emergencyPhone?.trim() || undefined,
        },
        chiefComplaint:      form.chiefComplaint.trim(),
        allergies:           form.allergies.trim(),
        medicalHistory:      form.medicalHistory.trim(),
        currentMedications:  form.currentMedications?.trim() || undefined,
        assignedDoctorId:    form.assignedDoctorId || undefined,
        treatmentCategoryId: catId,
        treatmentCategoryName: catName,
        appointmentDate:     form.appointmentDate || undefined,
        appointmentTime:     form.appointmentTime || undefined,
        notes:               form.notes?.trim() || undefined,
        advanceAmount:       advance > 0 ? advance : undefined,
        totalFee:            totalFee > 0 ? totalFee : undefined,
        paymentMode:         form.paymentMode,
        paymentNotes:        form.paymentNotes?.trim() || undefined,
      }));

      const patient = response?.data?.patient || response?.patient || null;
      if (!patient) {
        dispatch(addToast({ type: 'error', title: 'Registration Failed', message: 'No patient record returned. Please check and retry.' }));
        return;
      }

      // Broadcast to all panels
      window.dispatchEvent(new CustomEvent('ddc_patient_data_updated', {
        detail: { action: 'register', patient, patientId: patient.id },
      }));

      dispatch(addToast({
        type: 'success',
        title: 'Patient Registered',
        message: `${form.name} (${patient.patientNumber || patient.patientId || 'New'}) registered successfully.`,
      }));

      setRegistered({ patient, advance, totalFee, dueAmount, aptDate: form.appointmentDate });
      setDone(true);
    } catch (err) {
      console.error('Registration error:', err);
      dispatch(addToast({ type: 'error', title: 'Registration Failed', message: err.message || 'An unexpected error occurred.' }));
    } finally {
      setLoading(false);
    }
  }

  // ── Computed payment summary ───────────────────────────────────────────────
  const advance   = parseFloat(form.advancePayment) || 0;
  const totalFee  = parseFloat(form.totalFee) || 0;
  const due       = Math.max(0, totalFee - advance);
  const payStatus = advance >= totalFee && totalFee > 0 ? 'Fully Paid' : advance > 0 ? 'Partial Advance' : 'Pending';

  // ── Success screen ─────────────────────────────────────────────────────────
  if (done && registered) {
    const { patient, advance: adv, dueAmount, aptDate } = registered;
    const isToday = aptDate === today();

    return (
      <div className="flex flex-col items-center justify-center py-16 text-center animate-fade-in max-w-lg mx-auto">
        <div className="w-20 h-20 rounded-full bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center mb-5 shadow-sm">
          <CheckCircle2 size={40} className="text-emerald-500" />
        </div>
        <h2 className="text-xl font-bold text-[var(--color-text)] mb-1">Patient Registered Successfully</h2>
        <p className="text-sm text-[var(--color-text-muted)] mb-5">
          The patient record and appointment have been created in the system.
        </p>

        {/* Summary card */}
        <div className="w-full card p-5 text-left space-y-3 border border-emerald-200 bg-emerald-50/40 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-sm">
              {patient.name?.charAt(0)?.toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-[var(--color-text)]">{patient.name}</p>
              {patient.patientNumber && (
                <p className="text-xs text-[var(--color-text-muted)] font-mono">{patient.patientNumber}</p>
              )}
            </div>
          </div>

          <div className="border-t border-emerald-200 pt-3 grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-[var(--color-text-muted)]">Appointment</p>
              <p className="font-medium">{aptDate ? new Date(aptDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Scheduled'}</p>
              <span className={`text-xs font-semibold ${isToday ? 'text-amber-600' : 'text-blue-600'}`}>
                {isToday ? '⬤ Today' : '⬤ Upcoming'}
              </span>
            </div>
            {adv > 0 && (
              <div>
                <p className="text-xs text-[var(--color-text-muted)]">Advance Collected</p>
                <p className="font-bold text-emerald-700 text-base">₹{adv.toLocaleString('en-IN')}</p>
                {dueAmount > 0 && <p className="text-xs text-amber-600">Balance due: ₹{dueAmount.toLocaleString('en-IN')}</p>}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-3 justify-center">
          <button
            onClick={() => { setDone(false); setStep(1); setForm(BLANK); setRegistered(null); setAutoHint(null); }}
            className="btn btn-outline btn-sm"
          >
            Register Another
          </button>
          <button
            onClick={() => { window.dispatchEvent(new CustomEvent('ddc_patient_data_updated')); navigate(`/receptionist/patients/${patient.id}`); }}
            className="btn btn-sm bg-[var(--color-primary-500)] hover:bg-[var(--color-primary-600)] text-white flex items-center gap-1.5"
          >
            <Eye size={14} /> View Patient
          </button>
          <button
            onClick={() => { window.dispatchEvent(new CustomEvent('ddc_patient_data_updated')); navigate('/receptionist/patients'); }}
            className="btn btn-outline btn-sm flex items-center gap-1.5"
          >
            <Users size={14} /> All Patients
          </button>
        </div>
      </div>
    );
  }

  // ── Form ──────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/receptionist/patients')}
          className="w-8 h-8 rounded-lg border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-muted)] hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-text)] transition-colors"
        >
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-[var(--color-text)] flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-[var(--color-primary-500)] text-white flex items-center justify-center">
              <Users size={16} />
            </span>
            Register New Patient
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
            Step {step} of {STEPS.length} — <span className="font-medium text-[var(--color-text)]">{STEPS[step - 1].label}</span>
          </p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-0">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const done    = step > s.id;
          const active  = step === s.id;
          return (
            <div key={s.id} className="flex items-center flex-1">
              <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                done   ? 'text-emerald-700 bg-emerald-50'
                : active ? 'text-[var(--color-primary-700)] bg-[var(--color-primary-50)] ring-1 ring-[var(--color-primary-200)]'
                : 'text-[var(--color-text-muted)]'
              }`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                  done   ? 'bg-emerald-500 text-white'
                  : active ? 'bg-[var(--color-primary-500)] text-white'
                  : 'bg-[var(--color-bg-subtle)] text-[var(--color-text-muted)]'
                }`}>
                  {done ? '✓' : <Icon size={12} />}
                </div>
                <span className="hidden sm:block">{s.label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 rounded ${step > s.id ? 'bg-emerald-400' : 'bg-[var(--color-border)]'}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Form card */}
      <div className="card p-6 bg-white border border-[var(--color-border)] rounded-xl shadow-sm">

        {/* ── STEP 1: Personal Info ──────────────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-5">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg bg-[var(--color-primary-100)] flex items-center justify-center">
                <User size={14} className="text-[var(--color-primary-600)]" />
              </div>
              <h2 className="text-sm font-bold text-[var(--color-text)]">Personal Information</h2>
            </div>

            <Field label="Full Name" required error={errors.name}>
              <TextInput
                id="reg-name"
                placeholder="e.g. Aarav Patil"
                value={form.name}
                onChange={e => update('name', e.target.value)}
                error={errors.name}
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Age" required={!form.dob} error={errors.age} hint={form.dob ? 'Auto-calculated from DOB' : ''}>
                <TextInput
                  id="reg-age"
                  type="number"
                  min={1} max={120}
                  placeholder="e.g. 28"
                  value={form.age}
                  onChange={e => {
                    update('age', e.target.value);
                    // Auto-fill DOB from age
                    if (e.target.value && !isNaN(e.target.value)) {
                      const yr = new Date().getFullYear() - parseInt(e.target.value);
                      // Only prefill year, leave month/day blank
                    }
                  }}
                  error={errors.age}
                />
              </Field>
              <Field label="Date of Birth" hint="Optional — helps calculate accurate age">
                <TextInput
                  id="reg-dob"
                  type="date"
                  max={today()}
                  value={form.dob}
                  onChange={e => {
                    update('dob', e.target.value);
                    // Auto-calculate age from DOB
                    if (e.target.value) {
                      const born = new Date(e.target.value);
                      const now  = new Date();
                      const age  = now.getFullYear() - born.getFullYear() -
                        (now < new Date(now.getFullYear(), born.getMonth(), born.getDate()) ? 1 : 0);
                      if (age > 0 && age <= 120) update('age', String(age));
                    }
                  }}
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Gender" required error={errors.gender}>
                <SelectInput
                  id="reg-gender"
                  options={GENDER_OPTIONS}
                  placeholder="Select gender"
                  value={form.gender}
                  onChange={e => update('gender', e.target.value)}
                  error={errors.gender}
                />
              </Field>
              <Field label="Blood Group">
                <SelectInput
                  id="reg-blood"
                  options={BLOOD_GROUPS}
                  placeholder="Select"
                  value={form.bloodGroup}
                  onChange={e => update('bloodGroup', e.target.value)}
                />
              </Field>
            </div>
          </div>
        )}

        {/* ── STEP 2: Contact & Emergency ───────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-5">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center">
                <Phone size={14} className="text-blue-600" />
              </div>
              <h2 className="text-sm font-bold text-[var(--color-text)]">Contact Information</h2>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Mobile Number" required error={errors.phone} hint="10 digits only">
                <PhoneInput
                  id="reg-phone"
                  placeholder="9876543210"
                  value={form.phone}
                  onChange={e => update('phone', e.target.value)}
                  error={errors.phone}
                />
              </Field>
              <Field label="Alternate Phone" hint="Optional">
                <PhoneInput
                  id="reg-altphone"
                  placeholder="9876543210"
                  value={form.altPhone}
                  onChange={e => update('altPhone', e.target.value)}
                />
              </Field>
            </div>

            <Field label="Email Address" hint="Optional — for appointment reminders" error={errors.email}>
              <TextInput
                id="reg-email"
                type="email"
                placeholder="patient@email.com"
                value={form.email}
                onChange={e => update('email', e.target.value)}
                error={errors.email}
              />
            </Field>

            <Field label="Full Address" required error={errors.address}>
              <textarea
                id="reg-address"
                rows={2}
                placeholder="House/Flat No, Colony, Sector…"
                value={form.address}
                onChange={e => update('address', e.target.value)}
                className={`form-input w-full text-sm resize-none ${errors.address ? 'border-rose-400' : ''}`}
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="City" hint="Optional">
                <TextInput placeholder="e.g. New Delhi" value={form.city} onChange={e => update('city', e.target.value)} />
              </Field>
              <Field label="PIN Code" hint="Optional">
                <TextInput placeholder="e.g. 110075" value={form.pincode} onChange={e => update('pincode', e.target.value)} />
              </Field>
            </div>

            {/* Emergency contact */}
            <div className="pt-4 border-t border-[var(--color-border)]">
              <h3 className="text-sm font-semibold text-[var(--color-text)] mb-3 flex items-center gap-2">
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-rose-50 text-rose-600 border border-rose-200">Emergency</span>
                Emergency Contact
                <span className="text-xs font-normal text-[var(--color-text-muted)]">(optional)</span>
              </h3>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Name">
                  <TextInput placeholder="Contact name" value={form.emergencyName} onChange={e => update('emergencyName', e.target.value)} />
                </Field>
                <Field label="Relation">
                  <TextInput placeholder="e.g. Father, Spouse" value={form.emergencyRelation} onChange={e => update('emergencyRelation', e.target.value)} />
                </Field>
                <Field label="Phone" error={errors.emergencyPhone}>
                  <PhoneInput placeholder="9876543210" value={form.emergencyPhone} onChange={e => update('emergencyPhone', e.target.value)} error={errors.emergencyPhone} />
                </Field>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 3: Medical + Appointment + Payment ───────────────────── */}
        {step === 3 && (
          <div className="space-y-5">
            {/* Medical info */}
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center">
                <Stethoscope size={14} className="text-emerald-600" />
              </div>
              <h2 className="text-sm font-bold text-[var(--color-text)]">Medical Information</h2>
            </div>

            <Field label="Chief Complaint / Reason for Visit" required error={errors.chiefComplaint}>
              <textarea
                id="reg-complaint"
                rows={2}
                placeholder="Why is the patient visiting? e.g. Tooth pain, Braces consultation"
                value={form.chiefComplaint}
                onChange={e => update('chiefComplaint', e.target.value)}
                className={`form-input w-full text-sm resize-none ${errors.chiefComplaint ? 'border-rose-400' : ''}`}
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Known Allergies">
                <TextInput placeholder="None / Penicillin / Dust…" value={form.allergies} onChange={e => update('allergies', e.target.value)} />
              </Field>
              <Field label="Current Medications" hint="Optional">
                <TextInput placeholder="e.g. None / Metformin…" value={form.currentMedications} onChange={e => update('currentMedications', e.target.value)} />
              </Field>
            </div>

            <Field label="Significant Medical History">
              <textarea
                rows={2}
                placeholder="Diabetes, Hypertension, Heart conditions, or 'No significant history'…"
                value={form.medicalHistory}
                onChange={e => update('medicalHistory', e.target.value)}
                className="form-input w-full text-sm resize-none"
              />
            </Field>

            {/* Appointment details */}
            <div className="pt-4 border-t border-[var(--color-border)]">
              <h3 className="text-sm font-semibold text-[var(--color-text)] mb-3 flex items-center gap-2">
                <Calendar size={14} className="text-[var(--color-primary-500)]" />
                Appointment Details
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Assign Doctor" required error={errors.assignedDoctorId}>
                  <SelectInput
                    id="reg-doctor"
                    options={doctors.map(d => ({ value: String(d.id || d._id), label: `${d.name}${d.specialization ? ' — ' + d.specialization : ''}` }))}
                    placeholder={doctors.length === 0 ? 'Loading doctors…' : 'Select doctor'}
                    value={form.assignedDoctorId}
                    onChange={e => update('assignedDoctorId', e.target.value)}
                    error={errors.assignedDoctorId}
                  />
                </Field>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-[var(--color-text-muted)]">Treatment Category</label>
                    <button
                      type="button"
                      onClick={() => setShowAddCat(true)}
                      className="text-xs text-[var(--color-primary-600)] hover:underline font-medium flex items-center gap-0.5"
                    >
                      <PlusCircle size={11} /> Add New
                    </button>
                  </div>
                  <SelectInput
                    id="reg-category"
                    options={categories.map(c => ({ value: String(c.id || c._id), label: c.name }))}
                    placeholder="Select category"
                    value={form.treatmentCategoryId}
                    onChange={e => handleCategoryChange(e.target.value)}
                  />
                </div>

                <div>
                  <Field label="Appointment Date">
                    <TextInput
                      id="reg-apt-date"
                      type="date"
                      min={today()}
                      value={form.appointmentDate}
                      onChange={e => { update('appointmentDate', e.target.value); setAutoHint(null); }}
                    />
                  </Field>
                  {autoHint && (
                    <p className="mt-1 text-xs text-emerald-700 font-medium flex items-center gap-1 bg-emerald-50 px-2 py-1 rounded border border-emerald-200">
                      ⚡ Auto-scheduled +{autoHint.days}d for {autoHint.catName}
                    </p>
                  )}
                </div>

                <Field label="Appointment Time" hint="Optional">
                  <TextInput
                    id="reg-apt-time"
                    type="time"
                    value={form.appointmentTime}
                    onChange={e => update('appointmentTime', e.target.value)}
                  />
                </Field>
              </div>
            </div>

            {/* Payment section */}
            <div className="pt-4 border-t border-[var(--color-border)]">
              <h3 className="text-sm font-semibold text-[var(--color-text)] mb-3 flex items-center gap-2">
                <IndianRupee size={14} className="text-amber-600" />
                Advance Payment & Fee
                <span className="text-xs font-normal text-[var(--color-text-muted)]">(optional)</span>
              </h3>

              <div className="grid grid-cols-3 gap-3 p-4 rounded-xl bg-[var(--color-bg-subtle)] border border-[var(--color-border)]">
                <Field label="Advance Amount (₹)" hint="Amount collected today">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] text-sm font-bold">₹</span>
                    <TextInput
                      id="reg-advance"
                      type="number"
                      min={0}
                      step={100}
                      placeholder="0"
                      value={form.advancePayment}
                      onChange={e => update('advancePayment', e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </Field>

                <Field label="Estimated Total Fee (₹)">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] text-sm font-bold">₹</span>
                    <TextInput
                      id="reg-total-fee"
                      type="number"
                      min={0}
                      step={500}
                      placeholder="0"
                      value={form.totalFee}
                      onChange={e => update('totalFee', e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </Field>

                <Field label="Payment Mode">
                  <SelectInput
                    id="reg-pay-mode"
                    options={PAYMENT_MODES}
                    value={form.paymentMode}
                    onChange={e => update('paymentMode', e.target.value)}
                  />
                </Field>
              </div>

              {/* Payment summary bar */}
              {(advance > 0 || totalFee > 0) && (
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-800">
                  <div className="flex items-center gap-4">
                    <span>Advance: <strong>₹{advance.toLocaleString('en-IN')}</strong></span>
                    {totalFee > 0 && <span>Total: <strong>₹{totalFee.toLocaleString('en-IN')}</strong></span>}
                    {totalFee > 0 && due > 0 && <span className="text-amber-700">Balance Due: <strong>₹{due.toLocaleString('en-IN')}</strong></span>}
                  </div>
                  <span className={`px-2 py-0.5 rounded font-semibold text-[11px] ${
                    payStatus === 'Fully Paid'     ? 'bg-emerald-600 text-white'
                    : payStatus === 'Partial Advance' ? 'bg-amber-500 text-white'
                    : 'bg-white text-slate-600 border border-slate-200'
                  }`}>
                    {payStatus}
                  </span>
                </div>
              )}

              <div className="mt-3">
                <Field label="Payment Notes" hint="Optional — e.g. 'Registration advance', 'Cash received'">
                  <TextInput
                    placeholder="e.g. Registration deposit via UPI"
                    value={form.paymentNotes}
                    onChange={e => update('paymentNotes', e.target.value)}
                  />
                </Field>
              </div>
            </div>

            {/* Additional notes */}
            <Field label="Additional Notes" hint="Optional">
              <textarea
                rows={2}
                placeholder="Any special requirements, referral source, or relevant notes…"
                value={form.notes}
                onChange={e => update('notes', e.target.value)}
                className="form-input w-full text-sm resize-none"
              />
            </Field>
          </div>
        )}
      </div>

      {/* Navigation buttons */}
      <div className="flex items-center justify-between">
        <button
          onClick={step === 1 ? () => navigate('/receptionist/patients') : prev}
          className="flex items-center gap-2 text-sm px-4 h-10 rounded-xl border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-text)] transition-colors font-medium cursor-pointer"
        >
          <ChevronLeft size={15} /> {step === 1 ? 'Cancel' : 'Back'}
        </button>

        <div className="flex items-center gap-2">
          {/* Step dots */}
          {STEPS.map(s => (
            <div
              key={s.id}
              className={`w-2 h-2 rounded-full transition-all ${
                step === s.id ? 'bg-[var(--color-primary-500)] w-4' : step > s.id ? 'bg-emerald-400' : 'bg-[var(--color-border)]'
              }`}
            />
          ))}
        </div>

        {step < STEPS.length ? (
          <button
            onClick={next}
            className="flex items-center gap-2 text-sm px-5 h-10 rounded-xl bg-[var(--color-primary-500)] text-white hover:bg-[var(--color-primary-600)] transition-colors font-semibold cursor-pointer shadow-sm"
          >
            Continue <ChevronRight size={15} />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex items-center gap-2 text-sm px-5 h-10 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60 cursor-pointer transition-colors font-semibold shadow-sm"
          >
            {loading
              ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Registering…</>
              : <><CheckCircle2 size={15} /> Register Patient</>
            }
          </button>
        )}
      </div>

      {/* Add Category Modal */}
      {showAddCat && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowAddCat(false)}>
          <div className="card p-6 w-full max-w-sm space-y-4 bg-white" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-[var(--color-text)]">New Treatment Category</h3>
            <div className="space-y-3">
              <Field label="Category Name" required>
                <TextInput placeholder="e.g. Implantology" value={newCat.name} onChange={e => setNewCat(c => ({ ...c, name: e.target.value }))} />
              </Field>
              <Field label="Short Code" required>
                <TextInput placeholder="e.g. IMPL" value={newCat.code} onChange={e => setNewCat(c => ({ ...c, code: e.target.value.toUpperCase() }))} maxLength={10} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Duration (mins)">
                  <TextInput type="number" min={5} value={newCat.defaultDurationMinutes} onChange={e => setNewCat(c => ({ ...c, defaultDurationMinutes: e.target.value }))} />
                </Field>
                <Field label="Follow-up (days)">
                  <TextInput type="number" min={0} value={newCat.defaultFollowUpDays} onChange={e => setNewCat(c => ({ ...c, defaultFollowUpDays: e.target.value }))} />
                </Field>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowAddCat(false)} disabled={catSaving} className="btn btn-outline btn-sm">Cancel</button>
              <button onClick={handleCreateCategory} disabled={catSaving || !newCat.name.trim() || !newCat.code.trim()} className="btn btn-primary btn-sm">
                {catSaving ? 'Saving…' : 'Add Category'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
