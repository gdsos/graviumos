import type { CostEstimateLineItem, CostEstimateSummary } from './types';

export const DEFAULT_SERVICE_CHARGE_PERCENT = 15;
export const DEFAULT_MISC_CHARGE_PERCENT = 10;
export const DEFAULT_GST_PERCENT = 18;

export function calculateLineItemTotal(lineItem: CostEstimateLineItem) {
  return Math.round(lineItem.cogsAmount * lineItem.quantity);
}

export function calculateCogsSubtotal(lineItems: CostEstimateLineItem[]) {
  return Math.round(
    lineItems.reduce((total, lineItem) => total + calculateLineItemTotal(lineItem), 0)
  );
}

function clampPercent(value: number, min: number, max: number) {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function calculateCostEstimateSummary({
  lineItems,
  serviceChargePercent,
  miscChargePercent,
  gstPercent,
  targetProjectRevenue,
}: {
  lineItems: CostEstimateLineItem[];
  serviceChargePercent: number;
  miscChargePercent: number;
  gstPercent: number;
  targetProjectRevenue: number;
}): CostEstimateSummary {
  const normalizedServiceChargePercent = clampPercent(serviceChargePercent, 10, 20);
  const normalizedMiscChargePercent = clampPercent(miscChargePercent, 10, 15);
  const cogsSubtotal = calculateCogsSubtotal(lineItems);
  const serviceChargeAmount = Math.round((cogsSubtotal * normalizedServiceChargePercent) / 100);
  const miscChargeAmount = Math.round((cogsSubtotal * normalizedMiscChargePercent) / 100);
  const taxableSubtotal = Math.round(cogsSubtotal + serviceChargeAmount + miscChargeAmount);
  const gstAmount = Math.round((taxableSubtotal * gstPercent) / 100);
  const estimatedGrossRevenue = Math.round(taxableSubtotal + gstAmount);
  const revenueDifference = Math.round(estimatedGrossRevenue - targetProjectRevenue);

  return {
    cogsSubtotal,
    serviceChargePercent: normalizedServiceChargePercent,
    serviceChargeAmount,
    miscChargePercent: normalizedMiscChargePercent,
    miscChargeAmount,
    taxableSubtotal,
    gstPercent,
    gstAmount,
    estimatedGrossRevenue,
    targetProjectRevenue,
    revenueDifference,
    isRevenueMatched: Math.abs(revenueDifference) <= 1,
  };
}

export function formatEstimateDifferenceLabel(revenueDifference: number) {
  if (revenueDifference === 0) return 'Matched';

  return revenueDifference > 0
    ? `Estimate is higher by ?${Math.abs(revenueDifference).toLocaleString('en-IN')}`
    : `Estimate is lower by ?${Math.abs(revenueDifference).toLocaleString('en-IN')}`;
}
