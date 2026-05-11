import type { ReactNode } from 'react';

type StatusBadgeVariant =
  | 'default'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'muted'
  | 'outline';

interface StatusBadgeProps {
  children: ReactNode;
  variant?: StatusBadgeVariant;
  className?: string;
}

const variantClasses: Record<StatusBadgeVariant, string> = {
  default: 'bg-primary text-primary-foreground border-transparent',
  success:
    'bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-300',
  warning:
    'bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-300',
  danger:
    'bg-destructive/10 text-destructive border-destructive/20',
  info:
    'bg-blue-500/10 text-blue-700 border-blue-500/20 dark:text-blue-300',
  muted:
    'bg-muted text-muted-foreground border-border',
  outline:
    'bg-background text-foreground border-border',
};

export function StatusBadge({
  children,
  variant = 'muted',
  className = '',
}: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium leading-none ${variantClasses[variant]} ${className}`}
    >
      {children}
    </span>
  );
}