import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUp,
  Check,
  CheckCircle2,
  ChevronDown,
  FilePlus2,
  Minus,
  Plus,
  RefreshCcw,
  Save,
  Trash2,
} from 'lucide-react';

import { SectionCard } from '@/components/common/SectionCard';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';

import type { ProcurementItem } from '@/features/items/types';
import { vendorCategoryLabels } from '@/features/vendors/data';

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

function createItemMasterDefaultDescription(itemName: string) {
  const trimmedName = itemName.trim();

  if (!trimmedName) return '';

  const parts = trimmedName
    .split('|')
    .map(part => part.trim())
    .filter(Boolean);

  const baseName = parts[0] ?? trimmedName;
  const materialType = parts[1];

  if (materialType) {
    return `Supply and installation of ${baseName} using ${materialType} as per approved design and site measurements.`;
  }

  return `Supply and installation of ${baseName} as per approved design and site measurements.`;
}
function createEstimateLineItemDescription({
  areaName,
  itemDescription,
}: {
  areaName: string;
  itemDescription: string;
}) {
  const cleanAreaName = areaName.trim() || 'Selected Area';
  const cleanItemDescription = itemDescription.trim().replace(/\.$/, '');

  if (!cleanItemDescription) return '';

  return `For ${cleanAreaName}, ${cleanItemDescription}. Includes labour charges, required fittings, fixing materials, alignment, finishing touch-ups, and final site installation.`;
}


const UNASSIGNED_PROJECT_ID = 'unassigned-draft';
const ITEMS_STORAGE_KEY = 'gravium-os-items';
const LEGACY_ITEMS_STORAGE_KEY = 'gravium-os-items-demo';
const PROCUREMENT_CATEGORIES_STORAGE_KEY =
  'gravium-os-procurement-categories-demo';
const PROCUREMENT_UNITS_STORAGE_KEY = 'gravium-os-procurement-units-demo';

interface ProcurementCategoryOption {
  value: string;
  label: string;
}

function getDefaultCategoryOptions(): ProcurementCategoryOption[] {
  return [
    { value: 'custom', label: 'Custom' },
    ...Object.entries(vendorCategoryLabels).map(([value, label]) => ({
      value,
      label,
    })),
  ];
}

function formatProcurementCategoryLabel(value: string) {
  return value
    .trim()
    .replaceAll('_', ' ')
    .replace(/\b\w/g, letter => letter.toUpperCase());
}

function normalizeProcurementCategoryValue(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, '_');
}

function createProcurementCategoryOption(value: string): ProcurementCategoryOption {
  const trimmedValue = value.trim();

  return {
    value: normalizeProcurementCategoryValue(trimmedValue),
    label: formatProcurementCategoryLabel(trimmedValue),
  };
}

function saveProcurementCategoryOptions(options: ProcurementCategoryOption[]) {
  if (typeof window === 'undefined') return;

  localStorage.setItem(
    PROCUREMENT_CATEGORIES_STORAGE_KEY,
    JSON.stringify(options.filter(option => option.value !== 'all'))
  );
}

function getProcurementCategoryLabel(
  options: ProcurementCategoryOption[],
  value: string
) {
  return (
    options.find(option => option.value === value)?.label ??
    formatProcurementCategoryLabel(value)
  );
}

function getStoredCategoryOptions() {
  if (typeof window === 'undefined') return getDefaultCategoryOptions();

  try {
    const storedCategories = localStorage.getItem(
      PROCUREMENT_CATEGORIES_STORAGE_KEY
    );

    if (!storedCategories) return getDefaultCategoryOptions();

    const parsedCategories = JSON.parse(storedCategories);

    if (!Array.isArray(parsedCategories)) return getDefaultCategoryOptions();

    const optionMap = new Map<string, string>();

    getDefaultCategoryOptions().forEach(option => {
      optionMap.set(option.value, option.label);
    });

    parsedCategories.forEach(option => {
      if (
        option &&
        typeof option.value === 'string' &&
        typeof option.label === 'string' &&
        option.value !== 'all'
      ) {
        optionMap.set(option.value, option.label);
      }
    });

    return Array.from(optionMap, ([value, label]) => ({ value, label }));
  } catch {
    return getDefaultCategoryOptions();
  }
}

function getStoredCostEstimateUnits() {
  if (typeof window === 'undefined') return defaultCostEstimateUnits;

  try {
    const storedUnits = localStorage.getItem(PROCUREMENT_UNITS_STORAGE_KEY);

    if (!storedUnits) return defaultCostEstimateUnits;

    const parsedUnits = JSON.parse(storedUnits);

    if (!Array.isArray(parsedUnits)) return defaultCostEstimateUnits;

    const unitMap = new Map<string, CostEstimateUnit>();

    defaultCostEstimateUnits.forEach(unit => {
      unitMap.set(unit.shortLabel.toLowerCase(), unit);
    });

    parsedUnits.forEach(option => {
      if (
        option &&
        typeof option.value === 'string' &&
        typeof option.label === 'string'
      ) {
        const shortLabel = option.value.trim();

        if (!shortLabel) return;

        unitMap.set(shortLabel.toLowerCase(), {
          id: `unit-${shortLabel.toLowerCase().replace(/\s+/g, '-')}`,
          label: option.label.trim() || shortLabel,
          shortLabel,
          isCustom: !defaultCostEstimateUnits.some(
            unit => unit.shortLabel.toLowerCase() === shortLabel.toLowerCase()
          ),
        });
      }
    });

    return Array.from(unitMap.values());
  } catch {
    return defaultCostEstimateUnits;
  }
}

function saveCostEstimateUnitsToStorage(units: CostEstimateUnit[]) {
  if (typeof window === 'undefined') return;

  localStorage.setItem(
    PROCUREMENT_UNITS_STORAGE_KEY,
    JSON.stringify(
      units.map(unit => ({
        value: unit.shortLabel,
        label: unit.shortLabel,
      }))
    )
  );
}

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

function getValidProcurementItemsFromStorage(rawItems: string | null) {
  if (!rawItems) return [];

  const parsedItems = JSON.parse(rawItems);

  if (!Array.isArray(parsedItems)) return [];

  return parsedItems.filter(item => {
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
      ['active', 'inactive'].includes(item.status)
    );
  }) as ProcurementItem[];
}

function getStoredItemPresets() {
  if (typeof window === 'undefined') return [];

  try {
    const storedItems = getValidProcurementItemsFromStorage(
      localStorage.getItem(ITEMS_STORAGE_KEY)
    );

    if (storedItems.length > 0) {
      return storedItems
        .filter(item => item.status === 'active')
        .map(mapProcurementItemToPreset);
    }

    const legacyItems = getValidProcurementItemsFromStorage(
      localStorage.getItem(LEGACY_ITEMS_STORAGE_KEY)
    );

    if (legacyItems.length > 0) {
      localStorage.setItem(ITEMS_STORAGE_KEY, JSON.stringify(legacyItems));

      return legacyItems
        .filter(item => item.status === 'active')
        .map(mapProcurementItemToPreset);
    }

    return [];
  } catch {
    return [];
  }
}

function saveItemPresetToItemsMaster(preset: CostEstimateItemPreset) {
  if (typeof window === 'undefined') return;

  let currentItems: ProcurementItem[] = [];

  try {
    currentItems = getValidProcurementItemsFromStorage(
      localStorage.getItem(ITEMS_STORAGE_KEY)
    );

    if (currentItems.length === 0) {
      currentItems = getValidProcurementItemsFromStorage(
        localStorage.getItem(LEGACY_ITEMS_STORAGE_KEY)
      );
    }
  } catch {
    currentItems = [];
  }

  const nextItem: ProcurementItem = {
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
  };

  const nextItems = [
    nextItem,
    ...currentItems.filter(item => {
      return (
        item.id !== nextItem.id &&
        item.name.trim().toLowerCase() !== nextItem.name.trim().toLowerCase()
      );
    }),
  ];

  localStorage.setItem(ITEMS_STORAGE_KEY, JSON.stringify(nextItems));
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

interface CostEstimateConfirmDialog {
  title: string;
  message: string;
  confirmLabel: string;
  tone: 'default' | 'destructive';
  onConfirm: () => void;
}

interface CostEstimateSectionProps {
  initialAreas?: CostEstimateArea[];
  initialLineItems?: CostEstimateLineItem[];
  initialProjectId?: string;
  projectOptions?: CostEstimateProject[];
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
  projectOptions = [],
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
  const [isProjectSelectorOpen, setIsProjectSelectorOpen] = useState(false);
  const isProjectLinkedEstimate = Boolean(initialProjectId);
  const estimateTopRef = useRef<HTMLDivElement | null>(null);
  const [isSaveMenuOpen, setIsSaveMenuOpen] = useState(false);
  const saveMenuRef = useRef<HTMLDivElement | null>(null);
  const [isBottomSaveMenuOpen, setIsBottomSaveMenuOpen] = useState(false);
  const bottomSaveMenuRef = useRef<HTMLDivElement | null>(null);
  const [confirmDialog, setConfirmDialog] =
    useState<CostEstimateConfirmDialog | null>(null);
  const [areas, setAreas] = useState<CostEstimateArea[]>(initialAreaList);
  const [lineItems, setLineItems] = useState<CostEstimateLineItem[]>(
    initialLineItems ?? []
  );
  const [units, setUnits] = useState<CostEstimateUnit[]>(
    () => getStoredCostEstimateUnits()
  );
  const [itemPresets, setItemPresets] = useState<CostEstimateItemPreset[]>(
    () => getStoredItemPresets()
  );
  const [itemCategoryOptions, setItemCategoryOptions] = useState(() =>
    getStoredCategoryOptions()
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
  const [newPresetCategory, setNewPresetCategory] = useState('custom');
  const [newPresetCategoryQuery, setNewPresetCategoryQuery] = useState('');
  const [isNewPresetCategoryOpen, setIsNewPresetCategoryOpen] = useState(false);
  const [newPresetUnit, setNewPresetUnit] = useState('sqft');
  const [newPresetUnitQuery, setNewPresetUnitQuery] = useState('');
  const [isNewPresetUnitOpen, setIsNewPresetUnitOpen] = useState(false);
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
  const [newLineItemUnitQuery, setNewLineItemUnitQuery] = useState('');
  const [isNewLineItemUnitOpen, setIsNewLineItemUnitOpen] = useState(false);
  const [savedRowUnitDropdownId, setSavedRowUnitDropdownId] = useState<string | null>(null);
  const [savedRowUnitQuery, setSavedRowUnitQuery] = useState('');
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
  const newPresetCategorySearchValue = newPresetCategoryQuery
    .trim()
    .toLowerCase();
  const matchingNewPresetCategoryOptions = newPresetCategorySearchValue
    ? itemCategoryOptions.filter(option =>
        option.label.toLowerCase().includes(newPresetCategorySearchValue)
      )
    : itemCategoryOptions;
  const selectedNewPresetCategoryLabel = getProcurementCategoryLabel(
    itemCategoryOptions,
    newPresetCategory
  );
  const newLineItemUnitSearchValue = newLineItemUnitQuery
    .trim()
    .toLowerCase();
  const matchingLineItemUnitOptions = newLineItemUnitSearchValue
    ? units.filter(unit =>
        unit.shortLabel.toLowerCase().includes(newLineItemUnitSearchValue)
      )
    : units;
  const newPresetUnitSearchValue = newPresetUnitQuery.trim().toLowerCase();
  const matchingNewPresetUnitOptions = newPresetUnitSearchValue
    ? units.filter(unit =>
        unit.shortLabel.toLowerCase().includes(newPresetUnitSearchValue)
      )
    : units;
  const canAddNewPresetUnit =
    newPresetUnitQuery.trim().length > 0 &&
    !units.some(
      unit =>
        unit.shortLabel.toLowerCase() ===
        newPresetUnitQuery.trim().toLowerCase()
    );

  const registerNewPresetUnit = (value: string) => {
    const trimmedUnit = value.trim();

    if (!trimmedUnit) return newPresetUnit;

    const existingUnit = units.find(
      unit => unit.shortLabel.toLowerCase() === trimmedUnit.toLowerCase()
    );

    if (existingUnit) {
      setNewPresetUnit(existingUnit.shortLabel);
      setNewPresetUnitQuery('');
      setIsNewPresetUnitOpen(false);
      return existingUnit.shortLabel;
    }

    const newUnit: CostEstimateUnit = {
      id: createId('estimate-unit'),
      label: trimmedUnit,
      shortLabel: trimmedUnit,
      isCustom: true,
    };

    setUnits(current => {
      const nextUnits = [...current, newUnit];
      saveCostEstimateUnitsToStorage(nextUnits);
      return nextUnits;
    });
    setNewPresetUnit(newUnit.shortLabel);
    setNewPresetUnitQuery('');
    setIsNewPresetUnitOpen(false);

    return newUnit.shortLabel;
  };

  const canAddNewLineItemUnit =
    newLineItemUnitQuery.trim().length > 0 &&
    !units.some(
      unit =>
        unit.shortLabel.toLowerCase() ===
        newLineItemUnitQuery.trim().toLowerCase()
    );

  const registerLineItemUnit = (value: string) => {
    const trimmedUnit = value.trim();

    if (!trimmedUnit) return newLineItemUnit;

    const existingUnit = units.find(
      unit => unit.shortLabel.toLowerCase() === trimmedUnit.toLowerCase()
    );

    if (existingUnit) {
      setNewLineItemUnit(existingUnit.shortLabel);
      setNewLineItemUnitQuery('');
      setIsNewLineItemUnitOpen(false);
      return existingUnit.shortLabel;
    }

    const newUnit: CostEstimateUnit = {
      id: createId('estimate-unit'),
      label: trimmedUnit,
      shortLabel: trimmedUnit,
      isCustom: true,
    };

    setUnits(current => {
      const nextUnits = [...current, newUnit];
      saveCostEstimateUnitsToStorage(nextUnits);
      return nextUnits;
    });
    setNewLineItemUnit(newUnit.shortLabel);
    setNewLineItemUnitQuery('');
    setIsNewLineItemUnitOpen(false);

    return newUnit.shortLabel;
  };

  const canAddNewPresetCategory =
    newPresetCategoryQuery.trim().length > 0 &&
    !itemCategoryOptions.some(
      option =>
        option.label.toLowerCase() ===
        newPresetCategoryQuery.trim().toLowerCase()
    );

  const registerNewPresetCategory = (value: string) => {
    const option = createProcurementCategoryOption(value);

    setItemCategoryOptions(currentOptions => {
      const exists = currentOptions.some(
        currentOption => currentOption.value === option.value
      );

      if (exists) return currentOptions;

      const nextOptions = [...currentOptions, option];
      saveProcurementCategoryOptions(nextOptions);
      return nextOptions;
    });

    setNewPresetCategory(option.value);
    setNewPresetCategoryQuery('');
    setIsNewPresetCategoryOpen(false);

    return option.value;
  };

  const shouldShowLineItemDetails = newLineItemName.trim().length > 0;

  const availableProjectsForNewEstimate = projectOptions.filter(
    project => !project.hasCostEstimate || project.id === selectedProjectId
  );
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
    if (!isSaveMenuOpen && !isBottomSaveMenuOpen) return;

    const handleDocumentMouseDown = (event: MouseEvent) => {
      const target = event.target as Node | null;

      if (target && saveMenuRef.current?.contains(target)) return;
      if (target && bottomSaveMenuRef.current?.contains(target)) return;

      setIsSaveMenuOpen(false);
      setIsBottomSaveMenuOpen(false);
    };

    document.addEventListener('mousedown', handleDocumentMouseDown);

    return () => {
      document.removeEventListener('mousedown', handleDocumentMouseDown);
    };
  }, [isBottomSaveMenuOpen, isSaveMenuOpen]);

  const markEstimateDirty = () => {
    setStatus('draft');
    setHasSavedEstimate(false);
    setIsEditingEstimate(true);
  };

  const handleBackToEstimateTop = () => {
    estimateTopRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
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

  const executeDeleteDraft = () => {
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

  const handleDeleteDraft = () => {
    setConfirmDialog({
      title: isRevisionDraft ? 'Delete revision draft?' : 'Delete draft estimate?',
      message: isRevisionDraft
        ? 'This will remove the revision draft and restore the approved estimate if one exists.'
        : 'This will remove this draft estimate. This action cannot be undone.',
      confirmLabel: isRevisionDraft ? 'Delete Revision' : 'Delete Draft',
      tone: 'destructive',
      onConfirm: executeDeleteDraft,
    });
  };

  const executeCreateRevision = () => {
    const nextVersion = estimateVersion + 1;

    setStatus('draft');
    setIsEditingEstimate(true);
    setHasSavedEstimate(false);
    setIsRevisionDraft(true);
    setEstimateVersion(nextVersion);

    onCreateRevision?.(createSavePayload('revision', nextVersion));
  };

  const handleCreateRevision = () => {
    setConfirmDialog({
      title: 'Create revision draft?',
      message:
        'The current approved version will stay locked while you prepare a new revision draft.',
      confirmLabel: 'Create Revision',
      tone: 'default',
      onConfirm: executeCreateRevision,
    });
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

  const normalizeBedroomBathroomMasters = (currentAreas: CostEstimateArea[]) => {
    const hasMasterBedroom = currentAreas.some(
      area => area.name.trim().toLowerCase() === 'master bedroom'
    );
    const hasMasterBathroom = currentAreas.some(
      area => area.name.trim().toLowerCase() === 'master bathroom'
    );

    let didRenameBedroom = hasMasterBedroom;
    let didRenameBathroom = hasMasterBathroom;

    return currentAreas.map(area => {
      const areaName = area.name.trim().toLowerCase();

      if (!didRenameBedroom && area.type === 'bedroom') {
        didRenameBedroom = true;
        return { ...area, name: 'Master Bedroom' };
      }

      if (
        !didRenameBathroom &&
        area.type === 'bathroom' &&
        (areaName.includes('attached bathroom') || areaName === 'bathroom')
      ) {
        didRenameBathroom = true;
        return { ...area, name: 'Master Bathroom' };
      }

      return area;
    });
  };

  const getNextBedroomNumber = (currentAreas: CostEstimateArea[]) =>
    currentAreas.filter(area => /^bedroom\s+\d+$/i.test(area.name.trim()))
      .length + 1;

  const getNextAttachedBathroomNumber = (currentAreas: CostEstimateArea[]) =>
    currentAreas.filter(area =>
      /^attached bathroom\s+\d+$/i.test(area.name.trim())
    ).length + 1;

  const handleAddBedroomSet = () => {
    setAreas(current => {
      const normalizedAreas = normalizeBedroomBathroomMasters(current);
      const nextSetNumber = Math.max(
        getNextBedroomNumber(normalizedAreas),
        getNextAttachedBathroomNumber(normalizedAreas)
      );

      return [
        ...normalizedAreas,
        {
          id: createId('estimate-bedroom'),
          name: `Bedroom ${nextSetNumber}`,
          type: 'bedroom',
        },
        {
          id: createId('estimate-bathroom'),
          name: `Attached Bathroom ${nextSetNumber}`,
          type: 'bathroom',
        },
      ];
    });

    markEstimateDirty();
  };

  const handleAddSingleBedroom = () => {
    setAreas(current => {
      const normalizedAreas = normalizeBedroomBathroomMasters(current);

      return [
        ...normalizedAreas,
        {
          id: createId('estimate-bedroom'),
          name: `Bedroom ${getNextBedroomNumber(normalizedAreas)}`,
          type: 'bedroom',
        },
      ];
    });

    markEstimateDirty();
  };

  const handleAddSingleBathroom = () => {
    setAreas(current => {
      const normalizedAreas = normalizeBedroomBathroomMasters(current);

      return [
        ...normalizedAreas,
        {
          id: createId('estimate-bathroom'),
          name: `Attached Bathroom ${getNextAttachedBathroomNumber(normalizedAreas)}`,
          type: 'bathroom',
        },
      ];
    });

    markEstimateDirty();
  };

  const handleAddCommonBathroom = () => {
    setAreas(current => {
      const commonBathroomCount = current.filter(area =>
        /^common bathroom(\s+\d+)?$/i.test(area.name.trim())
      ).length;

      return [
        ...current,
        {
          id: createId('estimate-common-bathroom'),
          name:
            commonBathroomCount === 0
              ? 'Common Bathroom'
              : `Common Bathroom ${commonBathroomCount + 1}`,
          type: 'bathroom',
        },
      ];
    });

    markEstimateDirty();
  };

  const executeDeleteArea = (areaId: string) => {
    const remainingAreas = areas.filter(area => area.id !== areaId);
    const fallbackAreaId = remainingAreas[0]?.id ?? '';

    setAreas(remainingAreas);
    setLineItems(current =>
      current.filter(lineItem => lineItem.areaId !== areaId)
    );
    setNewLineItemAreaId(current => (current === areaId ? fallbackAreaId : current));
    setActiveLineItemAreaId(current =>
      current === areaId ? fallbackAreaId : current
    );
    markEstimateDirty();
  };

  const handleDeleteArea = (areaId: string) => {
    if (isEstimateReadOnly) return;

    const area = areas.find(currentArea => currentArea.id === areaId);
    if (!area) return;

    const areaLineItemCount = lineItems.filter(
      lineItem => lineItem.areaId === areaId
    ).length;

    if (areaLineItemCount === 0) {
      executeDeleteArea(areaId);
      return;
    }

    setConfirmDialog({
      title: 'Delete area?',
      message: `This area has ${areaLineItemCount} row item(s). Deleting it will also remove all row items inside this area.`,
      confirmLabel: 'Delete Area',
      tone: 'destructive',
      onConfirm: () => executeDeleteArea(areaId),
    });
  };

  const handleStartAreaLineItem = (areaId: string) => {
    setNewLineItemAreaId(areaId);
    setActiveLineItemAreaId(areaId);
  };

  const applyItemPreset = (preset: CostEstimateItemPreset) => {
    setNewLineItemName(preset.name);
    setNewLineItemUnit(preset.defaultUnitLabel);
    setNewLineItemRate(String(preset.sellingRatePerUnit));
    setNewLineItemDescription(
      createEstimateLineItemDescription({
        areaName: selectedAreaName,
        itemDescription: preset.defaultDescription,
      })
    );
    setIsItemSuggestionOpen(false);
  };

  const handleItemNameChange = (itemName: string) => {
    setNewLineItemName(itemName);
    setIsItemSuggestionOpen(true);
  };

  const handleClearNewLineItem = () => {
    setNewLineItemName('');
    setNewLineItemDescription('');
    setNewLineItemQuantity('1');
    setNewLineItemUnit('sqft');
    setNewLineItemUnitQuery('');
    setIsNewLineItemUnitOpen(false);
    setNewLineItemRate('500');
    setNewLineItemRemarks('');
    setIsItemSuggestionOpen(false);
  };

  const handleOpenNewItemPresetForm = () => {
    const typedItemName = newLineItemName.trim();

    setNewPresetName(typedItemName);
    setNewPresetDescription(createItemMasterDefaultDescription(typedItemName));

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
      category: newPresetCategory,
      defaultUnitLabel: newPresetUnit,
      purchaseRatePerUnit,
      markupPercent,
      sellingRatePerUnit,
      defaultDescription:
        newPresetDescription.trim() ||
        createItemMasterDefaultDescription(trimmedName),
    };

    setItemPresets(current => [
      newPreset,
      ...current.filter(preset => {
        return (
          preset.id !== newPreset.id &&
          preset.name.trim().toLowerCase() !==
            newPreset.name.trim().toLowerCase()
        );
      }),
    ]);
    saveItemPresetToItemsMaster(newPreset);
    setNewLineItemName(newPreset.name);
    setNewLineItemUnit(newPreset.defaultUnitLabel);
    setNewLineItemRate(String(newPreset.sellingRatePerUnit));
    setNewLineItemDescription(
      createEstimateLineItemDescription({
        areaName: selectedAreaName,
        itemDescription: newPreset.defaultDescription,
      })
    );
    setNewPresetName('');
    setNewPresetCategory('custom');
    setNewPresetPurchaseRate('500');
    setNewPresetMarkupPercent('35');
    setNewPresetDescription('');
    setIsNewItemPresetFormOpen(false);
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

    setUnits(current => {
      const nextUnits = [...current, newUnit];
      saveCostEstimateUnitsToStorage(nextUnits);
      return nextUnits;
    });
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

  const getMatchingSavedRowUnits = () => {
    const searchValue = savedRowUnitQuery.trim().toLowerCase();

    return searchValue
      ? units.filter(unit => unit.shortLabel.toLowerCase().includes(searchValue))
      : units;
  };

  const canAddSavedRowUnit =
    savedRowUnitQuery.trim().length > 0 &&
    !units.some(
      unit =>
        unit.shortLabel.toLowerCase() === savedRowUnitQuery.trim().toLowerCase()
    );

  const registerSavedRowUnit = (lineItemId: string, value: string) => {
    const trimmedUnit = value.trim();

    if (!trimmedUnit) return;

    const existingUnit = units.find(
      unit => unit.shortLabel.toLowerCase() === trimmedUnit.toLowerCase()
    );

    if (existingUnit) {
      handleUpdateLineItem(lineItemId, { unitLabel: existingUnit.shortLabel });
      setSavedRowUnitQuery('');
      setSavedRowUnitDropdownId(null);
      return;
    }

    const newUnit: CostEstimateUnit = {
      id: createId('estimate-unit'),
      label: trimmedUnit,
      shortLabel: trimmedUnit,
      isCustom: true,
    };

    setUnits(current => {
      const nextUnits = [...current, newUnit];
      saveCostEstimateUnitsToStorage(nextUnits);
      return nextUnits;
    });

    handleUpdateLineItem(lineItemId, { unitLabel: newUnit.shortLabel });
    setSavedRowUnitQuery('');
    setSavedRowUnitDropdownId(null);
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
    <div ref={estimateTopRef} className="scroll-mt-6">
      <SectionCard
      title={
        <div className="flex items-center gap-2">
          <span>Cost Estimate</span>
          <StatusBadge variant={status === 'approved' ? 'success' : 'warning'}>
            {estimateStatusLabel}
          </StatusBadge>
        </div>
      }
      description="Prepare project-level estimates with area-wise scope, costs, pricing, GST, and approval-ready totals."
      actions={
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          {status === 'approved' ? (
            isHistoricalView ? null : (
              <Button
                type="button"
                variant="outline"
                onClick={handleCreateRevision}
                className="h-10 w-full justify-center gap-2 sm:w-auto"
              >
                <FilePlus2 className="h-4 w-4" />
                <span>Create Revision</span>
              </Button>
            )
          ) : (
            <div className="grid w-full grid-cols-3 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:justify-end">
              {isRevisionDraft && onViewApprovedVersion && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onViewApprovedVersion}
                  className="h-10 w-full justify-center gap-1.5 px-2 text-xs sm:w-auto sm:gap-2 sm:px-4 sm:text-sm"
                  aria-label="View approved estimate"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="sm:hidden">View</span><span className="hidden sm:inline">View Approved</span>
                </Button>
              )}

              <div
                ref={saveMenuRef}
                className="relative flex h-10 min-w-0 items-stretch sm:inline-flex sm:w-auto"
              >
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSaveDraft}
                  className="h-10 w-full justify-center rounded-lg bg-background px-2 text-xs text-foreground hover:bg-muted gap-1.5 sm:w-auto sm:rounded-r-none sm:border-r-0 sm:gap-2 sm:px-4 sm:text-sm"
                  aria-label={saveButtonLabel}
                >
                  <Save className="h-4 w-4 shrink-0" />
                  <span className="sm:hidden">Save</span>
                  <span className="hidden truncate sm:inline">{saveButtonLabel}</span>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsSaveMenuOpen(current => !current)}
                  className="hidden h-10 flex-none rounded-l-none rounded-r-lg border-l-0 bg-background px-3 text-foreground hover:bg-muted sm:flex"
                  aria-label="Open save options"
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>

                {isSaveMenuOpen && (
                  <div className="absolute left-0 right-0 top-11 z-[100] overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-lg">
                    <button
                      type="button"
                      onMouseDown={event => event.preventDefault()}
                      onClick={() => {
                        setIsSaveMenuOpen(false);
                        handleSaveAndClose();
                      }}
                      className="w-full whitespace-nowrap px-3 py-2 text-center text-sm transition hover:bg-muted"
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
                className="h-10 w-full justify-center gap-1.5 px-2 text-xs text-destructive hover:text-destructive sm:w-auto sm:gap-2 sm:px-4 sm:text-sm"
                aria-label={deleteButtonLabel}
              >
                <Trash2 className="h-4 w-4" />
                <span className="sm:hidden">Delete</span><span className="hidden sm:inline">{deleteButtonLabel}</span>
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
        {!isProjectLinkedEstimate && (
        <div className="rounded-2xl border border-border bg-background p-3 sm:p-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_460px] lg:items-center">
            <p className="text-sm font-medium text-foreground">
              Estimate Project
            </p>

            <div
              className={`relative ${isProjectSelectorOpen ? 'z-[120]' : 'z-0'}`}
              onBlur={event => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                  setIsProjectSelectorOpen(false);
                }
              }}
            >
              <button
                type="button"
                onClick={() => setIsProjectSelectorOpen(current => !current)}
                className="flex min-h-10 w-full items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 text-left text-sm text-foreground outline-none transition hover:bg-muted/40 focus:border-foreground"
              >
                <span className="truncate">
                  {selectedProjectId === UNASSIGNED_PROJECT_ID
                    ? 'Unassigned Draft'
                    : getProjectLabel(
                        availableProjectsForNewEstimate.find(
                          project => project.id === selectedProjectId
                        )
                      )}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {isProjectSelectorOpen ? 'Close' : 'Change'}
                </span>
              </button>

              {isProjectSelectorOpen && (
                <div className="absolute left-0 top-full z-[130] mt-2 max-h-72 w-full overflow-y-auto rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-2xl">
                  <button
                    type="button"
                    onMouseDown={event => event.preventDefault()}
                    onClick={() => {
                      handleProjectSelectionChange(UNASSIGNED_PROJECT_ID);
                      setIsProjectSelectorOpen(false);
                    }}
                    className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-muted ${
                      selectedProjectId === UNASSIGNED_PROJECT_ID
                        ? 'bg-muted text-foreground'
                        : 'text-muted-foreground'
                    }`}
                  >
                    <span className="truncate">Unassigned Draft</span>
                    {selectedProjectId === UNASSIGNED_PROJECT_ID && (
                      <span className="text-xs text-foreground">Selected</span>
                    )}
                  </button>

                  {availableProjectsForNewEstimate.map(project => {
                    const isSelected = project.id === selectedProjectId;

                    return (
                      <button
                        key={project.id}
                        type="button"
                        onMouseDown={event => event.preventDefault()}
                        onClick={() => {
                          handleProjectSelectionChange(project.id);
                          setIsProjectSelectorOpen(false);
                        }}
                        className={`flex w-full min-w-0 items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-muted ${
                          isSelected ? 'bg-muted text-foreground' : 'text-muted-foreground'
                        }`}
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-medium">
                            {project.name}
                          </span>
                          <span className="mt-0.5 block truncate text-xs">
                            {project.clientName}
                          </span>
                        </span>
                        {isSelected && (
                          <span className="shrink-0 text-xs text-foreground">
                            Selected
                          </span>
                        )}
                      </button>
                    );
                  })}

                  {availableProjectsForNewEstimate.length === 0 && (
                    <p className="px-3 py-2 text-xs text-muted-foreground">
                      No available project found.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        )}

        {supersededVersions.length > 0 && (
          <div className="rounded-2xl border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
            Superseded versions:{' '}
            <span className="font-medium text-foreground">
              {supersededVersions.map(version => `v${version}`).join(', ')}
            </span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-border bg-background px-3 py-2 sm:rounded-2xl sm:p-4">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground sm:text-xs">Subtotal</p>
            <p className="mt-1 text-sm font-semibold text-foreground sm:mt-2 sm:text-xl">
              {formatINR(summary.cogsSubtotal)}
            </p>
          </div>

          <div className="rounded-xl border border-border bg-background px-3 py-2 sm:rounded-2xl sm:p-4">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground sm:text-xs">Taxable</p>
            <p className="mt-1 text-sm font-semibold text-foreground sm:mt-2 sm:text-xl">
              {formatINR(summary.taxableSubtotal)}
            </p>
          </div>

          <div className="rounded-xl border border-border bg-background px-3 py-2 sm:rounded-2xl sm:p-4">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground sm:text-xs">GST 18%</p>
            <p className="mt-1 text-sm font-semibold text-foreground sm:mt-2 sm:text-xl">
              {formatINR(summary.gstAmount)}
            </p>
          </div>

          <div className="rounded-xl border border-border bg-background px-3 py-2 sm:rounded-2xl sm:p-4">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground sm:text-xs">
              Grand Total
            </p>
            <p className="mt-1 text-sm font-semibold text-foreground sm:mt-2 sm:text-xl">
              {formatINR(summary.estimatedGrossRevenue)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 lg:grid-cols-3 lg:gap-3">
          <label className="grid gap-1 rounded-xl border border-border bg-background px-2 py-2 lg:block lg:border-0 lg:bg-transparent lg:p-0">
            <span className="truncate text-[10px] font-medium text-muted-foreground sm:text-xs lg:text-sm lg:text-foreground">
              Service %
            </span>
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
              className="h-9 min-h-0 w-full rounded-lg border border-border bg-background px-2 text-sm text-foreground outline-none transition focus:border-foreground lg:mt-2 lg:h-10 lg:px-3"
            />
            <span className="hidden text-xs text-muted-foreground lg:mt-2 lg:block">Allowed: 10-20%</span>
          </label>

          <label className="grid gap-1 rounded-xl border border-border bg-background px-2 py-2 lg:block lg:border-0 lg:bg-transparent lg:p-0">
            <span className="truncate text-[10px] font-medium text-muted-foreground sm:text-xs lg:text-sm lg:text-foreground">
              Misc %
            </span>
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
              className="h-9 min-h-0 w-full rounded-lg border border-border bg-background px-2 text-sm text-foreground outline-none transition focus:border-foreground lg:mt-2 lg:h-10 lg:px-3"
            />
            <span className="hidden text-xs text-muted-foreground lg:mt-2 lg:block">Allowed: 10-15%</span>
          </label>

          <label className="grid gap-1 rounded-xl border border-border bg-background px-2 py-2 lg:block lg:border-0 lg:bg-transparent lg:p-0">
            <span className="truncate text-[10px] font-medium text-muted-foreground sm:text-xs lg:text-sm lg:text-foreground">
              Revenue
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
              className="h-9 min-h-0 w-full rounded-lg border border-border bg-background px-2 text-sm text-foreground outline-none transition focus:border-foreground lg:mt-2 lg:h-10 lg:px-3"
            />
            <span className="hidden text-xs text-muted-foreground lg:mt-2 lg:block">
              Used to validate the estimated grand total against the project value.
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
              Line items are managed inside each selected area.
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

          <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <Button
              type="button"
              variant="outline"
              onClick={handleAddBedroomSet}
              className="justify-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Bedroom Set
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleAddCommonBathroom}
              className="justify-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Common Bathroom
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleAddSingleBedroom}
              className="justify-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Bedroom
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleAddSingleBathroom}
              className="justify-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Bathroom
            </Button>
          </div>

          <div className="mt-4 overflow-hidden rounded-2xl border border-border">
            {groupedAreas.map(group => (
              <div
                key={group.area.id}
                className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 border-b border-border px-3 py-3 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_110px_120px_44px] sm:items-center sm:gap-2"
              >
                <div className="min-w-0 sm:text-left">
                  <p className="truncate text-base font-semibold text-foreground sm:text-sm sm:font-medium">
                    {group.area.name}
                  </p>
                </div>

                <p className="whitespace-nowrap text-right text-xs text-muted-foreground sm:text-center">
                  {group.lineItems.length} item(s)
                </p>

                <p className="self-end text-lg font-semibold text-foreground sm:self-center sm:text-center sm:text-sm">
                  {formatINR(group.total)}
                </p>

                <div className="flex items-end justify-end sm:items-center sm:justify-center">
                  <button
                    type="button"
                    onClick={() => handleDeleteArea(group.area.id)}
                    disabled={isEstimateReadOnly}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-border disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
                    aria-label={`Delete ${group.area.name}`}
                    title="Delete area"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
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
              <div className="flex flex-row items-start justify-between gap-3 border-b border-border bg-muted/30 p-4 sm:items-center">
                <div className="min-w-0">
                  <p className="text-base font-semibold text-foreground sm:text-sm">
                    {group.area.name}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {group.lineItems.length} line item(s)
                  </p>
                  <p className="mt-2 text-sm font-semibold text-foreground sm:hidden">
                    Area total: {formatINR(group.total)}
                  </p>
                </div>

                <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                  <div className="hidden text-sm font-semibold text-foreground sm:block">
                    Area total: {formatINR(group.total)}
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleStartAreaLineItem(group.area.id)}
                    className="h-8 gap-1.5 px-2 text-xs sm:hidden"
                  >
                    <Plus className="h-4 w-4" />
                    Add
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleStartAreaLineItem(group.area.id)}
                    className="hidden gap-2 sm:flex"
                  >
                    <Plus className="h-4 w-4" />
                    Add New Row
                  </Button>
                </div>
              </div>

              {activeLineItemAreaId === group.area.id && (
                <div className="border-b border-border bg-card/60 p-3 sm:p-4">
                  <div className="grid grid-cols-3 gap-2 sm:gap-3 xl:grid-cols-[minmax(0,1fr)_120px_160px_160px_150px] xl:items-center xl:gap-4 2xl:gap-5">
                    <div className="col-span-3 grid gap-2 sm:gap-3 xl:col-span-1">
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
                          className="min-h-10 w-full rounded-lg border border-border bg-background px-3 pr-10 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-foreground"
                        />

                        {newLineItemName.trim() && (
                          <button
                            type="button"
                            onMouseDown={event => event.preventDefault()}
                            onClick={handleClearNewLineItem}
                            className="absolute right-2 top-5 z-[60] flex h-[18px] w-[18px] -translate-y-1/2 items-center justify-center rounded-full border-[2.5px] border-destructive/90 bg-background text-destructive transition hover:border-destructive hover:bg-destructive/10"
                            aria-label="Clear selected item"
                          >
                            <Minus className="h-[11px] w-[11px]" strokeWidth={5} />
                          </button>
                        )}

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
                        <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6">
                          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl border border-border bg-card p-5 text-card-foreground shadow-xl sm:rounded-3xl">
                            <h2 className="text-lg font-semibold text-foreground">
                              Add Item
                            </h2>
                            <p className="mt-1 text-sm text-muted-foreground">
                              Save this item to Procurement - Items and use it in this estimate row.
                            </p>

                            <div className="mt-5 grid gap-4">
                              <label className="grid gap-2">
                                <span className="text-sm font-medium text-foreground">
                                  Item Name
                                </span>
                                <input
                                  value={newPresetName}
                                  onChange={event => {
                                    const previousName = newPresetName;
                                    const nextName = event.target.value;

                                    setNewPresetName(nextName);
                                    setNewPresetDescription(currentDescription => {
                                      const previousAutoDescription =
                                        createItemMasterDefaultDescription(
                                          previousName
                                        );
                                      const isOldGeneratedDescription =
                                        currentDescription.includes(
                                          'configured as an execution-ready interior item'
                                        ) ||
                                        currentDescription.includes(
                                          'configured with'
                                        );

                                      if (
                                        currentDescription.trim() &&
                                        currentDescription !== previousAutoDescription &&
                                        !isOldGeneratedDescription
                                      ) {
                                        return currentDescription;
                                      }

                                      return createItemMasterDefaultDescription(nextName);
                                    });
                                  }}
                                  placeholder="e.g. TV Unit"
                                  className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-foreground"
                                />
                              </label>

                              <div className="grid gap-4 sm:grid-cols-2">
                                <label className="relative grid gap-2">
                                  <span className="text-sm font-medium text-foreground">
                                    Scope / Category
                                  </span>

                                  <input
                                    value={
                                      isNewPresetCategoryOpen
                                        ? newPresetCategoryQuery
                                        : selectedNewPresetCategoryLabel
                                    }
                                    onFocus={() => {
                                      setNewPresetCategoryQuery('');
                                      setIsNewPresetCategoryOpen(true);
                                    }}
                                    onBlur={() => {
                                      window.setTimeout(() => {
                                        setIsNewPresetCategoryOpen(false);
                                      }, 120);
                                    }}
                                    onChange={event => {
                                      setNewPresetCategoryQuery(event.target.value);
                                      setIsNewPresetCategoryOpen(true);
                                    }}
                                    onKeyDown={event => {
                                      if (
                                        event.key === 'Enter' &&
                                        canAddNewPresetCategory
                                      ) {
                                        event.preventDefault();
                                        registerNewPresetCategory(
                                          newPresetCategoryQuery
                                        );
                                      }
                                    }}
                                    placeholder="Search or add category"
                                    className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-foreground"
                                  />

                                  {isNewPresetCategoryOpen && (
                                    <div className="absolute left-0 right-0 top-[68px] z-[140] max-h-56 overflow-y-auto rounded-xl border border-border bg-card text-card-foreground shadow-xl">
                                      {matchingNewPresetCategoryOptions.map(option => (
                                        <button
                                          key={option.value}
                                          type="button"
                                          onMouseDown={event =>
                                            event.preventDefault()
                                          }
                                          onClick={() => {
                                            setNewPresetCategory(option.value);
                                            setNewPresetCategoryQuery('');
                                            setIsNewPresetCategoryOpen(false);
                                          }}
                                          className="block w-full px-3 py-2 text-left text-sm transition hover:bg-muted"
                                        >
                                          {option.label}
                                        </button>
                                      ))}

                                      {canAddNewPresetCategory && (
                                        <button
                                          type="button"
                                          onMouseDown={event =>
                                            event.preventDefault()
                                          }
                                          onClick={() =>
                                            registerNewPresetCategory(
                                              newPresetCategoryQuery
                                            )
                                          }
                                          className="block w-full border-t border-border px-3 py-2 text-left text-sm transition hover:bg-muted"
                                        >
                                          Add Category: {newPresetCategoryQuery.trim()}
                                        </button>
                                      )}

                                      {matchingNewPresetCategoryOptions.length ===
                                        0 &&
                                        !canAddNewPresetCategory && (
                                          <p className="px-3 py-2 text-sm text-muted-foreground">
                                            No categories found.
                                          </p>
                                        )}
                                    </div>
                                  )}
                                </label>

                                <label className="relative grid gap-2">
                                  <span className="text-sm font-medium text-foreground">
                                    Default Unit
                                  </span>

                                  <input
                                    value={
                                      isNewPresetUnitOpen
                                        ? newPresetUnitQuery
                                        : newPresetUnit
                                    }
                                    onFocus={() => {
                                      setNewPresetUnitQuery('');
                                      setIsNewPresetUnitOpen(true);
                                    }}
                                    onBlur={() => {
                                      window.setTimeout(() => {
                                        setIsNewPresetUnitOpen(false);
                                      }, 120);
                                    }}
                                    onChange={event => {
                                      setNewPresetUnitQuery(event.target.value);
                                      setIsNewPresetUnitOpen(true);
                                    }}
                                    onKeyDown={event => {
                                      if (
                                        event.key === 'Enter' &&
                                        canAddNewPresetUnit
                                      ) {
                                        event.preventDefault();
                                        registerNewPresetUnit(newPresetUnitQuery);
                                      }
                                    }}
                                    placeholder="Search or add unit"
                                    className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-foreground"
                                  />

                                  {isNewPresetUnitOpen && (
                                    <div className="absolute left-0 right-0 top-[68px] z-[140] max-h-56 overflow-y-auto rounded-xl border border-border bg-card text-card-foreground shadow-xl">
                                      {matchingNewPresetUnitOptions.map(unit => (
                                        <button
                                          key={unit.id}
                                          type="button"
                                          onMouseDown={event =>
                                            event.preventDefault()
                                          }
                                          onClick={() => {
                                            setNewPresetUnit(unit.shortLabel);
                                            setNewPresetUnitQuery('');
                                            setIsNewPresetUnitOpen(false);
                                          }}
                                          className="block w-full px-3 py-2 text-left text-sm transition hover:bg-muted"
                                        >
                                          {unit.shortLabel}
                                        </button>
                                      ))}

                                      {canAddNewPresetUnit && (
                                        <button
                                          type="button"
                                          onMouseDown={event =>
                                            event.preventDefault()
                                          }
                                          onClick={() =>
                                            registerNewPresetUnit(
                                              newPresetUnitQuery
                                            )
                                          }
                                          className="block w-full border-t border-border px-3 py-2 text-left text-sm transition hover:bg-muted"
                                        >
                                          Add Unit: {newPresetUnitQuery.trim()}
                                        </button>
                                      )}

                                      {matchingNewPresetUnitOptions.length === 0 &&
                                        !canAddNewPresetUnit && (
                                          <p className="px-3 py-2 text-sm text-muted-foreground">
                                            No units found.
                                          </p>
                                        )}
                                    </div>
                                  )}
                                </label>
                              </div>

                              <div className="grid gap-4 sm:grid-cols-2">
                                <label className="grid gap-2">
                                  <span className="text-sm font-medium text-foreground">
                                    Cost Rate
                                  </span>
                                  <input
                                    type="number"
                                    min="0"
                                    value={newPresetPurchaseRate}
                                    onChange={event =>
                                      setNewPresetPurchaseRate(event.target.value)
                                    }
                                    placeholder="500"
                                    className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-foreground"
                                  />
                                </label>

                                <label className="grid gap-2">
                                  <span className="text-sm font-medium text-foreground">
                                    Markup %
                                  </span>
                                  <input
                                    type="number"
                                    min="0"
                                    value={newPresetMarkupPercent}
                                    onChange={event =>
                                      setNewPresetMarkupPercent(event.target.value)
                                    }
                                    placeholder="35"
                                    className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-foreground"
                                  />
                                </label>
                              </div>

                              <div className="rounded-2xl border border-border bg-muted/30 p-3">
                                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                                  Calculated Sale Rate
                                </p>
                                <p className="mt-1 text-xl font-semibold text-foreground">
                                  {formatINR(
                                    calculateSellingRate(
                                      Number(newPresetPurchaseRate) || 0,
                                      Number(newPresetMarkupPercent) || 0
                                    )
                                  )}
                                </p>
                              </div>

                              <label className="grid gap-2">
                                <span className="text-sm font-medium text-foreground">
                                  Default Description
                                </span>
                                <textarea
                                  value={newPresetDescription}
                                  onChange={event =>
                                    setNewPresetDescription(event.target.value)
                                  }
                                  rows={4}
                                  placeholder="Default estimate description for this item"
                                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-foreground"
                                />
                              </label>
                            </div>

                            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
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

                    <div className="relative min-w-0 self-center">
                      <input
                        value={
                          isNewLineItemUnitOpen
                            ? newLineItemUnitQuery
                            : newLineItemUnit
                        }
                        onFocus={() => {
                          setNewLineItemUnitQuery('');
                          setIsNewLineItemUnitOpen(true);
                        }}
                        onBlur={() => {
                          window.setTimeout(() => {
                            setIsNewLineItemUnitOpen(false);
                          }, 120);
                        }}
                        onChange={event => {
                          setNewLineItemUnitQuery(event.target.value);
                          setIsNewLineItemUnitOpen(true);
                        }}
                        onKeyDown={event => {
                          if (event.key === 'Enter' && canAddNewLineItemUnit) {
                            event.preventDefault();
                            registerLineItemUnit(newLineItemUnitQuery);
                          }
                        }}
                        placeholder="Unit"
                        className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-foreground"
                      />

                      {isNewLineItemUnitOpen && (
                        <div className="absolute left-0 right-0 top-11 z-[100] max-h-56 overflow-y-auto rounded-xl border border-border bg-card text-card-foreground shadow-xl">
                          {matchingLineItemUnitOptions.map(unit => (
                            <button
                              key={unit.id}
                              type="button"
                              onMouseDown={event => event.preventDefault()}
                              onClick={() => {
                                setNewLineItemUnit(unit.shortLabel);
                                setNewLineItemUnitQuery('');
                                setIsNewLineItemUnitOpen(false);
                              }}
                              className="block w-full px-3 py-2 text-left text-sm transition hover:bg-muted"
                            >
                              {unit.shortLabel}
                            </button>
                          ))}

                          {canAddNewLineItemUnit && (
                            <button
                              type="button"
                              onMouseDown={event => event.preventDefault()}
                              onClick={() =>
                                registerLineItemUnit(newLineItemUnitQuery)
                              }
                              className="block w-full border-t border-border px-3 py-2 text-left text-sm transition hover:bg-muted"
                            >
                              Add Unit: {newLineItemUnitQuery.trim()}
                            </button>
                          )}

                          {matchingLineItemUnitOptions.length === 0 &&
                            !canAddNewLineItemUnit && (
                              <p className="px-3 py-2 text-sm text-muted-foreground">
                                No units found.
                              </p>
                            )}
                        </div>
                      )}

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

                    <div className="col-span-3 flex min-w-0 items-center justify-between gap-2 self-center xl:col-span-1 xl:flex-col xl:items-stretch">
                      <div className="min-w-0 flex-1 rounded-xl border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground xl:w-full">
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
                        className="h-10 w-11 shrink-0 justify-center px-0 sm:w-auto sm:gap-2 sm:px-3"
                        aria-label="Save row"
                      >
                        <Check className="h-4 w-4" />
                        <span className="hidden sm:inline">Save Row</span>
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
                      className="grid grid-cols-3 gap-2 rounded-2xl border border-border bg-card p-3 sm:p-4 xl:grid-cols-[minmax(0,1fr)_120px_160px_160px_auto] xl:items-center xl:gap-4 2xl:gap-5"
                    >
                      <div className="col-span-3 min-w-0 xl:col-span-1">
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

                      <div className="relative self-center">
                        <input
                          value={
                            savedRowUnitDropdownId === lineItem.id
                              ? savedRowUnitQuery
                              : lineItem.unitLabel
                          }
                          onFocus={() => {
                            setSavedRowUnitDropdownId(lineItem.id);
                            setSavedRowUnitQuery('');
                          }}
                          onBlur={() => {
                            window.setTimeout(() => {
                              setSavedRowUnitDropdownId(null);
                            }, 120);
                          }}
                          onChange={event => {
                            setSavedRowUnitDropdownId(lineItem.id);
                            setSavedRowUnitQuery(event.target.value);
                          }}
                          onKeyDown={event => {
                            if (event.key === 'Enter' && canAddSavedRowUnit) {
                              event.preventDefault();
                              registerSavedRowUnit(lineItem.id, savedRowUnitQuery);
                            }
                          }}
                          placeholder="Unit"
                          className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-foreground"
                        />

                        {savedRowUnitDropdownId === lineItem.id && (
                          <div className="absolute left-0 right-0 top-11 z-[100] max-h-56 overflow-y-auto rounded-xl border border-border bg-card text-card-foreground shadow-xl">
                            {getMatchingSavedRowUnits().map(unit => (
                              <button
                                key={unit.id}
                                type="button"
                                onMouseDown={event => event.preventDefault()}
                                onClick={() => {
                                  handleUpdateLineItem(lineItem.id, {
                                    unitLabel: unit.shortLabel,
                                  });
                                  setSavedRowUnitQuery('');
                                  setSavedRowUnitDropdownId(null);
                                }}
                                className="block w-full px-3 py-2 text-left text-sm transition hover:bg-muted"
                              >
                                {unit.shortLabel}
                              </button>
                            ))}

                            {canAddSavedRowUnit && (
                              <button
                                type="button"
                                onMouseDown={event => event.preventDefault()}
                                onClick={() =>
                                  registerSavedRowUnit(lineItem.id, savedRowUnitQuery)
                                }
                                className="block w-full border-t border-border px-3 py-2 text-left text-sm transition hover:bg-muted"
                              >
                                Add Unit: {savedRowUnitQuery.trim()}
                              </button>
                            )}

                            {getMatchingSavedRowUnits().length === 0 &&
                              !canAddSavedRowUnit && (
                                <p className="px-3 py-2 text-sm text-muted-foreground">
                                  No units found.
                                </p>
                              )}
                          </div>
                        )}
                      </div>

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

                      <div className="col-span-3 flex items-center justify-between gap-3 xl:col-span-1">
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

      <div className="mt-6 grid grid-cols-3 gap-2 border-t border-border pt-4 sm:flex sm:items-center sm:justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={handleBackToEstimateTop}
          className="h-10 w-full justify-center gap-1.5 px-2 text-xs sm:w-auto sm:gap-2 sm:px-4 sm:text-sm"
          aria-label="Back to top"
        >
          <ArrowUp className="h-4 w-4" />
          <span className="sm:hidden">Top</span><span className="hidden sm:inline">Back to Top</span>
        </Button>

        {status !== 'approved' && (
          <>
            <div
              ref={bottomSaveMenuRef}
              className="relative flex h-10 min-w-0 flex-1 items-stretch sm:inline-flex sm:w-auto"
            >
              <Button
                type="button"
                variant="outline"
                onClick={handleSaveDraft}
                className="h-10 w-full justify-center rounded-lg bg-background px-2 text-xs text-foreground hover:bg-muted gap-1.5 sm:w-auto sm:rounded-r-none sm:border-r-0 sm:gap-2 sm:px-4 sm:text-sm"
                aria-label={saveButtonLabel}
              >
                <Save className="h-4 w-4" />
                <span className="sm:hidden">Save</span>
                <span className="hidden sm:inline">{saveButtonLabel}</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={() => setIsBottomSaveMenuOpen(current => !current)}
                className="hidden h-10 flex-none rounded-l-none rounded-r-lg border-l-0 bg-background px-3 text-foreground hover:bg-muted sm:flex"
                aria-label="Open bottom save options"
              >
                <ChevronDown className="h-4 w-4" />
              </Button>

              {isBottomSaveMenuOpen && (
                <div className="absolute left-0 right-0 top-11 z-[100] overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-lg">
                  <button
                    type="button"
                    onMouseDown={event => event.preventDefault()}
                    onClick={() => {
                      setIsBottomSaveMenuOpen(false);
                      handleSaveAndClose();
                    }}
                    className="w-full whitespace-nowrap px-3 py-2 text-center text-sm transition hover:bg-muted"
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
              className="h-10 w-full justify-center gap-1.5 px-2 text-xs text-destructive hover:text-destructive sm:w-auto sm:gap-2 sm:px-4 sm:text-sm"
              aria-label={deleteButtonLabel}
            >
              <Trash2 className="h-4 w-4" />
              <span className="sm:hidden">Delete</span>
              <span className="hidden sm:inline">{deleteButtonLabel}</span>
            </Button>
          </>
        )}
      </div>
    </SectionCard>

      {confirmDialog && (
        <div className="fixed inset-0 z-[160] flex items-end justify-center bg-black/40 p-0 backdrop-blur-sm sm:items-center sm:p-6">
          <div className="w-full max-w-md rounded-t-3xl border border-border bg-card p-5 text-card-foreground shadow-xl sm:rounded-3xl">
            <h2 className="text-lg font-semibold text-foreground">
              {confirmDialog.title}
            </h2>

            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {confirmDialog.message}
            </p>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setConfirmDialog(null)}
              >
                Cancel
              </Button>

              <Button
                type="button"
                variant={
                  confirmDialog.tone === 'destructive'
                    ? 'destructive'
                    : 'default'
                }
                onClick={() => {
                  const { onConfirm } = confirmDialog;
                  setConfirmDialog(null);
                  onConfirm();
                }}
              >
                {confirmDialog.confirmLabel}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
