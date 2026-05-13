import { useMemo, useState } from 'react';
import { CheckCircle2, Plus, RefreshCcw, Trash2 } from 'lucide-react';

import { SectionCard } from '@/components/common/SectionCard';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';

import {
  DEFAULT_GST_PERCENT,
  DEFAULT_MISC_CHARGE_PERCENT,
  DEFAULT_SERVICE_CHARGE_PERCENT,
  calculateCostEstimateSummary,
  formatEstimateDifferenceLabel,
} from '../calculator';
import { demoCostEstimateAreas, demoCostEstimateLineItems } from '../data';

import type {
  CostEstimateArea,
  CostEstimateLineItem,
  CostEstimateStatus,
} from '../types';

function formatINR(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function createId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}`;
}

function getAreaName(areas: CostEstimateArea[], areaId: string) {
  return areas.find(area => area.id === areaId)?.name ?? 'Selected Area';
}

export function CostEstimateSection() {
  const [status, setStatus] = useState<CostEstimateStatus>('draft');
  const [areas, setAreas] = useState<CostEstimateArea[]>(demoCostEstimateAreas);
  const [lineItems, setLineItems] = useState<CostEstimateLineItem[]>(
    demoCostEstimateLineItems
  );
  const [serviceChargePercent, setServiceChargePercent] = useState(
    DEFAULT_SERVICE_CHARGE_PERCENT
  );
  const [miscChargePercent, setMiscChargePercent] = useState(
    DEFAULT_MISC_CHARGE_PERCENT
  );
  const [targetProjectRevenue, setTargetProjectRevenue] = useState(950000);
  const [newAreaName, setNewAreaName] = useState('');
  const [newLineItemAreaId, setNewLineItemAreaId] = useState(
    demoCostEstimateAreas[0]?.id ?? ''
  );
  const [newLineItemName, setNewLineItemName] = useState('');
  const [newLineItemCogs, setNewLineItemCogs] = useState('50000');

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

  const handleAddArea = () => {
    const trimmedName = newAreaName.trim();
    if (!trimmedName) return;

    const newArea: CostEstimateArea = {
      id: createId('estimate-area'),
      name: trimmedName,
      type: 'custom',
    };

    setAreas(current => [...current, newArea]);
    setNewLineItemAreaId(current => current || newArea.id);
    setNewAreaName('');
    setStatus('draft');
  };

  const handleAddRepeatedRoom = (type: 'bedroom' | 'bathroom') => {
    const count = areas.filter(area => area.type === type).length;
    const label = type === 'bedroom' ? 'Bedroom' : 'Bathroom';

    setAreas(current => [
      ...current,
      {
        id: createId(`estimate-${type}`),
        name: `${label} ${count + 1}`,
        type,
      },
    ]);
    setStatus('draft');
  };

  const handleAddLineItem = () => {
    const trimmedName = newLineItemName.trim();
    const cogsAmount = Math.max(0, Number(newLineItemCogs) || 0);

    if (!trimmedName || !newLineItemAreaId) return;

    setLineItems(current => [
      ...current,
      {
        id: createId('estimate-line'),
        areaId: newLineItemAreaId,
        name: trimmedName,
        cogsAmount,
        quantity: 1,
        unitLabel: 'scope',
      },
    ]);
    setNewLineItemName('');
    setNewLineItemCogs('50000');
    setStatus('draft');
  };

  const handleUpdateLineItemAmount = (lineItemId: string, amount: number) => {
    setLineItems(current =>
      current.map(lineItem =>
        lineItem.id === lineItemId
          ? { ...lineItem, cogsAmount: Math.max(0, amount) }
          : lineItem
      )
    );
    setStatus('draft');
  };

  const handleRemoveLineItem = (lineItemId: string) => {
    setLineItems(current =>
      current.filter(lineItem => lineItem.id !== lineItemId)
    );
    setStatus('draft');
  };

  const handleUpdateRevenue = () => {
    setTargetProjectRevenue(summary.estimatedGrossRevenue);
    setStatus('draft');
  };

  const handleApproveEstimate = () => {
    if (!summary.isRevenueMatched) return;
    setStatus('approved');
  };

  return (
    <SectionCard
      title="Cost Estimate"
      description="Project-level estimate source for execution scope, COGS, pricing, GST, and future timeline generation."
      actions={
        <StatusBadge variant={status === 'approved' ? 'success' : 'warning'}>
          {status === 'approved' ? 'Approved Estimate' : 'Draft Estimate'}
        </StatusBadge>
      }
    >
      <div className="grid gap-5">
        <div className="rounded-2xl border border-border bg-muted/30 p-4">
          <p className="text-sm font-medium text-foreground">
            Future source of truth
          </p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Areas, repeated rooms, scope, COGS, execution revenue, and vendor-linked
            work should be finalized here. Timeline will later convert the approved
            estimate into work packages.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-border bg-background p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">COGS</p>
            <p className="mt-2 text-xl font-semibold text-foreground">
              {formatINR(summary.cogsSubtotal)}
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-background p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Taxable</p>
            <p className="mt-2 text-xl font-semibold text-foreground">
              {formatINR(summary.taxableSubtotal)}
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-background p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">GST 18%</p>
            <p className="mt-2 text-xl font-semibold text-foreground">
              {formatINR(summary.gstAmount)}
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-background p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Gross Revenue
            </p>
            <p className="mt-2 text-xl font-semibold text-foreground">
              {formatINR(summary.estimatedGrossRevenue)}
            </p>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          <label className="grid gap-2">
            <span className="text-sm font-medium text-foreground">Service Charge %</span>
            <input
              type="number"
              min="10"
              max="20"
              value={serviceChargePercent}
              onChange={event => {
                setServiceChargePercent(Number(event.target.value));
                setStatus('draft');
              }}
              className="min-h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-foreground"
            />
            <span className="text-xs text-muted-foreground">Allowed: 10-20%</span>
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium text-foreground">Misc Charge %</span>
            <input
              type="number"
              min="10"
              max="15"
              value={miscChargePercent}
              onChange={event => {
                setMiscChargePercent(Number(event.target.value));
                setStatus('draft');
              }}
              className="min-h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-foreground"
            />
            <span className="text-xs text-muted-foreground">Allowed: 10-15%</span>
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
                setTargetProjectRevenue(Number(event.target.value));
                setStatus('draft');
              }}
              className="min-h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-foreground"
            />
            <span className="text-xs text-muted-foreground">
              Later this will sync with project financials.
            </span>
          </label>
        </div>

        <div
          className={`rounded-2xl border p-4 ${
            summary.isRevenueMatched
              ? 'border-emerald-500/20 bg-emerald-500/10'
              : 'border-amber-500/20 bg-amber-500/10'
          }`}
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                {summary.isRevenueMatched && (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
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
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
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

            <div className="flex flex-col gap-2 sm:flex-row">
              {!summary.isRevenueMatched && (
                <Button type="button" onClick={handleUpdateRevenue} className="gap-2">
                  <RefreshCcw className="h-4 w-4" />
                  Update Revenue
                </Button>
              )}
              <Button
                type="button"
                onClick={handleApproveEstimate}
                disabled={!summary.isRevenueMatched || status === 'approved'}
                className="gap-2"
              >
                <CheckCircle2 className="h-4 w-4" />
                {status === 'approved' ? 'Approved' : 'Approve Estimate'}
              </Button>
            </div>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-2xl border border-border bg-background p-4">
            <p className="text-sm font-medium text-foreground">
              Areas / repeated rooms
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Repeated rooms are created here so each room can later carry its own
              estimate scope.
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <input
                value={newAreaName}
                onChange={event => setNewAreaName(event.target.value)}
                placeholder="e.g. Prayer Room"
                className="min-h-10 flex-1 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-foreground"
              />
              <Button
                type="button"
                onClick={handleAddArea}
                disabled={!newAreaName.trim()}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Area
              </Button>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleAddRepeatedRoom('bedroom')}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Bedroom
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleAddRepeatedRoom('bathroom')}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Bathroom
              </Button>
            </div>

            <div className="mt-4 flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {areas.map(area => (
                <div
                  key={area.id}
                  className="min-w-[180px] rounded-2xl border border-border bg-muted/30 p-3"
                >
                  <p className="font-medium text-foreground">{area.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {area.type.replaceAll('_', ' ')}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-background p-4">
            <p className="text-sm font-medium text-foreground">
              Add estimate scope item
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Scope belongs here first. Timeline will later convert approved line
              items into work packages.
            </p>

            <div className="mt-4 grid gap-3">
              <select
                value={newLineItemAreaId}
                onChange={event => setNewLineItemAreaId(event.target.value)}
                className="min-h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-foreground"
              >
                {areas.map(area => (
                  <option key={area.id} value={area.id}>
                    {area.name}
                  </option>
                ))}
              </select>

              <input
                value={newLineItemName}
                onChange={event => setNewLineItemName(event.target.value)}
                placeholder="e.g. Wardrobe"
                className="min-h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-foreground"
              />

              <input
                type="number"
                min="0"
                value={newLineItemCogs}
                onChange={event => setNewLineItemCogs(event.target.value)}
                placeholder="COGS"
                className="min-h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-foreground"
              />

              <Button
                type="button"
                onClick={handleAddLineItem}
                disabled={!newLineItemName.trim() || !newLineItemAreaId}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Scope Item
              </Button>
            </div>
          </div>
        </div>

        <div className="grid gap-3">
          {lineItems.map(lineItem => (
            <div
              key={lineItem.id}
              className="grid gap-3 rounded-2xl border border-border bg-background p-4 lg:grid-cols-[minmax(0,1fr)_180px_auto]"
            >
              <div className="min-w-0">
                <p className="font-medium text-foreground">{lineItem.name}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {getAreaName(areas, lineItem.areaId)}
                  {lineItem.vendorName ? ` - ${lineItem.vendorName}` : ''}
                </p>
              </div>

              <input
                type="number"
                min="0"
                value={lineItem.cogsAmount}
                onChange={event =>
                  handleUpdateLineItemAmount(lineItem.id, Number(event.target.value))
                }
                className="min-h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-foreground"
              />

              <button
                type="button"
                onClick={() => handleRemoveLineItem(lineItem.id)}
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-destructive/30 text-destructive transition hover:bg-destructive/10"
                aria-label="Remove estimate line item"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </SectionCard>
  );
}
