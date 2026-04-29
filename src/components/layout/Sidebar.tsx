import { Link, useLocation } from 'react-router-dom';
import { PIcon, PText } from '@porsche-design-system/components-react';
import { useAuth } from '../../contexts/AuthContext';

interface NavItem {
  label: string;
  icon: string;
  path: string;
  adminOnly?: boolean;
  financeOnly?: boolean;
  msOnly?: boolean;
}

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  isAdmin: boolean;
}

const adminNavItems: NavItem[] = [
  { label: 'Dashboard', icon: 'chart', path: '/admin/dashboard' },
  { label: 'Leads', icon: 'arrow-right', path: '/admin/leads' },
  { label: 'Projects', icon: 'configurate', path: '/admin/projects' },
  { label: 'Tasks', icon: 'check', path: '/admin/tasks' },
  { label: 'People', icon: 'group', path: '/admin/people' },
  { label: 'Financials', icon: 'calculator', path: '/admin/financials' },
  { label: 'Payroll', icon: 'document', path: '/admin/payroll' },
  { label: 'Reports', icon: 'file-excel', path: '/admin/reports' },
  { label: 'Announcements', icon: 'broadcast', path: '/admin/announcements' },
  { label: 'Settings', icon: 'adjust', path: '/admin/settings' },
];

const employeeNavItems: NavItem[] = [
  { label: 'Overview', icon: 'chart', path: '/portal/overview' },
  { label: 'My Tasks', icon: 'check', path: '/portal/tasks' },
  { label: 'Projects', icon: 'configurate', path: '/portal/projects' },
  { label: 'Leads', icon: 'arrow-right', path: '/portal/leads', msOnly: true },
  { label: 'Financials', icon: 'calculator', path: '/portal/financials', financeOnly: true },
  { label: 'Payroll', icon: 'document', path: '/portal/payroll', financeOnly: true },
  { label: 'Whiteboard', icon: 'edit', path: '/portal/whiteboard' },
  { label: 'Profile', icon: 'user', path: '/portal/profile' },
];

export default function Sidebar({ collapsed, onToggle, isAdmin }: SidebarProps) {
  const location = useLocation();
  const { profile, isFinance, isMS, signOut } = useAuth();

  const navItems = isAdmin ? adminNavItems : employeeNavItems.filter(item => {
    if (item.financeOnly && !isFinance()) return false;
    if (item.msOnly && !isMS()) return false;
    return true;
  });

  return (
    <>
      {/* Mobile backdrop: visible on < lg when sidebar is open (not collapsed) */}
      {!collapsed && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onToggle}
          aria-hidden="true"
        />
      )}
      <aside
        className={`flex flex-col bg-surface border-r border-contrast-low transition-all duration-300 z-50 fixed inset-y-0 left-0 lg:relative lg:inset-auto lg:left-auto lg:z-40 ${collapsed ? '-translate-x-full lg:translate-x-0' : 'translate-x-0'} lg:h-screen ${collapsed ? 'lg:w-16' : 'w-60 lg:w-60'}`}
        style={{ minHeight: '100vh' }}
      >
      {/* Logo area */}
      <div className={`flex items-center border-b border-contrast-low ${collapsed ? 'justify-center py-4 px-2' : 'px-5 py-4'}`} style={{ minHeight: '64px' }}>
        {collapsed ? (
          <button onClick={onToggle} className="flex items-center justify-center">
            <img
              src="/Logo-Icon.png"
              alt="GRAVIUM"
              style={{ height: '28px', filter: 'var(--logo-filter)' }}
              className="logo-icon"
            />
          </button>
        ) : (
          <div className="flex items-center justify-between w-full">
            <Link to={isAdmin ? '/admin/dashboard' : '/portal/overview'} className="flex items-center gap-1.5">
              <img
                src="/GRAVIUM.png"
                alt="GRAVIUM"
                style={{ height: '22px' }}
                className="logo-text"
              />
              <span className="font-bold text-primary" style={{ fontFamily: "'Montserrat', 'Arial Narrow', Arial, sans-serif", letterSpacing: '-0.02em', fontSize: '15px' }}>OS</span>
            </Link>
            <button onClick={onToggle} className="text-contrast-medium hover:text-primary transition-colors p-1">
              <PIcon name="arrow-compact-left" size="small" />
            </button>
          </div>
        )}
      </div>

      {/* Portal badge */}
      {!collapsed && (
        <div className="px-5 py-2">
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${isAdmin ? 'bg-primary text-canvas' : 'bg-surface text-contrast-medium border border-contrast-low'}`}
            style={{ fontFamily: "'Montserrat', 'Arial Narrow', Arial, sans-serif" }}>
            {isAdmin ? 'Admin' : profile?.role === 'department_head' ? 'Dept. Head' : 'Employee'}
          </span>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 overflow-y-auto">
        {navItems.map(item => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              title={collapsed ? item.label : undefined}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg mb-0.5 transition-all duration-150 group ${
                isActive
                  ? 'bg-primary text-canvas nav-link-active'
                  : 'text-contrast-high hover:bg-contrast-low/50 hover:text-primary'
              }`}
            >
              <PIcon
                name={item.icon as Parameters<typeof PIcon>[0]['name']}
                size="small"
                color="inherit"
              />
              {!collapsed && (
                <PText
                  size="small"
                  weight="semi-bold"
                  color="inherit"
                  style={{ fontFamily: "'Montserrat', 'Arial Narrow', Arial, sans-serif" }}
                >
                  {item.label}
                </PText>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className={`border-t border-contrast-low ${collapsed ? 'p-2' : 'p-3'}`}>
        {!collapsed && profile && (
          <div className="flex items-center gap-3 px-2 py-2 mb-2 rounded-lg bg-canvas">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-canvas text-xs font-bold flex-shrink-0">
              {profile.full_name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <PText size="x-small" weight="semi-bold" className="truncate">{profile.full_name || 'User'}</PText>
              <PText size="xx-small" color="contrast-medium" className="truncate">{profile.email}</PText>
            </div>
          </div>
        )}
        <button
          onClick={signOut}
          title={collapsed ? 'Sign Out' : undefined}
          className={`flex items-center gap-3 px-3 py-2 rounded-lg w-full text-contrast-high hover:bg-error-soft hover:text-error transition-colors ${collapsed ? 'justify-center' : ''}`}
        >
          <PIcon name="logout" size="small" color="inherit" />
          {!collapsed && (
            <PText size="small" color="inherit" style={{ fontFamily: "'Montserrat', 'Arial Narrow', Arial, sans-serif" }}>
              Sign Out
            </PText>
          )}
        </button>
      </div>
    </aside>
    </>
  );
}
