import { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";

interface AppLayoutProps {
  isAdmin: boolean;
}

export default function AppLayout({ isAdmin }: AppLayoutProps) {
  const [collapsed, setCollapsed] = useState(true);

  return (

    <div className="flex h-screen overflow-hidden bg-canvas">

    <div className="flex h-screen bg-background overflow-hidden">

      {/* Sidebar */}
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(c => !c)}
        isAdmin={isAdmin}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar onMenuToggle={() => setSidebarCollapsed(c => !c)} isAdmin={isAdmin} />

      {/* Main */}
      <div className="flex flex-col flex-1 overflow-hidden">

        {/* ONLY ONE TOPBAR */}
        <TopBar onMenuToggle={() => setCollapsed(c => !c)} isAdmin={isAdmin} />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
