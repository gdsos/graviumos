import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';

import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { OperationFeedbackProvider } from './contexts/OperationFeedbackContext';

import LoginPage from './pages/auth/LoginPage';
import CreateAdminPage from './pages/auth/CreateAdminPage';
import AppLayout from './components/layout/AppLayout';
import { AppLoader } from './components/common/AppLoader';

// Admin pages
import Dashboard from './pages/admin/Dashboard';
import Leads from './pages/admin/Leads';
import Projects from './pages/admin/Projects';
import Tasks from './pages/admin/Tasks';
import People from './pages/admin/People';
import VendorsPage from './pages/VendorsPage';
import ItemsPage from './pages/ItemsPage';
import TimelinePage from './pages/TimelinePage';
import CostEstimatesPage from './pages/CostEstimatesPage';
import Financials from './pages/admin/Financials';
import Payroll from './pages/admin/Payroll';
import Reports from './pages/admin/Reports';
import Settings from './pages/admin/Settings';
import Announcements from './pages/admin/Announcements';

// Employee portal pages
import Overview from './pages/portal/Overview';
import MyTasks from './pages/portal/MyTasks';
import PortalProjects from './pages/portal/PortalProjects';
import Whiteboard from './pages/portal/Whiteboard';
import Profile from './pages/portal/Profile';
import PortalLeads from './pages/portal/PortalLeads';
import PortalFinancials from './pages/portal/PortalFinancials';
import PortalPayroll from './pages/portal/PortalPayroll';

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  if (loading) return <AppLoader />;
  if (!user) return <Navigate to="/login/admin" replace />;
  if (profile && profile.role !== 'super_admin') return <Navigate to="/portal/overview" replace />;
  return <>{children}</>;
}

function EmployeeRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <AppLoader />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function InitialLoaderBridge() {
  const { loading } = useAuth();

  useEffect(() => {
    if (loading) return;

    const el = document.getElementById('app-loader');
    if (!el) return;

    el.style.opacity = '0';
    el.style.pointerEvents = 'none';
    el.style.transition = 'opacity 220ms ease';

    window.setTimeout(() => {
      el.remove();
    }, 240);
  }, [loading]);

  return null;
}

function AppWithTheme() {
  return (
    <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<LoginPage portalType="employee" />} />
          <Route path="/login/admin" element={<LoginPage portalType="admin" />} />
          <Route path="/admin/create" element={<CreateAdminPage />} />

          <Route path="/admin" element={<AdminRoute><AppLayout isAdmin={true} /></AdminRoute>}>
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="leads" element={<Leads />} />
            <Route path="projects" element={<Projects />} />
            <Route path="items" element={<ItemsPage />} />
            <Route path="vendors" element={<VendorsPage />} />
            <Route path="cost-estimates" element={<CostEstimatesPage />} />
            <Route path="timeline" element={<TimelinePage />} />
            <Route path="tasks" element={<Tasks />} />
            <Route path="people" element={<People />} />
            <Route path="financials" element={<Financials />} />
            <Route path="payroll" element={<Payroll />} />
            <Route path="reports" element={<Reports />} />
            <Route path="settings" element={<Settings />} />
            <Route path="announcements" element={<Announcements />} />
          </Route>

          <Route path="/portal" element={<EmployeeRoute><AppLayout isAdmin={false} /></EmployeeRoute>}>
            <Route index element={<Navigate to="/portal/overview" replace />} />
            <Route path="overview" element={<Overview />} />
            <Route path="tasks" element={<MyTasks />} />
            <Route path="projects" element={<PortalProjects />} />
            <Route path="items" element={<ItemsPage />} />
            <Route path="vendors" element={<VendorsPage />} />
            <Route path="cost-estimates" element={<CostEstimatesPage />} />
            <Route path="timeline" element={<TimelinePage />} />
            <Route path="leads" element={<PortalLeads />} />
            <Route path="financials" element={<PortalFinancials />} />
            <Route path="payroll" element={<PortalPayroll />} />
            <Route path="whiteboard" element={<Whiteboard />} />
            <Route path="profile" element={<Profile />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
  );
}

export default function App() {
  // PWA update reload
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        window.location.reload();
      });
    }
  }, []);

  return (
    <ThemeProvider>
      <OperationFeedbackProvider>
        <AuthProvider>
          <InitialLoaderBridge />
          <AppWithTheme />
        </AuthProvider>
      </OperationFeedbackProvider>
    </ThemeProvider>
  );
}