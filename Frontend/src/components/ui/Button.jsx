import { Loader2 } from 'lucide-react';

/**
 * Button component — premium solid variants, never transparent.
 * @param {'primary'|'secondary'|'danger'|'ghost'|'outline'|'success'|'teal'} variant
 * @param {'xs'|'sm'|'md'|'lg'} size
 * @param {boolean} loading
 * @param {boolean} disabled
 */
export default function Button({
  children,
  variant = 'primary',
  size = 'sm',
  loading = false,
  disabled = false,
  onClick,
  type = 'button',
  className = '',
  ...rest
}) {
  const sizeClass = {
    xs: 'btn-xs',
    sm: 'btn-sm',
    md: 'btn-md',
    lg: 'btn-lg',
  }[size] || 'btn-sm';

  const variantClass = {
    primary:   'btn-primary',
    secondary: 'btn-secondary',
    danger:    'btn-danger',
    ghost:     'btn-ghost',
    outline:   'btn-outline',
    success:   'btn-success',
    teal:      'btn-teal',
  }[variant] || 'btn-primary';

  const isDisabled = disabled || loading;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      className={`btn ${variantClass} ${sizeClass} ${isDisabled ? 'opacity-60 cursor-not-allowed pointer-events-none' : ''} ${className}`}
      {...rest}
    >
      {loading && <Loader2 size={14} className="animate-spin-slow" aria-hidden="true" />}
      {children}
    </button>
  );
}
