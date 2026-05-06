import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  Info,
  Calendar,
  Bell,
  Newspaper,
  Check,
  CheckCircle,
  Clock,
  List,
  Trash2,
  Settings,
  MapPin,
  RefreshCcw,
  AlertTriangle,
  Lock,
  Plus,
  X,
  Edit3,
  FileText,
  User,
  Calculator,
  Eye,
  EyeOff,
  Filter,
  ExternalLink,
  BarChart3,
  ShoppingBag,
  Truck,
  ArrowRight,
} from 'lucide-react';

const iconMap = {
  information: Info,
  calendar: Calendar,
  bell: Bell,
  news: Newspaper,
  check: Check,
  check_circle: CheckCircle,
  clock: Clock,
  list: List,
  delete: Trash2,
  trash: Trash2,
  configurate: Settings,
  settings: Settings,
  'geo-localization': MapPin,
  refresh: RefreshCcw,
  error: AlertTriangle,
  lock: Lock,
  add: Plus,
  close: X,
  edit: Edit3,
  document: FileText,
  user: User,
  calculator: Calculator,
  view: Eye,
  'view-off': EyeOff,
  filter: Filter,
  external: ExternalLink,
  'logo-linkedin': ExternalLink,
  'logo-x': X,
  chart: BarChart3,
  highway: Truck,
  purchase: ShoppingBag,
  'arrow-compact-right': ArrowRight,
  'arrow-head-right': ArrowRight,
} as const;

type IconName = keyof typeof iconMap | string;

type TextSize = 'xx-small' | 'x-small' | 'small' | 'medium' | 'large' | 'x-large';
type TextWeight = 'regular' | 'semi-bold' | 'bold';
type TextColor =
  | 'primary'
  | 'contrast-high'
  | 'contrast-medium'
  | 'contrast-low'
  | 'notification-success'
  | 'notification-warning'
  | 'notification-error'
  | 'notification-info'
  | 'background-surface'
  | 'inherit'
  | string;

type TagVariant = 'default' | 'secondary' | 'info' | 'success' | 'warning' | 'error';

type TagColor = TextColor | 'background-surface';

type ButtonVariant =
  | 'default'
  | 'primary'
  | 'outline'
  | 'secondary'
  | 'ghost'
  | 'destructive'
  | 'link';

function cls(...classes: Array<string | false | undefined | null>) {
  return classes.filter(Boolean).join(' ');
}

function mapTextSize(size: TextSize | undefined) {
  switch (size) {
    case 'xx-small':
      return 'text-[0.66rem] leading-4';
    case 'x-small':
      return 'text-xs leading-4';
    case 'small':
      return 'text-sm leading-5';
    case 'medium':
      return 'text-base leading-6';
    case 'large':
      return 'text-lg leading-7';
    case 'x-large':
      return 'text-xl leading-8';
    default:
      return 'text-sm leading-5';
  }
}

function mapTextWeight(weight: TextWeight | undefined) {
  switch (weight) {
    case 'semi-bold':
      return 'font-semibold';
    case 'bold':
      return 'font-bold';
    default:
      return 'font-normal';
  }
}

function mapTextColor(color: TextColor | undefined) {
  switch (color) {
    case 'primary':
      return 'text-slate-900';
    case 'contrast-high':
      return 'text-slate-900';
    case 'contrast-medium':
      return 'text-slate-600';
    case 'contrast-low':
      return 'text-slate-500';
    case 'notification-success':
      return 'text-emerald-700';
    case 'notification-warning':
      return 'text-amber-700';
    case 'notification-error':
      return 'text-red-700';
    case 'notification-info':
      return 'text-sky-700';
    case 'background-surface':
      return 'text-slate-700';
    case 'inherit':
      return 'text-current';
    default:
      return 'text-slate-900';
  }
}

function mapTagVariant(variant: TagVariant | undefined) {
  switch (variant) {
    case 'secondary':
      return 'bg-slate-100 text-slate-800 border border-slate-200';
    case 'info':
      return 'bg-sky-100 text-sky-900 border border-sky-200';
    case 'success':
      return 'bg-emerald-100 text-emerald-900 border border-emerald-200';
    case 'warning':
      return 'bg-amber-100 text-amber-900 border border-amber-200';
    case 'error':
      return 'bg-red-100 text-red-900 border border-red-200';
    default:
      return 'bg-slate-100 text-slate-800 border border-slate-200';
  }
}

function mapTagColor(color: TagColor | undefined) {
  switch (color) {
    case 'background-surface':
      return 'bg-slate-100 text-slate-800 border border-slate-200';
    case 'notification-success':
      return 'bg-emerald-100 text-emerald-900 border border-emerald-200';
    case 'notification-warning':
      return 'bg-amber-100 text-amber-900 border border-amber-200';
    case 'notification-error':
      return 'bg-red-100 text-red-900 border border-red-200';
    case 'notification-info':
      return 'bg-sky-100 text-sky-900 border border-sky-200';
    case 'contrast-medium':
      return 'bg-slate-100 text-slate-800 border border-slate-200';
    default:
      return mapTagVariant('default');
  }
}

export function PText({
  size,
  weight,
  color,
  className,
  style,
  children,
  ...props
}: {
  size?: TextSize;
  weight?: TextWeight;
  color?: TextColor;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cls(mapTextSize(size), mapTextWeight(weight), mapTextColor(color), className)}
      style={style}
      {...props}
    >
      {children}
    </span>
  );
}

export function PHeading({
  tag = 'h2',
  size,
  className,
  style,
  children,
  ...props
}: {
  tag?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
  size?: TextSize;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLHeadingElement>) {
  const Tag = tag as React.ElementType;
  return (
    <Tag
      className={cls('font-semibold tracking-tight', size ? mapTextSize(size) : 'text-xl leading-8', className)}
      style={style}
      {...props}
    >
      {children}
    </Tag>
  );
}

export function PTag({
  variant,
  color,
  compact,
  className,
  style,
  children,
  ...props
}: {
  variant?: TagVariant;
  color?: TagColor;
  compact?: boolean;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cls(
        'inline-flex items-center rounded-full border px-2.5 py-1 text-[0.7rem] font-medium',
        compact ? 'px-2 py-0.5 text-[0.68rem]' : '',
        color ? mapTagColor(color) : mapTagVariant(variant),
        className
      )}
      style={style}
      {...props}
    >
      {children}
    </span>
  );
}

export function PIcon({
  name,
  size = 'medium',
  color,
  className,
  style,
  ...props
}: {
  name: IconName;
  size?: 'x-small' | 'small' | 'medium' | 'large';
  color?: TextColor;
  className?: string;
  style?: React.CSSProperties;
} & React.HTMLAttributes<SVGSVGElement>) {
  const IconComponent = iconMap[name as keyof typeof iconMap] ?? Info;
  const sizeMap: Record<string, number> = {
    'x-small': 12,
    small: 14,
    medium: 18,
    large: 22,
  };
  return (
    <IconComponent
      size={sizeMap[size] ?? 18}
      className={cls(mapTextColor(color), className)}
      style={style}
      {...props}
    />
  );
}

export function PButton({
  icon,
  loading,
  children,
  className,
  variant,
  type = 'button',
  ...props
}: {
  icon?: IconName | React.ReactNode;
  loading?: boolean;
  children?: React.ReactNode;
  variant?: ButtonVariant;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
} & React.ComponentPropsWithoutRef<'button'>) {
  const iconNode =
    typeof icon === 'string' ? (
      <PIcon name={icon as IconName} size="small" className="mr-2" />
    ) : (
      icon ?? null
    );

  return (
    <Button type={type} variant={variant === 'primary' ? 'default' : (variant as any)} className={cls(className)} disabled={props.disabled || loading} {...props}>
      {loading ? (
        <span className="flex items-center gap-2">
          <svg className="h-4 w-4 animate-spin text-current" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
            />
          </svg>
          {children}
        </span>
      ) : (
        <>
          {iconNode}
          {children}
        </>
      )}
    </Button>
  );
}

export function PTabs({
  activeTabIndex = 0,
  children,
  className,
  style,
}: {
  activeTabIndex?: number;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [activeIndex, setActiveIndex] = React.useState(activeTabIndex);
  const items = React.Children.toArray(children).filter(React.isValidElement) as React.ReactElement<any>[];

  return (
    <div className={cls('space-y-4', className)} style={style}>
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {items.map((item, index) => (
          <button
            key={index}
            type="button"
            className={cls(
              'rounded-full px-4 py-2 text-sm font-medium transition-colors',
              activeIndex === index ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            )}
            onClick={() => setActiveIndex(index)}
          >
            {item.props.label ?? `Tab ${index + 1}`}
          </button>
        ))}
      </div>
      <div>{items[activeIndex]}</div>
    </div>
  );
}

export function PTabsItem({
  children,
  className,
  style,
  ...props
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cls(className)} style={style} {...props}>
      {children}
    </div>
  );
}

export function PSwitch({
  checked,
  onUpdate,
  hideLabel,
  className,
  style,
  children,
  ...props
}: {
  checked: boolean;
  onUpdate: (event: CustomEvent<{ checked: boolean }>) => void;
  hideLabel?: boolean;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
} & React.HTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={cls('inline-flex items-center gap-2', className)} style={style} {...props}>
      <span className="relative inline-flex h-6 w-11 rounded-full bg-slate-300 transition-colors" aria-hidden="true">
        <span
          className={cls(
            'absolute left-0 top-0 h-6 w-6 rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-5 bg-slate-900' : 'translate-x-0'
          )}
        />
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onUpdate(new CustomEvent('change', { detail: { checked: e.target.checked } }))}
        className="sr-only"
      />
      {!hideLabel && <span>{children}</span>}
    </label>
  );
}

export function PInlineNotification({
  heading,
  description,
  state,
  dismissButton,
  onDismiss,
  className,
  style,
  ...props
}: {
  heading: string;
  description: string;
  state: 'success' | 'error' | 'info' | 'warning';
  dismissButton?: boolean;
  onDismiss?: () => void;
  className?: string;
  style?: React.CSSProperties;
} & React.HTMLAttributes<HTMLDivElement>) {
  const stateClasses = {
    success: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    error: 'bg-red-50 border-red-200 text-red-900',
    warning: 'bg-amber-50 border-amber-200 text-amber-900',
    info: 'bg-sky-50 border-sky-200 text-sky-900',
  };

  return (
    <div className={cls('rounded-3xl border p-4', stateClasses[state], className)} style={style} {...props}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{heading}</p>
          <p className="mt-1 text-sm text-current/80">{description}</p>
        </div>
        {dismissButton && onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-full p-1 text-current/70 hover:text-current"
            aria-label="Dismiss"
          >
            <X size={16} />
          </button>
        )}
      </div>
    </div>
  );
}

export function PModal({
  open,
  onDismiss,
  children,
  style,
  aria,
  className,
  heading,
  ...props
}: {
  open: boolean;
  onDismiss: () => void;
  children: React.ReactNode;
  style?: React.CSSProperties;
  aria?: Record<string, string>;
  heading?: string;
  className?: string;
} & React.HTMLAttributes<HTMLDivElement>) {
  const handleBackdropClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onDismiss();
    }
  };

  React.useEffect(() => {
    if (!open) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onDismiss();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [open, onDismiss]);

  if (!open) return null;

  const childrenArray = React.Children.toArray(children);
  const isSlottedElement = (
    child: React.ReactNode
  ): child is React.ReactElement<{ slot?: string }> => React.isValidElement(child) && typeof (child.props as any).slot === 'string';

  const header = childrenArray.find(isSlottedElement);
  const footer = childrenArray.find(isSlottedElement);
  const body = childrenArray.filter(child => !isSlottedElement(child));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={handleBackdropClick}
      aria-modal="true"
      role="dialog"
      {...aria}
    >
      <div
        className={cls('w-full max-w-3xl rounded-3xl bg-white shadow-2xl overflow-hidden', className)}
        style={style}
        {...props}
      >
        {(heading || header) && (
          <div className="border-b border-slate-200 px-6 py-5">
            {heading ? <h2 className="text-xl font-semibold">{heading}</h2> : null}
            {header ? React.cloneElement(header, { slot: undefined } as any) : null}
          </div>
        )}
        <div className="p-6 space-y-6">
          {body}
        </div>
        {footer && (
          <div className="border-t border-slate-200 px-6 py-4 bg-slate-50 flex flex-wrap justify-end gap-3">
            {React.cloneElement(footer, { slot: undefined } as any)}
          </div>
        )}
      </div>
    </div>
  );
}
