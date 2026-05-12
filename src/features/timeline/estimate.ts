export interface CostEstimateLineItem {
  id: string;
  scopeItemId: string;
  scopeItemName: string;
  areaName?: string;
  vendorId?: string;
  vendorName?: string;
  cogsAmount: number;
  quantity: number;
  unitLabel?: string;
  notes?: string;
}

export interface CostEstimateInput {
  lineItems: CostEstimateLineItem[];
  serviceChargePercent: number;
  miscChargePercent: number;
  gstPercent: number;
  targetProjectRevenue: number;
}

export interface CostEstimateSummary {
  cogsSubtotal: number;
  serviceChargePercent: number;
  serviceChargeAmount: number;
  miscChargePercent: number;
  miscChargeAmount: number;
  taxableSubtotal: number;
  gstPercent: number;
  gstAmount: number;
  estimatedGrossRevenue: number;
  targetProjectRevenue: number;
  revenueDifference: number;
  isRevenueMatched: boolean;
}

export interface RevenueMismatchResolution {
  action: 'continue_editing' | 'update_revenue';
  currentProjectRevenue: number;
  updatedProjectRevenue: number;
  warningMessage?: string;
}

export const DEFAULT_SERVICE_CHARGE_PERCENT = 15;
export const DEFAULT_MISC_CHARGE_PERCENT = 10;
export const DEFAULT_GST_PERCENT = 18;

export const MIN_SERVICE_CHARGE_PERCENT = 10;
export const MAX_SERVICE_CHARGE_PERCENT = 20;

export const MIN_MISC_CHARGE_PERCENT = 10;
export const MAX_MISC_CHARGE_PERCENT = 15;

export const REVENUE_MATCH_TOLERANCE = 1;

function roundAmount(amount: number) {
  return Math.round(amount);
}

function clampPercent(value: number, min: number, max: number) {
  if (Number.isNaN(value)) return min;

  return Math.min(max, Math.max(min, value));
}

export function normalizeServiceChargePercent(percent: number) {
  return clampPercent(
    percent,
    MIN_SERVICE_CHARGE_PERCENT,
    MAX_SERVICE_CHARGE_PERCENT
  );
}

export function normalizeMiscChargePercent(percent: number) {
  return clampPercent(percent, MIN_MISC_CHARGE_PERCENT, MAX_MISC_CHARGE_PERCENT);
}

export function calculateLineItemTotal(lineItem: CostEstimateLineItem) {
  return roundAmount(lineItem.cogsAmount * lineItem.quantity);
}

export function calculateCogsSubtotal(lineItems: CostEstimateLineItem[]) {
  return roundAmount(
    lineItems.reduce(
      (total, lineItem) => total + calculateLineItemTotal(lineItem),
      0
    )
  );
}

export function calculateCostEstimateSummary(
  input: CostEstimateInput
): CostEstimateSummary {
  const serviceChargePercent = normalizeServiceChargePercent(
    input.serviceChargePercent
  );

  const miscChargePercent = normalizeMiscChargePercent(input.miscChargePercent);

  const cogsSubtotal = calculateCogsSubtotal(input.lineItems);

  const serviceChargeAmount = roundAmount(
    (cogsSubtotal * serviceChargePercent) / 100
  );

  const miscChargeAmount = roundAmount((cogsSubtotal * miscChargePercent) / 100);

  const taxableSubtotal = roundAmount(
    cogsSubtotal + serviceChargeAmount + miscChargeAmount
  );

  const gstAmount = roundAmount((taxableSubtotal * input.gstPercent) / 100);

  const estimatedGrossRevenue = roundAmount(taxableSubtotal + gstAmount);

  const revenueDifference = roundAmount(
    estimatedGrossRevenue - input.targetProjectRevenue
  );

  const isRevenueMatched =
    Math.abs(revenueDifference) <= REVENUE_MATCH_TOLERANCE;

  return {
    cogsSubtotal,
    serviceChargePercent,
    serviceChargeAmount,
    miscChargePercent,
    miscChargeAmount,
    taxableSubtotal,
    gstPercent: input.gstPercent,
    gstAmount,
    estimatedGrossRevenue,
    targetProjectRevenue: input.targetProjectRevenue,
    revenueDifference,
    isRevenueMatched,
  };
}

export function createRevenueMismatchResolution({
  action,
  currentProjectRevenue,
  estimatedGrossRevenue,
}: {
  action: RevenueMismatchResolution['action'];
  currentProjectRevenue: number;
  estimatedGrossRevenue: number;
}): RevenueMismatchResolution {
  if (action === 'continue_editing') {
    return {
      action,
      currentProjectRevenue,
      updatedProjectRevenue: currentProjectRevenue,
    };
  }

  return {
    action,
    currentProjectRevenue,
    updatedProjectRevenue: estimatedGrossRevenue,
    warningMessage:
      'This will overwrite the current project revenue with the generated cost estimate gross revenue. Payment gates, project financials, and reports may be affected.',
  };
}

export function formatEstimateDifferenceLabel(revenueDifference: number) {
  if (revenueDifference === 0) return 'Matched';

  return revenueDifference > 0
    ? `Estimate is higher by ₹${Math.abs(revenueDifference).toLocaleString('en-IN')}`
    : `Estimate is lower by ₹${Math.abs(revenueDifference).toLocaleString('en-IN')}`;
}
