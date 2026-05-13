import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Calculator, CheckCircle2 } from 'lucide-react';

import { SectionCard } from '@/components/common/SectionCard';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';

import {
  calculateCostEstimateSummary,
  DEFAULT_GST_PERCENT,
  DEFAULT_MISC_CHARGE_PERCENT,
  DEFAULT_SERVICE_CHARGE_PERCENT,
  formatEstimateDifferenceLabel,
  type CostEstimateLineItem,
  type CostEstimateSummary,
} from '../estimate';

import type { SelectedArea, SelectedScopeItem } from '../scopeTypes';

interface CostEstimateStepProps {
  selectedAreas: SelectedArea[];
  selectedScopeItems: SelectedScopeItem[];
  targetProjectRevenue?: number;
  onSummaryChange?: (summary: CostEstimateSummary) => void;
  onTargetProjectRevenueChange?: (revenue: number) => void;
  onApprovalChange?: (isApproved: boolean) => void;
}

function formatINR(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function getAreaName(selectedAreas: SelectedArea[], areaId: string) {
  return selectedAreas.find(area => area.id === areaId)?.name ?? 'Selected Area';
}

function getDefaultCogsAmount(scopeItem: SelectedScopeItem) {
  if (scopeItem.isCustom) return 50000;
  if (scopeItem.priority === 'critical') return 125000;
  if (scopeItem.priority === 'high') return 85000;
  if (scopeItem.priority === 'medium') return 50000;
  return 25000;
}

export function CostEstimateStep({
  selectedAreas,
  selectedScopeItems,
  targetProjectRevenue: externalTargetProjectRevenue,
  onSummaryChange,
  onTargetProjectRevenueChange,
  onApprovalChange,
}: CostEstimateStepProps) {
  const [lineItemAmounts, setLineItemAmounts] = useState<Record<string, number>>({});
  const [serviceChargePercent, setServiceChargePercent] = useState(
    DEFAULT_SERVICE_CHARGE_PERCENT
  );
  const [miscChargePercent, setMiscChargePercent] = useState(
    DEFAULT_MISC_CHARGE_PERCENT
  );
  const [targetProjectRevenue, setTargetProjectRevenue] = useState(
    externalTargetProjectRevenue ?? 3145473
  );
  const [isApproved, setIsApproved] = useState(false);

  const lineItems: CostEstimateLineItem[] = useMemo(
    () =>
      selectedScopeItems.map(scopeItem => ({
        id: `estimate-${scopeItem.id}`,
        scopeItemId: scopeItem.id,
        scopeItemName: scopeItem.name,
        areaName: getAreaName(selectedAreas, scopeItem.areaId),
        vendorId: scopeItem.selectedVendorId,
        cogsAmount:
          lineItemAmounts[scopeItem.id] ?? getDefaultCogsAmount(scopeItem),
        quantity: 1,
        unitLabel: 'scope',
      })),
    [lineItemAmounts, selectedAreas, selectedScopeItems]
  );

  const summary = useMemo(
    () =>
      calculateCostEstimateSummary({
        lineItems,
        serviceChargePercent,
        miscChargePercent,
        gstPercent: DEFAULT_GST_PERCENT,
        targetProjectRevenue,
      }),
    [lineItems, miscChargePercent, serviceChargePercent, targetProjectRevenue]
  );

  useEffect(() => {
    onSummaryChange?.(summary);
  }, [onSummaryChange, summary]);

  useEffect(() => {
    if (externalTargetProjectRevenue === undefined) return;

    setTargetProjectRevenue(externalTargetProjectRevenue);
  }, [externalTargetProjectRevenue]);

  useEffect(() => {
    setIsApproved(false);
    onApprovalChange?.(false);
  }, [
    lineItemAmounts,
    miscChargePercent,
    onApprovalChange,
    selectedScopeItems,
    serviceChargePercent,
    targetProjectRevenue,
  ]);

  useEffect(() => {
    onApprovalChange?.(isApproved);
  }, [isApproved, onApprovalChange]);

  const handleApproveEstimate = () => {
    if (!summary.isRevenueMatched) return;

    setIsApproved(true);
  };

  return (
    <div className="grid gap-5">
      <div className="rounded-2xl border border-border bg-muted/30 p-4">
        <p className="text-sm font-medium text-foreground">
          Cost Estimate Validation
        </p>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          Enter COGS/pricing for each scope item. The system calculates service
          charge, misc charge, GST, and validates the generated gross revenue
          against the current project revenue.
        </p>
      </div>

      <div className="grid gap-3 xl:grid-cols-4">
        <div className="rounded-2xl border border-border bg-background p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            COGS Subtotal
          </p>
          <p className="mt-2 text-2xl font-semibold text-foreground">
            {formatINR(summary.cogsSubtotal)}
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-background p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Service Charge
          </p>
          <p className="mt-2 text-2xl font-semibold text-foreground">
            {formatINR(summary.serviceChargeAmount)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {summary.serviceChargePercent}%
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-background p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Misc Charge
          </p>
          <p className="mt-2 text-2xl font-semibold text-foreground">
            {formatINR(summary.miscChargeAmount)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {summary.miscChargePercent}%
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-background p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            GST
          </p>
          <p className="mt-2 text-2xl font-semibold text-foreground">
            {formatINR(summary.gstAmount)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {summary.gstPercent}%
          </p>
        </div>
      </div>

      <SectionCard
        title="Estimate Controls"
        description="Service charge and misc charge are editable. GST is fixed at 18%."
        className="shadow-none"
      >
        <div className="grid gap-3 md:grid-cols-3">
          <label className="grid gap-2">
            <span className="text-sm font-medium text-foreground">
              Service Charge %
            </span>
            <input
              type="number"
              min="10"
              max="20"
              value={serviceChargePercent}
              onChange={event =>
                setServiceChargePercent(Number(event.target.value))
              }
              className="min-h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-foreground"
            />
            <span className="text-xs text-muted-foreground">
              Allowed range: 10–20%
            </span>
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium text-foreground">
              Misc Charge %
            </span>
            <input
              type="number"
              min="10"
              max="15"
              value={miscChargePercent}
              onChange={event => setMiscChargePercent(Number(event.target.value))}
              className="min-h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-foreground"
            />
            <span className="text-xs text-muted-foreground">
              Allowed range: 10–15%
            </span>
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium text-foreground">
              Current Project Revenue
            </span>
            <input
              type="number"
              min="0"
              value={targetProjectRevenue}
              onChange={event => {
                const nextRevenue = Number(event.target.value);
                setTargetProjectRevenue(nextRevenue);
                onTargetProjectRevenueChange?.(nextRevenue);
              }}
              className="min-h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-foreground"
            />
            <span className="text-xs text-muted-foreground">
              Later this will come from the Projects page.
            </span>
          </label>
        </div>
      </SectionCard>

      <SectionCard
        title="Scope Pricing"
        description="Temporary COGS values are prefilled for testing. Adjust them to validate project revenue."
        className="shadow-none"
      >
        <div className="grid gap-3">
          {lineItems.map(lineItem => (
            <div
              key={lineItem.id}
              className="grid gap-3 rounded-2xl border border-border bg-background p-4 lg:grid-cols-[minmax(0,1fr)_180px]"
            >
              <div className="min-w-0">
                <p className="font-medium text-foreground">
                  {lineItem.scopeItemName}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {lineItem.areaName}
                </p>
              </div>

              <input
                type="number"
                min="0"
                value={lineItem.cogsAmount}
                onChange={event =>
                  setLineItemAmounts(current => ({
                    ...current,
                    [lineItem.scopeItemId]: Number(event.target.value),
                  }))
                }
                className="min-h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-foreground"
              />
            </div>
          ))}
        </div>
      </SectionCard>

      <div
        className={`rounded-2xl border p-4 ${
          summary.isRevenueMatched
            ? 'border-emerald-500/20 bg-emerald-500/10'
            : 'border-amber-500/20 bg-amber-500/10'
        }`}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              {summary.isRevenueMatched ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              )}

              <p className="font-semibold text-foreground">
                {summary.isRevenueMatched
                  ? 'Revenue matched'
                  : 'Revenue mismatch detected'}
              </p>

              <StatusBadge
                variant={summary.isRevenueMatched ? 'success' : 'warning'}
              >
                {formatEstimateDifferenceLabel(summary.revenueDifference)}
              </StatusBadge>
            </div>

            <p className="text-sm leading-6 text-muted-foreground">
              Estimated gross revenue is{' '}
              <span className="font-medium text-foreground">
                {formatINR(summary.estimatedGrossRevenue)}
              </span>{' '}
              against current project revenue of{' '}
              <span className="font-medium text-foreground">
                {formatINR(summary.targetProjectRevenue)}
              </span>
              .
            </p>
          </div>

          {summary.isRevenueMatched ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              {isApproved ? (
                <StatusBadge variant="success">Estimate Approved</StatusBadge>
              ) : (
                <Button
                  type="button"
                  onClick={handleApproveEstimate}
                  className="gap-2"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Approve Cost Estimate
                </Button>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-amber-500/20 bg-background/60 px-3 py-2 text-xs leading-5 text-muted-foreground">
              Click Continue below to resolve the mismatch before moving to
              Review.
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-background p-4">
        <div className="flex items-center gap-2">
          <Calculator className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">
            Estimated Gross Revenue Formula
          </p>
        </div>

        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          COGS subtotal + service charge + misc charge = taxable subtotal. GST
          18% is calculated after that. Payment gates should be generated from
          the final gross revenue.
        </p>
      </div>

    </div>
  );
}

