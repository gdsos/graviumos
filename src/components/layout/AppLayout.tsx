import { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import MobileBottomNav from "./MobileBottomNav";

interface AppLayoutProps {
  isAdmin: boolean;
}

export default function AppLayout({ isAdmin }: AppLayoutProps) {
  const [collapsed, setCollapsed] = useState(true);

  return (
    <div className="flex h-screen overflow-hidden bg-background">

      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <Sidebar
          collapsed={collapsed}
          onToggle={() => setCollapsed(c => !c)}
          isAdmin={isAdmin}
        />
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* ONLY ONE TOPBAR */}
        <TopBar
          onMenuToggle={() => setCollapsed(c => !c)}
        />

        <main className="flex-1 overflow-y-auto p-4 pb-28 sm:p-6 md:pb-6">
          <Outlet />
        </main>
      </div>

      <MobileBottomNav isAdmin={isAdmin} />

    </div>
  );
}