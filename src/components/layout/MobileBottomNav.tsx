import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, type Transition } from 'framer-motion';
import { Link, useLocation } from 'react-router-dom';
import {
  CalendarClock,
  CheckSquare,
  ClipboardList,
  DollarSign,
  FileText,
  Folder,
  Home,
  LayoutGrid,
  Menu,
  Package,
  Settings,
  Store,
} from 'lucide-react';

import GlassSurface from '@/components/ui/GlassSurface';
import { useAuth } from '@/contexts/AuthContext';
import { hasPageAccess, type PagePermissionKey } from '@/lib/pagePermissions';

interface MobileBottomNavProps {
  isAdmin: boolean;
}

interface MobileNavItem {
  label: string;
  icon: typeof Home;
  path: string;
  helper?: string;
  group?: string;
  pagePermissionKey?: PagePermissionKey;
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
      pagePermissionKey: isAdmin ? undefined : 'portal.projects',
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
      pagePermissionKey: isAdmin ? undefined : 'portal.timeline',
    },
  ];
}

function getMenuNavItems(isAdmin: boolean): MobileNavItem[] {
  const basePath = getBasePath(isAdmin);

  const items: MobileNavItem[] = [
    {
      label: 'Cost Estimates',
      icon: ClipboardList,
      path: `${basePath}/cost-estimates`,
      helper: 'Project estimates',
      group: 'Procurement',
      pagePermissionKey: isAdmin ? undefined : 'portal.cost-estimates',
    },
    {
      label: 'Items',
      icon: Package,
      path: `${basePath}/items`,
      helper: 'Item master',
      group: 'Procurement',
      pagePermissionKey: isAdmin ? undefined : 'portal.items',
    },
    {
      label: 'Vendors',
      icon: Store,
      path: `${basePath}/vendors`,
      helper: 'Vendor directory',
      group: 'Procurement',
      pagePermissionKey: isAdmin ? undefined : 'portal.vendors',
    },
  ];

  items.push({
    label: 'Financials',
    icon: DollarSign,
    path: `${basePath}/financials`,
    helper: 'Payments and values',
    group: 'Finance',
    pagePermissionKey: isAdmin ? undefined : 'portal.financials',
  });

  items.push({
    label: 'Payroll',
    icon: DollarSign,
    path: `${basePath}/payroll`,
    helper: 'Payroll records',
    group: 'Finance',
    pagePermissionKey: isAdmin ? undefined : 'portal.payroll',
  });

  items.push({
    label: 'Leads',
    icon: LayoutGrid,
    path: `${basePath}/leads`,
    helper: 'Sales pipeline',
    group: 'Sales',
    pagePermissionKey: isAdmin ? undefined : 'portal.leads',
  });

  if (!isAdmin) {
    items.push({
      label: 'Whiteboard',
      icon: FileText,
      path: `${basePath}/whiteboard`,
      helper: 'Shared notes',
      group: 'Utility',
      pagePermissionKey: 'portal.whiteboard',
    });
  }

  if (isAdmin) {
    items.push({
      label: 'Settings',
      icon: Settings,
      path: `${basePath}/settings`,
      helper: 'Admin controls',
      group: 'Admin',
    });
  }

  return items;
}

const selectorTransition: Transition = {
  type: 'spring',
  stiffness: 420,
  damping: 34,
  mass: 0.65,
};

function ActiveSelector() {
  return (
    <motion.div
      layoutId="mobile-nav-active-selector"
      className="pointer-events-none absolute left-1/2 top-1/2 z-10 h-[4.25rem] w-[calc(100%+0.35rem)] -translate-x-1/2 -translate-y-1/2"
      transition={selectorTransition}
    >
      <GlassSurface
        width="100%"
        height="100%"
        borderRadius={24}
        backgroundOpacity={0.10}
        saturation={1.05}
        distortionScale={-28}
        redOffset={0}
        greenOffset={1}
        blueOffset={2}
        opacity={0.16}
        blur={1.5}
        brightness={30}
        mixBlendMode="screen"
        className="h-full w-full"
      >
        <span />
      </GlassSurface>
    </motion.div>
  );
}

function PrimaryNavButton({
  item,
  isActive,
  onClick,
}: {
  item: MobileNavItem;
  isActive: boolean;
  onClick?: () => void;
}) {
  const Icon = item.icon;

  return (
    <Link
      to={item.path}
      onClick={onClick}
      className={`relative z-30 flex h-12 min-w-0 flex-col items-center justify-center gap-0.5 overflow-visible rounded-2xl px-2 text-[11px] font-medium transition-colors ${
        isActive ? 'text-white dark:text-white' : 'text-black/62 hover:text-black dark:text-white/62 dark:hover:text-white'
      }`}
    >
      {isActive && <ActiveSelector />}

      <motion.span
        whileTap={{ scale: 0.94 }}
        animate={isActive ? { y: -1, scale: 1.04 } : { y: 0, scale: 1 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        className="relative z-20 flex min-w-0 flex-col items-center justify-center gap-0.5"
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="max-w-full truncate">{item.label}</span>
      </motion.span>
    </Link>
  );
}

function MenuButton({
  isActive,
  onClick,
}: {
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative z-30 flex h-12 min-w-0 flex-col items-center justify-center gap-0.5 overflow-visible rounded-2xl px-2 text-[11px] font-medium transition-colors ${
        isActive ? 'text-white dark:text-white' : 'text-black/62 hover:text-black dark:text-white/62 dark:hover:text-white'
      }`}
      aria-label="Open menu navigation"
      aria-expanded={isActive}
    >
      {isActive && <ActiveSelector />}

      <motion.span
        whileTap={{ scale: 0.94 }}
        animate={isActive ? { y: -1, scale: 1.04 } : { y: 0, scale: 1 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        className="relative z-20 flex min-w-0 flex-col items-center justify-center gap-0.5"
      >
        <Menu className="h-4 w-4 shrink-0" />
        <span>Menu</span>
      </motion.span>
    </button>
  );
}

function MenuDrawer({
  items,
  currentPath,
  onClose,
}: {
  items: MobileNavItem[];
  currentPath: string;
  onClose: () => void;
}) {
  const groupedItems = items.reduce<Record<string, MobileNavItem[]>>((groups, item) => {
    const group = item.group || 'More';
    groups[group] = groups[group] || [];
    groups[group].push(item);
    return groups;
  }, {});

  return (
    <motion.div
      initial={{ opacity: 0, y: 18, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 12, scale: 0.98 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="relative z-[60] mx-auto mb-3 max-w-[22rem] overflow-hidden rounded-[1.75rem] border border-white/18 bg-[#4F4E4D]/56 p-2.5 text-black shadow-2xl shadow-black/22 backdrop-blur-sm dark:border-white/10 dark:bg-black/60 dark:text-white"
    >
      <div className="pointer-events-none absolute inset-0 rounded-[1.75rem] bg-gradient-to-b from-white/14 via-white/4 to-transparent dark:from-white/24 dark:via-white/6" />

      <div className="relative z-10 w-full space-y-3">
        {Object.entries(groupedItems).map(([group, groupItems]) => (
          <div key={group} className="space-y-1.5">
            <p className="px-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-black/45 dark:text-white/45">
              {group}
            </p>

            <div className="grid grid-cols-2 gap-2">
              {groupItems.map(item => {
                const Icon = item.icon;
                const isActive = currentPath === item.path;

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={onClose}
                    className={`relative overflow-hidden rounded-2xl border px-3 py-3 transition-colors ${
                      isActive
                        ? 'border-white/24 bg-white/18 text-white dark:border-white/18 dark:bg-white/14 dark:text-white'
                        : 'border-black/10 bg-black/6 text-black/64 hover:bg-black/12 hover:text-black dark:border-white/14 dark:bg-white/9 dark:text-white/72 dark:hover:bg-white/16 dark:hover:text-white'
                    }`}
                  >
                    <div className="relative z-10 flex items-start gap-2.5">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-black/8 text-black dark:bg-white/12 dark:text-white">
                        <Icon className="h-4 w-4" />
                      </span>

                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">
                          {item.label}
                        </span>

                        {item.helper && (
                          <span className="block truncate text-[11px] text-black/45 dark:text-white/45">
                            {item.helper}
                          </span>
                        )}
                      </span>
                    </div>

                    {isActive && (
                      <motion.span
                        layoutId="mobile-drawer-active"
                        className="absolute inset-0 rounded-2xl border border-white/14 bg-white/8 dark:border-white/14 dark:bg-white/8"
                        transition={selectorTransition}
                      />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

export default function MobileBottomNav({ isAdmin }: MobileBottomNavProps) {
  const location = useLocation();
  const { profile } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navRef = useRef<HTMLDivElement | null>(null);

  const filterByPageAccess = (item: MobileNavItem) => {
    if (isAdmin || !item.pagePermissionKey) return true;

    return hasPageAccess(profile, item.pagePermissionKey, 'view');
  };

  const visiblePrimaryItems = getPrimaryNavItems(isAdmin).filter(filterByPageAccess);
  const visibleMenuItems = getMenuNavItems(isAdmin).filter(filterByPageAccess);
  const visibleItems = [...visiblePrimaryItems, ...visibleMenuItems];

  const primaryItems =
    visibleItems.length <= 5 ? visibleItems : visiblePrimaryItems.slice(0, 4);

  const menuItems =
    visibleItems.length <= 5
      ? []
      : [...visiblePrimaryItems.slice(4), ...visibleMenuItems];

  const navColumnCount = primaryItems.length + (menuItems.length > 0 ? 1 : 0);
  const activePrimaryPath = isMenuOpen ? '' : location.pathname;

  useEffect(() => {
    if (!isMenuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;

      if (target && navRef.current?.contains(target)) return;

      setIsMenuOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [isMenuOpen]);

  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);


  return (
    <div
      ref={navRef}
      className="fixed inset-x-0 bottom-0 z-[70] px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] md:hidden"
    >
      <AnimatePresence>
        {isMenuOpen && menuItems.length > 0 && (
          <MenuDrawer
            items={menuItems}
            currentPath={location.pathname}
            onClose={() => setIsMenuOpen(false)}
          />
        )}
      </AnimatePresence>

      <motion.nav
        initial={false}
        className="relative mx-auto grid h-[64px] items-center gap-1 overflow-visible rounded-[2rem] border border-white/18 bg-[#4F4E4D]/52 px-2 text-black shadow-2xl shadow-black/22 backdrop-blur-sm supports-[backdrop-filter]:bg-[#4F4E4D]/46 dark:border-white/10 dark:bg-black/55 dark:text-white dark:shadow-black/20"
        style={{
          gridTemplateColumns: `repeat(${navColumnCount}, minmax(0, 1fr))`,
          width: `min(${navColumnCount * 4.6}rem, calc(100vw - 1.5rem))`,
        }}
      >
        <div className="pointer-events-none absolute inset-0 rounded-[2rem] bg-gradient-to-b from-white/14 via-white/4 to-transparent dark:from-white/24 dark:via-white/6" />

        {primaryItems.map(item => (
          <PrimaryNavButton
            key={item.path}
            item={item}
            isActive={activePrimaryPath === item.path}
          />
        ))}

        {menuItems.length > 0 && (
          <MenuButton
            isActive={isMenuOpen}
            onClick={() => setIsMenuOpen(current => !current)}
          />
        )}
      </motion.nav>
    </div>
  );
}
