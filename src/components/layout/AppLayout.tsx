import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

interface AppLayoutProps {
  isAdmin: boolean;
}

export default function AppLayout({ isAdmin }: AppLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-muted/40 text-foreground">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(c => !c)}
        isAdmin={isAdmin}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar />

        <main className="flex-1 overflow-y-auto px-8 py-6">
  <div className="max-w-7xl mx-auto">
    <Outlet />
  </div>
</main>
      </div>
    </div>
  );
}