import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, type Transition } from 'framer-motion';
import { Link, useLocation } from 'react-router-dom';
import {
  CalendarClock,
  CheckSquare,
  ClipboardList,
  DollarSign,
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

interface MobileBottomNavProps {
  isAdmin: boolean;
}

interface MobileNavItem {
  label: string;
  icon: typeof Home;
  path: string;
  helper?: string;
  group?: string;
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

function getMenuNavItems(isAdmin: boolean, isFinance: boolean, isMS: boolean): MobileNavItem[] {
  const basePath = getBasePath(isAdmin);

  const items: MobileNavItem[] = [
    {
      label: 'Cost Estimates',
      icon: ClipboardList,
      path: `${basePath}/cost-estimates`,
      helper: 'Project estimates',
      group: 'Procurement',
    },
    {
      label: 'Items',
      icon: Package,
      path: `${basePath}/items`,
      helper: 'Item master',
      group: 'Procurement',
    },
    {
      label: 'Vendors',
      icon: Store,
      path: `${basePath}/vendors`,
      helper: 'Vendor directory',
      group: 'Procurement',
    },
  ];

  if (isAdmin || isFinance) {
    items.push({
      label: 'Financials',
      icon: DollarSign,
      path: `${basePath}/financials`,
      helper: 'Payments and values',
      group: 'Finance',
    });
  }

  if (isAdmin || isMS) {
    items.push({
      label: 'Leads',
      icon: LayoutGrid,
      path: `${basePath}/leads`,
      helper: 'Sales pipeline',
      group: 'Sales',
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
        backgroundOpacity={0.18}
        saturation={1.05}
        distortionScale={-28}
        redOffset={0}
        greenOffset={1}
        blueOffset={2}
        opacity={0.24}
        blur={4}
        brightness={32}
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
        isActive ? 'text-white' : 'text-muted-foreground hover:text-foreground'
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
        isActive ? 'text-white' : 'text-muted-foreground hover:text-foreground'
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
      className="relative z-[60] mx-auto mb-3 max-w-[22rem] overflow-hidden rounded-[1.75rem] border border-border/80 bg-background/95 p-2.5 shadow-2xl shadow-black/25 backdrop-blur-2xl dark:border-white/12 dark:bg-[#101010]/92"
    >
      <div className="pointer-events-none absolute inset-0 rounded-[1.75rem] bg-gradient-to-b from-white/10 to-transparent dark:from-white/8" />

      <div className="relative z-10 w-full space-y-3">
        {Object.entries(groupedItems).map(([group, groupItems]) => (
          <div key={group} className="space-y-1.5">
            <p className="px-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
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
                        ? 'border-border bg-foreground/10 text-foreground dark:bg-white/12'
                        : 'border-border/70 bg-background/75 text-muted-foreground hover:bg-muted hover:text-foreground dark:bg-black/35 dark:hover:bg-white/8'
                    }`}
                  >
                    <div className="relative z-10 flex items-start gap-2.5">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground dark:bg-white/10">
                        <Icon className="h-4 w-4" />
                      </span>

                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">
                          {item.label}
                        </span>

                        {item.helper && (
                          <span className="block truncate text-[11px] text-muted-foreground">
                            {item.helper}
                          </span>
                        )}
                      </span>
                    </div>

                    {isActive && (
                      <motion.span
                        layoutId="mobile-drawer-active"
                        className="absolute inset-0 rounded-2xl border border-border bg-foreground/5"
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
  const { isFinance, isMS } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navRef = useRef<HTMLDivElement | null>(null);

  const primaryItems = getPrimaryNavItems(isAdmin);
  const menuItems = getMenuNavItems(isAdmin, isFinance(), isMS());
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
        {isMenuOpen && (
          <MenuDrawer
            items={menuItems}
            currentPath={location.pathname}
            onClose={() => setIsMenuOpen(false)}
          />
        )}
      </AnimatePresence>

      <motion.nav
        initial={false}
        className="relative mx-auto grid h-[64px] max-w-[28rem] grid-cols-5 items-center gap-1 overflow-visible rounded-[2rem] border border-border/70 bg-background/85 px-2 shadow-2xl shadow-black/15 backdrop-blur-2xl supports-[backdrop-filter]:bg-background/70 dark:border-white/10 dark:bg-black/55"
      >
        <div className="pointer-events-none absolute inset-0 rounded-[2rem] bg-gradient-to-b from-white/12 to-transparent dark:from-white/8" />

        {primaryItems.map(item => (
          <PrimaryNavButton
            key={item.path}
            item={item}
            isActive={activePrimaryPath === item.path}
          />
        ))}

        <MenuButton
          isActive={isMenuOpen}
          onClick={() => setIsMenuOpen(current => !current)}
        />
      </motion.nav>
    </div>
  );
}
