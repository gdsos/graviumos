import {
  supabase,
  type ProjectFinanceAccount,
  type ProjectFinancePaymentGate,
} from './supabase';
import {
  DEFAULT_GST_PERCENT,
  calculateCostEstimateSummary,
} from '../features/cost-estimate/calculator';
import type {
  CostEstimateArea,
  CostEstimateLineItem,
  CostEstimateSummary,
} from '../features/cost-estimate/types';

type CostEstimateStatus = 'draft' | 'approved' | 'revision';

interface CostEstimateRow {
  id: string;
  project_id: string | null;
  project_name: string;
  client_name: string | null;
  status: CostEstimateStatus;
  version: number | string | null;
  grand_total: number | string | null;
  areas: unknown;
  line_items: unknown;
  service_charge_percent: number | string | null;
  misc_charge_percent: number | string | null;
  target_project_revenue: number | string | null;
  approved_snapshot: unknown;
  created_at: string | null;
  updated_at: string | null;
}

interface EstimateEditorPayloadLike {
  grandTotal?: unknown;
  status?: unknown;
  version?: unknown;
  areas?: unknown;
  lineItems?: unknown;
  serviceChargePercent?: unknown;
  miscChargePercent?: unknown;
  targetProjectRevenue?: unknown;
}

export interface ApprovedEstimateFinancePayload {
  id: string;
  projectId: string;
  projectName: string;
  clientName: string | null;
  status: 'approved';
  version: number;
  grandTotal: number;
  areas: CostEstimateArea[];
  lineItems: CostEstimateLineItem[];
  serviceChargePercent: number;
  miscChargePercent: number;
  gstPercent: number;
  targetProjectRevenue: number;
  approvedSource: 'current_record' | 'approved_snapshot';
  updatedAt: string | null;
}

export interface ProjectFinanceAccountSyncInput {
  estimateId?: string;
  projectId?: string;
  userId?: string | null;
  syncLegacyProjectFields?: boolean;
}

export interface ProjectFinanceAccountSyncResult {
  account: ProjectFinanceAccount;
  estimate: ApprovedEstimateFinancePayload;
  summary: CostEstimateSummary;
  paymentGates: ProjectFinancePaymentGate[];
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
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

function normalizeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function getApprovedEstimatePayloadFromRow(
  row: CostEstimateRow
): ApprovedEstimateFinancePayload | null {
  if (!row.project_id) return null;

  const currentRecordPayload: EstimateEditorPayloadLike = {
    grandTotal: row.grand_total,
    status: row.status,
    version: row.version,
    areas: row.areas,
    lineItems: row.line_items,
    serviceChargePercent: row.service_charge_percent,
    miscChargePercent: row.misc_charge_percent,
    targetProjectRevenue: row.target_project_revenue,
  };

  const approvedSnapshotPayload = isObjectRecord(row.approved_snapshot)
    ? (row.approved_snapshot as EstimateEditorPayloadLike)
    : null;

  const sourcePayload =
    row.status === 'approved'
      ? currentRecordPayload
      : approvedSnapshotPayload?.status === 'approved'
        ? approvedSnapshotPayload
        : null;

  if (!sourcePayload) return null;

  const approvedSource =
    row.status === 'approved' ? 'current_record' : 'approved_snapshot';

  return {
    id: row.id,
    projectId: row.project_id,
    projectName: row.project_name,
    clientName: row.client_name,
    status: 'approved',
    version: toNumber(sourcePayload.version, toNumber(row.version, 1)),
    grandTotal: toNumber(sourcePayload.grandTotal, toNumber(row.grand_total)),
    areas: normalizeArray<CostEstimateArea>(sourcePayload.areas),
    lineItems: normalizeArray<CostEstimateLineItem>(sourcePayload.lineItems),
    serviceChargePercent: toNumber(sourcePayload.serviceChargePercent, 15),
    miscChargePercent: toNumber(sourcePayload.miscChargePercent, 10),
    gstPercent: DEFAULT_GST_PERCENT,
    targetProjectRevenue: toNumber(
      sourcePayload.targetProjectRevenue,
      toNumber(row.target_project_revenue)
    ),
    approvedSource,
    updatedAt: row.updated_at ?? row.created_at,
  };
}

async function fetchEstimateRowsForFinance(
  input: ProjectFinanceAccountSyncInput
): Promise<CostEstimateRow[]> {
  if (input.estimateId) {
    const { data, error } = await supabase
      .from('cost_estimates')
      .select('*')
      .eq('id', input.estimateId)
      .maybeSingle();

    if (error) throw error;
    return data ? [data as CostEstimateRow] : [];
  }

  if (input.projectId) {
    const { data, error } = await supabase
      .from('cost_estimates')
      .select('*')
      .eq('project_id', input.projectId)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return (data ?? []) as CostEstimateRow[];
  }

  throw new Error('Provide estimateId or projectId to sync project finance.');
}

export async function findApprovedEstimateForFinance(
  input: ProjectFinanceAccountSyncInput
): Promise<ApprovedEstimateFinancePayload | null> {
  const rows = await fetchEstimateRowsForFinance(input);

  for (const row of rows) {
    const approvedPayload = getApprovedEstimatePayloadFromRow(row);
    if (approvedPayload) return approvedPayload;
  }

  return null;
}


type TimelinePaymentGateStatus = 'pending' | 'received' | 'overdue' | string;

interface TimelinePaymentGateSnapshot {
  id: string;
  projectId?: string;
  type?: string;
  title?: string;
  description?: string;
  percentage?: number;
  amount?: number;
  dueDate?: string;
  receivedDate?: string;
  status?: TimelinePaymentGateStatus;
  blocksWorkPackageIds?: string[];
}

interface ProjectTimelineGateRow {
  id: string;
  project_id: string;
  source_estimate_id: string | null;
  source_estimate_version: number | string | null;
  source_estimate_grand_total: number | string | null;
  has_timeline: boolean | null;
  timeline_confirmed_at: string | null;
  payment_gates: unknown;
}

function isTimelinePaymentGate(value: unknown): value is TimelinePaymentGateSnapshot {
  if (!isObjectRecord(value)) return false;

  return typeof value.id === 'string';
}

function getFinanceGateStatus({
  requiredAmount,
  collectedAmount,
  timelineStatus,
}: {
  requiredAmount: number;
  collectedAmount: number;
  timelineStatus?: TimelinePaymentGateStatus;
}): ProjectFinancePaymentGate['status'] {
  if (collectedAmount > requiredAmount) return 'overpaid';
  if (requiredAmount > 0 && collectedAmount === requiredAmount) return 'paid';
  if (collectedAmount > 0) return 'partial';
  if (timelineStatus === 'received') return 'paid';

  return 'pending';
}

function getFinanceGateRequiredAmount({
  timelineGate,
  revenueAmount,
}: {
  timelineGate: TimelinePaymentGateSnapshot;
  revenueAmount: number;
}) {
  const directAmount = toNumber(timelineGate.amount);

  if (directAmount > 0) return directAmount;

  const percentage = toNumber(timelineGate.percentage);

  if (percentage > 0 && revenueAmount > 0) {
    return Math.round((revenueAmount * percentage) / 100);
  }

  return 0;
}

async function fetchProjectTimelineGateRow(projectId: string) {
  const { data, error } = await supabase
    .from('project_timelines')
    .select('id, project_id, source_estimate_id, source_estimate_version, source_estimate_grand_total, has_timeline, timeline_confirmed_at, payment_gates')
    .eq('project_id', projectId)
    .eq('has_timeline', true)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  if (!data) return null;

  return data as ProjectTimelineGateRow;
}

async function syncFinancePaymentGatesFromTimeline({
  account,
  estimate,
  revenueAmount,
}: {
  account: ProjectFinanceAccount;
  estimate: ApprovedEstimateFinancePayload;
  revenueAmount: number;
}) {
  const timeline = await fetchProjectTimelineGateRow(estimate.projectId);

  if (!timeline || !timeline.has_timeline || !Array.isArray(timeline.payment_gates)) {
    return [] as ProjectFinancePaymentGate[];
  }

  const timelineGates = timeline.payment_gates.filter(isTimelinePaymentGate);

  if (timelineGates.length === 0) {
    return [] as ProjectFinancePaymentGate[];
  }

  const { data: existingGateRows, error: existingGateError } = await supabase
    .from('project_finance_payment_gates')
    .select('*')
    .eq('finance_account_id', account.id);

  if (existingGateError) throw existingGateError;

  const existingGates = ((existingGateRows ?? []) as ProjectFinancePaymentGate[]);
  const existingGateByOrder = new Map(
    existingGates.map(gate => [gate.gate_order, gate])
  );

  const gateRows = timelineGates.map((timelineGate, index) => {
    const gateOrder = index + 1;
    const existingGate = existingGateByOrder.get(gateOrder);
    const requiredAmount = getFinanceGateRequiredAmount({
      timelineGate,
      revenueAmount,
    });
    const collectedAmount =
      existingGate
        ? toNumber(existingGate.collected_amount)
        : timelineGate.status === 'received'
          ? requiredAmount
          : 0;
    const carryForwardInAmount = existingGate
      ? toNumber(existingGate.carry_forward_in_amount)
      : 0;
    const carryForwardOutAmount = existingGate
      ? toNumber(existingGate.carry_forward_out_amount)
      : 0;
    const outstandingAmount = Math.max(
      0,
      Math.round(requiredAmount + carryForwardInAmount - collectedAmount - carryForwardOutAmount)
    );
    const status = getFinanceGateStatus({
      requiredAmount,
      collectedAmount,
      timelineStatus: timelineGate.status,
    });

    return {
      finance_account_id: account.id,
      project_id: estimate.projectId,
      timeline_id: timeline.id,
      timeline_gate_id: timelineGate.id,
      gate_order: gateOrder,
      title: timelineGate.title?.trim() || `Payment Gate ${gateOrder}`,
      trigger_label:
        timelineGate.description?.trim() ||
        (timelineGate.percentage ? `Collect ${timelineGate.percentage}%` : ''),
      required_amount: requiredAmount,
      collected_amount: collectedAmount,
      carry_forward_in_amount: carryForwardInAmount,
      carry_forward_out_amount: carryForwardOutAmount,
      outstanding_amount: outstandingAmount,
      status,
      marked_paid_at:
        status === 'paid' || status === 'overpaid'
          ? existingGate?.marked_paid_at ?? timelineGate.receivedDate ?? null
          : null,
      marked_paid_by: existingGate?.marked_paid_by ?? null,
      source_gate_snapshot: {
        timelineId: timeline.id,
        timelineSourceEstimateId: timeline.source_estimate_id,
        timelineSourceEstimateVersion: timeline.source_estimate_version,
        timelineConfirmedAt: timeline.timeline_confirmed_at,
        timelineGate,
      },
    };
  });

  const { data, error } = await supabase
    .from('project_finance_payment_gates')
    .upsert(gateRows, { onConflict: 'finance_account_id,gate_order' })
    .select('*')
    .order('gate_order', { ascending: true });

  if (error) throw error;

  const upsertedGateRows = (data ?? []) as ProjectFinancePaymentGate[];

  if (upsertedGateRows.length > 0) {
    return upsertedGateRows;
  }

  const { data: syncedGateRows, error: syncedGateFetchError } = await supabase
    .from('project_finance_payment_gates')
    .select('*')
    .eq('finance_account_id', account.id)
    .eq('timeline_id', timeline.id)
    .order('gate_order', { ascending: true });

  if (syncedGateFetchError) throw syncedGateFetchError;

  return (syncedGateRows ?? []) as ProjectFinancePaymentGate[];
}


export function calculateApprovedEstimateFinanceSummary(
  estimate: ApprovedEstimateFinancePayload
) {
  return calculateCostEstimateSummary({
    lineItems: estimate.lineItems,
    serviceChargePercent: estimate.serviceChargePercent,
    miscChargePercent: estimate.miscChargePercent,
    gstPercent: estimate.gstPercent,
    targetProjectRevenue: estimate.targetProjectRevenue,
  });
}

export async function syncProjectFinanceAccountFromApprovedEstimate(
  input: ProjectFinanceAccountSyncInput
): Promise<ProjectFinanceAccountSyncResult> {
  const estimate = await findApprovedEstimateForFinance(input);

  if (!estimate) {
    throw new Error('No approved project-linked cost estimate found for finance sync.');
  }

  const summary = calculateApprovedEstimateFinanceSummary(estimate);
  const revenueAmount =
    estimate.grandTotal > 0 ? estimate.grandTotal : summary.estimatedGrossRevenue;
  const estimatedCogsAmount = summary.cogsSubtotal;
  const estimatedMarginAmount = Math.round(revenueAmount - estimatedCogsAmount);

  const now = new Date().toISOString();

  const sourceSnapshot = {
    estimateId: estimate.id,
    projectId: estimate.projectId,
    projectName: estimate.projectName,
    clientName: estimate.clientName,
    version: estimate.version,
    approvedSource: estimate.approvedSource,
    approvedEstimateUpdatedAt: estimate.updatedAt,
    areas: estimate.areas,
    lineItems: estimate.lineItems,
    summary,
  };

  const { data, error } = await supabase
    .from('project_finance_accounts')
    .upsert(
      {
        project_id: estimate.projectId,
        source_estimate_id: estimate.id,
        status: 'active',
        revenue_amount: revenueAmount,
        estimated_cogs_amount: estimatedCogsAmount,
        estimated_margin_amount: estimatedMarginAmount,
        service_charge_amount: summary.serviceChargeAmount,
        misc_charge_amount: summary.miscChargeAmount,
        gst_amount: summary.gstAmount,
        source_snapshot: sourceSnapshot,
        last_synced_at: now,
        created_by: input.userId ?? null,
      },
      { onConflict: 'project_id' }
    )
    .select('*')
    .single();

  if (error) throw error;

  const syncedPaymentGates = await syncFinancePaymentGatesFromTimeline({
    account: data as ProjectFinanceAccount,
    estimate,
    revenueAmount,
  });

  if (input.syncLegacyProjectFields) {
    const { error: projectUpdateError } = await supabase
      .from('projects')
      .update({
        revenue: revenueAmount,
        estimated_cogs: estimatedCogsAmount,
        updated_at: now,
      })
      .eq('id', estimate.projectId);

    if (projectUpdateError) throw projectUpdateError;
  }

  return {
    account: data as ProjectFinanceAccount,
    estimate,
    summary,
    paymentGates: syncedPaymentGates,
  };
}
