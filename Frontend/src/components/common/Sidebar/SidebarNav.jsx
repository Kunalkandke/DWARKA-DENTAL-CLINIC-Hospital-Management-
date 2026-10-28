import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Users, Calendar, UserCog,
  DollarSign, BarChart2, Bell, Settings, Stethoscope,
  ClipboardList, History, User, UserPlus, Tag, Brain,
  CheckCircle, ChevronRight,
} from 'lucide-react';
import { useSelector } from 'react-redux';

// ── Admin nav groups ────────────────────────────────────────────────────
const ADMIN_GROUPS = [
  {
    label: 'Main',
    items: [
      { label: 'Dashboard',    to: '/admin',              icon: LayoutDashboard, end: true },
      { label: 'Appointments', to: '/admin/appointments', icon: Calendar },
      { label: 'Patients',     to: '/admin/patients',     icon: Users },
    ],
  },
  {
    label: 'Management',
    items: [
      { label: 'Doctors',     to: '/admin/doctors',    icon: Stethoscope },
      { label: 'Staff',       to: '/admin/staff',      icon: UserCog },
      { label: 'Attendance',  to: '/admin/attendance', icon: CheckCircle },
      { label: 'Categories',  to: '/admin/categories', icon: Tag },
    ],
  },
  {
    label: 'Finance & Reports',
    items: [
      { label: 'Revenue',       to: '/admin/revenue',  icon: DollarSign },
      { label: 'Reports',       to: '/admin/reports',  icon: BarChart2 },
    ],
  },
  {
    label: 'System',
    items: [
      { label: 'Notifications', to: '/admin/notifications', icon: Bell },
      { label: 'Settings',      to: '/admin/settings',      icon: Settings },
    ],
  },
];

// ── Doctor nav ────────────────────────────────────────────────────────────
const DOCTOR_GROUPS = [
  {
    label: 'Main',
    items: [
      { label: 'Dashboard',           to: '/doctor',              icon: LayoutDashboard, end: true },
      { label: "Today's Appointments", to: '/doctor/appointments', icon: Calendar },
      { label: 'Patients',            to: '/doctor/patients',     icon: Users },
    ],
  },
  {
    label: 'Clinical',
    items: [
      { label: 'AI X-ray',         to: '/doctor/ai-xray',    icon: Brain },
      { label: 'Follow-ups',       to: '/doctor/follow-ups', icon: ClipboardList },
      { label: 'Clinical History', to: '/doctor/history',    icon: History },
    ],
  },
  {
    label: 'Account',
    items: [
      { label: 'Notifications', to: '/doctor/notifications', icon: Bell },
      { label: 'Profile',       to: '/doctor/profile',       icon: User },
    ],
  },
];

// ── Receptionist nav ────────────────────────────────────────────────────
const RECEPTIONIST_GROUPS = [
  {
    label: 'Main',
    items: [
      { label: 'Dashboard',         to: '/receptionist',              icon: LayoutDashboard, end: true },
      { label: 'Appointments',      to: '/receptionist/appointments', icon: Calendar },
      { label: 'Patients',          to: '/receptionist/patients',     icon: Users },
      { label: 'Register Patient',  to: '/receptionist/patients/new', icon: UserPlus },
    ],
  },
  {
    label: 'Operations',
    items: [
      { label: 'Payments',   to: '/receptionist/payments',   icon: DollarSign },
      { label: 'Staff',      to: '/receptionist/staff',      icon: UserCog },
      { label: 'AI X-ray',   to: '/receptionist/ai-xray',   icon: Brain },
      { label: 'Follow-ups', to: '/receptionist/follow-ups', icon: ClipboardList },
    ],
  },
  {
    label: 'Account',
    items: [
      { label: 'Notifications', to: '/receptionist/notifications', icon: Bell },
      { label: 'Profile',       to: '/receptionist/profile',       icon: User },
    ],
  },
];

const NAV_GROUPS = {
  admin:        ADMIN_GROUPS,
  doctor:       DOCTOR_GROUPS,
  receptionist: RECEPTIONIST_GROUPS,
};

export default function SidebarNav({ collapsed }) {
  const { role } = useSelector(state => state.auth);
  const groups = NAV_GROUPS[role] || [];

  return (
    <nav aria-label="Main navigation" className="flex-1 py-2 overflow-y-auto">
      {groups.map((group, gi) => (
        <div key={gi} className="mb-1">
          {/* Section label — hidden when collapsed */}
          {!collapsed && (
            <div className="sidebar-section-label">{group.label}</div>
          )}
          {collapsed && gi > 0 && (
            <div className="mx-4 my-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.07)' }} />
          )}

          <ul className="space-y-0.5" role="list">
            {group.items.map(({ label, to, icon: Icon, end }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={end}
                  className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                  aria-label={collapsed ? label : undefined}
                  title={collapsed ? label : undefined}
                >
                  {/* Icon container */}
                  <div className="sidebar-icon-wrap">
                    <Icon
                      size={17}
                      className="sidebar-icon flex-shrink-0"
                      aria-hidden="true"
                    />
                  </div>

                  {/* Label */}
                  {!collapsed && (
                    <span className="flex-1 truncate text-sm">{label}</span>
                  )}

                  {/* Chevron — shows on hover */}
                  {!collapsed && (
                    <ChevronRight
                      size={13}
                      className="opacity-0 group-hover:opacity-40 transition-opacity flex-shrink-0 text-slate-500"
                      aria-hidden="true"
                    />
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
