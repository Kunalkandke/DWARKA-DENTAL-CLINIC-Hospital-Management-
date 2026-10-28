/**
 * Card component primitives — premium elevated design.
 */
export function Card({ children, className = '', noPad = false, ...rest }) {
  return (
    <div className={`card ${noPad ? '' : 'p-6'} ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '' }) {
  return (
    <div className={`flex items-center justify-between mb-5 ${className}`}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className = '' }) {
  return (
    <h2 className={`text-[0.9375rem] font-bold text-[var(--color-text)] tracking-tight ${className}`}>
      {children}
    </h2>
  );
}

export function CardContent({ children, className = '' }) {
  return <div className={className}>{children}</div>;
}

import { Link } from 'react-router-dom';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

/** Premium KPI metric card with icon, label, value, trend, and hover lift. */
export function KPICard({
  label,
  value,
  icon: Icon,
  iconColor = 'text-[var(--color-primary-500)]',
  iconBg = 'bg-[var(--color-primary-50)]',
  iconGradient,
  trend,
  trendLabel,
  className = '',
  onClick,
  to,
  accentColor,
  ...rest
}) {
  const content = (
    <div className="flex flex-col gap-3">
      {/* Top row: icon + trend */}
      <div className="flex items-start justify-between gap-2">
        {Icon && (
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}
            style={iconGradient ? { background: iconGradient } : undefined}
          >
            <Icon size={21} className={iconColor} aria-hidden="true" />
          </div>
        )}
        {trendLabel && <div className="ml-auto">{trendLabel}</div>}
      </div>

      {/* Value + label */}
      <div>
        <p className="text-2xl font-bold text-[var(--color-text)] leading-none tracking-tight">
          {value}
        </p>
        <p className="text-xs font-500 text-[var(--color-text-muted)] mt-1.5 uppercase tracking-wider">
          {label}
        </p>
      </div>
    </div>
  );

  const baseClass = `kpi-card p-5 block group ${className}`;

  if (to) {
    return (
      <Link to={to} className={baseClass} {...rest}>
        {content}
      </Link>
    );
  }

  if (onClick) {
    return (
      <div onClick={onClick} className={`${baseClass} cursor-pointer`} {...rest}>
        {content}
      </div>
    );
  }

  return (
    <div className={baseClass} {...rest}>
      {content}
    </div>
  );
}
