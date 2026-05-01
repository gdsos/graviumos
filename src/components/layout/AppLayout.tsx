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
    <div className="flex h-screen overflow-hidden bg-background">

      {/* Sidebar */}
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(c => !c)}
        isAdmin={isAdmin}
      />

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* ONLY ONE TOPBAR */}
        <TopBar
          onMenuToggle={() => setCollapsed(c => !c)}
        />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>

    </div>
  );
}