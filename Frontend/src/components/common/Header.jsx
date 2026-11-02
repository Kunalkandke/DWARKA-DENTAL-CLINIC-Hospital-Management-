import { useState } from 'react';
import { Bell, Menu, Search, X, ChevronRight } from 'lucide-react';
import { useDispatch } from 'react-redux';
import { toggleMobileSidebar } from '../../app/store';
import { useNotifications } from '../../hooks/useNotifications';
import Avatar from '../ui/Avatar';
import { useAuth } from '../../hooks/useAuth';
import NotificationPanel from './NotificationPanel';
import { useLocation, useSearchParams } from 'react-router-dom';

/** Derives a page title from the current route path. */
function usePageTitle() {
  const { pathname } = useLocation();
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length < 2) return 'Dashboard';
  if (segments.includes('patients') && segments.length >= 3) return 'Patient Profile';
  const last = segments[segments.length - 1];
  return last.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

/** Breadcrumb segments from path */
function useBreadcrumb() {
  const { pathname } = useLocation();
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length <= 1) return [];
  return segments.slice(1).map(s => s.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '));
}

export default function Header() {
  const dispatch = useDispatch();
  const { user } = useAuth();
  const { unreadCount } = useNotifications();
  const [notifOpen, setNotifOpen] = useState(false);
  const pageTitle = usePageTitle();
  const breadcrumbs = useBreadcrumb();

  const [searchParams, setSearchParams] = useSearchParams();
  const searchQuery = searchParams.get('q') || '';

  function handleSearchChange(e) {
    const val = e.target.value;
    if (val) setSearchParams({ q: val }, { replace: true });
    else setSearchParams({}, { replace: true });
  }

  function handleClearSearch() {
    setSearchParams({}, { replace: true });
  }

  return (
    <header
      className="sticky top-0 z-20 h-[52px] flex items-center gap-3 px-5"
      style={{
        background: 'rgba(255,255,255,0.95)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(226,232,240,0.8)',
        boxShadow: '0 1px 4px rgba(15,23,42,0.04)',
      }}
    >
      {/* Mobile menu toggle */}
      <button
        onClick={() => dispatch(toggleMobileSidebar())}
        className="md:hidden w-9 h-9 flex items-center justify-center rounded-xl text-[var(--color-text-muted)] hover:bg-[var(--color-bg-subtle)] transition-colors cursor-pointer"
        aria-label="Open navigation"
      >
        <Menu size={20} />
      </button>

      {/* Page title + breadcrumb */}
      <div className="hidden sm:flex flex-col justify-center min-w-0">
        {breadcrumbs.length > 1 ? (
          <div className="flex items-center gap-1 text-xs text-[var(--color-text-subtle)] mb-0.5">
            {breadcrumbs.slice(0, -1).map((b, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <ChevronRight size={10} />}
                {b}
              </span>
            ))}
            <ChevronRight size={10} />
          </div>
        ) : null}
        <h1 className="text-[15px] font-bold text-[var(--color-text)] leading-tight tracking-tight truncate">
          {pageTitle}
        </h1>
      </div>

      <div className="flex-1" />

      {/* Premium Search Bar */}
      <div
        className="hidden sm:flex items-center gap-2.5 px-3.5 h-9 rounded-xl transition-all"
        style={{
          background: 'var(--color-bg-subtle)',
          border: '1.5px solid var(--color-border)',
          minWidth: '220px',
          maxWidth: '320px',
          boxShadow: 'var(--shadow-xs)',
        }}
        onFocus={e => {
          e.currentTarget.style.background = '#fff';
          e.currentTarget.style.borderColor = 'var(--color-primary-400)';
          e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)';
        }}
        onBlur={e => {
          e.currentTarget.style.background = 'var(--color-bg-subtle)';
          e.currentTarget.style.borderColor = 'var(--color-border)';
          e.currentTarget.style.boxShadow = 'var(--shadow-xs)';
        }}
      >
        <Search size={14} className="text-[var(--color-text-subtle)] flex-shrink-0" />
        <input
          type="text"
          placeholder="Search patients, doctors..."
          value={searchQuery}
          onChange={handleSearchChange}
          className="bg-transparent border-none outline-none text-[13px] w-full text-[var(--color-text)] placeholder:text-[var(--color-text-subtle)] font-medium"
        />
        {searchQuery && (
          <button
            onClick={handleClearSearch}
            className="w-4 h-4 flex items-center justify-center rounded-full bg-slate-300 hover:bg-slate-400 transition-colors cursor-pointer flex-shrink-0"
            title="Clear search"
          >
            <X size={9} className="text-slate-600" />
          </button>
        )}
      </div>

      {/* Notification Bell */}
      <div className="relative">
        <button
          id="notifications-toggle"
          onClick={() => setNotifOpen(v => !v)}
          className="btn btn-ghost btn-sm relative w-8 h-8 rounded-lg"
          style={{ border: '1.5px solid var(--color-border)' }}
          aria-label={`Notifications${unreadCount > 0 ? ` — ${unreadCount} unread` : ''}`}
          aria-expanded={notifOpen}
          aria-controls="notifications-panel"
        >
          <Bell size={15} />
          {unreadCount > 0 && (
            <span
              className="absolute top-1 right-1 w-4 h-4 flex items-center justify-center text-white text-[9px] font-bold rounded-full"
              style={{
                background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                boxShadow: '0 1px 4px rgba(239,68,68,0.5)',
                minWidth: '16px',
              }}
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {notifOpen && (
          <NotificationPanel onClose={() => setNotifOpen(false)} />
        )}
      </div>

      {/* User section */}
      <div className="flex items-center gap-2.5 pl-2 border-l border-[var(--color-border)]">
        <div className="hidden md:flex flex-col items-end">
          <span className="text-[13px] font-semibold text-[var(--color-text)] leading-tight">
            {user?.name?.split(' ')[0] || 'User'}
          </span>
          <span className="text-[10px] text-[var(--color-text-subtle)] capitalize">{user?.role || 'Staff'}</span>
        </div>
        <Avatar name={user?.name || ''} size="sm" />
      </div>
    </header>
  );
}
