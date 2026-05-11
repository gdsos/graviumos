import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

export function ThemeModeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();

  const buttonClass =
    'inline-flex h-8 w-8 items-center justify-center rounded-md transition';

  const inactiveClass =
    'text-muted-foreground hover:bg-muted hover:text-foreground';

  const activeClass = 'bg-primary text-primary-foreground';

  return (
    <div className="inline-flex items-center rounded-lg border border-border bg-background p-1">
      <button
        type="button"
        onClick={() => setTheme('light')}
        className={`${buttonClass} ${theme === 'light' ? activeClass : inactiveClass}`}
        title="Light mode"
        aria-label="Light mode"
      >
        <Sun className="h-4 w-4" />
      </button>

      <button
        type="button"
        onClick={() => setTheme('dark')}
        className={`${buttonClass} ${theme === 'dark' ? activeClass : inactiveClass}`}
        title="Dark mode"
        aria-label="Dark mode"
      >
        <Moon className="h-4 w-4" />
      </button>

      <button
        type="button"
        onClick={() => setTheme('system')}
        className={`${buttonClass} ${theme === 'system' ? activeClass : inactiveClass}`}
        title={`System mode: currently ${resolvedTheme}`}
        aria-label="System mode"
      >
        <Monitor className="h-4 w-4" />
      </button>
    </div>
  );
}