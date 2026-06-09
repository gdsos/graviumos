import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Database,
  FileText,
  Loader2,
  Lock,
  RefreshCcw,
  Search,
  ShieldCheck,
} from 'lucide-react';

import { useAuth } from '@/contexts/AuthContext';
import { supabase, type Project, formatINR } from '@/lib/supabase';
import { syncProjectFinanceAccountFromApprovedEstimate } from '@/lib/projectFinance';

type FinanceTab = 'overview' | 'project-accounts';

type ApprovedEstimateRow = {
  id: string;
  project_id: string | null;
  project_name: string | null;
  client_name: string | null;
  status: string | null;
  version: number | string | null;
  grand_total: number | string | null;
  updated_at: string | null;
};

type ProjectFinanceAccountRow = {
  id: string;
  project_id: string;
  source_estimate_id: string | null;
  source_estimate_version: number | string | null;
  revenue_amount: number | string | null;
  estimated_cogs_amount: number | string | null;
  estimated_margin_amount: number | string | null;
  service_charge_amount: number | string | null;
  misc_charge_amount: number | string | null;
  gst_amount: number | string | null;
  last_synced_at: string | null;
  status: string | null;
};

type SyncNotice = {
  state: 'success' | 'error' | 'info';
  heading: string;
  description: string;
};

function toNumber(value: unknown, fallback = 0) {
  const numberValue =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value)
        : Number.NaN;

  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '?';

  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getProjectClientName(project: Project) {
  const record = project as Project & {
    client_name?: string | null;
    clientName?: string | null;
    client?: string | null;
  };

  return record.client_name ?? record.clientName ?? record.client ?? 'Client not assigned';
}

function getProjectStatus(project: Project) {
  const record = project as Project & { status?: string | null };

  return record.status ?? 'Active';
}

function getProjectLabel(project: Project) {
  const clientName = getProjectClientName(project);

  return clientName && clientName !== 'Client not assigned'
    ? `${project.name} - ${clientName}`
    : project.name;
}

function getEstimateLabel(estimate: ApprovedEstimateRow | null) {
  if (!estimate) return 'No Approved Estimate';

  const version = toNumber(estimate.version, 1);
  const total = toNumber(estimate.grand_total, 0);

  return `Approved Estimate v${version} - ${formatINR(total)}`;
}

function MetricCard({
  label,
  value,
  helper,
  tone = 'default',
}: {
  label: string;
  value: string;
  helper: string;
  tone?: 'default' | 'success' | 'warning' | 'muted';
}) {
  const toneClass =
    tone === 'success'
      ? 'text-emerald-600 dark:text-emerald-400'
      : tone === 'warning'
        ? 'text-amber-600 dark:text-amber-300'
        : tone === 'muted'
          ? 'text-muted-foreground'
          : 'text-foreground';

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
        {label}
      </p>
      <p className={`mt-3 text-2xl font-semibold ${toneClass}`}>
        {value}
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        {helper}
      </p>
    </div>
  );
}

function StatusPill({
  children,
  tone = 'muted',
}: {
  children: React.ReactNode;
  tone?: 'success' | 'warning' | 'muted' | 'info';
}) {
  const toneClass =
    tone === 'success'
      ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300'
      : tone === 'warning'
        ? 'border-amber-400/30 bg-amber-400/10 text-amber-300'
        : tone === 'info'
          ? 'border-blue-400/30 bg-blue-400/10 text-blue-300'
          : 'border-border bg-muted/40 text-muted-foreground';

  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${toneClass}`}>
      {children}
    </span>
  );
}

function NoticeBlock({
  notice,
  onDismiss,
}: {
  notice: SyncNotice;
  onDismiss: () => void;
}) {
  const isSuccess = notice.state === 'success';
  const isError = notice.state === 'error';

  return (
    <div
      className={`rounded-2xl border p-4 ${
        isSuccess
          ? 'border-emerald-400/30 bg-emerald-400/10'
          : isError
            ? 'border-red-400/30 bg-red-400/10'
            : 'border-blue-400/30 bg-blue-400/10'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex gap-3">
          {isSuccess ? (
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-300" />
          ) : isError ? (
            <AlertCircle className="mt-0.5 h-5 w-5 text-red-300" />
          ) : (
            <Database className="mt-0.5 h-5 w-5 text-blue-300" />
          )}
          <div>
            <p className="text-sm font-semibold text-foreground">{notice.heading}</p>
            <p className="mt-1 text-sm text-muted-foreground">{notice.description}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition hover:bg-muted"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

export default function Financials() {
  const { isAdmin, isFinance } = useAuth();

  if (!isAdmin() && !isFinance()) {
    return (
      <div className="mx-auto max-w-7xl">
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-red-400/30 bg-red-400/10">
            <Lock className="h-8 w-8 text-red-300" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Access Restricted</h1>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              Finance is restricted to Finance department members and Administrators.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <FinancialsInner />;
}

function FinancialsInner() {
  const [activeTab, setActiveTab] = useState<FinanceTab>('project-accounts');
  const [projects, setProjects] = useState<Project[]>([]);
  const [financeAccounts, setFinanceAccounts] = useState<ProjectFinanceAccountRow[]>([]);
  const [approvedEstimates, setApprovedEstimates] = useState<ApprovedEstimateRow[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [isProjectPickerOpen, setIsProjectPickerOpen] = useState(false);
  const [projectSearch, setProjectSearch] = useState('');
  const projectPickerRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncingProjectId, setSyncingProjectId] = useState<string | null>(null);
  const [notice, setNotice] = useState<SyncNotice | null>(null);
  const [error, setError] = useState('');

  const fetchFinanceData = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setLoading(true);
    }
    setError('');

    const [projectsRes, accountsRes, estimatesRes] = await Promise.all([
      supabase.from('projects').select('*').order('created_at', { ascending: false }),
      supabase.from('project_finance_accounts').select('*').order('updated_at', { ascending: false }),
      supabase
        .from('cost_estimates')
        .select('id, project_id, project_name, client_name, status, version, grand_total, updated_at')
        .eq('status', 'approved')
        .order('updated_at', { ascending: false }),
    ]);

    if (projectsRes.error) {
      setError(projectsRes.error.message);
      setLoading(false);
      return;
    }

    if (accountsRes.error) {
      setError(accountsRes.error.message);
      setLoading(false);
      return;
    }

    if (estimatesRes.error) {
      setError(estimatesRes.error.message);
      setLoading(false);
      return;
    }

    const nextProjects = (projectsRes.data ?? []) as Project[];

    setProjects(nextProjects);
    setFinanceAccounts((accountsRes.data ?? []) as ProjectFinanceAccountRow[]);
    setApprovedEstimates((estimatesRes.data ?? []) as ApprovedEstimateRow[]);

    setSelectedProjectId(current => {
      if (current && nextProjects.some(project => project.id === current)) {
        return current;
      }

      return nextProjects[0]?.id ?? '';
    });

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchFinanceData();
  }, [fetchFinanceData]);

  useEffect(() => {
    const channel = supabase
      .channel('finance-workspace-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'project_finance_accounts' },
        () => {
          void fetchFinanceData({ silent: true });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cost_estimates' },
        () => {
          void fetchFinanceData({ silent: true });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'projects' },
        () => {
          void fetchFinanceData({ silent: true });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [fetchFinanceData]);

  useEffect(() => {
    if (!isProjectPickerOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;

      if (target && projectPickerRef.current?.contains(target)) return;

      setIsProjectPickerOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsProjectPickerOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isProjectPickerOpen]);

  const approvedEstimateByProjectId = useMemo(() => {
    const map = new Map<string, ApprovedEstimateRow>();

    approvedEstimates.forEach(estimate => {
      if (!estimate.project_id) return;
      if (!map.has(estimate.project_id)) {
        map.set(estimate.project_id, estimate);
      }
    });

    return map;
  }, [approvedEstimates]);

  const validFinanceAccounts = useMemo(() => {
    return financeAccounts.filter(account => {
      const approvedEstimate = approvedEstimateByProjectId.get(account.project_id);

      return Boolean(
        approvedEstimate &&
          account.source_estimate_id &&
          account.source_estimate_id === approvedEstimate.id
      );
    });
  }, [approvedEstimateByProjectId, financeAccounts]);

  const selectedProject =
    projects.find(project => project.id === selectedProjectId) ?? null;
  const selectedApprovedEstimate = selectedProject
    ? approvedEstimateByProjectId.get(selectedProject.id) ?? null
    : null;
  const selectedFinanceAccount = selectedProject
    ? validFinanceAccounts.find(account => account.project_id === selectedProject.id) ?? null
    : null;

  const filteredProjects = projects.filter(project =>
    getProjectLabel(project).toLowerCase().includes(projectSearch.trim().toLowerCase())
  );

  const totalSyncedRevenue = validFinanceAccounts.reduce(
    (sum, account) => sum + toNumber(account.revenue_amount),
    0
  );
  const totalSyncedCogs = validFinanceAccounts.reduce(
    (sum, account) => sum + toNumber(account.estimated_cogs_amount),
    0
  );
  const totalSyncedMargin = totalSyncedRevenue - totalSyncedCogs;
  const unsyncedApprovedEstimateCount = approvedEstimates.filter(
    estimate =>
      Boolean(estimate.project_id) &&
      !validFinanceAccounts.some(account => account.project_id === estimate.project_id)
  ).length;

  const selectedEstimateVersion =
    selectedFinanceAccount?.source_estimate_version ??
    selectedApprovedEstimate?.version ??
    null;
  const selectedRevenue = toNumber(selectedFinanceAccount?.revenue_amount);
  const selectedEstimatedCogs = toNumber(selectedFinanceAccount?.estimated_cogs_amount);
  const selectedMargin =
    toNumber(selectedFinanceAccount?.estimated_margin_amount) ||
    selectedRevenue - selectedEstimatedCogs;
  const selectedServiceCharge = toNumber(selectedFinanceAccount?.service_charge_amount);
  const selectedMiscCharge = toNumber(selectedFinanceAccount?.misc_charge_amount);
  const selectedGst = toNumber(selectedFinanceAccount?.gst_amount);

  const handleSyncFinanceAccount = async () => {
    if (!selectedProject) return;

    if (!selectedApprovedEstimate) {
      setNotice({
        state: 'error',
        heading: 'No Approved Estimate Found',
        description:
          'This project does not have an approved Cost Estimate anymore. Approve a Cost Estimate before creating the Finance Account.',
      });
      return;
    }

    setSyncingProjectId(selectedProject.id);
    setNotice(null);
    setError('');

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();

      if (userError) throw userError;

      const result = await syncProjectFinanceAccountFromApprovedEstimate({
        projectId: selectedProject.id,
        estimateId: selectedApprovedEstimate.id,
        userId: userData.user?.id ?? null,
      });

      setNotice({
        state: 'success',
        heading: 'Finance Account Synced',
        description: `${selectedProject.name} is now synced from approved estimate v${result.estimate.version}. Revenue ${formatINR(result.account.revenue_amount)} - Estimated COGS ${formatINR(result.account.estimated_cogs_amount)}.`,
      });

      await fetchFinanceData();
    } catch (syncError) {
      setNotice({
        state: 'error',
        heading: 'Finance Sync Failed',
        description:
          syncError instanceof Error
            ? syncError.message
            : 'Unable to sync Finance Account.',
      });
    } finally {
      setSyncingProjectId(null);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl">
        <div className="flex h-72 items-center justify-center gap-3 rounded-3xl border border-border bg-card">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading Finance workspace?</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
            Finance
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
            Project Finance Accounts
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Clean project-based finance workspace. Active values now come only from synced
            Finance Accounts created from approved Cost Estimates.
          </p>
        </div>

        <div className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-border bg-card px-4 text-sm font-semibold text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          Live Data
        </div>
      </header>

      {error && (
        <NoticeBlock
          notice={{
            state: 'error',
            heading: 'Failed To Load Finance',
            description: error,
          }}
          onDismiss={() => setError('')}
        />
      )}

      {notice && <NoticeBlock notice={notice} onDismiss={() => setNotice(null)} />}

      <div className="flex flex-wrap gap-2 border-b border-border pb-3">
        {[
          { id: 'overview', label: 'Overview' },
          { id: 'project-accounts', label: 'Project Accounts' },
        ].map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as FinanceTab)}
            className={`rounded-2xl px-5 py-2.5 text-sm font-semibold transition ${
              activeTab === tab.id
                ? 'bg-foreground text-background'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <section className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Synced Revenue"
              value={formatINR(totalSyncedRevenue)}
              helper="Only from valid Finance Accounts"
              tone={totalSyncedRevenue > 0 ? 'success' : 'muted'}
            />
            <MetricCard
              label="Estimated COGS"
              value={formatINR(totalSyncedCogs)}
              helper="From approved Cost Estimate sync"
            />
            <MetricCard
              label="Estimated Margin"
              value={formatINR(totalSyncedMargin)}
              helper="Revenue minus estimated COGS"
              tone={totalSyncedMargin > 0 ? 'success' : 'muted'}
            />
            <MetricCard
              label="Waiting To Sync"
              value={String(unsyncedApprovedEstimateCount)}
              helper="Approved estimates without Finance Account"
              tone={unsyncedApprovedEstimateCount > 0 ? 'warning' : 'muted'}
            />
          </div>

          <div className="rounded-3xl border border-border bg-card p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-background">
                <ShieldCheck className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  Clean Finance Source Active
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                  Legacy project revenue, old expenses, and old cash received entries are no
                  longer used as the visible Finance source on this page. They remain untouched
                  in the database, but the Finance workspace now starts from synced Finance
                  Account records.
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {activeTab === 'project-accounts' && (
        <section className="space-y-6">
          <div className="rounded-3xl border border-border bg-card p-5">
            <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)_auto] lg:items-center">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  Select Project
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {projects.length} project{projects.length === 1 ? '' : 's'} available
                </p>
              </div>

              <div ref={projectPickerRef} className="relative">
                <button
                  type="button"
                  onClick={() => setIsProjectPickerOpen(current => !current)}
                  className="flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl border border-border bg-background px-4 text-left text-sm font-semibold text-foreground transition hover:bg-muted/40"
                >
                  <span className="truncate">
                    {selectedProject ? getProjectLabel(selectedProject) : 'No Project Selected'}
                  </span>
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>

                {isProjectPickerOpen && (
                  <div className="absolute left-0 right-0 top-[calc(100%+10px)] z-[220] rounded-3xl border border-border bg-card p-3 shadow-2xl">
                    <div className="flex items-center gap-2 rounded-2xl border border-border bg-background px-3">
                      <Search className="h-4 w-4 text-muted-foreground" />
                      <input
                        value={projectSearch}
                        onChange={event => setProjectSearch(event.target.value)}
                        placeholder="Search project or client"
                        className="h-11 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                        autoFocus
                      />
                    </div>

                    <div className="mt-3 max-h-80 overflow-y-auto">
                      {filteredProjects.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                          No matching projects.
                        </div>
                      ) : (
                        filteredProjects.map(project => {
                          const approvedEstimate = approvedEstimateByProjectId.get(project.id);
                          const financeAccount = validFinanceAccounts.find(
                            account => account.project_id === project.id
                          );

                          return (
                            <button
                              key={project.id}
                              type="button"
                              onClick={() => {
                                setSelectedProjectId(project.id);
                                setProjectSearch('');
                                setIsProjectPickerOpen(false);
                              }}
                              className={`mb-2 flex w-full items-center justify-between gap-3 rounded-2xl border p-4 text-left transition ${
                                project.id === selectedProjectId
                                  ? 'border-foreground bg-muted text-foreground'
                                  : 'border-border bg-background text-foreground hover:bg-muted'
                              }`}
                            >
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold">
                                  {project.name}
                                </p>
                                <p className={`mt-1 truncate text-xs ${
                                  'text-muted-foreground'
                                }`}>
                                  {getProjectClientName(project)}
                                </p>
                              </div>
                              <div className="shrink-0">
                                {financeAccount ? (
                                  <StatusPill tone="success">Synced</StatusPill>
                                ) : approvedEstimate ? (
                                  <StatusPill tone="warning">Ready</StatusPill>
                                ) : (
                                  <StatusPill>No Estimate</StatusPill>
                                )}
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-start lg:justify-end">
                {selectedFinanceAccount ? (
                  <StatusPill tone="success">Synced</StatusPill>
                ) : selectedApprovedEstimate ? (
                  <StatusPill tone="warning">Ready To Sync</StatusPill>
                ) : (
                  <StatusPill>No Approved Estimate</StatusPill>
                )}
              </div>
            </div>
          </div>

          {selectedProject && (
            <div className="rounded-3xl border border-border bg-card p-6">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                    Project Account
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-foreground">
                    {selectedProject.name}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {getProjectClientName(selectedProject)} - {getProjectStatus(selectedProject)}
                  </p>
                  <p className="mt-4 text-sm text-muted-foreground">
                    Source: {getEstimateLabel(selectedApprovedEstimate)}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleSyncFinanceAccount}
                  disabled={!selectedApprovedEstimate || syncingProjectId === selectedProject.id}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-foreground px-5 text-sm font-semibold text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {syncingProjectId === selectedProject.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCcw className="h-4 w-4" />
                  )}
                  {selectedFinanceAccount ? 'Resync Finance Account' : 'Sync Finance Account'}
                </button>
              </div>

              {!selectedApprovedEstimate && (
                <div className="mt-6 rounded-2xl border border-dashed border-border bg-background p-6">
                  <div className="flex items-start gap-4">
                    <FileText className="mt-1 h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        No approved Cost Estimate found.
                      </p>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        Create and approve a project-linked Cost Estimate first. Finance will
                        stay empty for this project until that source exists.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {selectedApprovedEstimate && !selectedFinanceAccount && (
                <div className="mt-6 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-6">
                  <div className="flex items-start gap-4">
                    <Database className="mt-1 h-5 w-5 text-amber-300" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        Approved estimate is ready.
                      </p>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        Sync once to create the clean Finance Account. No old project revenue
                        will be used.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {selectedFinanceAccount && (
                <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <MetricCard
                    label="Revenue"
                    value={formatINR(selectedRevenue)}
                    helper="From synced Finance Account"
                    tone="success"
                  />
                  <MetricCard
                    label="Estimated COGS"
                    value={formatINR(selectedEstimatedCogs)}
                    helper="From approved estimate line items"
                  />
                  <MetricCard
                    label="Estimated Margin"
                    value={formatINR(selectedMargin)}
                    helper="Revenue minus estimated COGS"
                    tone={selectedMargin > 0 ? 'success' : 'muted'}
                  />
                  <MetricCard
                    label="Last Synced"
                    value={formatDateTime(selectedFinanceAccount.last_synced_at)}
                    helper={selectedEstimateVersion ? `Estimate v${selectedEstimateVersion}` : 'Estimate version unavailable'}
                  />
                </div>
              )}

              {selectedFinanceAccount && (
                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <MetricCard
                    label="Service Charge"
                    value={formatINR(selectedServiceCharge)}
                    helper="Synced from estimate summary"
                  />
                  <MetricCard
                    label="Misc Charge"
                    value={formatINR(selectedMiscCharge)}
                    helper="Synced from estimate summary"
                  />
                  <MetricCard
                    label="GST"
                    value={formatINR(selectedGst)}
                    helper="Synced from estimate summary"
                  />
                </div>
              )}
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-3">
            {[
              {
                title: 'Cash Received',
                description: 'Next phase: record client payments against Finance payment gates.',
                icon: CircleDollarSign,
              },
              {
                title: 'COGS Entries',
                description: 'Next phase: add vendor selector, In-House default, and COGS rows.',
                icon: Database,
              },
              {
                title: 'Vendor Payments',
                description: 'Next phase: project vendor ledgers, advances, paid, and outstanding.',
                icon: FileText,
              },
            ].map(card => {
              const Icon = card.icon;

              return (
                <div key={card.title} className="rounded-3xl border border-dashed border-border bg-card p-6">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-background">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-foreground">
                    {card.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {card.description}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
