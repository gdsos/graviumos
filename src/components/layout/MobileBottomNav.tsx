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
      className="pointer-events-none absolute left-1/2 top-1/2 z-10 h-[4.45rem] w-[calc(100%+0.35rem)] -translate-x-1/2 -translate-y-1/2"
      transition={selectorTransition}
    >
      <GlassSurface
        width="100%"
        height="100%"
        borderRadius={24}
        backgroundOpacity={0.34}
        saturation={1.16}
        distortionScale={-64}
        redOffset={0}
        greenOffset={4}
        blueOffset={8}
        opacity={0.58}
        blur={8}
        brightness={34}
        mixBlendMode="screen"
        className="mobile-nav-selector-surface h-full w-full"
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
        isActive ? 'text-white' : 'text-white/52 hover:text-white'
      }`}
    >
      {isActive && <ActiveSelector />}

      <motion.span
        animate={isActive ? { scale: 1.1 } : { scale: 1 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="relative z-40 flex min-w-0 flex-col items-center justify-center gap-0.5"
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
        isActive ? 'text-white' : 'text-white/52 hover:text-white'
      }`}
      aria-label="Open menu navigation"
      aria-expanded={isActive}
    >
      {isActive && <ActiveSelector />}

      <motion.span
        animate={isActive ? { scale: 1.1 } : { scale: 1 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="relative z-40 flex min-w-0 flex-col items-center justify-center gap-0.5"
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
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 12, scale: 0.98 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      className="relative z-[60] mx-auto mb-3 max-w-[22rem]"
    >
      <GlassSurface
        width="100%"
        height="auto"
        borderRadius={30}
        backgroundOpacity={0.44}
        saturation={1.06}
        distortionScale={-20}
        redOffset={0}
        greenOffset={1}
        blueOffset={2}
        opacity={0.36}
        blur={3}
        brightness={24}
        mixBlendMode="screen"
        className="glass-menu-drawer-surface text-foreground dark:text-white"
      >
        <div className="relative z-10 w-full space-y-3 p-2.5 pt-3">
          {Object.entries(groupedItems).map(([group, groupItems]) => (
            <div key={group} className="space-y-1.5">
              <p className="px-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/42 dark:text-white/38">
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
                      className={`relative overflow-hidden rounded-2xl border px-3 py-3 transition ${
                        isActive
                          ? 'border-foreground/12 bg-black/8 text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.42)] dark:border-white/24 dark:bg-white/16 dark:text-white dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]'
                          : 'border-foreground/8 bg-white/36 text-foreground/62 hover:border-foreground/14 hover:bg-white/54 hover:text-foreground dark:border-white/10 dark:bg-black/22 dark:text-white/62 dark:hover:border-white/18 dark:hover:bg-white/8 dark:hover:text-white'
                      }`}
                    >
                      <div className="relative z-10 flex items-start gap-2.5">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-black/6 dark:bg-white/8">
                          <Icon className="h-4 w-4" />
                        </span>

                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">
                            {item.label}
                          </span>
                          {item.helper && (
                            <span className="block truncate text-[11px] text-foreground/45 dark:text-white/42">
                              {item.helper}
                            </span>
                          )}
                        </span>
                      </div>

                      {isActive && (
                        <motion.span
                          layoutId="mobile-drawer-active"
                          className="absolute inset-0 rounded-2xl border border-foreground/10 bg-black/5 dark:border-white/18 dark:bg-white/10"
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
      </GlassSurface>
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
  const isMenuPageActive = menuItems.some(item => location.pathname === item.path);
  const isMenuActive = isMenuOpen || isMenuPageActive;

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
          <>
            <MenuDrawer
              items={menuItems}
              currentPath={location.pathname}
              onClose={() => setIsMenuOpen(false)}
            />
          </>
        )}
      </AnimatePresence>

      <GlassSurface
        width="100%"
        height={62}
        borderRadius={999}
        backgroundOpacity={0.36}
        saturation={1.18}
        distortionScale={-76}
        redOffset={0}
        greenOffset={4}
        blueOffset={8}
        opacity={0.62}
        blur={8}
        brightness={34}
        mixBlendMode="screen"
        className="mobile-bottom-nav-surface mx-auto max-w-[22rem] overflow-visible text-white"
      >
        <nav className="relative z-30 grid h-full w-full grid-cols-5 items-center gap-1 overflow-visible px-1.5">
          {primaryItems.map(item => (
            <PrimaryNavButton
              key={item.path}
              item={item}
              isActive={!isMenuOpen && location.pathname === item.path}
              onClick={() => setIsMenuOpen(false)}
            />
          ))}

          <MenuButton
            isActive={isMenuActive}
            onClick={() => setIsMenuOpen(current => !current)}
          />
        </nav>
      </GlassSurface>
    </div>
  );
}
