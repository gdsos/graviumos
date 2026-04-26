import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { PorscheDesignSystemProvider } from '@porsche-design-system/components-react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { useEffect } from "react";

import LoginPage from './pages/auth/LoginPage';
import CreateAdminPage from './pages/auth/CreateAdminPage';
import AppLayout from './components/layout/AppLayout';

// Admin pages
import Dashboard from './pages/admin/Dashboard';
import Leads from './pages/admin/Leads';
import Projects from './pages/admin/Projects';
import Tasks from './pages/admin/Tasks';
import People from './pages/admin/People';
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
  if (loading) return <div className="min-h-screen bg-canvas flex items-center justify-center"><div className="text-primary">Loading...</div></div>;
  if (!user) return <Navigate to="/login/admin" replace />;
  if (profile && profile.role !== 'super_admin') return <Navigate to="/portal/overview" replace />;
  return <>{children}</>;
}

function EmployeeRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-canvas flex items-center justify-center"><div className="text-primary">Loading...</div></div>;
  if (!user) return <Navigate to="/login/employee" replace />;
  return <>{children}</>;
}

function AppWithTheme() {
  const { theme } = useTheme();
  return (
    <PorscheDesignSystemProvider theme={theme}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/login/admin" replace />} />
          <Route path="/login/admin" element={<LoginPage portalType="admin" />} />
          <Route path="/login/employee" element={<LoginPage portalType="employee" />} />
          <Route path="/admin/create" element={<CreateAdminPage />} />

          <Route path="/admin" element={<AdminRoute><AppLayout isAdmin={true} /></AdminRoute>}>
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="leads" element={<Leads />} />
            <Route path="projects" element={<Projects />} />
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
            <Route path="leads" element={<PortalLeads />} />
            <Route path="financials" element={<PortalFinancials />} />
            <Route path="payroll" element={<PortalPayroll />} />
            <Route path="whiteboard" element={<Whiteboard />} />
            <Route path="profile" element={<Profile />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </PorscheDesignSystemProvider>
  );
}

export default function App() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        window.location.reload();
      });
    }
  }, []);

  return (
    <ThemeProvider>
      <AuthProvider>
        <AppWithTheme />
      </AuthProvider>
    </ThemeProvider>
  );
}
