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
import { createNotification } from '@/lib/notifications';
import { DateInput } from '@/components/common/DateInput';

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

type ProjectFinancePaymentGateRow = {
  id: string;
  finance_account_id: string;
  project_id: string;
  timeline_id: string | null;
  timeline_gate_id: string | null;
  gate_order: number | string;
  title: string;
  trigger_label: string;
  required_amount: number | string | null;
  collected_amount: number | string | null;
  carry_forward_in_amount: number | string | null;
  carry_forward_out_amount: number | string | null;
  outstanding_amount: number | string | null;
  status: 'pending' | 'partial' | 'paid' | 'overpaid' | 'cancelled' | string;
  marked_paid_at: string | null;
  source_gate_snapshot: Record<string, unknown>;
};

type ProjectTimelineGateSourceRow = {
  id: string;
  project_id: string;
  source_estimate_id: string | null;
  source_estimate_version: number | string | null;
  has_timeline: boolean | null;
  payment_gates: unknown;
  updated_at: string | null;
};

type TimelineGateRecord = Record<string, unknown> & {
  id?: string;
};

function getTimelineGateRecords(value: unknown): TimelineGateRecord[] {
  if (!Array.isArray(value)) return [];

  return value.filter(
    (gate): gate is TimelineGateRecord =>
      typeof gate === 'object' && gate !== null
  );
}

function getTimelineGateIdentity(gate: TimelineGateRecord, index: number) {
  return typeof gate.id === 'string' && gate.id.trim()
    ? gate.id
    : `timeline-gate-${index + 1}`;
}



type SyncNotice = {
  state: 'success' | 'error' | 'info';
  heading: string;
  description: string;
};

type CashReceiptDraft = {
  paymentGateId: string;
  amount: string;
  receiptDate: string;
  receivedFrom: string;
  paymentMode: string;
  referenceNumber: string;
  description: string;
  gstTreatment: 'GST' | 'NO_GST';
};

function getTodayDateString() {
  return new Date().toISOString().slice(0, 10);
}

function getFinanceGateStatusFromCollection(requiredAmount: number, collectedAmount: number) {
  if (collectedAmount <= 0) return 'pending';
  if (collectedAmount < requiredAmount) return 'partial';
  if (collectedAmount === requiredAmount) return 'paid';

  return 'overpaid';
}

function isFinanceGateComplete(gate: ProjectFinancePaymentGateRow) {
  const outstandingAmount = toNumber(gate.outstanding_amount);
  const collectedAmount = toNumber(gate.collected_amount);
  const requiredAmount = toNumber(gate.required_amount);

  return (
    gate.status === 'paid' ||
    gate.status === 'overpaid' ||
    (requiredAmount > 0 && collectedAmount >= requiredAmount) ||
    outstandingAmount <= 0
  );
}

function getFinanceGateWorkflowState(
  gate: ProjectFinancePaymentGateRow,
  gateIndex: number,
  paymentGates: ProjectFinancePaymentGateRow[]
) {
  if (isFinanceGateComplete(gate)) {
    return {
      state: 'completed' as const,
      label: 'Completed',
      helper: 'This payment gate is fully collected.',
    };
  }

  const previousGate = paymentGates
    .slice(0, gateIndex)
    .find(previous => !isFinanceGateComplete(previous));

  if (previousGate) {
    return {
      state: 'locked' as const,
      label: `Locked`,
      helper: `Complete Gate ${previousGate.gate_order} before recording this payment.`,
    };
  }

  return {
    state: 'open' as const,
    label: 'Record Cash',
    helper: 'Ready to record client cash for this gate.',
  };
}

function getSyncedFinanceGateCount(
  paymentGates: unknown,
  fallbackTimelineGateIds: string[]
) {
  return Array.isArray(paymentGates)
    ? paymentGates.length
    : fallbackTimelineGateIds.length;
}


type NotificationDepartmentRow = {
  id: string;
  code: string | null;
  name: string | null;
};

type NotificationProfileRow = {
  id: string;
  department_ids: string[] | null;
};

async function notifyDesignExecutionPaymentCollected({
  project,
  gate,
  amount,
}: {
  project: Project;
  gate: ProjectFinancePaymentGateRow;
  amount: number;
}) {
  try {
    const { data: departments, error: departmentsError } = await supabase
      .from('departments')
      .select('id, code, name');

    if (departmentsError) throw departmentsError;

    const targetDepartmentIds = ((departments ?? []) as NotificationDepartmentRow[])
      .filter(department => {
        const code = (department.code ?? '').toUpperCase();
        const name = (department.name ?? '').toLowerCase();

        return (
          ['DE', 'DS', 'EX'].includes(code) ||
          name.includes('design') ||
          name.includes('execution')
        );
      })
      .map(department => department.id);

    if (targetDepartmentIds.length === 0) {
      console.warn('No Design/Execution departments found for payment notification.');
      return;
    }

    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, department_ids');

    if (profilesError) throw profilesError;

    const recipientIds = Array.from(
      new Set(
        ((profiles ?? []) as NotificationProfileRow[])
          .filter(profile =>
            (profile.department_ids ?? []).some(departmentId =>
              targetDepartmentIds.includes(departmentId)
            )
          )
          .map(profile => profile.id)
      )
    );

    if (recipientIds.length === 0) {
      console.warn('No Design/Execution users found for payment notification.');
      return;
    }

    const title = `Payment received: ${gate.title}`;
    const message = `${formatINR(amount)} was recorded for ${project.name}. Timeline actions linked to this gate can continue.`;
    const link = `/portal/timeline?project=${project.id}`;

    await Promise.allSettled(
      recipientIds.map(userId =>
        createNotification(userId, title, message, 'project', link)
      )
    );
  } catch (notificationError) {
    console.error('Failed to notify Design/Execution team about payment collection', notificationError);
  }
}


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
  const [financePaymentGates, setFinancePaymentGates] = useState<ProjectFinancePaymentGateRow[]>([]);
  const [timelineGateSources, setTimelineGateSources] = useState<ProjectTimelineGateSourceRow[]>([]);
  const [approvedEstimates, setApprovedEstimates] = useState<ApprovedEstimateRow[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [isProjectPickerOpen, setIsProjectPickerOpen] = useState(false);
  const [projectSearch, setProjectSearch] = useState('');
  const projectPickerRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncingProjectId, setSyncingProjectId] = useState<string | null>(null);
  const [autoSyncAttemptKey, setAutoSyncAttemptKey] = useState<string | null>(null);
  const [cashReceiptDraft, setCashReceiptDraft] = useState<CashReceiptDraft | null>(null);
  const [isCashPaymentModePickerOpen, setIsCashPaymentModePickerOpen] = useState(false);
  const [isCashGstPickerOpen, setIsCashGstPickerOpen] = useState(false);
  const cashPaymentModePickerRef = useRef<HTMLDivElement | null>(null);
  const cashGstPickerRef = useRef<HTMLDivElement | null>(null);
  const [savingCashReceipt, setSavingCashReceipt] = useState(false);
  const [notice, setNotice] = useState<SyncNotice | null>(null);
  const [error, setError] = useState('');

  const fetchFinanceData = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setLoading(true);
    }
    setError('');

    const [projectsRes, accountsRes, gatesRes, timelinesRes, estimatesRes] = await Promise.all([
      supabase.from('projects').select('*').order('created_at', { ascending: false }),
      supabase.from('project_finance_accounts').select('*').order('updated_at', { ascending: false }),
      supabase.from('project_finance_payment_gates').select('*').order('gate_order', { ascending: true }),
      supabase
        .from('project_timelines')
        .select('id, project_id, source_estimate_id, source_estimate_version, has_timeline, payment_gates, updated_at')
        .order('updated_at', { ascending: false }),
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

    if (gatesRes.error) {
      setError(gatesRes.error.message);
      setLoading(false);
      return;
    }

    if (timelinesRes.error) {
      setError(timelinesRes.error.message);
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
    setFinancePaymentGates((gatesRes.data ?? []) as ProjectFinancePaymentGateRow[]);
    setTimelineGateSources((timelinesRes.data ?? []) as ProjectTimelineGateSourceRow[]);
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
    if (!isCashPaymentModePickerOpen && !isCashGstPickerOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;

      if (!(target instanceof Node)) return;

      if (
        isCashPaymentModePickerOpen &&
        cashPaymentModePickerRef.current &&
        !cashPaymentModePickerRef.current.contains(target)
      ) {
        setIsCashPaymentModePickerOpen(false);
      }

      if (
        isCashGstPickerOpen &&
        cashGstPickerRef.current &&
        !cashGstPickerRef.current.contains(target)
      ) {
        setIsCashGstPickerOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [isCashGstPickerOpen, isCashPaymentModePickerOpen]);

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
        { event: '*', schema: 'public', table: 'project_finance_payment_gates' },
        () => {
          void fetchFinanceData({ silent: true });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'project_timelines' },
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
  const selectedPaymentGates = selectedFinanceAccount
    ? financePaymentGates
        .filter(gate => gate.finance_account_id === selectedFinanceAccount.id)
        .sort((a, b) => toNumber(a.gate_order) - toNumber(b.gate_order))
    : [];
  const selectedTimelineGateSource = selectedProject
    ? timelineGateSources.find(
        timeline =>
          timeline.project_id === selectedProject.id &&
          timeline.has_timeline
      ) ?? null
    : null;
  const selectedTimelineGateRecords = getTimelineGateRecords(
    selectedTimelineGateSource?.payment_gates
  );
  const selectedTimelineGateIds = selectedTimelineGateRecords.map(getTimelineGateIdentity);
  const selectedFinanceTimelineGateIds = selectedPaymentGates
    .map(gate => gate.timeline_gate_id)
    .filter((gateId): gateId is string => Boolean(gateId));
  const hasMissingTimelineGatesInFinance =
    selectedTimelineGateIds.length > 0 &&
    selectedTimelineGateIds.some(
      gateId => !selectedFinanceTimelineGateIds.includes(gateId)
    );
  const hasTimelineGateSyncDrift = Boolean(
    selectedFinanceAccount &&
      selectedTimelineGateIds.length > 0 &&
      (selectedPaymentGates.length !== selectedTimelineGateIds.length ||
        hasMissingTimelineGatesInFinance)
  );
  const needsInitialFinanceSync = Boolean(
    selectedApprovedEstimate && !selectedFinanceAccount
  );
  const needsManualFinanceSync = needsInitialFinanceSync || hasTimelineGateSyncDrift;
  const isSyncingSelectedProject =
    Boolean(selectedProject) && syncingProjectId === selectedProject?.id;
  const syncActionLabel = selectedFinanceAccount
    ? 'Sync Timeline Gates'
    : 'Sync Finance Account';
  const selectedSyncStatus = !selectedApprovedEstimate
    ? { tone: 'muted' as const, label: 'No Approved Estimate' }
    : isSyncingSelectedProject
      ? { tone: 'info' as const, label: 'Syncing' }
      : needsInitialFinanceSync
        ? { tone: 'warning' as const, label: 'Ready To Sync' }
        : hasTimelineGateSyncDrift
          ? { tone: 'warning' as const, label: 'Timeline Gates Pending Sync' }
          : { tone: 'success' as const, label: 'Synced' };
  const autoSyncKey =
    selectedProject && selectedApprovedEstimate && selectedFinanceAccount
      ? [
          selectedProject.id,
          selectedApprovedEstimate.id,
          selectedFinanceAccount.id,
          selectedTimelineGateIds.join('|'),
          selectedFinanceTimelineGateIds.join('|'),
        ].join('::')
      : '';

  useEffect(() => {
    if (!selectedProject || !selectedApprovedEstimate || !selectedFinanceAccount) return;
    if (!hasTimelineGateSyncDrift) return;
    if (!autoSyncKey || autoSyncAttemptKey === autoSyncKey) return;
    if (syncingProjectId === selectedProject.id) return;

    const projectId = selectedProject.id;
    const approvedEstimateId = selectedApprovedEstimate.id;

    let isMounted = true;

    async function syncTimelineGatesSilently() {
      setAutoSyncAttemptKey(autoSyncKey);
      setSyncingProjectId(projectId);

      try {
        const { data: userData, error: userError } = await supabase.auth.getUser();

        if (userError) throw userError;

        await syncProjectFinanceAccountFromApprovedEstimate({
          projectId,
          estimateId: approvedEstimateId,
          userId: userData.user?.id ?? null,
        });

        if (isMounted) {
          await fetchFinanceData({ silent: true });
        }
      } catch (syncError) {
        console.error('Unable to auto-sync Finance gates from Timeline', syncError);
      } finally {
        setSyncingProjectId(current =>
          current === projectId ? null : current
        );
      }
    }

    void syncTimelineGatesSilently();

    return () => {
      isMounted = false;
    };
  }, [
    autoSyncAttemptKey,
    autoSyncKey,
    fetchFinanceData,
    hasTimelineGateSyncDrift,
    selectedApprovedEstimate,
    selectedFinanceAccount,
    selectedProject,
  ]);

  const handleOpenCashReceiptDraft = (
    gate: ProjectFinancePaymentGateRow,
    gateIndex: number
  ) => {
    if (!selectedProject) return;

    const workflowState = getFinanceGateWorkflowState(
      gate,
      gateIndex,
      selectedPaymentGates
    );

    if (workflowState.state !== 'open') {
      setNotice({
        state: workflowState.state === 'completed' ? 'success' : 'info',
        heading:
          workflowState.state === 'completed'
            ? 'Payment Gate Completed'
            : 'Previous Gate Required',
        description: workflowState.helper,
      });
      return;
    }

    const outstandingAmount = toNumber(gate.outstanding_amount);
    const requiredAmount = toNumber(gate.required_amount);
    const suggestedAmount = outstandingAmount > 0 ? outstandingAmount : requiredAmount;

    setIsCashPaymentModePickerOpen(false);
    setIsCashGstPickerOpen(false);

    setCashReceiptDraft({
      paymentGateId: gate.id,
      amount: suggestedAmount > 0 ? String(Math.round(suggestedAmount)) : '',
      receiptDate: getTodayDateString(),
      receivedFrom: getProjectClientName(selectedProject),
      paymentMode: 'Bank Transfer',
      referenceNumber: '',
      description: `${gate.title} collection`,
      gstTreatment: 'GST',
    });

    setNotice(null);
  };

  const handleSaveCashReceipt = async () => {
    if (!selectedProject || !selectedFinanceAccount || !cashReceiptDraft) return;

    const selectedGate = selectedPaymentGates.find(
      gate => gate.id === cashReceiptDraft.paymentGateId
    );

    if (!selectedGate) {
      setNotice({
        state: 'error',
        heading: 'Payment Gate Missing',
        description: 'Select a valid payment gate before recording cash received.',
      });
      return;
    }

    const receivedAmount = toNumber(cashReceiptDraft.amount);

    if (receivedAmount <= 0) {
      setNotice({
        state: 'error',
        heading: 'Invalid Receipt Amount',
        description: 'Enter a received amount greater than zero.',
      });
      return;
    }

    const wasGateAlreadyComplete = isFinanceGateComplete(selectedGate);
    const requiredAmount = toNumber(selectedGate.required_amount);
    const previousCollectedAmount = toNumber(selectedGate.collected_amount);
    const nextCollectedAmount = previousCollectedAmount + receivedAmount;
    const nextOutstandingAmount = Math.max(requiredAmount - nextCollectedAmount, 0);
    const overpaymentAmount = Math.max(nextCollectedAmount - requiredAmount, 0);
    const nextStatus = getFinanceGateStatusFromCollection(
      requiredAmount,
      nextCollectedAmount
    );

    setSavingCashReceipt(true);
    setNotice(null);
    setError('');

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();

      if (userError) throw userError;

      const { data: receipt, error: receiptError } = await supabase
        .from('project_cash_receipts')
        .insert({
          finance_account_id: selectedFinanceAccount.id,
          project_id: selectedProject.id,
          receipt_date: cashReceiptDraft.receiptDate,
          received_from: cashReceiptDraft.receivedFrom.trim() || getProjectClientName(selectedProject),
          description: cashReceiptDraft.description.trim() || `${selectedGate.title} collection`,
          amount: receivedAmount,
          gst_treatment: cashReceiptDraft.gstTreatment,
          payment_mode: cashReceiptDraft.paymentMode.trim() || 'Bank Transfer',
          reference_number: cashReceiptDraft.referenceNumber.trim(),
          unallocated_amount: 0,
          overpayment_amount: overpaymentAmount,
          carry_forward_confirmed: false,
          carry_forward_notes: '',
          created_by: userData.user?.id ?? null,
        })
        .select('id')
        .single();

      if (receiptError) throw receiptError;
      if (!receipt?.id) throw new Error('Receipt was saved without an ID.');

      const { error: allocationError } = await supabase
        .from('project_cash_receipt_allocations')
        .insert({
          receipt_id: receipt.id,
          finance_account_id: selectedFinanceAccount.id,
          project_id: selectedProject.id,
          payment_gate_id: selectedGate.id,
          source_payment_gate_id: null,
          allocation_type: 'gate',
          allocated_amount: receivedAmount,
          allocation_order: 1,
          notes: `${selectedGate.title} allocation`,
        });

      if (allocationError) throw allocationError;

      const { error: gateUpdateError } = await supabase
        .from('project_finance_payment_gates')
        .update({
          collected_amount: nextCollectedAmount,
          outstanding_amount: nextOutstandingAmount,
          carry_forward_out_amount: overpaymentAmount,
          status: nextStatus,
          marked_paid_at:
            nextStatus === 'paid' || nextStatus === 'overpaid'
              ? new Date().toISOString()
              : null,
          marked_paid_by:
            nextStatus === 'paid' || nextStatus === 'overpaid'
              ? userData.user?.id ?? null
              : null,
        })
        .eq('id', selectedGate.id);

      if (gateUpdateError) throw gateUpdateError;

      const gateNowComplete = nextStatus === 'paid' || nextStatus === 'overpaid';

      if (!wasGateAlreadyComplete && gateNowComplete) {
        await notifyDesignExecutionPaymentCollected({
          project: selectedProject,
          gate: selectedGate,
          amount: receivedAmount,
        });
      }

      setNotice({
        state: 'success',
        heading: 'Cash Received Recorded',
        description: `${formatINR(receivedAmount)} was allocated to ${selectedGate.title}. Gate status is now ${nextStatus}.`,
      });

      setIsCashPaymentModePickerOpen(false);
      setIsCashGstPickerOpen(false);
      setCashReceiptDraft(null);
      await fetchFinanceData();
    } catch (receiptError) {
      console.error('Could not record cash received', receiptError);

      setNotice({
        state: 'error',
        heading: 'Could Not Record Cash Received',
        description:
          receiptError instanceof Error
            ? receiptError.message
            : 'Unable to record the cash received entry.',
      });
    } finally {
      setSavingCashReceipt(false);
    }
  };

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
      const syncedGateCount = getSyncedFinanceGateCount(
        result.paymentGates,
        selectedTimelineGateIds
      );

      setNotice({
        state: 'success',
        heading: 'Finance Account Synced',
        description: `${selectedProject.name} is now synced from approved estimate v${result.estimate.version}. Revenue ${formatINR(result.account.revenue_amount)} - Estimated COGS ${formatINR(result.account.estimated_cogs_amount)}. ${syncedGateCount} payment gate${syncedGateCount === 1 ? '' : 's'} synced from Timeline.`,
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
                <StatusPill tone={selectedSyncStatus.tone}>
                  {selectedSyncStatus.label}
                </StatusPill>
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

                {selectedApprovedEstimate && (needsManualFinanceSync || isSyncingSelectedProject) && (
                  <button
                    type="button"
                    onClick={() => void handleSyncFinanceAccount()}
                    disabled={isSyncingSelectedProject}
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-foreground px-5 text-sm font-semibold text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {isSyncingSelectedProject ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCcw className="h-4 w-4" />
                    )}
                    {isSyncingSelectedProject ? 'Syncing' : syncActionLabel}
                  </button>
                )}
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
                        Finance can create the clean project account from this approved estimate.
                        No old project revenue will be used.
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

          {selectedFinanceAccount && (
            <div className="rounded-3xl border border-border bg-card p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                    Finance Payment Gates
                  </p>
                  <h3 className="mt-2 text-lg font-semibold text-foreground">
                    Collection stages from Timeline
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Finance now tracks required, collected, and outstanding amount per gate.
                  </p>
                </div>

                <StatusPill tone={selectedPaymentGates.length > 0 ? 'info' : 'muted'}>
                  {selectedPaymentGates.length} Gate{selectedPaymentGates.length === 1 ? '' : 's'}
                </StatusPill>
              </div>

              {cashReceiptDraft && (
                <div className="mt-5 rounded-3xl border border-emerald-500/25 bg-emerald-500/10 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-300">
                        Record Cash Received
                      </p>
                      <h4 className="mt-1 text-base font-semibold text-foreground">
                        Allocate receipt to payment gate
                      </h4>
                    </div>

                    <button
                      type="button"
                      onClick={() => setCashReceiptDraft(null)}
                      className="text-left text-xs font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline sm:text-right"
                    >
                      Cancel
                    </button>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-12 md:items-start">
                    <div className="grid min-w-0 gap-2 md:col-span-6">
                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        Payment Gate
                      </span>
                      <div className="flex h-11 w-full items-center rounded-lg border border-border bg-background/70 px-3 text-sm text-foreground">
                        <span className="truncate">
                          {(() => {
                            const selectedGate = selectedPaymentGates.find(
                              gate => gate.id === cashReceiptDraft.paymentGateId
                            );

                            return selectedGate
                              ? `${selectedGate.gate_order}. ${selectedGate.title}`
                              : 'Selected payment gate';
                          })()}
                        </span>
                      </div>
                    </div>

                    <label className="grid min-w-0 gap-2 md:col-span-3">
                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        Amount
                      </span>
                      <input
                        type="number"
                        min="0"
                        value={cashReceiptDraft.amount}
                        onChange={event =>
                          setCashReceiptDraft(current =>
                            current
                              ? {
                                  ...current,
                                  amount: event.target.value,
                                }
                              : current
                          )
                        }
                        className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none"
                        placeholder="0"
                      />
                    </label>

                    <label className="grid min-w-0 gap-2 md:col-span-3">
                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        Receipt Date
                      </span>
                      <DateInput
                        value={cashReceiptDraft.receiptDate}
                        onChange={value =>
                          setCashReceiptDraft(current =>
                            current
                              ? {
                                  ...current,
                                  receiptDate: value,
                                }
                              : current
                          )
                        }
                        placeholder="Select receipt date"
                        popoverMode="fixed"
                        className="min-w-0 [&>button]:h-11 [&>button]:w-full [&>button]:rounded-lg [&>button]:px-3 [&>button]:text-sm"
                      />
                    </label>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-12 md:items-start">
                    <label className="grid min-w-0 gap-2 md:col-span-4">
                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        Received From
                      </span>
                      <div className="flex h-11 w-full items-center rounded-lg border border-border bg-background/70 px-3 text-sm text-foreground">
                        <span className="truncate">
                          {cashReceiptDraft.receivedFrom || 'Client'}
                        </span>
                      </div>
                    </label>

                    <div ref={cashPaymentModePickerRef} className="relative grid min-w-0 gap-2 md:col-span-4">
                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        Payment Mode
                      </span>

                      <button
                        type="button"
                        onClick={() =>
                          setIsCashPaymentModePickerOpen(current => !current)
                        }
                        className="flex h-11 w-full items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 text-left text-sm text-foreground outline-none transition hover:bg-muted/40"
                      >
                        <span className="truncate">
                          {cashReceiptDraft.paymentMode || 'Select payment mode'}
                        </span>
                        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </button>

                      {isCashPaymentModePickerOpen && (
                        <div className="absolute left-0 right-0 top-full z-[80] mt-2 max-h-72 overflow-y-auto rounded-2xl border border-border bg-popover p-1 text-popover-foreground shadow-2xl">
                          {[
                            'Bank Transfer',
                            'Cash',
                            'UPI',
                            'Bank Remittance',
                            'Cheque',
                            'Credit/Debit Card',
                          ].map(option => {
                            const isSelected = cashReceiptDraft.paymentMode === option;

                            return (
                              <button
                                key={option}
                                type="button"
                                onClick={() => {
                                  setCashReceiptDraft(current =>
                                    current
                                      ? {
                                          ...current,
                                          paymentMode: option,
                                        }
                                      : current
                                  );
                                  setIsCashPaymentModePickerOpen(false);
                                }}
                                className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition ${
                                  isSelected
                                    ? 'bg-foreground text-background'
                                    : 'hover:bg-muted'
                                }`}
                              >
                                <span>{option}</span>
                                {isSelected && (
                                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <label className="grid min-w-0 gap-2 md:col-span-4">
                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        Reference No.
                      </span>
                      <input
                        value={cashReceiptDraft.referenceNumber}
                        onChange={event =>
                          setCashReceiptDraft(current =>
                            current
                              ? {
                                  ...current,
                                  referenceNumber: event.target.value,
                                }
                              : current
                          )
                        }
                        className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none"
                        placeholder="Optional"
                      />
                    </label>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-12 md:items-start">
                    <label className="grid min-w-0 gap-2 md:col-span-10">
                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        Description
                      </span>
                      <input
                        value={cashReceiptDraft.description}
                        onChange={event =>
                          setCashReceiptDraft(current =>
                            current
                              ? {
                                  ...current,
                                  description: event.target.value,
                                }
                              : current
                          )
                        }
                        className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none"
                        placeholder="Receipt note"
                      />
                    </label>

                    <div ref={cashGstPickerRef} className="relative grid min-w-0 gap-2 md:col-span-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        GST
                      </span>

                      <button
                        type="button"
                        onClick={() => setIsCashGstPickerOpen(current => !current)}
                        className="flex h-11 w-full items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 text-left text-sm text-foreground outline-none transition hover:bg-muted/40"
                      >
                        <span>
                          {cashReceiptDraft.gstTreatment === 'GST' ? 'GST' : 'No GST'}
                        </span>
                        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </button>

                      {isCashGstPickerOpen && (
                        <div className="absolute left-0 right-0 top-full z-[80] mt-2 rounded-2xl border border-border bg-popover p-1 text-popover-foreground shadow-2xl">
                          {[
                            { value: 'GST' as const, label: 'GST' },
                            { value: 'NO_GST' as const, label: 'No GST' },
                          ].map(option => {
                            const isSelected = cashReceiptDraft.gstTreatment === option.value;

                            return (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() => {
                                  setCashReceiptDraft(current =>
                                    current
                                      ? {
                                          ...current,
                                          gstTreatment: option.value,
                                        }
                                      : current
                                  );
                                  setIsCashGstPickerOpen(false);
                                }}
                                className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition ${
                                  isSelected
                                    ? 'bg-foreground text-background'
                                    : 'hover:bg-muted'
                                }`}
                              >
                                {option.label}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 flex justify-end">
                    <button
                      type="button"
                      onClick={handleSaveCashReceipt}
                      disabled={savingCashReceipt}
                      className="inline-flex h-10 items-center justify-center rounded-lg border border-transparent bg-foreground px-4 text-sm font-medium text-background transition hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {savingCashReceipt ? 'Saving...' : 'Record Receipt'}
                    </button>
                  </div>
                </div>
              )}
              {selectedPaymentGates.length === 0 ? (
                <div className="mt-5 rounded-2xl border border-dashed border-border bg-background p-5">
                  <p className="text-sm font-semibold text-foreground">
                    No Timeline payment gates synced yet.
                  </p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    Confirm a Timeline with payment gates, then resync this Finance Account.
                  </p>
                </div>
              ) : (
                <div className="mt-5 space-y-3">
                  {selectedPaymentGates.map((gate, gateIndex) => {
                    const requiredAmount = toNumber(gate.required_amount);
                    const collectedAmount = toNumber(gate.collected_amount);
                    const outstandingAmount = toNumber(gate.outstanding_amount);
                    const progress =
                      requiredAmount > 0
                        ? Math.min(100, Math.round((collectedAmount / requiredAmount) * 100))
                        : 0;
                    const statusTone =
                      gate.status === 'paid' || gate.status === 'overpaid'
                        ? 'success'
                        : gate.status === 'partial'
                          ? 'info'
                          : 'warning';
                    const workflowState = getFinanceGateWorkflowState(
                      gate,
                      gateIndex,
                      selectedPaymentGates
                    );

                    return (
                      <div
                        key={gate.id}
                        className="rounded-2xl border border-border bg-background p-4"
                      >
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold text-foreground">
                                {gate.gate_order}. {gate.title}
                              </p>
                              <StatusPill tone={statusTone}>
                                {gate.status}
                              </StatusPill>
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {gate.trigger_label || 'No trigger label'}
                            </p>
                          </div>

                          <div className="grid grid-cols-3 gap-4 text-right">
                            <div>
                              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                Required
                              </p>
                              <p className="mt-1 text-sm font-semibold text-foreground">
                                {formatINR(requiredAmount)}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                Collected
                              </p>
                              <p className="mt-1 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                                {formatINR(collectedAmount)}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                Outstanding
                              </p>
                              <p className="mt-1 text-sm font-semibold text-amber-600 dark:text-amber-300">
                                {formatINR(outstandingAmount)}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-emerald-600 dark:bg-emerald-400"
                            style={{ width: `${progress}%` }}
                          />
                        </div>

                        <div className="mt-4 flex justify-end">
                          {workflowState.state === 'completed' ? (
                            <div
                              title={workflowState.helper}
                              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 text-sm text-emerald-700 dark:text-emerald-300 sm:w-auto"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                              Completed
                            </div>
                          ) : workflowState.state === 'locked' ? (
                            <div
                              title={workflowState.helper}
                              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-border bg-muted/40 px-3 text-sm text-muted-foreground sm:w-auto"
                            >
                              <Lock className="h-4 w-4" />
                              Locked
                            </div>
                          ) : (
                            <button
                              type="button"
                              title={workflowState.helper}
                              onClick={() => handleOpenCashReceiptDraft(gate, gateIndex)}
                              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 text-sm text-foreground transition hover:bg-muted sm:w-auto"
                            >
                              <CircleDollarSign className="h-4 w-4" />
                              Record Cash
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
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
