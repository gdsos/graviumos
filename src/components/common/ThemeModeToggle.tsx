import { useEffect, useRef, useState } from 'react';
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

  const orderedOptions = [
    ...themeOptions.filter(option => option.value === theme),
    ...themeOptions.filter(option => option.value !== theme),
  ];

  const ActiveIcon =
    theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor;

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;

      if (target && switchRef.current?.contains(target)) return;

      setIsOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [isOpen]);

  return (
    <div ref={switchRef} className="relative h-9 w-9 shrink-0">
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`absolute inset-0 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm transition hover:bg-muted ${isOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
        title={`Theme: ${theme === 'system' ? `System (${resolvedTheme})` : theme}`}
        aria-label="Open theme switch"
      >
        <ActiveIcon className="h-4 w-4" />
      </button>

      {isOpen && (
        <div className="absolute left-1/2 top-[-3.5px] z-50 flex w-[46px] translate-x-[calc(-50%+1%)] flex-col items-center rounded-full border border-border bg-card/95 pb-[2px] pt-[3px] shadow-lg backdrop-blur">
          {orderedOptions.map((option, optionIndex) => {
            const Icon = option.icon;
            const isActive = theme === option.value;

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  if (isActive) {
                    setIsOpen(false);
                    return;
                  }

                  setTheme(option.value);
                  setIsOpen(false);
                }}
                className={`flex h-9 w-9 items-center justify-center rounded-full transition ${
                  optionIndex === 1 ? 'translate-y-[3px]' : ''
                } ${
                  isActive
                    ? 'bg-muted text-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                }`}
                title={option.label}
                aria-label={`${option.label} mode`}
              >
                <Icon className="h-4 w-4" />
                <span className="sr-only">{option.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
