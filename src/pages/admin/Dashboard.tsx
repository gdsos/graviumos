import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { supabase, formatINR } from '../../lib/supabase';
import {
 Area,
 AreaChart,
 CartesianGrid,
 ResponsiveContainer,
 Tooltip,
 XAxis,
 YAxis,
} from 'recharts';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import {
 ArrowRight,
 Bell,
 BriefcaseBusiness,
 CheckSquare,
 CircleDollarSign,
 ClipboardList,
 Lightbulb,
 Maximize2,
 Package,
 Plus,
 Settings,
 Sparkles,
 Store,
 TrendingUp,
 X,
} from 'lucide-react';

interface KPIData {
 totalLeads: number;
 convertedLeads: number;
 activeProjects: number;
 projectValue: number;
 cashReceived: number;
 recognizedRevenue: number;
}

interface MonthlyRevenue {
 month: string;
 revenue: number;
}

interface CashReceivedRow {
 project_id?: string | null;
 amount?: number | null;
 received_date?: string | null;
 created_at?: string | null;
}

function getCashAmount(row: CashReceivedRow) {
 return Number(row.amount || 0);
}

function getCashDate(row: CashReceivedRow) {
 return row.received_date || row.created_at || '';
}

function getConversionRate(kpi: KPIData) {
 if (kpi.totalLeads <= 0) return 0;

 return Math.round((kpi.convertedLeads / kpi.totalLeads) * 100);
}

const cardMotion = {
 hidden: {
 opacity: 0,
 y: 14,
 scale: 0.985,
 },
 visible: {
 opacity: 1,
 y: 0,
 scale: 1,
 },
};

const cardTransition = {
 duration: 0.32,
 ease: 'easeOut' as const,
};

function AnimatedMetric({
 value,
 formatter,
 className = '',
}: {
 value: number;
 formatter: (value: number) => string;
 className?: string;
}) {
 const [displayValue, setDisplayValue] = useState(0);
 const previousValueRef = useRef(0);

 useEffect(() => {
 const from = previousValueRef.current;
 const to = Number.isFinite(value) ? value : 0;
 const duration = 750;
 const startedAt = performance.now();

 previousValueRef.current = to;

 let frame = 0;

 const tick = (now: number) => {
 const progress = Math.min((now - startedAt) / duration, 1);
 const eased = 1 - Math.pow(1 - progress, 3);

 setDisplayValue(from + (to - from) * eased);

 if (progress < 1) {
 frame = requestAnimationFrame(tick);
 }
 };

 frame = requestAnimationFrame(tick);

 return () => cancelAnimationFrame(frame);
 }, [value]);

 return <span className={className}>{formatter(displayValue)}</span>;
}

function BentoCard({
 children,
 className = '',
}: {
 children: React.ReactNode;
 className?: string;
}) {
 return (
 <motion.div
 variants={cardMotion}
 transition={cardTransition}
 whileHover={{ y: -3 }}
 whileTap={{ scale: 0.99 }}
 className={className}
 >
 {children}
 </motion.div>
 );
}

interface AdminCommandAction {
 label: string;
 helper: string;
 route: string;
 icon: typeof ArrowRight;
}

function FloatingCommandDock({
 actions,
 onNavigate,
}: {
 actions: AdminCommandAction[];
 onNavigate: (route: string) => void;
}) {
 const [open, setOpen] = useState(false);

 useEffect(() => {
 if (!open) return;

 const timeout = window.setTimeout(() => {
 setOpen(false);
 }, 7000);

 return () => window.clearTimeout(timeout);
 }, [open]);

 return (
 <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+6.25rem)] right-6 z-[80] md:bottom-8 md:right-8">
 <AnimatePresence>
 {open && (
 <motion.div
 initial={{ opacity: 0, y: 12, scale: 0.96 }}
 animate={{ opacity: 1, y: 0, scale: 1 }}
 exit={{ opacity: 0, y: 10, scale: 0.96 }}
 transition={{ duration: 0.18, ease: 'easeOut' }}
 className="mb-3 max-h-[70vh] w-[14.5rem] overflow-y-auto rounded-3xl border border-white/18 bg-[#4F4E4D]/58 p-2 shadow-2xl shadow-black/22 backdrop-blur-sm dark:border-white/10 dark:bg-black/60"
 >
 <div className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-b from-white/14 via-white/4 to-transparent dark:from-white/24 dark:via-white/6" />

 <div className="relative z-10 space-y-1.5">
 <div className="px-2 pb-1 pt-1">
 <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-black/55 dark:text-white/50">
 Quick Actions
 </p>
 </div>

 {actions.map(action => {
 const Icon = action.icon;

 return (
 <button
 key={action.label}
 type="button"
 onClick={() => {
 setOpen(false);
 onNavigate(action.route);
 }}
 className="flex w-full items-center gap-2.5 rounded-2xl border border-black/10 bg-black/6 px-3 py-2.5 text-left text-black transition-colors hover:bg-black/12 dark:border-white/14 dark:bg-white/9 dark:text-white dark:hover:bg-white/16"
 >
 <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-black/8 dark:bg-white/12">
 <Icon size={15} />
 </span>

 <span className="truncate text-sm font-semibold">
 {action.label}
 </span>
 </button>
 );
 })}
 </div>
 </motion.div>
 )}
 </AnimatePresence>

 <motion.button
 type="button"
 onClick={() => setOpen(current => !current)}
 whileTap={{ scale: 0.94 }}
 animate={open ? { rotate: 45 } : { rotate: 0 }}
 transition={{ duration: 0.18, ease: 'easeOut' }}
 className="relative ml-auto flex h-13 w-13 items-center justify-center overflow-hidden rounded-full border border-white/18 bg-[#4F4E4D]/54 text-black shadow-2xl shadow-black/22 backdrop-blur-sm transition-colors hover:bg-[#4F4E4D]/62 supports-[backdrop-filter]:bg-[#4F4E4D]/48 dark:border-white/10 dark:bg-black/60 dark:text-white dark:hover:bg-black/70"
 aria-expanded={open}
 aria-label="Toggle admin command dock"
 >
 <span className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-b from-white/14 via-white/4 to-transparent dark:from-white/24 dark:via-white/6" />
 <Sparkles size={19} className="relative z-10" />
 </motion.button>
 </div>
 );
}

function FlipCommandCard({
 cardKey,
 flippedCard,
 setFlippedCard,
 title,
 eyebrow,
 routeLabel,
 onOpen,
 children,
 className = '',
}: {
 cardKey: string;
 flippedCard: string | null;
 setFlippedCard: (cardKey: string | null) => void;
 title: string;
 eyebrow: string;
 routeLabel: string;
 onOpen: () => void;
 children: React.ReactNode;
 className?: string;
}) {
 const isFlipped = flippedCard === cardKey;

 return (
 <motion.div
 variants={cardMotion}
 transition={cardTransition}
 whileHover={{ y: -3 }}
 whileTap={{ scale: 0.99 }}
 className={`relative [perspective:1200px] ${className}`}
 >
 <motion.div
 animate={{ rotateY: isFlipped ? 180 : 0 }}
 transition={{ duration: 0.42, ease: 'easeInOut' }}
 className="relative h-full min-h-inherit w-full [transform-style:preserve-3d]"
 >
 <button
 type="button"
 onClick={() => setFlippedCard(cardKey)}
 className="absolute inset-0 h-full w-full rounded-3xl border border-border bg-card p-4 sm:p-6 text-left outline-none [backface-visibility:hidden] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
 >
 {children}
 </button>

 <div
 role="button"
 tabIndex={0}
 onClick={() => setFlippedCard(null)}
 onKeyDown={event => {
 if (event.key === 'Enter' || event.key === ' ') {
 event.preventDefault();
 setFlippedCard(null);
 }
 }}
 className="absolute inset-0 flex h-full w-full cursor-pointer flex-col justify-between rounded-3xl border border-border bg-card p-4 sm:p-6 outline-none [backface-visibility:hidden] [transform:rotateY(180deg)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
 >
 <div>
 <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground sm:text-xs sm:tracking-[0.22em]">
 {eyebrow}
 </p>

 <h3 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
 {title}
 </h3>
 </div>

 <button
 type="button"
 onClick={event => {
 event.stopPropagation();
 onOpen();
 }}
 className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
 >
 <ArrowRight size={16} />
 Open {routeLabel}
 </button>
 </div>
 </motion.div>
 </motion.div>
 );
}

export default function Dashboard() {
 const navigate = useNavigate();
 const { userDepartments, isAdmin } = useAuth();

 const [kpi, setKpi] = useState<KPIData>({
 totalLeads: 0,
 convertedLeads: 0,
 activeProjects: 0,
 projectValue: 0,
 cashReceived: 0,
 recognizedRevenue: 0,
 });
 const [monthlyRevenue, setMonthlyRevenue] = useState<MonthlyRevenue[]>([]);
 const [leadFunnel, setLeadFunnel] = useState<{ name: string; value: number; fill: string }[]>([]);
 const [loading, setLoading] = useState(true);
 const [flippedCard, setFlippedCard] = useState<string | null>(null);
 const [showRevenueDrawer, setShowRevenueDrawer] = useState(false);
 const { theme } = useTheme();

 useEffect(() => {
 const fetch = async () => {
 setLoading(true);

 const [leadsRes, projectsRes, cashRes] = await Promise.all([
 supabase.from('leads').select('status, created_at'),
 supabase.from('projects').select('id, status, revenue, created_at'),
 supabase.from('project_cash_received').select('project_id, amount, received_date, created_at'),
 ]);

 const leads = leadsRes.data || [];
 const projects = projectsRes.data || [];
 const cashRows = (cashRes.data || []) as CashReceivedRow[];

 const projectValue = projects.reduce(
 (sum: number, project: { revenue: number }) => sum + (project.revenue || 0),
 0
 );

 const cashReceived = cashRows.reduce(
 (sum, cash) => sum + getCashAmount(cash),
 0
 );

 const projectsWithCash = new Set(
 cashRows
 .map(cash => cash.project_id)
 .filter((projectId): projectId is string => Boolean(projectId))
 );

 const completedProjectValueWithoutCash = projects
 .filter((project: { id: string; status: string; revenue: number }) => {
 const status = String(project.status || '').toLowerCase();

 return (
 (status === 'completed' || status === 'complete') &&
 !projectsWithCash.has(project.id)
 );
 })
 .reduce((sum: number, project: { revenue: number }) => sum + (project.revenue || 0), 0);

 const recognizedRevenue = cashReceived + completedProjectValueWithoutCash;

 setKpi({
 totalLeads: leads.length,
 convertedLeads: leads.filter((lead: { status: string }) => lead.status === 'Converted').length,
 activeProjects: projects.filter((project: { status: string }) => project.status === 'Active').length,
 projectValue,
 cashReceived,
 recognizedRevenue,
 });

 const months: MonthlyRevenue[] = [];

 for (let index = 5; index >= 0; index--) {
 const date = new Date();
 date.setMonth(date.getMonth() - index);

 const monthStr = date.toLocaleString('default', {
 month: 'short',
 year: '2-digit',
 });

 const monthCashRows = cashRows.filter(cash => {
 const cashDateValue = getCashDate(cash);

 if (!cashDateValue) return false;

 const cashDate = new Date(cashDateValue);

 return (
 cashDate.getMonth() === date.getMonth() &&
 cashDate.getFullYear() === date.getFullYear()
 );
 });

 months.push({
 month: monthStr,
 revenue: monthCashRows.reduce((sum, cash) => sum + getCashAmount(cash), 0),
 });
 }

 setMonthlyRevenue(months);

 const statuses = ['Open', 'Qualified', 'Converted', 'Rejected', 'Ghosted'];
 const colors = ['#3B82F6', '#6B7280', '#10B981', '#EF4444', '#F59E0B'];

 setLeadFunnel(
 statuses.map((status, index) => ({
 name: status,
 value: leads.filter((lead: { status: string }) => lead.status === status).length,
 fill: colors[index],
 }))
 );

 setLoading(false);
 };

 fetch();
 }, []);

 const conversionRate = getConversionRate(kpi);
 const chartStroke = theme === 'dark' ? '#A8A8A8' : '#2F2F2F';
 const chartFill = theme === 'dark' ? '#F5F5F5' : '#2F2F2F';
 const textColor = theme === 'dark' ? '#D7D7D7' : '#4B4B4B';
 const gridColor = theme === 'dark' ? '#2F2F2F' : '#E4E4E4';
 const latestMonthRevenue = monthlyRevenue[monthlyRevenue.length - 1]?.revenue || 0;

 const adminSignals = useMemo(
 () => [
 {
 label: 'Converted Leads',
 value: kpi.convertedLeads,
 helper: `${conversionRate}% conversion rate`,
 icon: TrendingUp,
 tone: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
 route: '/admin/leads',
 },
 {
 label: 'Active Projects',
 value: kpi.activeProjects,
 helper: 'Running',
 icon: Settings,
 tone: 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300',
 route: '/admin/projects',
 },
 {
 label: 'Total Leads',
 value: kpi.totalLeads,
 helper: 'Pipeline',
 icon: ArrowRight,
 tone: 'border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300',
 route: '/admin/leads',
 },
 ],
 [conversionRate, kpi.activeProjects, kpi.convertedLeads, kpi.totalLeads]
 );

 const adminInsights = useMemo(() => {
 const insights: { message: string; action: string; route: string }[] = [];

 if (conversionRate < 25) {
 insights.push({
 message: 'Conversion needs attention. Review qualified leads and follow-ups.',
 action: 'Review Leads',
 route: '/admin/leads',
 });
 } else {
 insights.push({
 message: 'Conversion is moving well. Keep lead response time tight.',
 action: 'Open Leads',
 route: '/admin/leads',
 });
 }

 if (kpi.cashReceived < kpi.projectValue && kpi.projectValue > 0) {
 insights.push({
 message: 'Project value is ahead of cash received. Watch payment follow-ups.',
 action: 'Open Financials',
 route: '/admin/financials',
 });
 }

 if (kpi.activeProjects > 0) {
 insights.push({
 message: `${kpi.activeProjects} active project${kpi.activeProjects !== 1 ? 's' : ''} currently need operational tracking.`,
 action: 'View Projects',
 route: '/admin/projects',
 });
 } else {
 insights.push({
 message: 'No active projects are currently marked in the workspace.',
 action: 'View Projects',
 route: '/admin/projects',
 });
 }

 return insights.slice(0, 3);
 }, [conversionRate, kpi.activeProjects, kpi.cashReceived, kpi.projectValue]);

 const commandActions = useMemo<AdminCommandAction[]>(() => {
 const departmentTokens = userDepartments.map(department =>
 `${department.code} ${department.name}`.toLowerCase()
 );

 const hasDepartmentMatch = (...tokens: string[]) => {
 if (isAdmin()) return true;

 return departmentTokens.some(department =>
 tokens.some(token => department.includes(token.toLowerCase()))
 );
 };

 const actions: AdminCommandAction[] = [];

 const addAction = (action: AdminCommandAction) => {
 if (!actions.some(existing => existing.label === action.label)) {
 actions.push(action);
 }
 };

 const canCreateLeads = hasDepartmentMatch('MS', 'marketing', 'sales');
 const canCreateProjects = hasDepartmentMatch('operations', 'execution', 'site', 'project');
 const canManageProcurement = hasDepartmentMatch('procurement', 'purchase', 'vendor', 'item');

 if (canCreateLeads) {
 addAction({
 label: 'Create Lead',
 helper: 'Add a new enquiry',
 route: '/admin/leads?action=create',
 icon: Plus,
 });
 }

 if (canCreateProjects) {
 addAction({
 label: 'Create Project',
 helper: 'Start a new project record',
 route: '/admin/projects?action=create',
 icon: BriefcaseBusiness,
 });
 }

 addAction({
 label: 'Add Task',
 helper: 'Assign a new task',
 route: '/admin/tasks?action=create',
 icon: CheckSquare,
 });

 if (canManageProcurement) {
 addAction({
 label: 'Add Item',
 helper: 'Create item master data',
 route: '/admin/items?action=create',
 icon: Package,
 });

 addAction({
 label: 'Add Vendor',
 helper: 'Create vendor record',
 route: '/admin/vendors?action=create',
 icon: Store,
 });
 }

 if (isAdmin()) {
 addAction({
 label: 'Add Announcement',
 helper: 'Publish an update',
 route: '/admin/announcements?action=create',
 icon: Bell,
 });
 }

 return actions;
 }, [isAdmin, userDepartments]);

 useEffect(() => {
 if (!flippedCard) return;

 const timeout = window.setTimeout(() => {
 setFlippedCard(null);
 }, 5000);

 return () => window.clearTimeout(timeout);
 }, [flippedCard]);

 return (
 <div className="mx-auto w-full max-w-7xl px-3 py-6 pb-32 sm:px-6 lg:px-8 lg:pb-10">
 <div className="mb-5 border-b border-border pb-5 sm:mb-8 sm:pb-8">
 <div className="mb-3 flex items-center justify-between gap-3">
 <p className="text-xs font-semibold uppercase tracking-[0.32em] text-muted-foreground">
 Admin Console
 </p>

 <div className="inline-flex max-w-[10.5rem] items-center gap-1.5 truncate rounded-full border border-border bg-card px-2.5 py-1 text-[10px] font-medium text-muted-foreground sm:max-w-none sm:gap-2 sm:px-4 sm:py-2 sm:text-xs">
 <span className="relative flex h-1.5 w-1.5 shrink-0 sm:h-2 sm:w-2">
 <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
 <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500 sm:h-2 sm:w-2" />
 </span>
 <span className="truncate">Updated live</span>
 </div>
 </div>

 <div>
 <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
 Dashboard
 </h1>

 <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
 A focused view of leads, project movement, revenue, and operational health.
 </p>
 </div>
 </div>

 <motion.div
 variants={{
 hidden: {},
 visible: {
 transition: {
 staggerChildren: 0.055,
 delayChildren: 0.04,
 },
 },
 }}
 initial="hidden"
 animate="visible"
 className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-12"
 >
 <FlipCommandCard
 cardKey="financials"
 flippedCard={flippedCard}
 setFlippedCard={setFlippedCard}
 title="Financials"
 eyebrow="Command"
 routeLabel="Financials"
 onOpen={() => navigate('/admin/financials')}
 className="hidden min-h-[18rem] lg:col-span-5 lg:block"
 >
 <div className="flex items-start justify-between gap-4">
 <div>
 <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground sm:text-xs sm:tracking-[0.22em]">
 Recognized Revenue
 </p>

 <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:mt-4 sm:text-4xl">
 {loading ? (
 '...'
 ) : (
 <AnimatedMetric
 value={kpi.recognizedRevenue}
 formatter={value => formatINR(Math.round(value))}
 />
 )}
 </h2>
 </div>

 <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-muted text-foreground sm:h-11 sm:w-11 sm:rounded-2xl">
 <CircleDollarSign size={20} />
 </div>
 </div>

 <div className="mt-4 hidden gap-2 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3">
 <div className="rounded-2xl border border-border bg-background p-3 sm:p-4">
 <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
 Cash This Month
 </p>

 <p className="mt-2 text-xl font-semibold text-foreground">
 {loading ? (
 '...'
 ) : (
 <AnimatedMetric
 value={latestMonthRevenue}
 formatter={value => formatINR(Math.round(value))}
 />
 )}
 </p>
 </div>

 <div className="rounded-2xl border border-border bg-background p-3 sm:p-4">
 <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
 Project Value
 </p>

 <p className="mt-2 text-xl font-semibold text-foreground">
 {loading ? (
 '...'
 ) : (
 <AnimatedMetric
 value={kpi.projectValue}
 formatter={value => formatINR(Math.round(value))}
 />
 )}
 </p>
 </div>
 </div>
 </FlipCommandCard>

 <div className="order-2 col-span-2 lg:order-none grid grid-cols-2 gap-3 sm:gap-4 lg:col-span-7 lg:grid-cols-3">
 {adminSignals.map(signal => {
 const Icon = signal.icon;

 return (
 <FlipCommandCard
 key={signal.label}
 cardKey={signal.label}
 flippedCard={flippedCard}
 setFlippedCard={setFlippedCard}
 title={signal.label}
 eyebrow="Command"
 routeLabel={signal.label === 'Active Projects' ? 'Projects' : 'Leads'}
 onOpen={() => navigate(signal.route)}
 className="min-h-[17rem]"
 >
 <div
 className={`flex h-10 w-10 items-center justify-center rounded-2xl border ${signal.tone}`}
 >
 <Icon size={18} />
 </div>

 <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
 {signal.label}
 </p>

 <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
 {loading ? (
 '...'
 ) : (
 <AnimatedMetric
 value={signal.value}
 formatter={value => Math.round(value).toString()}
 />
 )}
 </p>

 <p className="mt-2 text-xs text-muted-foreground">
 {signal.helper}
 </p>
 </FlipCommandCard>
 );
 })}
 </div>

 <BentoCard className="order-1 col-span-2 lg:order-none rounded-3xl border border-border bg-card p-4 sm:p-6 lg:col-span-8">
 <div className="mb-4 flex items-start justify-between gap-3 sm:mb-5 sm:gap-4">
 <div>
 <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground sm:text-xs sm:tracking-[0.22em]">
 Cash Movement
 </p>

 <h2 className="mt-2 text-xl font-semibold text-foreground">
 Cash Received Trend
 </h2>
 </div>

 <button
 type="button"
 onClick={() => setShowRevenueDrawer(true)}
 className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
 aria-label="Expand revenue trend"
 >
 <Maximize2 className="h-4 w-4" />
 </button>
 </div>

 <ResponsiveContainer width="100%" height={180}>
 <AreaChart data={monthlyRevenue} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
 <defs>
 <linearGradient id="adminRevenueTrend" x1="0" y1="0" x2="0" y2="1">
 <stop offset="5%" stopColor={chartFill} stopOpacity={0.28} />
 <stop offset="95%" stopColor={chartFill} stopOpacity={0.02} />
 </linearGradient>
 </defs>

 <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />

 <XAxis
 dataKey="month"
 tick={{ fill: textColor, fontSize: 11 }}
 axisLine={false}
 tickLine={false}
 />

 <YAxis
 tick={{ fill: textColor, fontSize: 11 }}
 axisLine={false}
 tickLine={false}
 tickFormatter={value => `${(value / 1000).toFixed(0)}k`}
 />

 <Tooltip
 formatter={(value: unknown) => [formatINR(value as number), 'Cash Received']}
 contentStyle={{
 background: theme === 'dark' ? '#212225' : '#F5F5F5',
 border: '1px solid #D8D8DB',
 borderRadius: '14px',
 }}
 />

 <Area
 type="monotone"
 dataKey="revenue"
 stroke={chartStroke}
 strokeWidth={2.5}
 fill="url(#adminRevenueTrend)"
 activeDot={{ r: 5 }}
 />
 </AreaChart>
 </ResponsiveContainer>
 </BentoCard>

 <BentoCard className="order-3 col-span-2 lg:order-none rounded-3xl border border-border bg-card p-4 sm:p-6 lg:col-span-4">
 <div className="mb-4 flex items-start justify-between gap-3 sm:mb-5 sm:gap-4">
 <div>
 <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground sm:text-xs sm:tracking-[0.22em]">
 Sales
 </p>

 <h2 className="mt-2 text-xl font-semibold text-foreground">
 Lead Funnel
 </h2>
 </div>

 <ClipboardList className="h-4 w-4 text-muted-foreground" />
 </div>

 {loading ? (
 <div className="flex h-36 items-center justify-center rounded-2xl border border-dashed border-border bg-background sm:h-52">
 <span className="text-sm text-muted-foreground">Loading...</span>
 </div>
 ) : (
 <div className="flex flex-col gap-3">
 {leadFunnel.map(item => (
 <div key={item.name}>
 <div className="mb-1.5 flex items-center justify-between gap-3">
 <span className="text-xs font-medium text-muted-foreground">
 {item.name}
 </span>

 <span className="text-xs font-semibold text-foreground">
 {item.value}
 </span>
 </div>

 <div className="h-2.5 overflow-hidden rounded-full bg-muted">
 <div
 className="h-full rounded-full transition-all"
 style={{
 width: `${Math.max(
 (item.value / Math.max(kpi.totalLeads, 1)) * 100,
 item.value > 0 ? 8 : 0
 )}%`,
 background: item.fill,
 }}
 />
 </div>
 </div>
 ))}
 </div>
 )}
 </BentoCard>

 <BentoCard className="order-7 col-span-2 lg:order-none rounded-3xl border border-border bg-card p-4 sm:p-6 lg:col-span-4">
 <div className="mb-4 flex items-start justify-between gap-3 sm:mb-5 sm:gap-4">
 <div>
 <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground sm:text-xs sm:tracking-[0.22em]">
 Insights
 </p>

 <h2 className="mt-2 text-xl font-semibold text-foreground">
 Admin Signals
 </h2>
 </div>

 <Lightbulb className="h-4 w-4 text-muted-foreground" />
 </div>

 <div className="grid gap-2">
 {adminInsights.map(insight => (
 <div
 key={insight.message}
 className="rounded-2xl border border-border bg-background px-4 py-3"
 >
 <p className="text-sm text-muted-foreground">
 {insight.message}
 </p>

 <button
 type="button"
 onClick={() => navigate(insight.route)}
 className="mt-3 inline-flex h-8 items-center gap-2 rounded-full border border-border bg-card px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted"
 >
 {insight.action}
 <ArrowRight size={13} />
 </button>
 </div>
 ))}
 </div>
 </BentoCard>

 <BentoCard className="order-4 col-span-1 lg:order-none min-h-[10rem] rounded-3xl border border-border bg-card p-4 sm:p-6 lg:col-span-4">
 <div className="flex items-start gap-3 sm:gap-4">
 <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-muted text-foreground sm:h-11 sm:w-11 sm:rounded-2xl">
 <BriefcaseBusiness size={20} />
 </div>

 <div>
 <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground sm:text-xs sm:tracking-[0.22em]">
 Operations
 </p>

 <h2 className="mt-2 text-lg font-semibold text-foreground">
 Project Load
 </h2>

 <p className="mt-2 line-clamp-3 text-xs text-muted-foreground sm:text-sm">
 {loading
 ? 'Loading project load...'
 : `${kpi.activeProjects} active project${kpi.activeProjects !== 1 ? 's' : ''} currently need tracking.`}
 </p>
 </div>
 </div>
 </BentoCard>

 <BentoCard className="order-5 col-span-1 lg:order-none min-h-[10rem] rounded-3xl border border-border bg-card p-4 sm:p-6 lg:col-span-4">
 <div className="flex items-start gap-3 sm:gap-4">
 <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300 sm:h-11 sm:w-11 sm:rounded-2xl">
 <ArrowRight size={20} />
 </div>

 <div>
 <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground sm:text-xs sm:tracking-[0.22em]">
 Pipeline
 </p>

 <h2 className="mt-2 text-lg font-semibold text-foreground">
 Lead Volume
 </h2>

 <p className="mt-2 line-clamp-3 text-xs text-muted-foreground sm:text-sm">
 {loading
 ? 'Loading lead volume...'
 : `${kpi.totalLeads} total lead${kpi.totalLeads !== 1 ? 's' : ''} recorded in the CRM.`}
 </p>
 </div>
 </div>
 </BentoCard>

 <BentoCard className="order-6 col-span-1 lg:order-none min-h-[10rem] rounded-3xl border border-border bg-card p-4 sm:p-6 lg:col-span-4">
 <div className="flex items-start gap-3 sm:gap-4">
 <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 sm:h-11 sm:w-11 sm:rounded-2xl">
 <TrendingUp size={20} />
 </div>

 <div>
 <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground sm:text-xs sm:tracking-[0.22em]">
 Conversion
 </p>

 <h2 className="mt-2 text-lg font-semibold text-foreground">
 Sales Health
 </h2>

 <p className="mt-2 line-clamp-3 text-xs text-muted-foreground sm:text-sm">
 {loading
 ? 'Loading conversion health...'
 : conversionRate >= 25
 ? 'Healthy conversion trend.'
 : 'Conversion needs attention. Review qualified leads and follow-ups.'}
 </p>
 </div>
 </div>
 </BentoCard>
 </motion.div>

 <FloatingCommandDock
 actions={commandActions}
 onNavigate={route => navigate(route)}
 />

 {showRevenueDrawer && (
 <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
 <motion.div
 initial={{ opacity: 0, y: 16, scale: 0.98 }}
 animate={{ opacity: 1, y: 0, scale: 1 }}
 exit={{ opacity: 0, y: 12, scale: 0.98 }}
 transition={{ duration: 0.2, ease: 'easeOut' }}
 className="w-full max-w-5xl overflow-hidden rounded-3xl border border-border bg-card shadow-2xl"
 >
 <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4 sm:px-6">
 <div>
 <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground sm:text-xs sm:tracking-[0.22em]">
 Cash Movement
 </p>

 <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
 Cash Received Trend
 </h2>

 <p className="mt-1 text-sm text-muted-foreground">
 Month-wise cash received based on finance entries.
 </p>
 </div>

 <button
 type="button"
 onClick={() => setShowRevenueDrawer(false)}
 className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
 aria-label="Close revenue trend drawer"
 >
 <X size={18} />
 </button>
 </div>

 <div className="px-5 py-5 sm:px-6">
 <div className="mb-5 grid gap-3 sm:grid-cols-3">
 <div className="rounded-2xl border border-border bg-background p-3 sm:p-4">
 <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
 Recognized Revenue
 </p>

 <p className="mt-2 text-xl font-semibold text-foreground">
 {formatINR(kpi.recognizedRevenue)}
 </p>
 </div>

 <div className="rounded-2xl border border-border bg-background p-3 sm:p-4">
 <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
 Cash Received
 </p>

 <p className="mt-2 text-xl font-semibold text-foreground">
 {formatINR(kpi.cashReceived)}
 </p>
 </div>

 <div className="rounded-2xl border border-border bg-background p-3 sm:p-4">
 <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
 Project Value
 </p>

 <p className="mt-2 text-xl font-semibold text-foreground">
 {formatINR(kpi.projectValue)}
 </p>
 </div>
 </div>

 <ResponsiveContainer width="100%" height={360}>
 <AreaChart data={monthlyRevenue} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
 <defs>
 <linearGradient id="adminRevenueTrendDrawer" x1="0" y1="0" x2="0" y2="1">
 <stop offset="5%" stopColor={chartFill} stopOpacity={0.3} />
 <stop offset="95%" stopColor={chartFill} stopOpacity={0.02} />
 </linearGradient>
 </defs>

 <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />

 <XAxis
 dataKey="month"
 tick={{ fill: textColor, fontSize: 12 }}
 axisLine={false}
 tickLine={false}
 />

 <YAxis
 tick={{ fill: textColor, fontSize: 12 }}
 axisLine={false}
 tickLine={false}
 tickFormatter={value => `${(value / 1000).toFixed(0)}k`}
 />

 <Tooltip
 formatter={(value: unknown) => [formatINR(value as number), 'Cash Received']}
 contentStyle={{
 background: theme === 'dark' ? '#212225' : '#F5F5F5',
 border: '1px solid #D8D8DB',
 borderRadius: '14px',
 }}
 />

 <Area
 type="monotone"
 dataKey="revenue"
 stroke={chartStroke}
 strokeWidth={2.8}
 fill="url(#adminRevenueTrendDrawer)"
 activeDot={{ r: 5 }}
 />
 </AreaChart>
 </ResponsiveContainer>
 </div>
 </motion.div>
 </div>
 )}
 </div>
 );
}
