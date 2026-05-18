import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  CalendarClock,
  CheckSquare,
  ClipboardList,
  DollarSign,
  Folder,
  Home,
  LayoutGrid,
  MoreHorizontal,
  Package,
  Settings,
  Store,
} from 'lucide-react';

import { useAuth } from '@/contexts/AuthContext';

interface MobileBottomNavProps {
  isAdmin: boolean;
}

interface MobileNavItem {
  label: string;
  icon: typeof Home;
  path: string;
}

function getBasePath(isAdmin: boolean) {
  return isAdmin ? '/admin' : '/portal';
}

function getPrimaryNavItems(isAdmin: boolean): MobileNavItem[] {
  const basePath = getBasePath(isAdmin);

  return [
    {
      label: 'Home',
      icon: Home,
      path: isAdmin ? `${basePath}/dashboard` : `${basePath}/overview`,
    },
    {
      label: 'Projects',
      icon: Folder,
      path: `${basePath}/projects`,
    },
    {
      label: 'Tasks',
      icon: CheckSquare,
      path: `${basePath}/tasks`,
    },
    {
      label: 'Timeline',
      icon: CalendarClock,
      path: `${basePath}/timeline`,
    },
  ];
}

function getMoreNavItems(isAdmin: boolean, isFinance: boolean, isMS: boolean) {
  const basePath = getBasePath(isAdmin);

  const items: MobileNavItem[] = [
    {
      label: 'Cost Estimates',
      icon: ClipboardList,
      path: `${basePath}/cost-estimates`,
    },
    {
      label: 'Items',
      icon: Package,
      path: `${basePath}/items`,
    },
    {
      label: 'Vendors',
      icon: Store,
      path: `${basePath}/vendors`,
    },
  ];

  if (isAdmin || isFinance) {
    items.push({
      label: 'Financials',
      icon: DollarSign,
      path: `${basePath}/financials`,
    });
  }

  if (isAdmin || isMS) {
    items.push({
      label: 'Leads',
      icon: LayoutGrid,
      path: `${basePath}/leads`,
    });
  }

  if (isAdmin) {
    items.push({
      label: 'Settings',
      icon: Settings,
      path: `${basePath}/settings`,
    });
  }

  return items;
}

export default function MobileBottomNav({ isAdmin }: MobileBottomNavProps) {
  const location = useLocation();
  const { isFinance, isMS } = useAuth();
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const navRef = useRef<HTMLDivElement | null>(null);

  const primaryItems = getPrimaryNavItems(isAdmin);
  const moreItems = getMoreNavItems(isAdmin, isFinance(), isMS());
  const isMoreActive = moreItems.some(item => location.pathname === item.path);

  useEffect(() => {
    if (!isMoreOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;

      if (target && navRef.current?.contains(target)) return;

      setIsMoreOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [isMoreOpen]);

  return (
    <div
      ref={navRef}
      className="fixed inset-x-0 bottom-0 z-50 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] md:hidden"
    >
      {isMoreOpen && (
        <div className="mb-3 overflow-hidden rounded-3xl border border-border bg-card/95 p-2 text-card-foreground shadow-2xl backdrop-blur-xl">
          <div className="grid grid-cols-2 gap-2">
            {moreItems.map(item => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsMoreOpen(false)}
                  className={`flex items-center gap-2 rounded-2xl border px-3 py-3 text-sm font-medium transition ${
                    isActive
                      ? 'border-foreground/20 bg-foreground text-background'
                      : 'border-border bg-background/70 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      <nav className="rounded-full border border-border bg-background/78 p-1.5 text-foreground shadow-2xl backdrop-blur-xl">
        <div className="grid grid-cols-5 items-center gap-1">
          {primaryItems.map(item => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;

            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsMoreOpen(false)}
                className={`flex h-12 min-w-0 flex-col items-center justify-center gap-0.5 rounded-full px-2 text-[11px] font-medium transition ${
                  isActive
                    ? 'bg-foreground text-background shadow-lg'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}

          <button
            type="button"
            onClick={() => setIsMoreOpen(current => !current)}
            className={`flex h-12 min-w-0 flex-col items-center justify-center gap-0.5 rounded-full px-2 text-[11px] font-medium transition ${
              isMoreOpen || isMoreActive
                ? 'bg-foreground text-background shadow-lg'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
            aria-label="Open more navigation"
          >
            <MoreHorizontal className="h-4 w-4" />
            <span>More</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
