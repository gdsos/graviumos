import { useState, useEffect, useCallback } from 'react';
import {
  PHeading,
  PText,
  PButton,
  PTag,
  PIcon,
  PInlineNotification,
  PTabs,
  PTabsItem,
} from '@porsche-design-system/components-react';
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

// ─── Constants ────────────────────────────────────────────────────────────────

const FONT = "inherit";

const PIE_COLORS = ['#010205', '#6B6D70', '#AFB0B3', '#D8D8DB'];
const PIE_COLORS_DARK = ['#FBFCFF', '#AFB0B3', '#6B6D70', '#535457'];

const STATUS_COLORS: Record<string, Parameters<typeof PTag>[0]['color']> = {
  Active: 'notification-success-soft',
  Completed: 'notification-info-soft',
  'On Hold': 'notification-warning-soft',
  Cancelled: 'notification-error-soft',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

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
  icon: string;
  accent?: 'success' | 'warning' | 'error' | 'info' | 'default';
}) {
  const accentMap: Record<string, string> = {
    success: 'bg-success-soft text-success',
    warning: 'bg-warning-soft text-warning',
    error: 'bg-error-soft text-error',
    info: 'bg-info-soft text-info',
    default: 'bg-surface text-primary',
  };
  const iconClass = accentMap[accent ?? 'default'];

  return (
    <div className="bg-surface rounded-xl border border-contrast-low p-5 flex items-start gap-4">
      <div
        className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${iconClass}`}
      >
        <PIcon
          name={icon as Parameters<typeof PIcon>[0]['name']}
          size="small"
          color="inherit"
        />
      </div>
      <div className="min-w-0">
        <PText
          size="xx-small"
          color="contrast-medium"
          className="uppercase tracking-wide"
          
        >
          {label}
        </PText>
        <PHeading tag="h3" size="medium" className="mt-1" >
          {value}
        </PHeading>
        {sub && (
          <PText size="xx-small" color="contrast-medium" >
            {sub}
          </PText>
        )}
      </div>
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <PText
      size="x-small"
      weight="semi-bold"
      className="uppercase tracking-wide mb-3"
      color="contrast-medium"
      
    >
      {children}
    </PText>
  );
}

function TableHeaderCell({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3 text-left">
      <PText
        size="xx-small"
        color="contrast-medium"
        weight="semi-bold"
        className="uppercase tracking-wide"
        
      >
        {children}
      </PText>
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
    <div className="flex items-center justify-between py-3 border-b border-contrast-low last:border-0">
      <div className="flex items-center gap-3">
        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: color }} />
        <PText size="small" >
          {label}
        </PText>
        <PTag color="background-surface">
          {pct}%
        </PTag>
      </div>
      <PText size="small" weight="semi-bold" >
        {formatINR(amount)}
      </PText>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Financials() {
  const { isAdmin, isFinance } = useAuth();
  const { theme } = useTheme();

  // ── Access gate ────────────────────────────────────────────────────────────
  if (!isAdmin() && !isFinance()) {
    return (
      <div className="max-w-7xl mx-auto" >
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <div className="w-16 h-16 rounded-full bg-error-soft flex items-center justify-center">
            <PIcon name="lock" size="large" color="notification-error" />
          </div>
          <PHeading tag="h2" size="large" >
            Access Restricted
          </PHeading>
          <PText color="contrast-medium" >
            This section is only accessible to Finance department members and Administrators.
          </PText>
          <PInlineNotification
            heading="Insufficient Permissions"
            description="You do not have the required role to view financial data. Contact your administrator for access."
            state="error"
            dismissButton={false}
          />
        </div>
      </div>
    );
  }

  return <FinancialsInner theme={theme} />;
}

// ─── Inner component (only rendered when authorised) ──────────────────────────

function FinancialsInner({ theme }: { theme: 'light' | 'dark' }) {
  // Data
  const [projects, setProjects] = useState<Project[]>([]);
  const [allExpenses, setAllExpenses] = useState<ProjectExpense[]>([]);
  const [allCash, setAllCash] = useState<ProjectCashReceived[]>([]);
  const [orgSettings, setOrgSettings] = useState<OrgSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Project-wise tab
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [projectExpenses, setProjectExpenses] = useState<ProjectExpense[]>([]);
  const [projectCash, setProjectCash] = useState<ProjectCashReceived[]>([]);
  const [projectDetailLoading, setProjectDetailLoading] = useState(false);

  // ── Chart colours ─────────────────────────────────────────────────────────
  const chartTextColor = theme === 'dark' ? '#FBFCFF' : '#010205';
  const chartGridColor = theme === 'dark' ? '#333' : '#EEEFF2';
  const chartTooltipBg = theme === 'dark' ? '#212225' : '#ffffff';
  const chartBarColors = theme === 'dark'
    ? ['#FBFCFF', '#6B6D70', '#AFB0B3']
    : ['#010205', '#6B6D70', '#D8D8DB'];
  const pieColors = theme === 'dark' ? PIE_COLORS_DARK : PIE_COLORS;

  // ── Fetch all data ─────────────────────────────────────────────────────────
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

  // ── Fetch project-specific detail when selection changes ───────────────────
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

  // ── Auto-select first project when list loads ──────────────────────────────
  useEffect(() => {
    if (projects.length > 0 && !selectedProjectId) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  // ── Global Calculations ────────────────────────────────────────────────────

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

  // ── Bar chart data: Revenue vs COGS vs Profit per project ─────────────────
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

  // ── Pie chart data ─────────────────────────────────────────────────────────
  const pieData = profitFirstAllocations.map(a => ({
    name: a.label,
    value: a.pct,
  }));

  // ── Project-wise calculations ──────────────────────────────────────────────
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

  // ── Chart tooltip formatter ────────────────────────────────────────────────
  const currencyFormatter = (v: number) => formatINR(v);

  // ─── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto" >
        <div className="flex items-center justify-center h-64 gap-3">
          <PIcon name="chart" size="medium" color="contrast-medium" />
          <PText color="contrast-medium" >
            Loading financial data…
          </PText>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto" >
      {/* ── Page Header ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <PHeading tag="h1" size="x-large" className="mb-1" >
            Financials
          </PHeading>
          <PText color="contrast-medium" >
            Profit First financial overview for GRAVIUM OS
          </PText>
        </div>
        <PButton icon="refresh" variant="secondary" onClick={fetchAll}>
          Refresh
        </PButton>
      </div>

      {/* ── Error Banner ───────────────────────────────────────────────────── */}
      {error && (
        <div className="mb-6">
          <PInlineNotification
            heading="Failed to load data"
            description={error}
            state="error"
            dismissButton
            onDismiss={() => setError('')}
          />
        </div>
      )}

      {/* ── Tabs ───────────────────────────────────────────────────────────── */}
      <PTabs activeTabIndex={0}>
        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* TAB 1: Global Financial View                                       */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        <PTabsItem label="Global Overview">
          <div className="flex flex-col gap-8 pt-6">
            {/* ── KPI Cards ────────────────────────────────────────────────── */}
            <div>
              <SectionHeading>Key Performance Indicators</SectionHeading>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <KpiCard
                  label="Total Revenue"
                  value={formatINR(totalRevenue)}
                  sub={`Across ${projects.length} project${projects.length !== 1 ? 's' : ''}`}
                  icon="calculator"
                  accent="info"
                />
                <KpiCard
                  label="Total Actual COGS"
                  value={formatINR(totalActualCogs)}
                  sub="Sum of all project expenses"
                  icon="chart"
                  accent="warning"
                />
                <KpiCard
                  label="Total Profit"
                  value={formatINR(totalProfit)}
                  sub="Revenue − Actual COGS"
                  icon="increase"
                  accent={totalProfit >= 0 ? 'success' : 'error'}
                />
                <KpiCard
                  label="Remaining Opex"
                  value={formatINR(remainingOpex)}
                  sub={`Allocated ${formatINR(allocatedOpex)} − Used ${formatINR(usedOpex)}`}
                  icon="door"
                  accent={remainingOpex >= 0 ? 'success' : 'error'}
                />
              </div>
            </div>

            {/* ── Opex Summary ─────────────────────────────────────────────── */}
            <div className="bg-surface rounded-xl border border-contrast-low p-5">
              <SectionHeading>Operating Expense Tracker</SectionHeading>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="flex flex-col gap-1">
                  <PText size="x-small" color="contrast-medium" >
                    Allocated Opex ({profitFirstOpexPct}% of Revenue)
                  </PText>
                  <PText size="medium" weight="semi-bold" >
                    {formatINR(allocatedOpex)}
                  </PText>
                </div>
                <div className="flex flex-col gap-1">
                  <PText size="x-small" color="contrast-medium" >
                    Used Opex (Total Expenses)
                  </PText>
                  <PText size="medium" weight="semi-bold" >
                    {formatINR(usedOpex)}
                  </PText>
                </div>
                <div className="flex flex-col gap-1">
                  <PText size="x-small" color="contrast-medium" >
                    Remaining Opex
                  </PText>
                  <PText
                    size="medium"
                    weight="semi-bold"
                    color={remainingOpex >= 0 ? 'notification-success' : 'notification-error'}
                    
                  >
                    {formatINR(remainingOpex)}
                  </PText>
                </div>
              </div>
              {/* Progress bar */}
              {allocatedOpex > 0 && (
                <div className="mt-4">
                  <div className="flex justify-between mb-1">
                    <PText size="xx-small" color="contrast-medium" >
                      Opex utilisation
                    </PText>
                    <PText size="xx-small" color="contrast-medium" >
                      {Math.round((usedOpex / allocatedOpex) * 100)}%
                    </PText>
                  </div>
                  <div className="w-full bg-contrast-low rounded-full h-2 overflow-hidden">
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

            {/* ── Profit First Allocations ──────────────────────────────────── */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {/* Table */}
              <div className="bg-surface rounded-xl border border-contrast-low p-5">
                <SectionHeading>Profit First Allocation</SectionHeading>
                {totalRevenue === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 gap-2">
                    <PIcon name="chart" size="large" color="contrast-low" />
                    <PText color="contrast-medium" >
                      No revenue data yet.
                    </PText>
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
                      <PText size="x-small" weight="semi-bold" color="contrast-medium" >
                        Total Revenue Base
                      </PText>
                      <PText size="small" weight="semi-bold" >
                        {formatINR(totalRevenue)}
                      </PText>
                    </div>
                  </div>
                )}
              </div>

              {/* Pie chart */}
              <div className="bg-surface rounded-xl border border-contrast-low p-5">
                <SectionHeading>Profit First Breakdown</SectionHeading>
                {totalRevenue === 0 ? (
                  <div className="flex flex-col items-center justify-center h-48 gap-2">
                    <PIcon name="chart" size="large" color="contrast-low" />
                    <PText color="contrast-medium" >
                      No revenue to visualise.
                    </PText>
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
                            border: '1px solid var(--p-color-contrast-low)',
                            borderRadius: '8px',
                            fontFamily: FONT,
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
                            <PText size="x-small" >
                              {a.label}
                            </PText>
                          </div>
                          <PText size="x-small" weight="semi-bold" color="contrast-medium" >
                            {a.pct}%
                          </PText>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ── Bar Chart: Revenue vs COGS vs Profit per project ─────────── */}
            <div className="bg-surface rounded-xl border border-contrast-low p-5">
              <SectionHeading>Revenue vs COGS vs Profit — Per Project</SectionHeading>
              {projects.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 gap-2">
                  <PIcon name="chart" size="large" color="contrast-low" />
                  <PText color="contrast-medium" >
                    No project data to display.
                  </PText>
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
                      tick={{ fill: chartTextColor, fontSize: 11, fontFamily: FONT }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: chartTextColor, fontSize: 11, fontFamily: FONT }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      formatter={(v: unknown, name: unknown) => [currencyFormatter(v as number), name as string]}
                      contentStyle={{
                        background: chartTooltipBg,
                        border: '1px solid var(--p-color-contrast-low)',
                        borderRadius: '8px',
                        fontFamily: FONT,
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
                      <PText size="xx-small" color="contrast-medium" >
                        {label}
                      </PText>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Projects Summary Table ────────────────────────────────────── */}
            <div className="bg-surface rounded-xl border border-contrast-low overflow-hidden">
              <div className="px-5 py-4 border-b border-contrast-low">
                <SectionHeading>All Projects Summary</SectionHeading>
              </div>
              {projects.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2">
                  <PIcon name="highway" size="large" color="contrast-low" />
                  <PText color="contrast-medium" >
                    No projects found.
                  </PText>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-contrast-low">
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
                            className="border-b border-contrast-low last:border-0 hover:bg-canvas transition-colors"
                          >
                            <td className="px-4 py-3">
                              <PText size="small" weight="semi-bold" >
                                {p.name}
                              </PText>
                              <PText size="xx-small" color="contrast-medium" >
                                {p.client}
                              </PText>
                            </td>
                            <td className="px-4 py-3">
                              <PTag color={STATUS_COLORS[p.status] ?? 'background-surface'}>
                                {p.status}
                              </PTag>
                            </td>
                            <td className="px-4 py-3">
                              <PText size="small" >
                                {formatINR(rev)}
                              </PText>
                            </td>
                            <td className="px-4 py-3">
                              <PText size="small" >
                                {formatINR(projExp)}
                              </PText>
                            </td>
                            <td className="px-4 py-3">
                              <PText
                                size="small"
                                weight="semi-bold"
                                color={profit >= 0 ? 'notification-success' : 'notification-error'}
                                
                              >
                                {formatINR(profit)}
                              </PText>
                            </td>
                            <td className="px-4 py-3">
                              <PText size="small" color="notification-success" >
                                {formatINR(projCash)}
                              </PText>
                            </td>
                            <td className="px-4 py-3">
                              <PText
                                size="small"
                                color={outstanding > 0 ? 'notification-warning' : 'notification-success'}
                                
                              >
                                {formatINR(outstanding)}
                              </PText>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-contrast-low bg-canvas">
                        <td colSpan={2} className="px-4 py-3">
                          <PText size="x-small" weight="semi-bold" >
                            Totals
                          </PText>
                        </td>
                        <td className="px-4 py-3">
                          <PText size="x-small" weight="semi-bold" >
                            {formatINR(totalRevenue)}
                          </PText>
                        </td>
                        <td className="px-4 py-3">
                          <PText size="x-small" weight="semi-bold" >
                            {formatINR(totalActualCogs)}
                          </PText>
                        </td>
                        <td className="px-4 py-3">
                          <PText
                            size="x-small"
                            weight="semi-bold"
                            color={totalProfit >= 0 ? 'notification-success' : 'notification-error'}
                            
                          >
                            {formatINR(totalProfit)}
                          </PText>
                        </td>
                        <td className="px-4 py-3">
                          <PText size="x-small" weight="semi-bold" >
                            {formatINR(allCash.reduce((s, c) => s + (c.amount ?? 0), 0))}
                          </PText>
                        </td>
                        <td className="px-4 py-3">
                          <PText size="x-small" weight="semi-bold" >
                            {formatINR(
                              projects.reduce((s, p) => {
                                const received = allCash
                                  .filter(c => c.project_id === p.id)
                                  .reduce((a, c) => a + (c.amount ?? 0), 0);
                                return s + Math.max(0, (p.revenue ?? 0) - received);
                              }, 0)
                            )}
                          </PText>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </div>
        </PTabsItem>

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* TAB 2: Project-wise Financial View                                */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        <PTabsItem label="Project Breakdown">
          <div className="flex flex-col gap-6 pt-6">
            {/* ── Project Selector ─────────────────────────────────────────── */}
            <div className="bg-surface rounded-xl border border-contrast-low p-5">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <PText
                    size="x-small"
                    weight="semi-bold"
                    className="uppercase tracking-wide mb-1"
                    color="contrast-medium"
                    
                  >
                    Select Project
                  </PText>
                  <PText size="xx-small" color="contrast-medium" >
                    {projects.length} project{projects.length !== 1 ? 's' : ''} available
                  </PText>
                </div>
                <div className="flex-1 max-w-sm">
                  {projects.length === 0 ? (
                    <PText color="contrast-medium" >
                      No projects found.
                    </PText>
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
                  <PTag color={STATUS_COLORS[selectedProject.status] ?? 'background-surface'}>
                    {selectedProject.status}
                  </PTag>
                )}
              </div>
            </div>

            {/* ── Project Detail ────────────────────────────────────────────── */}
            {selectedProject && !projectDetailLoading && projFinancials && (
              <>
                {/* Financial KPIs */}
                <div>
                  <SectionHeading>Financial Summary — {selectedProject.name}</SectionHeading>
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                    <div className="bg-surface rounded-xl border border-contrast-low p-4 flex flex-col gap-1">
                      <PText size="x-small" color="contrast-medium" >
                        Revenue
                      </PText>
                      <PText size="medium" weight="semi-bold" >
                        {formatINR(projFinancials.revenue)}
                      </PText>
                    </div>
                    <div className="bg-surface rounded-xl border border-contrast-low p-4 flex flex-col gap-1">
                      <PText size="x-small" color="contrast-medium" >
                        Actual COGS
                      </PText>
                      <PText size="medium" weight="semi-bold" >
                        {formatINR(projFinancials.actualCogs)}
                      </PText>
                      <PText size="xx-small" color="contrast-medium" >
                        Est. COGS: {formatINR(projFinancials.estimatedCogs)}
                      </PText>
                    </div>
                    <div className="bg-surface rounded-xl border border-contrast-low p-4 flex flex-col gap-1">
                      <PText size="x-small" color="contrast-medium" >
                        Net Profit
                      </PText>
                      <PText
                        size="medium"
                        weight="semi-bold"
                        color={projFinancials.netProfit >= 0 ? 'notification-success' : 'notification-error'}
                        
                      >
                        {formatINR(projFinancials.netProfit)}
                      </PText>
                      <PText size="xx-small" color="contrast-medium" >
                        Revenue − Actual COGS
                      </PText>
                    </div>
                    <div
                      className="rounded-xl border-2 border-primary bg-primary/5 p-4 flex flex-col gap-1"
                    >
                      <PText size="x-small" color="contrast-medium" >
                        Design Fee ({projFinancials.designFeePct}% of Revenue)
                      </PText>
                      <PText size="medium" weight="semi-bold" >
                        {formatINR(projFinancials.designFee)}
                      </PText>
                    </div>
                  </div>
                </div>

                {/* Derived Figures */}
                <div className="bg-surface rounded-xl border border-contrast-low p-5">
                  <SectionHeading>Derived Allocations</SectionHeading>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="flex flex-col gap-1 p-3 rounded-lg bg-canvas border border-contrast-low">
                      <PText size="xx-small" color="contrast-medium" className="uppercase tracking-wide" >
                        Incentive ({projFinancials.incentivePct}% of Profit)
                      </PText>
                      <PText size="medium" weight="semi-bold" >
                        {formatINR(projFinancials.incentive)}
                      </PText>
                      <PText size="xx-small" color="contrast-medium" >
                        Based on pre-design-fee profit
                      </PText>
                    </div>
                    <div className="flex flex-col gap-1 p-3 rounded-lg bg-canvas border border-contrast-low">
                      <PText size="xx-small" color="contrast-medium" className="uppercase tracking-wide" >
                        Commission ({projFinancials.commissionPct}% of Profit)
                      </PText>
                      <PText size="medium" weight="semi-bold" >
                        {formatINR(projFinancials.commission)}
                      </PText>
                      <PText size="xx-small" color="contrast-medium" >
                        Based on pre-design-fee profit
                      </PText>
                    </div>
                    <div className="flex flex-col gap-1 p-3 rounded-lg bg-canvas border border-contrast-low">
                      <PText size="xx-small" color="contrast-medium" className="uppercase tracking-wide" >
                        Outstanding Payment
                      </PText>
                      <PText
                        size="medium"
                        weight="semi-bold"
                        color={projFinancials.outstanding > 0 ? 'notification-warning' : 'notification-success'}
                        
                      >
                        {formatINR(projFinancials.outstanding)}
                      </PText>
                      <PText size="xx-small" color="contrast-medium" >
                        Revenue − Cash Received
                      </PText>
                    </div>
                  </div>
                </div>

                {/* Cash Received Table */}
                <div className="bg-surface rounded-xl border border-contrast-low overflow-hidden">
                  <div className="px-5 py-4 border-b border-contrast-low flex items-center justify-between">
                    <SectionHeading>Cash Received</SectionHeading>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <PText size="xx-small" color="contrast-medium" >
                          Received
                        </PText>
                        <PText size="small" weight="semi-bold" color="notification-success" >
                          {formatINR(projFinancials.totalCashReceived)}
                        </PText>
                      </div>
                      <div className="text-right">
                        <PText size="xx-small" color="contrast-medium" >
                          Outstanding
                        </PText>
                        <PText
                          size="small"
                          weight="semi-bold"
                          color={projFinancials.outstanding > 0 ? 'notification-warning' : 'notification-success'}
                          
                        >
                          {formatINR(projFinancials.outstanding)}
                        </PText>
                      </div>
                    </div>
                  </div>
                  {projectCash.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 gap-2">
                      <PIcon name="purchase" size="large" color="contrast-low" />
                      <PText color="contrast-medium" >
                        No payments recorded for this project.
                      </PText>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-contrast-low">
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
                                className="border-b border-contrast-low last:border-0 hover:bg-canvas transition-colors"
                              >
                                <td className="px-4 py-3">
                                  <PText size="x-small" color="contrast-medium" >
                                    {new Date(entry.received_date).toLocaleDateString('en-IN')}
                                  </PText>
                                </td>
                                <td className="px-4 py-3">
                                  <PText size="x-small" >
                                    {entry.description || '—'}
                                  </PText>
                                </td>
                                <td className="px-4 py-3">
                                  <PText size="x-small" weight="semi-bold" color="notification-success" >
                                    {formatINR(entry.amount)}
                                  </PText>
                                </td>
                                <td className="px-4 py-3">
                                  <PText size="x-small" color="contrast-medium" >
                                    {formatINR(cumulative)}
                                  </PText>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2 border-contrast-low bg-canvas">
                            <td colSpan={2} className="px-4 py-3">
                              <PText size="x-small" weight="semi-bold" >
                                Total Received
                              </PText>
                            </td>
                            <td colSpan={2} className="px-4 py-3">
                              <PText size="x-small" weight="semi-bold" color="notification-success" >
                                {formatINR(projFinancials.totalCashReceived)}
                              </PText>
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>

                {/* Expenses Table */}
                <div className="bg-surface rounded-xl border border-contrast-low overflow-hidden">
                  <div className="px-5 py-4 border-b border-contrast-low flex items-center justify-between">
                    <SectionHeading>Expenses Logged</SectionHeading>
                    <PText size="small" weight="semi-bold" >
                      Total: {formatINR(projFinancials.actualCogs)}
                    </PText>
                  </div>
                  {projectExpenses.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 gap-2">
                      <PIcon name="document" size="large" color="contrast-low" />
                      <PText color="contrast-medium" >
                        No expenses logged for this project.
                      </PText>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-contrast-low">
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
                                className="border-b border-contrast-low last:border-0 hover:bg-canvas transition-colors"
                              >
                                <td className="px-4 py-3">
                                  <PText size="x-small" color="contrast-medium" >
                                    {new Date(exp.expense_date).toLocaleDateString('en-IN')}
                                  </PText>
                                </td>
                                <td className="px-4 py-3">
                                  <PText size="x-small" >
                                    {exp.description}
                                  </PText>
                                </td>
                                <td className="px-4 py-3">
                                  <PText size="x-small" weight="semi-bold" >
                                    {formatINR(exp.amount)}
                                  </PText>
                                </td>
                                <td className="px-4 py-3">
                                  <PText size="x-small" color="contrast-medium" >
                                    {pctOfRevenue}%
                                  </PText>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2 border-contrast-low bg-canvas">
                            <td colSpan={2} className="px-4 py-3">
                              <PText size="x-small" weight="semi-bold" >
                                Total Expenses
                              </PText>
                            </td>
                            <td className="px-4 py-3">
                              <PText size="x-small" weight="semi-bold" >
                                {formatINR(projFinancials.actualCogs)}
                              </PText>
                            </td>
                            <td className="px-4 py-3">
                              <PText size="x-small" color="contrast-medium" >
                                {projFinancials.revenue > 0
                                  ? `${((projFinancials.actualCogs / projFinancials.revenue) * 100).toFixed(1)}%`
                                  : '—'}
                              </PText>
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* ── Loading state for project detail ─────────────────────────── */}
            {projectDetailLoading && (
              <div className="flex items-center justify-center h-48 gap-3">
                <PIcon name="chart" size="medium" color="contrast-medium" />
                <PText color="contrast-medium" >
                  Loading project data…
                </PText>
              </div>
            )}

            {/* ── Empty state ───────────────────────────────────────────────── */}
            {!selectedProject && !projectDetailLoading && projects.length === 0 && (
              <div className="flex flex-col items-center justify-center h-64 gap-3 bg-surface rounded-xl border border-contrast-low">
                <PIcon name="highway" size="large" color="contrast-low" />
                <PText color="contrast-medium" >
                  No projects available. Create a project to see financial details.
                </PText>
              </div>
            )}
          </div>
        </PTabsItem>
      </PTabs>
    </div>
  );
}
