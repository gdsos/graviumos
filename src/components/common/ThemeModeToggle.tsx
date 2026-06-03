import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Monitor, Moon, Sun } from 'lucide-react';

import { useTheme } from '@/contexts/ThemeContext';

type ThemeOption = 'light' | 'dark' | 'system';

const themeOptions: {
  value: ThemeOption;
  label: string;
  icon: typeof Sun;
}[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

export function ThemeModeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const switchRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [menuPosition, setMenuPosition] = useState({
    top: 0,
    left: 0,
  });

  const orderedOptions = [
    ...themeOptions.filter(option => option.value === theme),
    ...themeOptions.filter(option => option.value !== theme),
  ];

  const ActiveIcon =
    theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor;

  useEffect(() => {
    if (!isOpen) return;

    const updateMenuPosition = () => {
      const rect = switchRef.current?.getBoundingClientRect();

      if (!rect) return;

      setMenuPosition({
        top: rect.top - 3.5,
        left: rect.left + rect.width / 2,
      });
    };

    updateMenuPosition();

    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;

      if (
        target &&
        (switchRef.current?.contains(target) || menuRef.current?.contains(target))
      ) {
        return;
      }

      setIsOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [isOpen]);

  return (
    <div ref={switchRef} className="relative h-9 w-9 shrink-0">
      <button
        type="button"
        onClick={() => setIsOpen(current => !current)}
        className={`absolute inset-0 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm transition hover:bg-muted ${isOpen ? 'opacity-80' : 'opacity-100'}`}
        title={`Theme: ${theme === 'system' ? `System (${resolvedTheme})` : theme}`}
        aria-label="Open theme switch"
      >
        <ActiveIcon className="h-4 w-4" />
      </button>

      {createPortal(
        <AnimatePresence>
          {isOpen && (
            <motion.div
              ref={menuRef}
              initial={{
                opacity: 0,
                scale: 0.86,
                y: -6,
                filter: 'blur(6px)',
              }}
              animate={{
                opacity: 1,
                scale: 1,
                y: 0,
                filter: 'blur(0px)',
              }}
              exit={{
                opacity: 0,
                scale: 0.9,
                y: -5,
                filter: 'blur(5px)',
              }}
              transition={{
                duration: 0.18,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="fixed z-[1000] flex w-[46px] translate-x-[calc(-50%+1%)] flex-col items-center rounded-full border border-border bg-card/95 pb-[2px] pt-[3px] shadow-lg backdrop-blur"
              style={{
                top: menuPosition.top,
                left: menuPosition.left,
                transformOrigin: 'top center',
              }}
            >
              {orderedOptions.map((option, optionIndex) => {
                const Icon = option.icon;
                const isActive = theme === option.value;

                return (
                  <motion.button
                    key={option.value}
                    type="button"
                    initial={{
                      opacity: 0,
                      y: -4,
                    }}
                    animate={{
                      opacity: 1,
                      y: optionIndex === 1 ? 3 : 0,
                    }}
                    exit={{
                      opacity: 0,
                      y: -3,
                    }}
                    whileTap={{
                      scale: 0.88,
                    }}
                    transition={{
                      duration: 0.16,
                      delay: optionIndex * 0.025,
                      ease: 'easeOut',
                    }}
                    onClick={() => {
                      if (isActive) {
                        setIsOpen(false);
                        return;
                      }

                      setTheme(option.value);
                      setIsOpen(false);
                    }}
                    className={`flex h-9 w-9 items-center justify-center rounded-full transition ${
                      isActive
                        ? 'bg-muted text-foreground shadow-sm'
                        : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                    }`}
                    title={option.label}
                    aria-label={`${option.label} mode`}
                  >
                    <motion.span
                      initial={{ rotate: -28, scale: 0.84 }}
                      animate={{
                        rotate: [-28, 6, 0],
                        scale: isActive ? [0.84, 1.06, 1] : [0.84, 0.98, 0.92],
                      }}
                      exit={{ rotate: -28, scale: 0.84 }}
                      transition={{
                        duration: 0.34,
                        delay: optionIndex * 0.05,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                    >
                      <Icon className="h-4 w-4" />
                    </motion.span>
                    <span className="sr-only">{option.label}</span>
                  </motion.button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
