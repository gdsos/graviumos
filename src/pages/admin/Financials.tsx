import { useState, useEffect, useCallback, Children, isValidElement } from 'react';
import {
  supabase,
  type Project,
  type ProjectExpense,
  type ProjectCashReceived,
  type OrgSettings,
  formatINR,
} from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { 
  Calculator,
  BarChart3,
  TrendingUp,
  Lock,
  DoorOpen,
  RefreshCw,
  FileText,
  CreditCard,
  Route,
} from 'lucide-react';

// ——— Constants ————————————————————————————————————————————————————————————————


const PIE_COLORS = ['#3dff87', '#00ddff', '#3e17ff', '#ec7f19'];
const PIE_COLORS_DARK = ['#FBFCFF', '#AFB0B3', '#6B6D70', '#535457'];

const STATUS_COLORS: Record<string, string> = {
  Active: 'bg-green-50 text-green-700',
  Completed: 'bg-blue-50 text-blue-700',
  'On Hold': 'bg-amber-50 text-amber-700',
  Cancelled: 'bg-red-50 text-red-700',
};

// ——— Sub-components ———————————————————————————————————————————————————————————

// ??? Local UI replacements ????????????????????????????????????????????????????????

function Text({
  children,
  size = 'small',
  weight,
  color,
  className = '',
}: {
  children: React.ReactNode;
  size?: string;
  weight?: string;
  color?: string;
  className?: string;
}) {
  const sizeClass =
    size === 'xx-small'
      ? 'text-xs'
      : size === 'x-small'
        ? 'text-xs'
        : size === 'medium'
          ? 'text-base'
          : 'text-sm';

  const weightClass =
    weight === 'semi-bold'
      ? 'font-semibold'
      : weight === 'bold'
        ? 'font-bold'
        : '';

  const colorClass =
    color === 'success'
      ? 'text-emerald-700 dark:text-emerald-300'
      : color === 'danger'
        ? 'text-destructive'
        : color === 'warning'
          ? 'text-amber-700 dark:text-amber-300'
          : color === 'muted'
            ? 'text-muted-foreground'
            : 'text-foreground';

  return (
    <span className={`${sizeClass} ${weightClass} ${colorClass} ${className}`}>
      {children}
    </span>
  );
}

function Heading({
  children,
  tag = 'h2',
  className = '',
}: {
  children: React.ReactNode;
  tag?: 'h1' | 'h2' | 'h3';
  size?: string;
  className?: string;
}) {
  const Tag = tag;

  return (
    <Tag className={`text-2xl font-semibold tracking-tight text-foreground ${className}`}>
      {children}
    </Tag>
  );
}

function Icon({
  name,
  size = 'small',
  color,
}: {
  name: string;
  size?: string;
  color?: string;
}) {
  const iconSize = size === 'large' ? 28 : size === 'medium' ? 22 : 16;
  const className =
    color === 'success'
      ? 'text-emerald-700 dark:text-emerald-300'
      : color === 'danger'
        ? 'text-destructive'
        : color === 'warning'
          ? 'text-amber-700 dark:text-amber-300'
          : color === 'muted'
            ? 'text-muted-foreground'
            : 'text-foreground';

  if (name === 'refresh') return <RefreshCw size={iconSize} className={className} />;
  if (name === 'purchase') return <CreditCard size={iconSize} className={className} />;
  if (name === 'document') return <FileText size={iconSize} className={className} />;
  if (name === 'highway') return <Route size={iconSize} className={className} />;

  return <BarChart3 size={iconSize} className={className} />;
}

function ActionButton({
  children,
  icon,
  variant = 'primary',
  loading = false,
  disabled = false,
  onClick,
  type = 'button',
}: {
  children: React.ReactNode;
  icon?: string;
  variant?: 'primary' | 'secondary';
  loading?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
}) {
  const variantClass =
    variant === 'secondary'
      ? 'border border-border bg-background text-foreground hover:bg-muted'
      : 'bg-primary text-primary-foreground hover:bg-primary/90';

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${variantClass}`}
    >
      {loading ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current/40 border-t-current" />
      ) : icon ? (
        <Icon name={icon} size="x-small" />
      ) : null}
      {children}
    </button>
  );
}

function Notice({
  heading,
  description,
  state = 'info',
  dismissButton,
  onDismiss,
}: {
  heading: string;
  description: string;
  state?: 'error' | 'success' | 'warning' | 'info';
  dismissButton?: boolean;
  onDismiss?: () => void;
}) {
  const toneClass =
    state === 'error'
      ? 'border-destructive/20 bg-destructive/10 text-destructive'
      : state === 'success'
        ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
        : state === 'warning'
          ? 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300'
          : 'border-border bg-card text-card-foreground';

  return (
    <div className={`flex gap-3 rounded-2xl border p-4 text-sm ${toneClass}`}>
      <BarChart3 className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{heading}</p>
        <p className="mt-0.5 text-xs leading-5">{description}</p>
      </div>
      {dismissButton && onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="text-xs font-semibold underline-offset-4 hover:underline"
        >
          Dismiss
        </button>
      )}
    </div>
  );
}

function Badge({ children, color }: { children: React.ReactNode; color?: string }) {
  const colorClass = color || 'border-border bg-background text-muted-foreground';

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${colorClass}`}>
      {children}
    </span>
  );
}

function Tabs({ children, activeTabIndex = 0 }: { children: React.ReactNode; activeTabIndex?: number }) {
  const panels = Children.toArray(children).filter(isValidElement);
  const [activeIndex, setActiveIndex] = useState(activeTabIndex);
  const activePanel = panels[activeIndex];

  return (
    <div>
      <div className="mb-6 flex flex-wrap gap-2 border-b border-border pb-2">
        {panels.map((panel, index) => {
          const label = isValidElement<{ label: string }>(panel) ? panel.props.label : `Tab ${index + 1}`;

          return (
            <button
              key={`${label}-${index}`}
              type="button"
              onClick={() => setActiveIndex(index)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                activeIndex === index
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div>{activePanel}</div>
    </div>
  );
}

function TabPanel({ children }: { label: string; children: React.ReactNode }) {
  return <>{children}</>;
}


function KpiCard({
  label,
  value,
  sub,
  icon,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  accent?: 'success' | 'warning' | 'error' | 'info' | 'default';
}) {
  const accentMap: Record<string, string> = {
    success: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    warning: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
    error: 'bg-destructive/10 text-destructive',
    info: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
    default: 'bg-muted text-foreground',
  };
  const iconClass = accentMap[accent ?? 'default'];

  return (
    <div className="bg-card rounded-xl border border-border p-5 flex items-start gap-4">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${iconClass}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <span className="text-xs text-slate-600 font-semibold uppercase tracking-wide block">
          {label}
        </span>
        <h3 className="text-xl font-bold mt-1">
          {value}
        </h3>
        {sub && (
          <span className="text-xs text-slate-600 block">
            {sub}
          </span>
        )}
      </div>
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs font-semibold uppercase tracking-wide mb-3 text-slate-600 block">
      {children}
    </span>
  );
}

function TableHeaderCell({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3 text-left">
      <span className="text-xs text-slate-600 font-semibold uppercase tracking-wide">
        {children}
      </span>
    </th>
  );
}

function AllocationRow({
  label,
  pct,
  amount,
  color,
}: {
  label: string;
  pct: number;
  amount: number;
  color: string;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-border last:border-0">
      <div className="flex items-center gap-3">
        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: color }} />
        <span className="text-sm">
          {label}
        </span>
        <span className="inline-block px-2 py-1 rounded text-xs font-semibold bg-slate-50 text-slate-700">
          {pct}%
        </span>
      </div>
      <span className="text-sm font-semibold">
        {formatINR(amount)}
      </span>
    </div>
  );
}

// ——— Main Component ———————————————————————————————————————————————————————————

export default function Financials() {
  const { isAdmin, isFinance } = useAuth();
  const { resolvedTheme } = useTheme();

  // —— Access gate ————————————————————————————————————————————————————————————
  if (!isAdmin() && !isFinance()) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center">
            <Lock size={32} className="text-red-600" />
          </div>
          <h2 className="text-2xl font-bold">Access Restricted</h2>
          <span className="text-sm text-slate-600">Finance is restricted to Finance department members and Administrators.</span>
          <div className="p-4 rounded-lg bg-red-50 border border-red-200 mt-4 w-full max-w-md">
            <p className="text-sm font-semibold text-red-900">Insufficient Permissions</p>
            <p className="text-sm text-red-700 mt-1">You do not have access to project accounts, cash received, COGS, or profit summaries. Contact your administrator for access.</p>
          </div>
        </div>
      </div>
    );
  }

  return <FinancialsInner theme={resolvedTheme} />;
}

// ——— Inner component (only rendered when authorised) ——————————————————————————

function FinancialsInner({ theme }: { theme: 'light' | 'dark' }) {
  // Data
  const [projects, setProjects] = useState<Project[]>([]);
  const [allExpenses, setAllExpenses] = useState<ProjectExpense[]>([]);
  const [allCash, setAllCash] = useState<ProjectCashReceived[]>([]);
  const [orgSettings, setOrgSettings] = useState<OrgSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Project accounts tab
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [projectExpenses, setProjectExpenses] = useState<ProjectExpense[]>([]);
  const [projectCash, setProjectCash] = useState<ProjectCashReceived[]>([]);
  const [projectDetailLoading, setProjectDetailLoading] = useState(false);

  // —— Chart colours —————————————————————————————————————————————————————————
  const chartTextColor = theme === 'dark' ? '#FBFCFF' : '#010205';
  const chartGridColor = theme === 'dark' ? '#333' : '#EEEFF2';
  const chartTooltipBg = theme === 'dark' ? '#212225' : '#ffffff';
  const chartBarColors = theme === 'dark'
    ? ['#FBFCFF', '#6B6D70', '#AFB0B3']
    : ['#00b3ff', '#a91e1e', '#20df60'];
  const pieColors = theme === 'dark' ? PIE_COLORS_DARK : PIE_COLORS;

  // —— Fetch all data —————————————————————————————————————————————————————————
  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError('');

    const [projectsRes, expensesRes, cashRes, settingsRes] = await Promise.all([
      supabase.from('projects').select('*').order('created_at', { ascending: false }),
      supabase.from('project_expenses').select('*'),
      supabase.from('project_cash_received').select('*'),
      supabase.from('org_settings').select('*').maybeSingle(),
    ]);

    if (projectsRes.error) { setError(projectsRes.error.message); setLoading(false); return; }
    if (expensesRes.error) { setError(expensesRes.error.message); setLoading(false); return; }
    if (cashRes.error) { setError(cashRes.error.message); setLoading(false); return; }

    setProjects((projectsRes.data as Project[]) || []);
    setAllExpenses((expensesRes.data as ProjectExpense[]) || []);
    setAllCash((cashRes.data as ProjectCashReceived[]) || []);
    setOrgSettings(settingsRes.data as OrgSettings | null);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // —— Fetch project-specific detail when selection changes ———————————————————
  useEffect(() => {
    if (!selectedProjectId) {
      setProjectExpenses([]);
      setProjectCash([]);
      return;
    }

    (async () => {
      setProjectDetailLoading(true);
      const [expRes, cashRes] = await Promise.all([
        supabase
          .from('project_expenses')
          .select('*')
          .eq('project_id', selectedProjectId)
          .order('expense_date', { ascending: false }),
        supabase
          .from('project_cash_received')
          .select('*')
          .eq('project_id', selectedProjectId)
          .order('received_date', { ascending: false }),
      ]);
      setProjectExpenses((expRes.data as ProjectExpense[]) || []);
      setProjectCash((cashRes.data as ProjectCashReceived[]) || []);
      setProjectDetailLoading(false);
    })();
  }, [selectedProjectId]);

  // —— Auto-select first project when list loads ——————————————————————————————
  useEffect(() => {
    if (projects.length > 0 && !selectedProjectId) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  // —— Global Calculations ————————————————————————————————————————————————————

  const totalRevenue = projects.reduce((s, p) => s + (p.revenue ?? 0), 0);
  const totalActualCogs = allExpenses.reduce((s, e) => s + (e.amount ?? 0), 0);
  const totalProfit = totalRevenue - totalActualCogs;

  const profitFirstProfitPct = orgSettings?.profit_first_profit_pct ?? 20;
  const profitFirstOpexPct = orgSettings?.profit_first_opex_pct ?? 30;
  const profitFirstTaxPct = orgSettings?.profit_first_tax_pct ?? 15;
  const profitFirstOwnerPayPct = orgSettings?.profit_first_owner_pay_pct ?? 35;

  const allocatedOpex = (profitFirstOpexPct / 100) * totalRevenue;
  const usedOpex = totalActualCogs;
  const remainingOpex = allocatedOpex - usedOpex;

  const pfProfit = (profitFirstProfitPct / 100) * totalRevenue;
  const pfOpex = (profitFirstOpexPct / 100) * totalRevenue;
  const pfTax = (profitFirstTaxPct / 100) * totalRevenue;
  const pfOwnerPay = (profitFirstOwnerPayPct / 100) * totalRevenue;

  const profitFirstAllocations = [
    { label: 'Profit', pct: profitFirstProfitPct, amount: pfProfit, color: pieColors[0] },
    { label: 'Opex', pct: profitFirstOpexPct, amount: pfOpex, color: pieColors[1] },
    { label: 'Tax', pct: profitFirstTaxPct, amount: pfTax, color: pieColors[2] },
    { label: 'Owner Pay', pct: profitFirstOwnerPayPct, amount: pfOwnerPay, color: pieColors[3] },
  ];

  // —— Bar chart data: Revenue vs COGS vs Profit per project —————————————————
  const barChartData = projects.map(p => {
    const projectCogs = allExpenses
      .filter(e => e.project_id === p.id)
      .reduce((s, e) => s + (e.amount ?? 0), 0);
    const rev = p.revenue ?? 0;
    return {
      name: p.name.length > 14 ? p.name.substring(0, 12) + '…' : p.name,
      Revenue: rev,
      COGS: projectCogs,
      Profit: rev - projectCogs,
    };
  });

  // —— Pie chart data —————————————————————————————————————————————————————————
  const pieData = profitFirstAllocations.map(a => ({
    name: a.label,
    value: a.pct,
  }));

  // —— Project account calculations ——————————————————————————————————————————————
  const selectedProject = projects.find(p => p.id === selectedProjectId) ?? null;

  const calcProjectFinancials = () => {
    if (!selectedProject) return null;
    const revenue = selectedProject.revenue ?? 0;
    const estimatedCogs = selectedProject.estimated_cogs ?? 0;
    const actualCogs = projectExpenses.reduce((s, e) => s + (e.amount ?? 0), 0);
    const profitBeforeDesignFee = revenue - actualCogs;
    const designFeePct = selectedProject.design_fee_pct ?? (orgSettings?.design_fee_pct ?? 15);
    const designFee = (designFeePct / 100) * revenue;
    const incentivePct = orgSettings?.incentive_pct ?? 20;
    const commissionPct = orgSettings?.commission_pct ?? 1.5;
    const incentive = (incentivePct / 100) * profitBeforeDesignFee;
    const commission = (commissionPct / 100) * profitBeforeDesignFee;
    const totalCashReceived = projectCash.reduce((s, c) => s + (c.amount ?? 0), 0);
    const outstanding = Math.max(0, revenue - totalCashReceived);
    const netProfit = profitBeforeDesignFee;

    return {
      revenue,
      estimatedCogs,
      actualCogs,
      profitBeforeDesignFee,
      designFeePct,
      designFee,
      incentivePct,
      incentive,
      commissionPct,
      commission,
      totalCashReceived,
      outstanding,
      netProfit,
    };
  };

  const projFinancials = calcProjectFinancials();

  // —— Chart tooltip formatter ————————————————————————————————————————————————
  const currencyFormatter = (v: number) => formatINR(v);

  // ——— Render ————————————————————————————————————————————————————————————————

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-center h-64 gap-3">
          <Icon name="chart" size="medium" color="muted" />
          <Text color="muted">
            Loading financial data…
          </Text>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* —— Page Header —————————————————————————————————————————————————————— */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <Heading tag="h1" size="x-large" className="mb-1">
            Finance
          </Heading>
          <Text color="muted">
            Project accounts, cash received, COGS, and finance summaries for Gravium OS.
          </Text>
        </div>
        <ActionButton icon="refresh" variant="secondary" onClick={fetchAll}>
          Refresh
        </ActionButton>
      </div>

      {/* —— Error Banner ————————————————————————————————————————————————————— */}
      {error && (
        <div className="mb-6">
          <Notice
            heading="Failed to load data"
            description={error}
            state="error"
            dismissButton
            onDismiss={() => setError('')}
          />
        </div>
      )}

      {/* —— Tabs ————————————————————————————————————————————————————————————— */}
      <Tabs activeTabIndex={0}>
        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* TAB 1: Global Financial View                                       */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        <TabPanel label="Overview">
          <div className="flex flex-col gap-8 pt-6">
            {/* —— KPI Cards —————————————————————————————————————————————————— */}
            <div>
              <SectionHeading>Finance Overview</SectionHeading>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <KpiCard
                  label="Total Revenue"
                  value={formatINR(totalRevenue)}
                  sub={`Across ${projects.length} project${projects.length !== 1 ? 's' : ''}`}
                  icon={<Calculator size={18} />}
                  accent="info"
                />
                <KpiCard
                  label="Total Actual COGS"
                  value={formatINR(totalActualCogs)}
                  sub="Sum of all project expenses"
                  icon={<BarChart3 size={18} />}
                  accent="warning"
                />
                <KpiCard
                  label="Total Profit"
                  value={formatINR(totalProfit)}
                  sub="Revenue − Actual COGS"
                  icon={<TrendingUp size={18} />}
                  accent={totalProfit >= 0 ? 'success' : 'error'}
                />
                <KpiCard
                  label="Remaining Opex"
                  value={formatINR(remainingOpex)}
                  sub={`Allocated ${formatINR(allocatedOpex)} − Used ${formatINR(usedOpex)}`}
                  icon={<DoorOpen size={18} />}
                  accent={remainingOpex >= 0 ? 'success' : 'error'}
                />
              </div>
            </div>

            {/* —— Opex Summary ——————————————————————————————————————————————— */}
            <div className="bg-card rounded-xl border border-border p-5">
              <SectionHeading>Operating Expense Tracker</SectionHeading>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="flex flex-col gap-1">
                  <Text size="x-small" color="muted">
                    Allocated Opex ({profitFirstOpexPct}% of Revenue)
                  </Text>
                  <Text size="medium" weight="semi-bold">
                    {formatINR(allocatedOpex)}
                  </Text>
                </div>
                <div className="flex flex-col gap-1">
                  <Text size="x-small" color="muted">
                    Used Opex (Total Expenses)
                  </Text>
                  <Text size="medium" weight="semi-bold">
                    {formatINR(usedOpex)}
                  </Text>
                </div>
                <div className="flex flex-col gap-1">
                  <Text size="x-small" color="muted">
                    Remaining Opex
                  </Text>
                  <Text
                    size="medium"
                    weight="semi-bold"
                    color={remainingOpex >= 0 ? 'notification-success' : 'notification-error'}
                  >
                    {formatINR(remainingOpex)}
                  </Text>
                </div>
              </div>
              {/* Progress bar */}
              {allocatedOpex > 0 && (
                <div className="mt-4">
                  <div className="flex justify-between mb-1">
                    <Text size="xx-small" color="muted">
                      Opex utilisation
                    </Text>
                    <Text size="xx-small" color="muted">
                      {Math.round((usedOpex / allocatedOpex) * 100)}%
                    </Text>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, (usedOpex / allocatedOpex) * 100)}%`,
                        background: usedOpex > allocatedOpex ? '#c62828' : usedOpex / allocatedOpex >= 0.75 ? '#0288d1' : '#ed6c02',
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* —— Profit First Allocations ———————————————————————————————————— */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {/* Table */}
              <div className="bg-card rounded-xl border border-border p-5">
                <SectionHeading>Profit First Allocation</SectionHeading>
                {totalRevenue === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 gap-2">
                    <Icon name="chart" size="large" color="muted" />
                    <Text color="muted">
                      No revenue data yet.
                    </Text>
                  </div>
                ) : (
                  <div>
                    {profitFirstAllocations.map(a => (
                      <AllocationRow
                        key={a.label}
                        label={a.label}
                        pct={a.pct}
                        amount={a.amount}
                        color={a.color}
                      />
                    ))}
                    <div className="flex items-center justify-between pt-3 mt-1">
                      <Text size="x-small" weight="semi-bold" color="muted">
                        Total Revenue Base
                      </Text>
                      <Text size="small" weight="semi-bold">
                        {formatINR(totalRevenue)}
                      </Text>
                    </div>
                  </div>
                )}
              </div>

              {/* Pie chart */}
              <div className="bg-card rounded-xl border border-border p-5">
                <SectionHeading>Profit First Breakdown</SectionHeading>
                {totalRevenue === 0 ? (
                  <div className="flex flex-col items-center justify-center h-48 gap-2">
                    <Icon name="chart" size="large" color="muted" />
                    <Text color="muted">
                      No revenue to visualise.
                    </Text>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    <ResponsiveContainer width={180} height={180}>
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {pieData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={pieColors[index]} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(v: unknown) => [`${v as number}%`]}
                          contentStyle={{
                            background: chartTooltipBg,
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px', fontFamily: 'inherit',
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    {/* Legend */}
                    <div className="flex flex-col gap-2 flex-1">
                      {profitFirstAllocations.map((a, i) => (
                        <div key={a.label} className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-sm flex-shrink-0"
                              style={{ background: pieColors[i] }}
                            />
                            <Text size="x-small">
                              {a.label}
                            </Text>
                          </div>
                          <Text size="x-small" weight="semi-bold" color="muted">
                            {a.pct}%
                          </Text>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* —— Bar Chart: Revenue vs COGS vs Profit per project ——————————— */}
            <div className="bg-card rounded-xl border border-border p-5">
              <SectionHeading>Revenue vs COGS vs Profit — Per Project</SectionHeading>
              {projects.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 gap-2">
                  <Icon name="chart" size="large" color="muted" />
                  <Text color="muted">
                    No project data to display.
                  </Text>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart
                    data={barChartData}
                    margin={{ top: 4, right: 4, left: 16, bottom: 0 }}
                    barGap={4}
                    barCategoryGap="30%"
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: chartTextColor, fontSize: 11, fontFamily: 'inherit' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: chartTextColor, fontSize: 11, fontFamily: 'inherit' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      formatter={(v: unknown, name: unknown) => [currencyFormatter(v as number), name as string]}
                      contentStyle={{
                        background: chartTooltipBg,
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px', fontFamily: 'inherit',
                      }}
                    />
                    <Bar dataKey="Revenue" fill={chartBarColors[0]} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="COGS" fill={chartBarColors[1]} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Profit" fill={chartBarColors[2]} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}

              {/* Bar legend */}
              {projects.length > 0 && (
                <div className="flex items-center gap-5 mt-3 justify-center flex-wrap">
                  {['Revenue', 'COGS', 'Profit'].map((label, i) => (
                    <div key={label} className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-sm"
                        style={{ background: chartBarColors[i] }}
                      />
                      <Text size="xx-small" color="muted">
                        {label}
                      </Text>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* —— Projects Summary Table —————————————————————————————————————— */}
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <div className="px-5 py-4 border-b border-border">
                <SectionHeading>All Projects Summary</SectionHeading>
              </div>
              {projects.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2">
                  <Icon name="highway" size="large" color="muted" />
                  <Text color="muted">
                    No projects found.
                  </Text>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <TableHeaderCell>Project</TableHeaderCell>
                        <TableHeaderCell>Status</TableHeaderCell>
                        <TableHeaderCell>Revenue</TableHeaderCell>
                        <TableHeaderCell>Actual COGS</TableHeaderCell>
                        <TableHeaderCell>Profit</TableHeaderCell>
                        <TableHeaderCell>Cash Received</TableHeaderCell>
                        <TableHeaderCell>Outstanding</TableHeaderCell>
                      </tr>
                    </thead>
                    <tbody>
                      {projects.map(p => {
                        const projExp = allExpenses
                          .filter(e => e.project_id === p.id)
                          .reduce((s, e) => s + (e.amount ?? 0), 0);
                        const projCash = allCash
                          .filter(c => c.project_id === p.id)
                          .reduce((s, c) => s + (c.amount ?? 0), 0);
                        const rev = p.revenue ?? 0;
                        const profit = rev - projExp;
                        const outstanding = Math.max(0, rev - projCash);
                        return (
                          <tr
                            key={p.id}
                            className="border-b border-border last:border-0 hover:bg-muted/40 transition-colors"
                          >
                            <td className="px-4 py-3">
                              <Text size="small" weight="semi-bold">
                                {p.name}
                              </Text>
                              <Text size="xx-small" color="muted">
                                {p.client}
                              </Text>
                            </td>
                            <td className="px-4 py-3">
                              <Badge color={STATUS_COLORS[p.status] ?? undefined}>
                                {p.status}
                              </Badge>
                            </td>
                            <td className="px-4 py-3">
                              <Text size="small">
                                {formatINR(rev)}
                              </Text>
                            </td>
                            <td className="px-4 py-3">
                              <Text size="small">
                                {formatINR(projExp)}
                              </Text>
                            </td>
                            <td className="px-4 py-3">
                              <Text
                                size="small"
                                weight="semi-bold"
                                color={profit >= 0 ? 'success' : 'danger'}
                              >
                                {formatINR(profit)}
                              </Text>
                            </td>
                            <td className="px-4 py-3">
                              <Text size="small" color="success">
                                {formatINR(projCash)}
                              </Text>
                            </td>
                            <td className="px-4 py-3">
                              <Text
                                size="small"
                                color={outstanding > 0 ? 'warning' : 'success'}
                              >
                                {formatINR(outstanding)}
                              </Text>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-border bg-background">
                        <td colSpan={2} className="px-4 py-3">
                          <Text size="x-small" weight="semi-bold">
                            Totals
                          </Text>
                        </td>
                        <td className="px-4 py-3">
                          <Text size="x-small" weight="semi-bold">
                            {formatINR(totalRevenue)}
                          </Text>
                        </td>
                        <td className="px-4 py-3">
                          <Text size="x-small" weight="semi-bold">
                            {formatINR(totalActualCogs)}
                          </Text>
                        </td>
                        <td className="px-4 py-3">
                          <Text
                            size="x-small"
                            weight="semi-bold"
                            color={totalProfit >= 0 ? 'success' : 'danger'}
                          >
                            {formatINR(totalProfit)}
                          </Text>
                        </td>
                        <td className="px-4 py-3">
                          <Text size="x-small" weight="semi-bold">
                            {formatINR(allCash.reduce((s, c) => s + (c.amount ?? 0), 0))}
                          </Text>
                        </td>
                        <td className="px-4 py-3">
                          <Text size="x-small" weight="semi-bold">
                            {formatINR(
                              projects.reduce((s, p) => {
                                const received = allCash
                                  .filter(c => c.project_id === p.id)
                                  .reduce((a, c) => a + (c.amount ?? 0), 0);
                                return s + Math.max(0, (p.revenue ?? 0) - received);
                              }, 0)
                            )}
                          </Text>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </div>
        </TabPanel>

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* TAB 2: Project Accounts                                               */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        <TabPanel label="Project Accounts">
          <div className="flex flex-col gap-6 pt-6">
            {/* —— Project Selector ——————————————————————————————————————————— */}
            <div className="bg-card rounded-xl border border-border p-5">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <Text
                    size="x-small"
                    weight="semi-bold"
                    className="uppercase tracking-wide mb-1"
                    color="muted"
                  >
                    Select Project
                  </Text>
                  <Text size="xx-small" color="muted">
                    {projects.length} project{projects.length !== 1 ? 's' : ''} available
                  </Text>
                </div>
                <div className="flex-1 max-w-sm">
                  {projects.length === 0 ? (
                    <Text color="muted">
                      No projects found.
                    </Text>
                  ) : (
                    <select
                      value={selectedProjectId}
                      onChange={e => setSelectedProjectId(e.target.value)}
                      className="form-input"
                    >
                      {projects.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} — {p.client}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                {selectedProject && (
                  <Badge color={STATUS_COLORS[selectedProject.status] ?? undefined}>
                    {selectedProject.status}
                  </Badge>
                )}
              </div>
            </div>

            {/* —— Project Detail —————————————————————————————————————————————— */}
            {selectedProject && !projectDetailLoading && projFinancials && (
              <>
                {/* Financial KPIs */}
                <div>
                  <SectionHeading>Financial Summary — {selectedProject.name}</SectionHeading>
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                    <div className="bg-card rounded-xl border border-border p-4 flex flex-col gap-1">
                      <Text size="x-small" color="muted">
                        Revenue
                      </Text>
                      <Text size="medium" weight="semi-bold">
                        {formatINR(projFinancials.revenue)}
                      </Text>
                    </div>
                    <div className="bg-card rounded-xl border border-border p-4 flex flex-col gap-1">
                      <Text size="x-small" color="muted">
                        Actual COGS
                      </Text>
                      <Text size="medium" weight="semi-bold">
                        {formatINR(projFinancials.actualCogs)}
                      </Text>
                      <Text size="xx-small" color="muted">
                        Est. COGS: {formatINR(projFinancials.estimatedCogs)}
                      </Text>
                    </div>
                    <div className="bg-card rounded-xl border border-border p-4 flex flex-col gap-1">
                      <Text size="x-small" color="muted">
                        Net Profit
                      </Text>
                      <Text
                        size="medium"
                        weight="semi-bold"
                        color={projFinancials.netProfit >= 0 ? 'success' : 'danger'}
                      >
                        {formatINR(projFinancials.netProfit)}
                      </Text>
                      <Text size="xx-small" color="muted">
                        Revenue − Actual COGS
                      </Text>
                    </div>
                    <div
                      className="rounded-xl border-2 border-primary bg-primary/5 p-4 flex flex-col gap-1"
                    >
                      <Text size="x-small" color="muted">
                        Design Fee ({projFinancials.designFeePct}% of Revenue)
                      </Text>
                      <Text size="medium" weight="semi-bold">
                        {formatINR(projFinancials.designFee)}
                      </Text>
                    </div>
                  </div>
                </div>

                {/* Derived Figures */}
                <div className="bg-card rounded-xl border border-border p-5">
                  <SectionHeading>Derived Allocations</SectionHeading>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="flex flex-col gap-1 p-3 rounded-lg bg-background border border-border">
                      <Text size="xx-small" color="muted" className="uppercase tracking-wide">
                        Incentive ({projFinancials.incentivePct}% of Profit)
                      </Text>
                      <Text size="medium" weight="semi-bold">
                        {formatINR(projFinancials.incentive)}
                      </Text>
                      <Text size="xx-small" color="muted">
                        Based on pre-design-fee profit
                      </Text>
                    </div>
                    <div className="flex flex-col gap-1 p-3 rounded-lg bg-background border border-border">
                      <Text size="xx-small" color="muted" className="uppercase tracking-wide">
                        Commission ({projFinancials.commissionPct}% of Profit)
                      </Text>
                      <Text size="medium" weight="semi-bold">
                        {formatINR(projFinancials.commission)}
                      </Text>
                      <Text size="xx-small" color="muted">
                        Based on pre-design-fee profit
                      </Text>
                    </div>
                    <div className="flex flex-col gap-1 p-3 rounded-lg bg-background border border-border">
                      <Text size="xx-small" color="muted" className="uppercase tracking-wide">
                        Outstanding Payment
                      </Text>
                      <Text
                        size="medium"
                        weight="semi-bold"
                        color={projFinancials.outstanding > 0 ? 'notification-warning' : 'notification-success'}
                      >
                        {formatINR(projFinancials.outstanding)}
                      </Text>
                      <Text size="xx-small" color="muted">
                        Revenue − Cash Received
                      </Text>
                    </div>
                  </div>
                </div>

                {/* Cash Received Table */}
                <div className="bg-card rounded-xl border border-border overflow-hidden">
                  <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                    <SectionHeading>Cash Received</SectionHeading>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <Text size="xx-small" color="muted">
                          Received
                        </Text>
                        <Text size="small" weight="semi-bold" color="success">
                          {formatINR(projFinancials.totalCashReceived)}
                        </Text>
                      </div>
                      <div className="text-right">
                        <Text size="xx-small" color="muted">
                          Outstanding
                        </Text>
                        <Text
                          size="small"
                          weight="semi-bold"
                          color={projFinancials.outstanding > 0 ? 'notification-warning' : 'notification-success'}
                        >
                          {formatINR(projFinancials.outstanding)}
                        </Text>
                      </div>
                    </div>
                  </div>
                  {projectCash.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 gap-2">
                      <Icon name="purchase" size="large" color="muted" />
                      <Text color="muted">
                        No payments recorded for this project.
                      </Text>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-border">
                            <TableHeaderCell>Date</TableHeaderCell>
                            <TableHeaderCell>Description</TableHeaderCell>
                            <TableHeaderCell>Amount</TableHeaderCell>
                            <TableHeaderCell>Cumulative</TableHeaderCell>
                          </tr>
                        </thead>
                        <tbody>
                          {projectCash.map((entry, idx) => {
                            const cumulative = projectCash
                              .slice(idx)
                              .reduce((s, c) => s + (c.amount ?? 0), 0);
                            return (
                              <tr
                                key={entry.id}
                                className="border-b border-border last:border-0 hover:bg-muted/40 transition-colors"
                              >
                                <td className="px-4 py-3">
                                  <Text size="x-small" color="muted">
                                    {new Date(entry.received_date).toLocaleDateString('en-IN')}
                                  </Text>
                                </td>
                                <td className="px-4 py-3">
                                  <Text size="x-small">
                                    {entry.description || '—'}
                                  </Text>
                                </td>
                                <td className="px-4 py-3">
                                  <Text size="x-small" weight="semi-bold" color="success">
                                    {formatINR(entry.amount)}
                                  </Text>
                                </td>
                                <td className="px-4 py-3">
                                  <Text size="x-small" color="muted">
                                    {formatINR(cumulative)}
                                  </Text>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2 border-border bg-background">
                            <td colSpan={2} className="px-4 py-3">
                              <Text size="x-small" weight="semi-bold">
                                Total Received
                              </Text>
                            </td>
                            <td colSpan={2} className="px-4 py-3">
                              <Text size="x-small" weight="semi-bold" color="success">
                                {formatINR(projFinancials.totalCashReceived)}
                              </Text>
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>

                {/* Expenses Table */}
                <div className="bg-card rounded-xl border border-border overflow-hidden">
                  <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                    <SectionHeading>Expenses Logged</SectionHeading>
                    <Text size="small" weight="semi-bold">
                      Total: {formatINR(projFinancials.actualCogs)}
                    </Text>
                  </div>
                  {projectExpenses.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 gap-2">
                      <Icon name="document" size="large" color="muted" />
                      <Text color="muted">
                        No expenses logged for this project.
                      </Text>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-border">
                            <TableHeaderCell>Date</TableHeaderCell>
                            <TableHeaderCell>Description</TableHeaderCell>
                            <TableHeaderCell>Amount</TableHeaderCell>
                            <TableHeaderCell>% of Revenue</TableHeaderCell>
                          </tr>
                        </thead>
                        <tbody>
                          {projectExpenses.map(exp => {
                            const pctOfRevenue =
                              projFinancials.revenue > 0
                                ? ((exp.amount / projFinancials.revenue) * 100).toFixed(1)
                                : '—';
                            return (
                              <tr
                                key={exp.id}
                                className="border-b border-border last:border-0 hover:bg-muted/40 transition-colors"
                              >
                                <td className="px-4 py-3">
                                  <Text size="x-small" color="muted">
                                    {new Date(exp.expense_date).toLocaleDateString('en-IN')}
                                  </Text>
                                </td>
                                <td className="px-4 py-3">
                                  <Text size="x-small">
                                    {exp.description}
                                  </Text>
                                </td>
                                <td className="px-4 py-3">
                                  <Text size="x-small" weight="semi-bold">
                                    {formatINR(exp.amount)}
                                  </Text>
                                </td>
                                <td className="px-4 py-3">
                                  <Text size="x-small" color="muted">
                                    {pctOfRevenue}%
                                  </Text>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2 border-border bg-background">
                            <td colSpan={2} className="px-4 py-3">
                              <Text size="x-small" weight="semi-bold">
                                Total Expenses
                              </Text>
                            </td>
                            <td className="px-4 py-3">
                              <Text size="x-small" weight="semi-bold">
                                {formatINR(projFinancials.actualCogs)}
                              </Text>
                            </td>
                            <td className="px-4 py-3">
                              <Text size="x-small" color="muted">
                                {projFinancials.revenue > 0
                                  ? `${((projFinancials.actualCogs / projFinancials.revenue) * 100).toFixed(1)}%`
                                  : '—'}
                              </Text>
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* —— Loading state for project detail ——————————————————————————— */}
            {projectDetailLoading && (
              <div className="flex items-center justify-center h-48 gap-3">
                <Icon name="chart" size="medium" color="muted" />
                <Text color="muted">
                  Loading project data…
                </Text>
              </div>
            )}

            {/* —— Empty state ————————————————————————————————————————————————— */}
            {!selectedProject && !projectDetailLoading && projects.length === 0 && (
              <div className="flex flex-col items-center justify-center h-64 gap-3 bg-card rounded-xl border border-border">
                <Icon name="highway" size="large" color="muted" />
                <Text color="muted">
                  No projects available. Create a project to see financial details.
                </Text>
              </div>
            )}
          </div>
        </TabPanel>
      </Tabs>
    </div>
  );
}



