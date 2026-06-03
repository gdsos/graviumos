import { GraviumLogo } from '@/components/common/GraviumLogo';
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
  ReceiptIndianRupee,
  Store,
  Package,
  CalendarClock,
  ClipboardList
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { hasPageAccess, type PagePermissionKey } from "@/lib/pagePermissions";

interface NavItem {
  label: string;
  icon: LucideIcon;
  path: string;
  adminOnly?: boolean;
  financeOnly?: boolean;
  msOnly?: boolean;
  pagePermissionKey?: PagePermissionKey;
}

interface NavGroup {
  label?: string;
  items: NavItem[];
}

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  isAdmin: boolean;
}

const adminNavGroups: NavGroup[] = [
  {
    items: [
      { label: "Dashboard", icon: LayoutDashboard, path: "/admin/dashboard" },
      { label: "Projects", icon: Folder, path: "/admin/projects" },
      { label: "Tasks", icon: CheckSquare, path: "/admin/tasks" },
    ],
  },
  {
    label: "Procurement",
    items: [
      { label: "Items", icon: Package, path: "/admin/items" },
      { label: "Vendors", icon: Store, path: "/admin/vendors" },
      { label: "Cost Estimates", icon: ClipboardList, path: "/admin/cost-estimates" },
    ],
  },
  {
    label: "Execution",
    items: [
      { label: "Timeline", icon: CalendarClock, path: "/admin/timeline" },
    ],
  },
  {
    label: "Marketing & Sales",
    items: [
      { label: "Leads", icon: BarChart3, path: "/admin/leads" },
    ],
  },
  {
    label: "Finance",
    items: [
      { label: "Financials", icon: DollarSign, path: "/admin/financials" },
      { label: "Payroll", icon: ReceiptIndianRupee, path: "/admin/payroll" },
    ],
  },
  {
    label: "Admin",
    items: [
      { label: "People", icon: Users, path: "/admin/people" },
      { label: "Reports", icon: FileText, path: "/admin/reports" },
      { label: "Announcements", icon: Megaphone, path: "/admin/announcements" },
    ],
  },
];

const employeeNavGroups: NavGroup[] = [
  {
    items: [
      { label: "Overview", icon: LayoutDashboard, path: "/portal/overview" },
      { label: "Projects", icon: Folder, path: "/portal/projects", pagePermissionKey: "portal.projects" },
      { label: "My Tasks", icon: CheckSquare, path: "/portal/tasks" },
    ],
  },
  {
    label: "Procurement",
    items: [
      { label: "Items", icon: Package, path: "/portal/items", pagePermissionKey: "portal.items" },
      { label: "Vendors", icon: Store, path: "/portal/vendors", pagePermissionKey: "portal.vendors" },
      { label: "Cost Estimates", icon: ClipboardList, path: "/portal/cost-estimates", pagePermissionKey: "portal.cost-estimates" },
    ],
  },
  {
    label: "Execution",
    items: [
      { label: "Timeline", icon: CalendarClock, path: "/portal/timeline", pagePermissionKey: "portal.timeline" },
    ],
  },
  {
    label: "Marketing & Sales",
    items: [
      { label: "Leads", icon: BarChart3, path: "/portal/leads", pagePermissionKey: "portal.leads" },
    ],
  },
  {
    label: "Finance",
    items: [
      { label: "Financials", icon: DollarSign, path: "/portal/financials", pagePermissionKey: "portal.financials" },
      { label: "Payroll", icon: ReceiptIndianRupee, path: "/portal/payroll", pagePermissionKey: "portal.payroll" },
    ],
  },
  {
    label: "Utility",
    items: [
      { label: "Whiteboard", icon: FileText, path: "/portal/whiteboard", pagePermissionKey: "portal.whiteboard" },
    ],
  },
];

export default function Sidebar({ collapsed, onToggle, isAdmin }: SidebarProps) {
  const location = useLocation();
  const { profile } = useAuth();

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkScreen = () => setIsMobile(window.innerWidth < 768);
    checkScreen();
    window.addEventListener("resize", checkScreen);
    return () => window.removeEventListener("resize", checkScreen);
  }, []);

  const navGroups = (isAdmin ? adminNavGroups : employeeNavGroups)
    .map((group) => ({
      ...group,
      items: isAdmin
        ? group.items
        : group.items.filter((item) => {
            if (!item.pagePermissionKey) return true;

            return hasPageAccess(profile, item.pagePermissionKey, 'view');
          }),
    }))
    .filter((group) => group.items.length > 0);

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
          className="flex h-15 cursor-pointer items-center justify-center px-3"
        >
          {collapsed ? (
            <GraviumLogo variant="icon" className="h-7 w-auto object-contain" />
          ) : (
            <div className="flex w-full items-center justify-center gap-2">
              <GraviumLogo variant="wordmark" className="h-7 w-auto object-contain" />
              <span className="font-semibold tracking-tight">OS</span>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto p-2">
          <div className="space-y-3">
            {navGroups.map((group, groupIndex) => (
              <div key={group.label ?? `group-${groupIndex}`} className="space-y-1">
                {group.label && (!collapsed || isMobile) && (
                  <p className="px-3 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {group.label}
                  </p>
                )}

                {group.items.map((item) => {
                  const isActive = location.pathname === item.path;
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => {
                        if (isMobile && !collapsed) {
                          onToggle();
                        }
                      }}
                    >
                      <Button
                        variant={isActive ? "secondary" : "ghost"}
                        className={`w-full ${collapsed && !isMobile
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
              </div>
            ))}
          </div>
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