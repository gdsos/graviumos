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
  calculateLineItemTotal,
  formatEstimateDifferenceLabel,
} from '../calculator';
import {
  defaultCostEstimateUnits,
  demoCostEstimateAreas,
  demoCostEstimateItemPresets,
  demoCostEstimateLineItems,
  demoCostEstimateProjects,
} from '../data';

import type {
  CostEstimateArea,
  CostEstimateItemPreset,
  CostEstimateLineItem,
  CostEstimateProject,
  CostEstimateStatus,
  CostEstimateUnit,
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

const UNASSIGNED_PROJECT_ID = 'unassigned-draft';
const ADD_NEW_UNIT_ID = 'add-new-unit';

function getAreaName(areas: CostEstimateArea[], areaId: string) {
  return areas.find(area => area.id === areaId)?.name ?? 'Selected Area';
}

function getProjectLabel(project?: CostEstimateProject) {
  if (!project) return 'Unassigned Draft';

  return `${project.name} - ${project.clientName}`;
}

function calculateSellingRate(purchaseRate: number, markupPercent: number) {
  return Math.round(purchaseRate * (1 + markupPercent / 100));
}

function createDefaultDescription({
  areaName,
  itemName,
  quantity,
  unitLabel,
}: {
  areaName: string;
  itemName: string;
  quantity: number;
  unitLabel: string;
}) {
  const safeAreaName = areaName || 'selected area';
  const safeItemName = itemName || 'custom work item';

  return `Design, supply, and installation of ${safeItemName} in ${safeAreaName}, measured as ${quantity || 0} ${unitLabel}, including required materials, fittings, finishing, and site installation.`;
}

export function CostEstimateSection() {
  const [status, setStatus] = useState<CostEstimateStatus>('draft');
  const [selectedProjectId, setSelectedProjectId] = useState(UNASSIGNED_PROJECT_ID);
  const [areas, setAreas] = useState<CostEstimateArea[]>(demoCostEstimateAreas);
  const [lineItems, setLineItems] = useState<CostEstimateLineItem[]>(
    demoCostEstimateLineItems
  );
  const [units, setUnits] = useState<CostEstimateUnit[]>(defaultCostEstimateUnits);
  const [itemPresets, setItemPresets] = useState<CostEstimateItemPreset[]>(
    demoCostEstimateItemPresets
  );
  const [serviceChargePercent, setServiceChargePercent] = useState(
    DEFAULT_SERVICE_CHARGE_PERCENT
  );
  const [miscChargePercent, setMiscChargePercent] = useState(
    DEFAULT_MISC_CHARGE_PERCENT
  );
  const [targetProjectRevenue, setTargetProjectRevenue] = useState(950000);
  const [newAreaName, setNewAreaName] = useState('');
  const [newUnitName, setNewUnitName] = useState('');
  const [isNewUnitFormOpen, setIsNewUnitFormOpen] = useState(false);
  const [isItemSuggestionOpen, setIsItemSuggestionOpen] = useState(false);
  const [isNewItemPresetFormOpen, setIsNewItemPresetFormOpen] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [newPresetUnit, setNewPresetUnit] = useState('sqft');
  const [newPresetPurchaseRate, setNewPresetPurchaseRate] = useState('500');
  const [newPresetMarkupPercent, setNewPresetMarkupPercent] = useState('35');
  const [newPresetDescription, setNewPresetDescription] = useState('');
  const [newLineItemAreaId, setNewLineItemAreaId] = useState(
    demoCostEstimateAreas[0]?.id ?? ''
  );
  const [activeLineItemAreaId, setActiveLineItemAreaId] = useState(
    demoCostEstimateAreas[0]?.id ?? ''
  );
  const [newLineItemName, setNewLineItemName] = useState('');
  const [newLineItemDescription, setNewLineItemDescription] = useState('');
  const [newLineItemQuantity, setNewLineItemQuantity] = useState('1');
  const [newLineItemUnit, setNewLineItemUnit] = useState('sqft');
  const [newLineItemRate, setNewLineItemRate] = useState('500');
  const [newLineItemRemarks, setNewLineItemRemarks] = useState('');

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

  const selectedAreaName = getAreaName(areas, newLineItemAreaId);
  const previewDescription = createDefaultDescription({
    areaName: selectedAreaName,
    itemName: newLineItemName,
    quantity: Number(newLineItemQuantity) || 0,
    unitLabel: newLineItemUnit,
  });

  const availableProjectsForNewEstimate = demoCostEstimateProjects.filter(
    project => !project.hasCostEstimate || project.id === selectedProjectId
  );
  const selectedProject =
    demoCostEstimateProjects.find(project => project.id === selectedProjectId) ??
    undefined;

  const groupedAreas = areas.map(area => {
    const areaLineItems = lineItems.filter(lineItem => lineItem.areaId === area.id);
    const areaTotal = areaLineItems.reduce(
      (total, lineItem) => total + calculateLineItemTotal(lineItem),
      0
    );

    return {
      area,
      lineItems: areaLineItems,
      total: areaTotal,
    };
  });

  const matchingItemPresets = itemPresets.filter(preset =>
    preset.name.toLowerCase().includes(newLineItemName.trim().toLowerCase())
  );

  const handleProjectSelectionChange = (projectId: string) => {
    setSelectedProjectId(projectId);
    setStatus('draft');
  };

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

  const handleStartAreaLineItem = (areaId: string) => {
    setNewLineItemAreaId(areaId);
    setActiveLineItemAreaId(areaId);
  };

  const applyItemPreset = (preset: CostEstimateItemPreset) => {
    setNewLineItemName(preset.name);
    setNewLineItemUnit(preset.defaultUnitLabel);
    setNewLineItemRate(String(preset.sellingRatePerUnit));
    setNewLineItemDescription(preset.defaultDescription);
    setIsItemSuggestionOpen(false);
  };

  const handleItemNameChange = (itemName: string) => {
    setNewLineItemName(itemName);
    setIsItemSuggestionOpen(true);
  };

  const handleOpenNewItemPresetForm = () => {
    setIsNewItemPresetFormOpen(true);
    setIsItemSuggestionOpen(false);
  };

  const handleAddItemPreset = () => {
    const trimmedName = newPresetName.trim();
    const purchaseRatePerUnit = Math.max(
      0,
      Number(newPresetPurchaseRate) || 0
    );
    const markupPercent = Math.max(0, Number(newPresetMarkupPercent) || 0);

    if (!trimmedName) return;

    const sellingRatePerUnit = calculateSellingRate(
      purchaseRatePerUnit,
      markupPercent
    );

    const newPreset: CostEstimateItemPreset = {
      id: createId('estimate-item-preset'),
      name: trimmedName,
      category: 'custom',
      defaultUnitLabel: newPresetUnit,
      purchaseRatePerUnit,
      markupPercent,
      sellingRatePerUnit,
      defaultDescription:
        newPresetDescription.trim() ||
        createDefaultDescription({
          areaName: 'selected area',
          itemName: trimmedName,
          quantity: 1,
          unitLabel: newPresetUnit,
        }),
    };

    setItemPresets(current => [...current, newPreset]);
    setNewLineItemName(newPreset.name);
    setNewLineItemUnit(newPreset.defaultUnitLabel);
    setNewLineItemRate(String(newPreset.sellingRatePerUnit));
    setNewLineItemDescription(newPreset.defaultDescription);
    setNewPresetName('');
    setNewPresetPurchaseRate('500');
    setNewPresetMarkupPercent('35');
    setNewPresetDescription('');
    setIsNewItemPresetFormOpen(false);
  };

  const handleUnitSelectionChange = (unitValue: string) => {
    if (unitValue === ADD_NEW_UNIT_ID) {
      setIsNewUnitFormOpen(true);
      return;
    }

    setNewLineItemUnit(unitValue);
  };

  const handleAddCustomUnit = () => {
    const trimmedUnit = newUnitName.trim();

    if (!trimmedUnit) return;

    const existingUnit = units.find(
      unit => unit.shortLabel.toLowerCase() === trimmedUnit.toLowerCase()
    );

    if (existingUnit) {
      setNewLineItemUnit(existingUnit.shortLabel);
      setNewUnitName('');
      setIsNewUnitFormOpen(false);
      return;
    }

    const newUnit: CostEstimateUnit = {
      id: createId('estimate-unit'),
      label: trimmedUnit,
      shortLabel: trimmedUnit,
      isCustom: true,
    };

    setUnits(current => [...current, newUnit]);
    setNewLineItemUnit(newUnit.shortLabel);
    setNewUnitName('');
    setIsNewUnitFormOpen(false);
  };

  const handleAddLineItem = () => {
    const trimmedName = newLineItemName.trim();
    const quantity = Math.max(0, Number(newLineItemQuantity) || 0);
    const ratePerUnit = Math.max(0, Number(newLineItemRate) || 0);

    if (!trimmedName || !newLineItemAreaId || quantity <= 0) return;

    setLineItems(current => [
      ...current,
      {
        id: createId('estimate-line'),
        areaId: newLineItemAreaId,
        name: trimmedName,
        description: newLineItemDescription.trim() || previewDescription,
        quantity,
        unitLabel: newLineItemUnit,
        ratePerUnit,
        remarks: newLineItemRemarks.trim() || undefined,
      },
    ]);
    setNewLineItemName('');
    setNewLineItemDescription('');
    setNewLineItemQuantity('1');
    setNewLineItemRate('500');
    setNewLineItemRemarks('');
    setStatus('draft');
  };

  const handleUpdateLineItem = (
    lineItemId: string,
    updates: Partial<CostEstimateLineItem>
  ) => {
    setLineItems(current =>
      current.map(lineItem =>
        lineItem.id === lineItemId ? { ...lineItem, ...updates } : lineItem
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
      <div className="grid gap-4 sm:gap-5">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="rounded-2xl border border-border bg-muted/30 p-3 sm:p-4">
            <p className="text-sm font-medium text-foreground">
              Future source of truth
            </p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Select areas first, then add estimate line items under each area.
              Timeline will later convert approved area groups into work packages.
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-background p-3 sm:p-4">
            <p className="text-sm font-medium text-foreground">
              Estimate Project
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Create as an unassigned draft or attach to a project without an
              existing cost estimate.
            </p>

            <select
              value={selectedProjectId}
              onChange={event => handleProjectSelectionChange(event.target.value)}
              className="mt-3 min-h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-foreground"
            >
              <option value={UNASSIGNED_PROJECT_ID}>Unassigned Draft</option>
              {availableProjectsForNewEstimate.map(project => (
                <option key={project.id} value={project.id}>
                  {getProjectLabel(project)}
                </option>
              ))}
            </select>

            <div className="mt-3 rounded-xl border border-border bg-muted/30 px-3 py-2 text-xs leading-5 text-muted-foreground">
              {selectedProject ? (
                <>
                  Linked to{' '}
                  <span className="font-medium text-foreground">
                    {selectedProject.name}
                  </span>
                  . Projects that already have a cost estimate are hidden from
                  this create list.
                </>
              ) : (
                <>
                  This estimate is currently not linked to any project. It can be
                  converted to a new or existing project later.
                </>
              )}
            </div>
          </div>
        </div>

        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 xl:grid-cols-4 [&>div]:min-w-[170px] sm:[&>div]:min-w-0 [&::-webkit-scrollbar]:hidden">
          <div className="rounded-2xl border border-border bg-background p-3 sm:p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Subtotal</p>
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
              Grand Total
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
          className={`rounded-2xl border p-3 sm:p-4 ${
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
                Estimated grand total is{' '}
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

        <div className="rounded-2xl border border-border bg-background p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">
                Area setup
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Decide which rooms or areas are included before adding line items.
              </p>
            </div>

            <p className="text-xs leading-5 text-muted-foreground sm:text-right">
              Line items are now added inside each area group below.
            </p>
          </div>

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

          <div className="mt-4 overflow-hidden rounded-2xl border border-border">
            {groupedAreas.map(group => (
              <div
                key={group.area.id}
                className="grid gap-2 border-b border-border px-3 py-2 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_110px_120px]"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {group.area.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {group.area.type.replaceAll('_', ' ')}
                  </p>
                </div>

                <p className="text-xs text-muted-foreground sm:text-right">
                  {group.lineItems.length} item(s)
                </p>

                <p className="text-sm font-semibold text-foreground sm:text-right">
                  {formatINR(group.total)}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4">
          {groupedAreas.map(group => (
            <div
              key={group.area.id}
              className="overflow-hidden rounded-2xl border border-border bg-background"
            >
              <div className="flex flex-col gap-3 border-b border-border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold text-foreground">{group.area.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {group.lineItems.length} line item(s)
                  </p>
                </div>

                <div className="flex flex-col gap-2 sm:items-end">
                  <div className="text-sm font-semibold text-foreground">
                    Area total: {formatINR(group.total)}
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleStartAreaLineItem(group.area.id)}
                    className="gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Add New Row
                  </Button>
                </div>
              </div>

              {activeLineItemAreaId === group.area.id && (
                <div className="border-b border-border bg-card/60 p-3 sm:p-4">
                  <div className="grid gap-2 sm:gap-3 xl:grid-cols-[minmax(0,1fr)_110px_110px_140px_auto]">
                    <div className="grid gap-2 sm:gap-3">
                      <div className="relative">
                        <input
                          value={newLineItemName}
                          onFocus={() => setIsItemSuggestionOpen(true)}
                          onBlur={() => {
                            window.setTimeout(() => {
                              setIsItemSuggestionOpen(false);
                            }, 120);
                          }}
                          onChange={event =>
                            handleItemNameChange(event.target.value)
                          }
                          placeholder="Type item name or search preset"
                          className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-foreground"
                        />

                        {isItemSuggestionOpen && (
                          <div className="absolute left-0 right-0 top-11 z-30 overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-lg">
                            <div className="max-h-64 overflow-y-auto p-1">
                              {matchingItemPresets.length > 0 ? (
                                matchingItemPresets.map(preset => (
                                  <button
                                    key={preset.id}
                                    type="button"
                                    onMouseDown={event => event.preventDefault()}
                                    onClick={() => applyItemPreset(preset)}
                                    className="w-full rounded-lg px-3 py-2 text-left transition hover:bg-muted"
                                  >
                                    <span className="block text-sm font-medium text-foreground">
                                      {preset.name}
                                    </span>
                                    <span className="mt-0.5 block text-xs text-muted-foreground">
                                      {preset.defaultUnitLabel} @{' '}
                                      {formatINR(preset.sellingRatePerUnit)}
                                    </span>
                                  </button>
                                ))
                              ) : (
                                <p className="px-3 py-2 text-xs text-muted-foreground">
                                  No matching preset. Keep typing to use a custom
                                  item.
                                </p>
                              )}

                              <button
                                type="button"
                                onMouseDown={event => event.preventDefault()}
                                onClick={handleOpenNewItemPresetForm}
                                className="mt-1 w-full rounded-lg border border-dashed border-border px-3 py-2 text-left text-sm font-medium text-foreground transition hover:bg-muted"
                              >
                                + Add New Item
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {isNewItemPresetFormOpen && (
                        <div className="rounded-2xl border border-border bg-muted/30 p-3">
                          <p className="text-sm font-medium text-foreground">
                            Add New Item Preset
                          </p>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">
                            This is temporary here. Later, item presets will move
                            to Procurement &gt; Items.
                          </p>

                          <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            <input
                              value={newPresetName}
                              onChange={event => setNewPresetName(event.target.value)}
                              placeholder="Item name"
                              className="min-h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-foreground"
                            />

                            <select
                              value={newPresetUnit}
                              onChange={event => setNewPresetUnit(event.target.value)}
                              className="min-h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-foreground"
                            >
                              {units.map(unit => (
                                <option key={unit.id} value={unit.shortLabel}>
                                  {unit.shortLabel}
                                </option>
                              ))}
                            </select>

                            <input
                              type="number"
                              min="0"
                              value={newPresetPurchaseRate}
                              onChange={event =>
                                setNewPresetPurchaseRate(event.target.value)
                              }
                              placeholder="Purchase rate"
                              className="min-h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-foreground"
                            />

                            <input
                              type="number"
                              min="0"
                              value={newPresetMarkupPercent}
                              onChange={event =>
                                setNewPresetMarkupPercent(event.target.value)
                              }
                              placeholder="Markup %"
                              className="min-h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-foreground"
                            />
                          </div>

                          <textarea
                            value={newPresetDescription}
                            onChange={event =>
                              setNewPresetDescription(event.target.value)
                            }
                            placeholder="Default description optional"
                            rows={2}
                            className="mt-3 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-foreground"
                          />

                          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-xs text-muted-foreground">
                              Selling rate preview:{' '}
                              <span className="font-semibold text-foreground">
                                {formatINR(
                                  calculateSellingRate(
                                    Number(newPresetPurchaseRate) || 0,
                                    Number(newPresetMarkupPercent) || 0
                                  )
                                )}
                              </span>
                            </p>

                            <div className="flex gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => setIsNewItemPresetFormOpen(false)}
                              >
                                Cancel
                              </Button>
                              <Button
                                type="button"
                                onClick={handleAddItemPreset}
                                disabled={!newPresetName.trim()}
                              >
                                Save Item
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}

                      <details className="rounded-xl border border-border bg-muted/20 p-2">
                        <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
                          More details
                        </summary>

                        <div className="mt-2 grid gap-2">
                          <textarea
                            value={newLineItemDescription || previewDescription}
                            onChange={event =>
                              setNewLineItemDescription(event.target.value)
                            }
                            rows={2}
                            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-foreground"
                          />

                          <input
                            value={newLineItemRemarks}
                            onChange={event =>
                              setNewLineItemRemarks(event.target.value)
                            }
                            placeholder="Remarks optional"
                            className="min-h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-foreground"
                          />
                        </div>
                      </details>
                    </div>

                    <input
                      type="number"
                      min="0"
                      value={newLineItemQuantity}
                      onChange={event => setNewLineItemQuantity(event.target.value)}
                      placeholder="Qty"
                      className="min-h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-foreground"
                    />

                    <div className="grid gap-2">
                      <select
                        value={newLineItemUnit}
                        onChange={event =>
                          handleUnitSelectionChange(event.target.value)
                        }
                        className="min-h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-foreground"
                      >
                        {units.map(unit => (
                          <option key={unit.id} value={unit.shortLabel}>
                            {unit.shortLabel}
                          </option>
                        ))}
                        <option value={ADD_NEW_UNIT_ID}>+ Add New Unit</option>
                      </select>

                      {isNewUnitFormOpen && (
                        <div className="rounded-xl border border-border bg-muted/30 p-2">
                          <input
                            value={newUnitName}
                            onChange={event => setNewUnitName(event.target.value)}
                            placeholder="Unit label"
                            className="min-h-9 w-full rounded-lg border border-border bg-background px-2 text-xs text-foreground outline-none transition placeholder:text-muted-foreground focus:border-foreground"
                          />
                          <div className="mt-2 flex gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => {
                                setNewUnitName('');
                                setIsNewUnitFormOpen(false);
                              }}
                              className="h-8 flex-1 px-2 text-xs"
                            >
                              Cancel
                            </Button>
                            <Button
                              type="button"
                              onClick={handleAddCustomUnit}
                              disabled={!newUnitName.trim()}
                              className="h-8 flex-1 px-2 text-xs"
                            >
                              Save
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>

                    <input
                      type="number"
                      min="0"
                      value={newLineItemRate}
                      onChange={event => setNewLineItemRate(event.target.value)}
                      placeholder="Rate/unit"
                      className="min-h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-foreground"
                    />

                    <div className="flex flex-col gap-2">
                      <div className="rounded-xl border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                        Amount:{' '}
                        <span className="font-semibold text-foreground">
                          {formatINR(
                            (Number(newLineItemQuantity) || 0) *
                              (Number(newLineItemRate) || 0)
                          )}
                        </span>
                      </div>

                      <Button
                        type="button"
                        onClick={handleAddLineItem}
                        disabled={!newLineItemName.trim() || !newLineItemAreaId}
                        className="gap-2"
                      >
                        <Plus className="h-4 w-4" />
                        Save Row
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {group.lineItems.length > 0 ? (
                <div className="grid gap-3 p-3 sm:p-4">
                  {group.lineItems.map(lineItem => (
                    <div
                      key={lineItem.id}
                      className="grid gap-3 rounded-2xl border border-border bg-card p-3 sm:p-4 xl:grid-cols-[minmax(0,1fr)_120px_120px_150px_auto]"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-foreground">{lineItem.name}</p>
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">
                          {lineItem.description}
                        </p>
                        {lineItem.vendorName && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Vendor: {lineItem.vendorName}
                          </p>
                        )}
                        {lineItem.remarks && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Remarks: {lineItem.remarks}
                          </p>
                        )}
                      </div>

                      <input
                        type="number"
                        min="0"
                        value={lineItem.quantity}
                        onChange={event =>
                          handleUpdateLineItem(lineItem.id, {
                            quantity: Number(event.target.value),
                          })
                        }
                        className="min-h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-foreground"
                      />

                      <select
                        value={lineItem.unitLabel}
                        onChange={event =>
                          handleUpdateLineItem(lineItem.id, {
                            unitLabel: event.target.value,
                          })
                        }
                        className="min-h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-foreground"
                      >
                        {units.map(unit => (
                          <option key={unit.id} value={unit.shortLabel}>
                            {unit.shortLabel}
                          </option>
                        ))}
                      </select>

                      <input
                        type="number"
                        min="0"
                        value={lineItem.ratePerUnit}
                        onChange={event =>
                          handleUpdateLineItem(lineItem.id, {
                            ratePerUnit: Number(event.target.value),
                          })
                        }
                        className="min-h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-foreground"
                      />

                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-foreground">
                          {formatINR(calculateLineItemTotal(lineItem))}
                        </p>
                        <button
                          type="button"
                          onClick={() => handleRemoveLineItem(lineItem.id)}
                          className="flex h-10 w-10 items-center justify-center rounded-lg border border-destructive/30 text-destructive transition hover:bg-destructive/10"
                          aria-label="Remove estimate line item"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="p-4 text-sm text-muted-foreground">
                  No line items added for this area yet.
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </SectionCard>
  );
}
