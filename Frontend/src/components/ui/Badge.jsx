/**
 * Badge — premium status pill component.
 * @param {Object} props
 * @param {'success'|'warning'|'danger'|'info'|'neutral'|'primary'|'accent'|'purple'} props.variant
 * @param {'sm'|'md'|'lg'} props.size
 * @param {boolean} props.dot — show colored dot indicator
 */
export default function Badge({ children, variant = 'neutral', size = 'md', dot = false, className = '' }) {
  const variantStyles = {
    success: 'bg-emerald-50 text-emerald-700 border border-emerald-200/80 ring-0',
    warning: 'bg-amber-50 text-amber-700 border border-amber-200/80',
    danger:  'bg-red-50 text-red-600 border border-red-200/80',
    info:    'bg-blue-50 text-blue-700 border border-blue-200/80',
    neutral: 'bg-slate-100 text-slate-600 border border-slate-200',
    primary: 'bg-[var(--color-primary-50)] text-[var(--color-primary-700)] border border-[var(--color-primary-200)]',
    accent:  'bg-[var(--color-accent-50)] text-[var(--color-accent-700)] border border-[var(--color-accent-200)]',
    purple:  'bg-violet-50 text-violet-700 border border-violet-200/80',
  };

  const dotColors = {
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    danger:  'bg-red-500',
    info:    'bg-blue-500',
    neutral: 'bg-slate-400',
    primary: 'bg-[var(--color-primary-500)]',
    accent:  'bg-[var(--color-accent-500)]',
    purple:  'bg-violet-500',
  };

  const sizeStyles = {
    sm: 'text-[10px] px-2 py-0.5 gap-1',
    md: 'text-[11px] px-2.5 py-1 gap-1.5',
    lg: 'text-xs px-3 py-1.5 gap-2',
  };

  return (
    <span
      className={`inline-flex items-center font-semibold rounded-full whitespace-nowrap ${variantStyles[variant] || variantStyles.neutral} ${sizeStyles[size]} ${className}`}
    >
      {dot && (
        <span className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColors[variant] || dotColors.neutral}`} />
      )}
      {children}
    </span>
  );
}

/** Maps appointment/patient status strings to badge variants. */
export function StatusBadge({ status }) {
  const map = {
    // Appointment statuses
    scheduled:    { variant: 'info',    label: 'Scheduled',    dot: true },
    confirmed:    { variant: 'primary', label: 'Confirmed',    dot: true },
    'in-progress':{ variant: 'warning', label: 'In Progress',  dot: true },
    in_progress:  { variant: 'warning', label: 'In Progress',  dot: true },
    completed:    { variant: 'success', label: 'Completed',    dot: true },
    cancelled:    { variant: 'danger',  label: 'Cancelled',    dot: true },
    'no-show':    { variant: 'neutral', label: 'No Show',      dot: true },
    missed:       { variant: 'danger',  label: 'Missed',       dot: true },
    arrived:      { variant: 'warning', label: 'Arrived',      dot: true },
    // Patient statuses
    new:          { variant: 'accent',  label: 'New',          dot: true },
    active:       { variant: 'success', label: 'Active',       dot: true },
    'follow-up':  { variant: 'warning', label: 'Follow-up',    dot: true },
    inactive:     { variant: 'neutral', label: 'Inactive',     dot: true },
    // Payment statuses
    paid:         { variant: 'success', label: 'Paid',         dot: true },
    pending:      { variant: 'warning', label: 'Pending',      dot: true },
    partial:      { variant: 'info',    label: 'Partial',      dot: true },
    refunded:     { variant: 'danger',  label: 'Refunded',     dot: true },
    // Staff/doctor
    'active-staff':  { variant: 'success', label: 'Active',   dot: true },
    inactive_staff:  { variant: 'neutral', label: 'Inactive', dot: true },
    // Follow-up
    'due-today':     { variant: 'danger',  label: 'Due Today',    dot: true },
    'due-tomorrow':  { variant: 'warning', label: 'Due Tomorrow', dot: true },
    upcoming:        { variant: 'info',    label: 'Upcoming',     dot: true },
  };

  const config = map[status] || { variant: 'neutral', label: status, dot: false };
  return <Badge variant={config.variant} dot={config.dot}>{config.label}</Badge>;
}
