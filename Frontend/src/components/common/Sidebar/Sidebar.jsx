import { useDispatch, useSelector } from 'react-redux';
import { toggleSidebar } from '../../../app/store';
import { useAuth } from '../../../hooks/useAuth';
import { LogOut, ChevronLeft, ChevronRight } from 'lucide-react';
import SidebarNav from './SidebarNav';
import Avatar from '../../ui/Avatar';

const ROLE_LABELS = {
  admin: 'Administrator',
  doctor: 'Doctor',
  receptionist: 'Receptionist',
};

const ROLE_BADGE = {
  admin:        'bg-violet-500/20 text-violet-300 border border-violet-500/20',
  doctor:       'bg-teal-500/20 text-teal-300 border border-teal-500/20',
  receptionist: 'bg-amber-500/20 text-amber-300 border border-amber-500/20',
};

const ROLE_DOT = {
  admin: 'bg-violet-400',
  doctor: 'bg-teal-400',
  receptionist: 'bg-amber-400',
};

export default function Sidebar() {
  const dispatch = useDispatch();
  const { sidebarCollapsed, sidebarMobileOpen } = useSelector(state => state.ui);
  const { user, role, logout } = useAuth();

  return (
    <aside
      className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''} ${sidebarMobileOpen ? 'open' : ''}`}
      aria-label="Application sidebar"
    >
      {/* ── Brand Header ── */}
      <div className="sidebar-brand-header">
        <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'}`}>
          {/* Logo Icon */}
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #2563eb 0%, #0ea5e9 100%)', boxShadow: '0 4px 14px rgba(37,99,235,0.4)' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 2C8 2 4 5 4 9c0 2.5 1 4 2 5.5S8 17 8 22h8c0-5 2-4 4-7.5s2-3 2-5.5c0-4-4-7-8-7z" />
            </svg>
          </div>

          {/* Brand text */}
          {!sidebarCollapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-white truncate leading-tight tracking-tight" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                Dwarka Dental
              </p>
              <p className="text-[10px] text-blue-300/70 truncate font-medium tracking-wide uppercase">
                Clinic Management
              </p>
            </div>
          )}
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => dispatch(toggleSidebar())}
          className={`hidden md:flex items-center justify-center rounded-lg transition-colors cursor-pointer flex-shrink-0 ${sidebarCollapsed ? 'mt-3 mx-auto w-7 h-7' : 'absolute right-3 top-5 w-7 h-7'}`}
          style={{ background: 'rgba(255,255,255,0.06)', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.08)' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; e.currentTarget.style.color = '#e2e8f0'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#94a3b8'; }}
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      {/* ── Role badge ── */}
      {!sidebarCollapsed && (
        <div className="px-4 pt-3 pb-1">
          <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest px-2.5 py-1 rounded-full ${ROLE_BADGE[role] || 'bg-white/10 text-slate-300'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${ROLE_DOT[role] || 'bg-slate-400'}`} />
            {ROLE_LABELS[role] || role}
          </span>
        </div>
      )}

      {/* ── Navigation ── */}
      <SidebarNav collapsed={sidebarCollapsed} />

      {/* ── User Footer ── */}
      <div className="border-t flex-shrink-0 p-3" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
        <div className={`flex items-center gap-3 p-2 rounded-xl transition-colors ${sidebarCollapsed ? 'justify-center' : ''}`}
          style={{ background: 'rgba(255,255,255,0.03)' }}
        >
          <Avatar name={user?.name || ''} size="sm" />
          {!sidebarCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-slate-100 truncate leading-tight">{user?.name}</p>
              <p className="text-[11px] text-slate-500 truncate mt-0.5">{user?.email}</p>
            </div>
          )}
          <button
            onClick={logout}
            className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg transition-colors cursor-pointer"
            style={{ color: '#64748b' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.15)'; e.currentTarget.style.color = '#f87171'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#64748b'; }}
            aria-label="Log out"
            title="Log out"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </aside>
  );
}
