import { Outlet } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { closeMobileSidebar } from '../app/store';
import Sidebar from '../components/common/Sidebar/Sidebar';
import Header from '../components/common/Header';
import ToastContainer from '../components/ui/Toast';

/**
 * Main dashboard layout shell — sidebar + header + content area.
 * Premium layout with subtle gradient background and proper scroll handling.
 */
export default function DashboardLayout() {
  const dispatch = useDispatch();
  const { sidebarCollapsed, sidebarMobileOpen } = useSelector(state => state.ui);

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--color-bg)' }}>
      {/* Mobile sidebar backdrop */}
      {sidebarMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden backdrop-blur-sm"
          onClick={() => dispatch(closeMobileSidebar())}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <Sidebar />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 transition-all duration-300">
        <Header />
        <main
          className="flex-1 overflow-auto animate-fade-in"
          style={{ padding: '20px 24px' }}
        >
          <Outlet />
        </main>
      </div>

      <ToastContainer />
    </div>
  );
}
