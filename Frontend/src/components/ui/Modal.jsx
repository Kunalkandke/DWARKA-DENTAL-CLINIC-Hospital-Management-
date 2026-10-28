import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/**
 * Premium Modal dialog with Portal, scale-in animation, frosted backdrop.
 */
export default function Modal({ open, onClose, title, children, size = 'md', hideClose = false }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  const sizeStyles = {
    sm: 'w-full max-w-sm',
    md: 'w-full max-w-lg',
    lg: 'w-full max-w-2xl',
    xl: 'w-full max-w-3xl',
    '2xl': 'w-full max-w-5xl',
  };

  const modalNode = (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 999999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(6px)',
        padding: '16px',
        overflowY: 'auto',
        animation: 'fadeIn 0.2s ease',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div
        ref={dialogRef}
        style={{
          maxHeight: '88vh',
          backgroundColor: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 24px 64px rgba(15,23,42,0.18), 0 8px 24px rgba(15,23,42,0.08)',
          animation: 'scaleIn 0.22s ease',
        }}
        className={`rounded-2xl border border-slate-200/80 w-full relative z-10 my-auto overflow-hidden ${sizeStyles[size]}`}
      >
        {/* Premium Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-[var(--color-bg-subtle)] sticky top-0 z-20 flex-shrink-0">
          <h2
            id="modal-title"
            className="text-base font-bold text-[var(--color-text)] tracking-tight"
          >
            {title}
          </h2>
          {!hideClose && (
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-transparent border-none text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors cursor-pointer"
              aria-label="Close modal"
            >
              <X size={17} />
            </button>
          )}
        </div>

        {/* Scrollable Body */}
        <div
          style={{ maxHeight: 'calc(88vh - 66px)', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}
          className="p-6 flex-1 bg-white text-slate-900"
        >
          {children}
        </div>
      </div>
    </div>
  );

  return createPortal(modalNode, document.body);
}

/** Premium Confirm dialog */
export function ConfirmModal({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirm', variant = 'danger', loading = false }) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <p className="text-sm text-slate-600 leading-relaxed mb-6">{message}</p>
      <div className="flex gap-3 justify-end">
        <button
          onClick={onClose}
          className="btn btn-secondary btn-sm"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={loading}
          className={`btn btn-sm ${variant === 'danger' ? 'btn-danger' : 'btn-primary'} ${loading ? 'opacity-60 cursor-not-allowed' : ''}`}
        >
          {loading ? 'Please wait…' : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
