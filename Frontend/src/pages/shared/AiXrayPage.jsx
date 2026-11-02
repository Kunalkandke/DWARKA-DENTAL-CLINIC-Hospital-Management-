import { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import {
  Upload, Brain, CheckCircle2, AlertTriangle, Loader2,
  RefreshCw, Sparkles, XCircle, ChevronRight, ImageIcon,
} from 'lucide-react';
import { api } from '../../utils/api';

// ── Constants ──────────────────────────────────────────────────────────────────

const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png'];

/** Build absolute URL for an /uploads/... path so images work on Vercel too. */
function assetUrl(path) {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${API_BASE}${path}`;
}

/** Colour tokens per class name. */
function classColour(label) {
  switch (label) {
    case 'Cavity':         return { dot: 'bg-red-500',    badge: 'bg-red-100 text-red-700',    border: 'border-red-200',    bg: 'bg-red-50'    };
    case 'Impacted Tooth': return { dot: 'bg-orange-500', badge: 'bg-orange-100 text-orange-700', border: 'border-orange-200', bg: 'bg-orange-50' };
    case 'Fillings':       return { dot: 'bg-blue-500',   badge: 'bg-blue-100 text-blue-700',  border: 'border-blue-200',   bg: 'bg-blue-50'   };
    case 'Implant':        return { dot: 'bg-green-500',  badge: 'bg-green-100 text-green-700', border: 'border-green-200',  bg: 'bg-green-50'  };
    default:               return { dot: 'bg-slate-400',  badge: 'bg-slate-100 text-slate-700', border: 'border-slate-200',  bg: 'bg-slate-50'  };
  }
}

/** Top-level result pill props. */
function resultPresentation(result) {
  switch (result) {
    case 'cavity':
      return { icon: <AlertTriangle size={16} className="text-red-500" />, label: 'Cavity Detected', cls: 'bg-red-50 border-red-200 text-red-800' };
    case 'findings_detected':
      return { icon: <AlertTriangle size={16} className="text-orange-500" />, label: 'Findings Detected', cls: 'bg-orange-50 border-orange-200 text-orange-800' };
    default:
      return { icon: <CheckCircle2 size={16} className="text-green-500" />, label: 'No Findings Above Threshold', cls: 'bg-green-50 border-green-200 text-green-800' };
  }
}

// ── Sub-components ─────────────────────────────────────────────────────────────

/** Persistent disclaimer strip. */
function Disclaimer() {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[11px] text-amber-900 leading-relaxed">
      <span className="font-semibold">⚠ AI decision support only.</span>{' '}
      Trained on panoramic X-rays. Cavity detection is the least reliable class.
      A qualified dentist must review every result.
    </div>
  );
}

/** Single finding row. */
function FindingRow({ finding }) {
  const c = classColour(finding.label);
  const pct = Math.round((finding.confidence ?? 0) * 100);
  return (
    <div className={`p-3 rounded-lg border ${c.border} ${c.bg} space-y-1`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-[var(--color-text)] flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${c.dot} inline-block flex-shrink-0`} />
          {finding.label}
        </span>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${c.badge}`}>
          {pct}% confidence
        </span>
      </div>
      {finding.suggestion && (
        <p className="text-[11px] text-[var(--color-text-muted)]">
          <span className="font-semibold">Next step:</span> {finding.suggestion}
        </p>
      )}
    </div>
  );
}

/** History list item. */
function HistoryItem({ report, isActive, onClick }) {
  const pres = resultPresentation(report.result);
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2.5 rounded-lg border transition-colors flex items-center justify-between gap-2
        ${isActive
          ? 'border-[var(--color-primary-400)] bg-[var(--color-primary-50)]'
          : 'border-[var(--color-border)] hover:border-[var(--color-primary-300)] hover:bg-[var(--color-primary-50)]/50'
        }`}
    >
      <div className="min-w-0">
        <p className="text-xs font-semibold text-[var(--color-text)] truncate">{report.date}</p>
        <p className={`text-[11px] mt-0.5 font-medium ${pres.cls.split(' ')[2]}`}>{pres.label}</p>
        <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
          {Array.isArray(report.findings) ? report.findings.length : 0} finding(s)
        </p>
      </div>
      <ChevronRight size={14} className="text-[var(--color-text-muted)] flex-shrink-0" />
    </button>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function AiXrayPage() {
  // Auth
  const role = useSelector((s) => s.auth.role);
  const canReview = role === 'doctor' || role === 'admin';

  // Patients
  const [patients, setPatients] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState('');

  // Upload
  const [file, setFile]           = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [fileError, setFileError]   = useState('');

  // Analysis state
  const [analyzing, setAnalyzing] = useState(false);
  const [report, setReport]       = useState(null);
  const [error, setError]         = useState('');

  // Image toggle
  const [showAnnotated, setShowAnnotated] = useState(true);

  // History
  const [history, setHistory]         = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Doctor review
  const [reviewStatus, setReviewStatus]     = useState('');   // 'confirmed' | 'rejected'
  const [reviewNotes, setReviewNotes]       = useState('');
  const [reviewLoading, setReviewLoading]   = useState(false);
  const [reviewError, setReviewError]       = useState('');
  const [reviewSuccess, setReviewSuccess]   = useState(false);

  // ── Load patients once ────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        const res = await api.getPatients({ limit: 500 });
        const list = res.data?.data || (Array.isArray(res.data) ? res.data : []);
        setPatients(list);
        if (list.length > 0) setSelectedPatientId(list[0].id || list[0]._id || '');
      } catch (err) {
        console.error('Failed to load patients', err);
      }
    }
    load();
  }, []);

  // ── Load history when patient changes ────────────────────────────────────
  useEffect(() => {
    if (!selectedPatientId) { setHistory([]); return; }
    let cancelled = false;
    setHistoryLoading(true);
    api.getAiReports(selectedPatientId)
      .then((res) => {
        if (!cancelled) setHistory(Array.isArray(res) ? res : (res.data ?? []));
      })
      .catch(() => { if (!cancelled) setHistory([]); })
      .finally(() => { if (!cancelled) setHistoryLoading(false); });
    return () => { cancelled = true; };
  }, [selectedPatientId]);

  // ── File validation ───────────────────────────────────────────────────────
  const validateAndSet = useCallback((f) => {
    if (!f) return;
    if (!ALLOWED_TYPES.includes(f.type)) {
      setFileError('Only JPG or PNG images are accepted.');
      return;
    }
    if (f.size > MAX_FILE_BYTES) {
      setFileError('File exceeds 10 MB. Please choose a smaller image.');
      return;
    }
    setFileError('');
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    setReport(null);
    setError('');
    setShowAnnotated(true);
  }, []);

  // ── Run analysis ──────────────────────────────────────────────────────────
  async function runAnalysis() {
    if (!file || !selectedPatientId) return;
    setAnalyzing(true);
    setReport(null);
    setError('');
    setReviewStatus('');
    setReviewNotes('');
    setReviewSuccess(false);

    try {
      const res = await api.uploadXray(selectedPatientId, file);
      const r = res?.data?.report ?? res?.report;
      if (!r) throw new Error('Unexpected response shape from server.');
      setReport(r);
      // Reload history to include the new report
      const hRes = await api.getAiReports(selectedPatientId);
      setHistory(Array.isArray(hRes) ? hRes : (hRes.data ?? []));
    } catch (err) {
      setError(err.message || 'Analysis failed. Please try again.');
    } finally {
      setAnalyzing(false);
    }
  }

  // ── Open a historical report ──────────────────────────────────────────────
  function openHistoricReport(r) {
    setReport(r);
    setFile(null);
    setPreviewUrl('');
    setFileError('');
    setError('');
    setShowAnnotated(true);
    // Pre-fill existing review if any
    setReviewStatus(r.doctorReview || '');
    setReviewNotes(r.doctorNotes || '');
    setReviewSuccess(false);
  }

  // ── Doctor review submit ──────────────────────────────────────────────────
  async function submitReview() {
    if (!report?.id || !reviewStatus) return;
    setReviewLoading(true);
    setReviewError('');
    try {
      await api.reviewAiReport(report.id, {
        doctorReview: reviewStatus,
        doctorNotes: reviewNotes,
      });
      setReport((prev) => prev ? { ...prev, doctorReview: reviewStatus, doctorNotes: reviewNotes } : prev);
      setReviewSuccess(true);
    } catch (err) {
      setReviewError(err.message || 'Failed to save review.');
    } finally {
      setReviewLoading(false);
    }
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const canScan = !!file && !!selectedPatientId && !analyzing;
  const displayedImageUrl = report
    ? (showAnnotated && report.annotatedImage
        ? assetUrl(report.annotatedImage)
        : assetUrl(report.image))
    : previewUrl || null;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-fade-in pb-10">

      {/* Page Header */}
      <div>
        <h1 className="text-xl font-bold text-[var(--color-text)] flex items-center gap-2">
          <Brain className="text-[var(--color-primary-500)]" size={24} />
          AI X-ray Analysis
        </h1>
        <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
          Upload a panoramic dental X-ray to detect fillings, implants, possible cavities, and impacted teeth.
        </p>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

        {/* ── Left column: Upload ───────────────────────────────────────── */}
        <div className="card p-6 space-y-5 bg-white border border-[var(--color-border)] rounded-xl shadow-xs">

          {/* Header */}
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[var(--color-text)] flex items-center gap-2">
              <Upload size={16} className="text-[var(--color-primary-500)]" />
              Upload X-ray Image
            </h2>
          </div>

          {/* Patient selector */}
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">
              Select Patient:
            </label>
            <select
              value={selectedPatientId}
              onChange={(e) => {
                setSelectedPatientId(e.target.value);
                setReport(null);
                setError('');
              }}
              className="form-input text-xs cursor-pointer"
            >
              {patients.length === 0 ? (
                <option value="">No patients found</option>
              ) : (
                patients.map((p) => (
                  <option key={p.id || p._id} value={p.id || p._id}>
                    {p.name} ({p.patientNumber || p.phone})
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Drag & drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              const f = e.dataTransfer.files?.[0];
              if (f) validateAndSet(f);
            }}
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-all flex flex-col items-center justify-center min-h-[220px] ${
              dragActive
                ? 'border-[var(--color-primary-500)] bg-[var(--color-primary-50)]'
                : 'border-blue-200 bg-blue-50/30 hover:border-blue-400'
            }`}
          >
            {previewUrl ? (
              <div className="relative w-full max-h-56 overflow-hidden rounded-lg border border-[var(--color-border)] group">
                <img
                  src={previewUrl}
                  alt="Selected X-ray preview"
                  className="w-full h-48 object-cover rounded-lg"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <label className="btn btn-primary btn-xs cursor-pointer">
                    Change Image
                    <input
                      type="file"
                      accept="image/jpeg,image/jpg,image/png"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && validateAndSet(e.target.files[0])}
                    />
                  </label>
                </div>
              </div>
            ) : (
              <>
                <div className="w-14 h-14 rounded-full bg-blue-100 text-[var(--color-primary-500)] flex items-center justify-center mb-3">
                  <Upload size={24} />
                </div>
                <p className="text-sm font-semibold text-[var(--color-text)]">Drop your X-ray here</p>
                <p className="text-xs text-[var(--color-text-muted)] mt-1">or click to browse files</p>
                <p className="text-[10px] text-slate-400 mt-2">JPG or PNG · max 10 MB · panoramic X-rays only</p>
                <label className="mt-4 btn btn-outline btn-xs cursor-pointer">
                  Browse Files
                  <input
                    type="file"
                    accept="image/jpeg,image/jpg,image/png"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && validateAndSet(e.target.files[0])}
                  />
                </label>
              </>
            )}
          </div>

          {/* File validation error */}
          {fileError && (
            <p className="text-xs text-red-600 flex items-center gap-1.5">
              <XCircle size={13} /> {fileError}
            </p>
          )}

          {/* Scan button */}
          {(file || previewUrl) && (
            <button
              onClick={runAnalysis}
              disabled={!canScan}
              className="w-full btn btn-primary py-2.5 flex items-center justify-center gap-2 font-medium cursor-pointer shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {analyzing ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Analyzing X-ray…
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  Start AI Scan
                </>
              )}
            </button>
          )}

          {/* History */}
          {selectedPatientId && (
            <div className="pt-2 border-t border-[var(--color-border)] space-y-2">
              <p className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                Previous Reports
              </p>
              {historyLoading && (
                <p className="text-xs text-[var(--color-text-muted)] flex items-center gap-1.5">
                  <Loader2 size={12} className="animate-spin" /> Loading…
                </p>
              )}
              {!historyLoading && history.length === 0 && (
                <p className="text-xs text-[var(--color-text-muted)]">No reports for this patient yet.</p>
              )}
              <div className="space-y-1.5 max-h-52 overflow-y-auto pr-0.5">
                {history.map((h) => (
                  <HistoryItem
                    key={h.id}
                    report={h}
                    isActive={report?.id === h.id}
                    onClick={() => openHistoricReport(h)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Right column: Results ─────────────────────────────────────── */}
        <div className="card p-6 space-y-5 bg-white border border-[var(--color-border)] rounded-xl shadow-xs min-h-[480px] flex flex-col">

          <div className="flex items-center justify-between border-b pb-3 border-[var(--color-border)]">
            <h2 className="text-sm font-semibold text-[var(--color-text)] flex items-center gap-2">
              <Brain size={16} className="text-violet-500" />
              Analysis Results
            </h2>
            {report?.modelVersion && (
              <span className="text-[10px] text-[var(--color-text-muted)] font-mono">{report.modelVersion}</span>
            )}
          </div>

          {/* Empty state */}
          {!analyzing && !report && !error && (
            <div className="flex-1 flex flex-col items-center justify-center py-16 text-center space-y-3">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                <Brain size={32} />
              </div>
              <div>
                <h3 className="text-sm font-medium text-[var(--color-text)]">No Analysis Yet</h3>
                <p className="text-xs text-[var(--color-text-muted)] max-w-xs mt-1">
                  Select a patient, upload a panoramic X-ray, and click <em>Start AI Scan</em>.
                </p>
              </div>
            </div>
          )}

          {/* Analyzing spinner */}
          {analyzing && (
            <div className="flex-1 flex flex-col items-center justify-center py-16 text-center space-y-4">
              <Loader2 size={44} className="animate-spin text-[var(--color-primary-500)]" />
              <p className="text-sm font-semibold text-[var(--color-text)]">Analyzing X-ray…</p>
              <p className="text-xs text-[var(--color-text-muted)]">This may take up to 60 seconds on first run.</p>
            </div>
          )}

          {/* Error state */}
          {!analyzing && error && (
            <div className="flex-1 flex flex-col items-center justify-center py-12 space-y-4 text-center">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <XCircle className="text-red-500" size={24} />
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--color-text)]">Analysis Failed</p>
                <p className="text-xs text-red-600 mt-1 max-w-xs">{error}</p>
              </div>
              <button
                onClick={runAnalysis}
                disabled={!canScan}
                className="btn btn-outline btn-sm flex items-center gap-1.5 disabled:opacity-50"
              >
                <RefreshCw size={14} /> Retry
              </button>
            </div>
          )}

          {/* Report display */}
          {!analyzing && report && (
            <div className="space-y-4 animate-fade-in flex-1 overflow-y-auto">

              {/* Result pill */}
              {(() => {
                const pres = resultPresentation(report.result);
                const pct  = Math.round((report.confidence ?? 0) * 100);
                return (
                  <div className={`flex items-center justify-between p-3 rounded-lg border ${pres.cls}`}>
                    <div className="flex items-center gap-2">
                      {pres.icon}
                      <div>
                        <p className="text-xs font-bold">{pres.label}</p>
                        <p className="text-[10px] opacity-80">
                          Highest confidence: {pct}%
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* X-ray images with toggle */}
              {(report.image || report.annotatedImage) && (
                <div className="space-y-2">
                  {/* Toggle buttons */}
                  {report.annotatedImage && report.image && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => setShowAnnotated(true)}
                        className={`btn btn-xs flex items-center gap-1 ${showAnnotated ? 'btn-primary' : 'btn-outline'}`}
                      >
                        <ImageIcon size={11} /> Annotated
                      </button>
                      <button
                        onClick={() => setShowAnnotated(false)}
                        className={`btn btn-xs flex items-center gap-1 ${!showAnnotated ? 'btn-primary' : 'btn-outline'}`}
                      >
                        <ImageIcon size={11} /> Original
                      </button>
                    </div>
                  )}
                  {displayedImageUrl && (
                    <img
                      src={displayedImageUrl}
                      alt={showAnnotated ? 'Annotated X-ray' : 'Original X-ray'}
                      className="w-full rounded-lg border border-[var(--color-border)] object-contain max-h-64 bg-black"
                    />
                  )}
                </div>
              )}

              {/* Summary */}
              {report.summary && (
                <div className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-200 text-xs space-y-1">
                  <p className="font-bold text-blue-900 flex items-center gap-1.5">
                    <Sparkles size={13} className="text-blue-600" />
                    AI Summary
                  </p>
                  <p className="text-blue-800 leading-relaxed">{report.summary}</p>
                </div>
              )}

              {/* Findings list */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-[var(--color-text)] uppercase tracking-wider">
                  Detected Findings ({Array.isArray(report.findings) ? report.findings.length : 0})
                </p>
                {Array.isArray(report.findings) && report.findings.length > 0 ? (
                  report.findings.map((f, i) => <FindingRow key={i} finding={f} />)
                ) : (
                  <p className="text-xs text-[var(--color-text-muted)] italic">
                    No findings above the confidence threshold.
                  </p>
                )}
              </div>

              {/* Disclaimer */}
              <Disclaimer />

              {/* Doctor review */}
              {canReview && (
                <div className="pt-2 border-t border-[var(--color-border)] space-y-3">
                  <p className="text-xs font-semibold text-[var(--color-text)]">Doctor Review</p>

                  {/* Existing review status */}
                  {report.doctorReview && (
                    <div className={`text-xs px-3 py-2 rounded-lg border font-medium
                      ${report.doctorReview === 'confirmed'
                        ? 'bg-green-50 border-green-200 text-green-800'
                        : 'bg-red-50 border-red-200 text-red-800'}`}>
                      {report.doctorReview === 'confirmed' ? '✓ Confirmed' : '✗ Rejected'}
                      {report.doctorNotes && <span className="font-normal"> — {report.doctorNotes}</span>}
                    </div>
                  )}

                  {/* Review form */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setReviewStatus('confirmed')}
                      className={`btn btn-sm flex-1 flex items-center justify-center gap-1.5
                        ${reviewStatus === 'confirmed' ? 'btn-primary' : 'btn-outline'}`}
                    >
                      <CheckCircle2 size={13} /> Confirm
                    </button>
                    <button
                      onClick={() => setReviewStatus('rejected')}
                      className={`btn btn-sm flex-1 flex items-center justify-center gap-1.5
                        ${reviewStatus === 'rejected' ? 'bg-red-500 text-white border-red-500' : 'btn-outline'}`}
                    >
                      <XCircle size={13} /> Reject
                    </button>
                  </div>

                  <textarea
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    placeholder="Add clinical notes (optional)…"
                    rows={2}
                    className="form-input text-xs w-full resize-none"
                  />

                  {reviewError && (
                    <p className="text-xs text-red-600">{reviewError}</p>
                  )}
                  {reviewSuccess && (
                    <p className="text-xs text-green-700 flex items-center gap-1">
                      <CheckCircle2 size={13} /> Review saved.
                    </p>
                  )}

                  <button
                    onClick={submitReview}
                    disabled={!reviewStatus || reviewLoading}
                    className="w-full btn btn-primary btn-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {reviewLoading ? <Loader2 size={13} className="animate-spin" /> : null}
                    Save Review
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bottom info banner */}
      <div className="card p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-blue-500 text-white flex items-center justify-center flex-shrink-0 mt-0.5">
          <Brain size={18} />
        </div>
        <div className="space-y-0.5 text-xs">
          <p className="font-bold text-blue-900">About This Tool</p>
          <p className="text-blue-800 leading-relaxed">
            This tool detects fillings, implants, possible cavities, and impacted teeth on panoramic dental X-rays.
            Results are generated by a YOLO11m model and must always be reviewed by a licensed dentist before any clinical decision is made.
          </p>
        </div>
      </div>
    </div>
  );
}
