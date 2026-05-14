import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  FilePlus2,
  Plus,
  RefreshCcw,
  Save,
  Trash2,
} from 'lucide-react';

import { SectionCard } from '@/components/common/SectionCard';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';

import { demoProcurementItems } from '@/features/items/data';
import type { ProcurementItem } from '@/features/items/types';

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
const ITEMS_STORAGE_KEY = 'gravium-os-items-demo';

function mapProcurementItemToPreset(item: ProcurementItem): CostEstimateItemPreset {
  return {
    id: item.id,
    name: item.name,
    category: item.category,
    defaultUnitLabel: item.defaultUnitLabel,
    purchaseRatePerUnit: item.purchaseRatePerUnit,
    markupPercent: item.markupPercent,
    sellingRatePerUnit: item.sellingRatePerUnit,
    defaultDescription: item.defaultDescription,
  };
}

function getStoredItemPresets() {
  if (typeof window === 'undefined') {
    return demoProcurementItems.map(mapProcurementItemToPreset);
  }

  try {
    const storedItems = localStorage.getItem(ITEMS_STORAGE_KEY);

    if (!storedItems) {
      return demoProcurementItems.map(mapProcurementItemToPreset);
    }

    const parsedItems = JSON.parse(storedItems);

    if (!Array.isArray(parsedItems)) {
      return demoProcurementItems.map(mapProcurementItemToPreset);
    }

    const validItems = parsedItems.filter(item => {
      return (
        item &&
        typeof item.id === 'string' &&
        typeof item.name === 'string' &&
        typeof item.category === 'string' &&
        typeof item.defaultUnitLabel === 'string' &&
        typeof item.purchaseRatePerUnit === 'number' &&
        typeof item.markupPercent === 'number' &&
        typeof item.sellingRatePerUnit === 'number' &&
        typeof item.defaultDescription === 'string' &&
        item.status === 'active'
      );
    }) as ProcurementItem[];

    return validItems.map(mapProcurementItemToPreset);
  } catch {
    return demoProcurementItems.map(mapProcurementItemToPreset);
  }
}

function saveItemPresetsToItemsMaster(presets: CostEstimateItemPreset[]) {
  if (typeof window === 'undefined') return;

  const items: ProcurementItem[] = presets.map(preset => ({
    id: preset.id,
    name: preset.name,
    category: preset.category,
    defaultUnitLabel: preset.defaultUnitLabel,
    purchaseRatePerUnit: preset.purchaseRatePerUnit,
    markupPercent: preset.markupPercent,
    sellingRatePerUnit: preset.sellingRatePerUnit,
    defaultDescription: preset.defaultDescription,
    status: 'active',
    updatedAt: new Date().toISOString(),
  }));

  localStorage.setItem(ITEMS_STORAGE_KEY, JSON.stringify(items));
}

interface CostEstimateSavePayload {
  grandTotal: number;
  status: 'draft' | 'approved' | 'revision';
  version: number;
  areas: CostEstimateArea[];
  lineItems: CostEstimateLineItem[];
  serviceChargePercent: number;
  miscChargePercent: number;
  targetProjectRevenue: number;
}

interface CostEstimateSectionProps {
  initialAreas?: CostEstimateArea[];
  initialLineItems?: CostEstimateLineItem[];
  initialProjectId?: string;
  initialStatus?: 'draft' | 'approved' | 'revision';
  initialVersion?: number;
  initialServiceChargePercent?: number;
  initialMiscChargePercent?: number;
  initialTargetProjectRevenue?: number;
  isHistoricalView?: boolean;
  onViewApprovedVersion?: () => void;
  onSaveDraft?: (payload: CostEstimateSavePayload) => void;
  onApproveEstimate?: (payload: CostEstimateSavePayload) => void;
  onCreateRevision?: (payload: CostEstimateSavePayload) => void;
  onDeleteDraft?: () => void;
  onSaveAndClose?: (payload: CostEstimateSavePayload) => void;
}

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

export function CostEstimateSection({
  initialAreas,
  initialLineItems,
  initialProjectId,
  initialStatus,
  initialVersion,
  initialServiceChargePercent,
  initialMiscChargePercent,
  initialTargetProjectRevenue,
  isHistoricalView,
  onViewApprovedVersion,
  onSaveDraft,
  onApproveEstimate,
  onCreateRevision,
  onDeleteDraft,
  onSaveAndClose,
}: CostEstimateSectionProps) {
  const initialAreaList =
    initialAreas && initialAreas.length > 0 ? initialAreas : demoCostEstimateAreas;
  const initialPrimaryAreaId = initialAreaList[0]?.id ?? '';
  const [status, setStatus] = useState<CostEstimateStatus>(
    initialStatus === 'approved' ? 'approved' : 'draft'
  );
  const [hasSavedEstimate, setHasSavedEstimate] = useState(
    initialStatus === 'approved' || initialStatus === 'revision'
  );
  const [isEditingEstimate, setIsEditingEstimate] = useState(
    initialStatus !== 'approved'
  );
  const [estimateVersion, setEstimateVersion] = useState(initialVersion ?? 1);
  const [isRevisionDraft, setIsRevisionDraft] = useState(
    initialStatus === 'revision'
  );
  const [supersededVersions, setSupersededVersions] = useState<number[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState(
    initialProjectId ?? UNASSIGNED_PROJECT_ID
  );
  const [isSaveMenuOpen, setIsSaveMenuOpen] = useState(false);
  const saveMenuRef = useRef<HTMLDivElement | null>(null);
  const [areas, setAreas] = useState<CostEstimateArea[]>(initialAreaList);
  const [lineItems, setLineItems] = useState<CostEstimateLineItem[]>(
    initialLineItems ?? []
  );
  const [units, setUnits] = useState<CostEstimateUnit[]>(defaultCostEstimateUnits);
  const [itemPresets, setItemPresets] = useState<CostEstimateItemPreset[]>(
    () => getStoredItemPresets()
  );
  const [serviceChargePercent, setServiceChargePercent] = useState<number | ''>(
    initialServiceChargePercent ?? DEFAULT_SERVICE_CHARGE_PERCENT
  );
  const [miscChargePercent, setMiscChargePercent] = useState<number | ''>(
    initialMiscChargePercent ?? DEFAULT_MISC_CHARGE_PERCENT
  );
  const [targetProjectRevenue, setTargetProjectRevenue] = useState<number | ''>(
    initialTargetProjectRevenue ?? 950000
  );
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
    initialPrimaryAreaId
  );
  const [activeLineItemAreaId, setActiveLineItemAreaId] = useState(
    initialPrimaryAreaId
  );
  const [newLineItemName, setNewLineItemName] = useState('');
  const [newLineItemDescription, setNewLineItemDescription] = useState('');
  const [newLineItemQuantity, setNewLineItemQuantity] = useState('1');
  const [newLineItemUnit, setNewLineItemUnit] = useState('sqft');
  const [newLineItemRate, setNewLineItemRate] = useState('500');
  const [newLineItemRemarks, setNewLineItemRemarks] = useState('');

  const numericServiceChargePercent =
    serviceChargePercent === '' ? 0 : serviceChargePercent;
  const numericMiscChargePercent = miscChargePercent === '' ? 0 : miscChargePercent;
  const numericTargetProjectRevenue =
    targetProjectRevenue === '' ? 0 : targetProjectRevenue;

  const summary = useMemo(
    () =>
      calculateCostEstimateSummary({
        lineItems,
        serviceChargePercent: numericServiceChargePercent,
        miscChargePercent: numericMiscChargePercent,
        gstPercent: DEFAULT_GST_PERCENT,
        targetProjectRevenue: numericTargetProjectRevenue,
      }),
    [
      lineItems,
      numericMiscChargePercent,
      numericServiceChargePercent,
      numericTargetProjectRevenue,
    ]
  );

  const selectedAreaName = getAreaName(areas, newLineItemAreaId);
  const previewDescription = createDefaultDescription({
    areaName: selectedAreaName,
    itemName: newLineItemName,
    quantity: Number(newLineItemQuantity) || 0,
    unitLabel: newLineItemUnit,
  });
  const shouldShowLineItemDetails = newLineItemName.trim().length > 0;

  const availableProjectsForNewEstimate = demoCostEstimateProjects.filter(
    project => !project.hasCostEstimate || project.id === selectedProjectId
  );
  const selectedProject =
    demoCostEstimateProjects.find(project => project.id === selectedProjectId) ??
    undefined;
  const isEstimateApproved = status === 'approved';
  const isEstimateReadOnly = isEstimateApproved && !isEditingEstimate;
  const estimateStatusLabel =
    status === 'approved'
      ? `Approved - v${estimateVersion} Active`
      : isRevisionDraft
        ? `Revision Draft - v${estimateVersion}${hasSavedEstimate ? ' Saved' : ''}`
        : hasSavedEstimate
          ? 'Draft - Saved'
          : 'Draft';
  const saveButtonLabel = isRevisionDraft
    ? hasSavedEstimate
      ? 'Saved Revision'
      : 'Save Revision'
    : hasSavedEstimate
      ? 'Saved'
      : 'Save Draft';
  const deleteButtonLabel = isRevisionDraft ? 'Delete Revision' : 'Delete Draft';
  const approvalButtonLabel =
    status === 'approved'
      ? 'Approved'
      : !hasSavedEstimate
        ? 'Save Draft First'
        : isRevisionDraft
          ? 'Approve Revision'
          : 'Approve Estimate';

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

  useEffect(() => {
    if (!isSaveMenuOpen) return;

    const handleDocumentMouseDown = (event: MouseEvent) => {
      const target = event.target as Node | null;

      if (target && saveMenuRef.current?.contains(target)) return;

      setIsSaveMenuOpen(false);
    };

    document.addEventListener('mousedown', handleDocumentMouseDown);

    return () => {
      document.removeEventListener('mousedown', handleDocumentMouseDown);
    };
  }, [isSaveMenuOpen]);

  const markEstimateDirty = () => {
    setStatus('draft');
    setHasSavedEstimate(false);
    setIsEditingEstimate(true);
  };

  const createSavePayload = (
    nextStatus: 'draft' | 'approved' | 'revision',
    nextVersion = estimateVersion
  ): CostEstimateSavePayload => ({
    grandTotal: summary.estimatedGrossRevenue,
    status: nextStatus,
    version: nextVersion,
    areas,
    lineItems,
    serviceChargePercent: numericServiceChargePercent,
    miscChargePercent: numericMiscChargePercent,
    targetProjectRevenue: numericTargetProjectRevenue,
  });

  const handleSaveDraft = () => {
    const nextStatus = isRevisionDraft ? 'revision' : 'draft';

    setHasSavedEstimate(true);
    setIsEditingEstimate(true);
    setStatus('draft');

    onSaveDraft?.(createSavePayload(nextStatus));
  };

  const handleSaveAndClose = () => {
    const nextStatus = isRevisionDraft ? 'revision' : status;

    setHasSavedEstimate(true);
    setIsEditingEstimate(true);

    onSaveAndClose?.(createSavePayload(nextStatus));
  };

  const handleDeleteDraft = () => {
    const confirmed = window.confirm(
      isRevisionDraft
        ? 'Delete this revision draft? This will remove the revision estimate.'
        : 'Delete this draft estimate? This will remove the estimate.'
    );

    if (!confirmed) return;

    if (onDeleteDraft) {
      onDeleteDraft();
      return;
    }

    setStatus('draft');
    setHasSavedEstimate(false);
    setIsEditingEstimate(true);
    setEstimateVersion(1);
    setIsRevisionDraft(false);
    setSupersededVersions([]);
    setSelectedProjectId(UNASSIGNED_PROJECT_ID);
    setAreas(initialAreaList);
    setLineItems([]);
    setServiceChargePercent(DEFAULT_SERVICE_CHARGE_PERCENT);
    setMiscChargePercent(DEFAULT_MISC_CHARGE_PERCENT);
    setTargetProjectRevenue(950000);
    setNewAreaName('');
    setNewLineItemAreaId(initialPrimaryAreaId);
    setActiveLineItemAreaId(initialPrimaryAreaId);
    setNewLineItemName('');
    setNewLineItemDescription('');
    setNewLineItemQuantity('1');
    setNewLineItemUnit('sqft');
    setNewLineItemRate('500');
    setNewLineItemRemarks('');
  };

  const handleCreateRevision = () => {
    const confirmed = window.confirm(
      'Create a revision draft from this approved estimate? The current approved version will stay locked until the revision is approved.'
    );

    if (!confirmed) return;

    const nextVersion = estimateVersion + 1;

    setStatus('draft');
    setIsEditingEstimate(true);
    setHasSavedEstimate(false);
    setIsRevisionDraft(true);
    setEstimateVersion(nextVersion);

    onCreateRevision?.(createSavePayload('revision', nextVersion));
  };

  const handleProjectSelectionChange = (projectId: string) => {
    setSelectedProjectId(projectId);
    markEstimateDirty();
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
    markEstimateDirty();
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
    markEstimateDirty();
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

    setItemPresets(current => {
      const nextPresets = [...current, newPreset];
      saveItemPresetsToItemsMaster(nextPresets);
      return nextPresets;
    });
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
    markEstimateDirty();
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
    markEstimateDirty();
  };

  const handleRemoveLineItem = (lineItemId: string) => {
    setLineItems(current =>
      current.filter(lineItem => lineItem.id !== lineItemId)
    );
    markEstimateDirty();
  };

  const handleUpdateRevenue = () => {
    setTargetProjectRevenue(summary.estimatedGrossRevenue);
    markEstimateDirty();
  };

  const handleApproveEstimate = () => {
    if (!summary.isRevenueMatched || !hasSavedEstimate) return;

    if (isRevisionDraft && estimateVersion > 1) {
      setSupersededVersions(currentVersions => [
        ...new Set([...currentVersions, estimateVersion - 1]),
      ]);
    }

    setStatus('approved');
    setHasSavedEstimate(true);
    setIsRevisionDraft(false);
    setIsEditingEstimate(false);

    onApproveEstimate?.(createSavePayload('approved'));
  };

  return (
    <SectionCard
      title={
        <div className="flex items-center gap-2">
          <span>Cost Estimate</span>
          <StatusBadge variant={status === 'approved' ? 'success' : 'warning'}>
            {estimateStatusLabel}
          </StatusBadge>
        </div>
      }
      description="Project-level estimate source for execution scope, COGS, pricing, GST, and future timeline generation."
      actions={
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {status === 'approved' ? (
            isHistoricalView ? null : (
              <Button
                type="button"
                variant="outline"
                onClick={handleCreateRevision}
                className="gap-2"
              >
                <FilePlus2 className="h-4 w-4" />
                Create Revision
              </Button>
            )
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              {isRevisionDraft && onViewApprovedVersion && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onViewApprovedVersion}
                  className="h-10 gap-2"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  View Approved
                </Button>
              )}

              <div
                ref={saveMenuRef}
                className="relative inline-flex h-10 min-w-0 items-stretch"
              >
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSaveDraft}
                  className="h-10 rounded-r-none border-r-0 bg-background text-foreground hover:bg-muted gap-2"
                >
                  <Save className="h-4 w-4" />
                  {saveButtonLabel}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsSaveMenuOpen(current => !current)}
                  className="h-10 rounded-l-none rounded-r-lg border-l-0 bg-background px-3 text-foreground hover:bg-muted"
                  aria-label="Open save options"
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>

                {isSaveMenuOpen && (
                  <div className="absolute right-0 top-11 z-[100] w-max overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-lg">
                    <button
                      type="button"
                      onMouseDown={event => event.preventDefault()}
                      onClick={() => {
                        setIsSaveMenuOpen(false);
                        handleSaveAndClose();
                      }}
                      className="whitespace-nowrap px-3 py-2 text-left text-sm transition hover:bg-muted"
                    >
                      Save and Close
                    </button>
                  </div>
                )}
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={handleDeleteDraft}
                className="h-10 gap-2 text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
                {deleteButtonLabel}
              </Button>
            </div>
          )}
        </div>
      }
    >
      <fieldset
        disabled={isEstimateReadOnly}
        className="grid gap-4 disabled:opacity-75 sm:gap-5"
      >
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

        {supersededVersions.length > 0 && (
          <div className="rounded-2xl border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
            Superseded versions:{' '}
            <span className="font-medium text-foreground">
              {supersededVersions.map(version => `v${version}`).join(', ')}
            </span>
          </div>
        )}

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
                const nextValue = event.target.value;

                setServiceChargePercent(nextValue === '' ? '' : Number(nextValue));
                markEstimateDirty();
              }}
              className="h-10 min-h-0 self-center rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-foreground"
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
                const nextValue = event.target.value;

                setMiscChargePercent(nextValue === '' ? '' : Number(nextValue));
                markEstimateDirty();
              }}
              className="h-10 min-h-0 self-center rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-foreground"
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
                const nextValue = event.target.value;

                setTargetProjectRevenue(nextValue === '' ? '' : Number(nextValue));
                markEstimateDirty();
              }}
              className="h-10 min-h-0 self-center rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-foreground"
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
                disabled={
                  !hasSavedEstimate ||
                  !summary.isRevenueMatched ||
                  status === 'approved'
                }
                className="gap-2"
              >
                <CheckCircle2 className="h-4 w-4" />
                {approvalButtonLabel}
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
              className="overflow-visible rounded-2xl border border-border bg-background"
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
                  <div className="grid gap-2 sm:gap-3 xl:grid-cols-[minmax(0,1fr)_120px_160px_160px_150px] xl:items-center xl:gap-4 2xl:gap-5">
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
                          <div className="absolute left-0 right-0 top-11 z-50 overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-lg">
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
                              className="h-10 min-h-0 self-center rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-foreground"
                            />

                            <select
                              value={newPresetUnit}
                              onChange={event => setNewPresetUnit(event.target.value)}
                              className="h-10 min-h-0 self-center rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-foreground"
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
                              className="h-10 min-h-0 self-center rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-foreground"
                            />

                            <input
                              type="number"
                              min="0"
                              value={newPresetMarkupPercent}
                              onChange={event =>
                                setNewPresetMarkupPercent(event.target.value)
                              }
                              placeholder="Markup %"
                              className="h-10 min-h-0 self-center rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-foreground"
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

                      {shouldShowLineItemDetails && (
                        <div className="grid gap-2">
                          <textarea
                            value={newLineItemDescription || previewDescription}
                            onChange={event =>
                              setNewLineItemDescription(event.target.value)
                            }
                            rows={2}
                            placeholder="Description"
                            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-foreground"
                          />

                          <input
                            value={newLineItemRemarks}
                            onChange={event =>
                              setNewLineItemRemarks(event.target.value)
                            }
                            placeholder="Remarks optional"
                            className="h-10 min-h-0 self-center rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-foreground"
                          />
                        </div>
                      )}
                    </div>

                    <input
                      type="number"
                      min="0"
                      value={newLineItemQuantity}
                      onChange={event => {
                        setNewLineItemQuantity(event.target.value);
                        markEstimateDirty();
                      }}
                      placeholder="Qty"
                      className="h-10 w-full min-w-0 self-center rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-foreground"
                    />

                    <div className="min-w-0 self-center">
                      <select
                        value={newLineItemUnit}
                        onChange={event =>
                          handleUnitSelectionChange(event.target.value)
                        }
                        className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-foreground"
                      >
                        {units.map(unit => (
                          <option key={unit.id} value={unit.shortLabel}>
                            {unit.shortLabel}
                          </option>
                        ))}
                        <option value={ADD_NEW_UNIT_ID}>+ Add New Unit</option>
                      </select>

                      {isNewUnitFormOpen && (
                        <div className="mt-2 rounded-xl border border-border bg-muted/30 p-2">
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
                      onChange={event => {
                        setNewLineItemRate(event.target.value);
                        markEstimateDirty();
                      }}
                      placeholder="Rate/unit"
                      className="h-10 w-full min-w-0 self-center rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-foreground"
                    />

                    <div className="flex min-w-0 flex-col gap-2 self-center">
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
                      className="grid gap-3 rounded-2xl border border-border bg-card p-3 sm:p-4 xl:grid-cols-[minmax(0,1fr)_120px_160px_160px_auto] xl:items-center xl:gap-4 2xl:gap-5"
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
                        className="h-10 min-h-0 self-center rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-foreground"
                      />

                      <select
                        value={lineItem.unitLabel}
                        onChange={event =>
                          handleUpdateLineItem(lineItem.id, {
                            unitLabel: event.target.value,
                          })
                        }
                        className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-foreground"
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
                        className="h-10 min-h-0 self-center rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-foreground"
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
      </fieldset>
    </SectionCard>
  );
}
