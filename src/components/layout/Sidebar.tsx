import { Link, useLocation } from "react-router-dom";
import { Button } from "../../components/ui/button";
import { useAuth } from "../../contexts/AuthContext";
import {
  LayoutDashboard,
  Users,
  Folder,
  CheckSquare,
  BarChart3,
  DollarSign,
  FileText,
  Megaphone,
  Settings,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";

interface NavItem {
  label: string;
  icon: LucideIcon;
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
  { label: "Dashboard", icon: LayoutDashboard, path: "/admin/dashboard" },
  { label: "Leads", icon: BarChart3, path: "/admin/leads" },
  { label: "Projects", icon: Folder, path: "/admin/projects" },
  { label: "Tasks", icon: CheckSquare, path: "/admin/tasks" },
  { label: "People", icon: Users, path: "/admin/people" },
  { label: "Financials", icon: DollarSign, path: "/admin/financials" },
  { label: "Payroll", icon: FileText, path: "/admin/payroll" },
  { label: "Reports", icon: FileText, path: "/admin/reports" },
  { label: "Announcements", icon: Megaphone, path: "/admin/announcements" },
  { label: "Settings", icon: Settings, path: "/admin/settings" },
];

const employeeNavItems: NavItem[] = [
  { label: "Overview", icon: LayoutDashboard, path: "/portal/overview" },
  { label: "My Tasks", icon: CheckSquare, path: "/portal/tasks" },
  { label: "Projects", icon: Folder, path: "/portal/projects" },
  { label: "Leads", icon: BarChart3, path: "/portal/leads", msOnly: true },
  { label: "Financials", icon: DollarSign, path: "/portal/financials", financeOnly: true },
  { label: "Payroll", icon: FileText, path: "/portal/payroll", financeOnly: true },
  { label: "Whiteboard", icon: FileText, path: "/portal/whiteboard" },
];

export default function Sidebar({ collapsed, onToggle, isAdmin }: SidebarProps) {
  const location = useLocation();
  const { isFinance, isMS } = useAuth();

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkScreen = () => setIsMobile(window.innerWidth < 768);
    checkScreen();
    window.addEventListener("resize", checkScreen);
    return () => window.removeEventListener("resize", checkScreen);
  }, []);

  const navItems = isAdmin
    ? adminNavItems
    : employeeNavItems.filter((item) => {
        if (item.financeOnly && !isFinance()) return false;
        if (item.msOnly && !isMS()) return false;
        return true;
      });

  return (
    <>
      {/* Mobile Overlay */}
      {isMobile && !collapsed && (
        <div
          className="fixed inset-0 bg-black/40 z-40"
          onClick={onToggle}
        />
      )}

      <aside
        className={`
          fixed md:static top-0 left-0 h-full z-50
          flex flex-col border-r bg-background transition-all duration-300
          ${isMobile
            ? collapsed
              ? "-translate-x-full w-64"
              : "translate-x-0 w-64"
            : collapsed
              ? "w-16"
              : "w-64"
          }
        `}
      >
        {/* Header */}
        <div
          onClick={onToggle}
          className="flex items-center border-b p-4 cursor-pointer"
        >
          {collapsed ? (
            <img src="/Logo-Icon.png" alt="Logo" className="h-7 mx-auto" />
          ) : (
            <div className="flex items-center gap-2">
              <img src="/GRAVIUM.png" alt="Gravium" className="h-7" />
              <span className="font-semibold tracking-tight">OS</span>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 p-2 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;

            return (
              <Link key={item.path} to={item.path}>
                <Button
                  variant={isActive ? "secondary" : "ghost"}
                  className={`w-full ${
                    collapsed && !isMobile
                      ? "justify-center px-0"
                      : "justify-start gap-2 px-3"
                  }`}
                >
                  <Icon size={16} />
                  {(!collapsed || isMobile) && item.label}
                </Button>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        {(!collapsed || isMobile) && (
          <div className="p-3 border-t text-xs text-muted-foreground">
            Gravium OS v1.0
          </div>
        )}
      </aside>
    </>
  );
}