import { useEffect, useMemo, useState } from 'react';
import {
  Calculator,
  ChevronDown,
  MoreHorizontal,
  Package,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { createPortal } from 'react-dom';

import { EmptyState } from '@/components/common/EmptyState';
import { PageHeader } from '@/components/common/PageHeader';
import { useOperationFeedback } from '@/contexts/OperationFeedbackContext';
import { SectionCard } from '@/components/common/SectionCard';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';

import { defaultCostEstimateUnits } from '@/features/cost-estimate/data';
import { vendorCategoryLabels } from '@/features/vendors/data';
import type {
  ItemCategory,
  ItemStatus,
  ProcurementItem,
} from '@/features/items/types';
import { supabase, type ProcurementItemRecord } from '@/lib/supabase';
import {
  fetchProcurementCategories,
  fetchProcurementItems,
  fetchProcurementUnits,
  getLocalProcurementCategoryOptions,
  getLocalProcurementItems,
  getLocalProcurementUnitOptions,
  importLocalProcurementMastersToSupabase,
  mapItemRecordToProcurementItem,
  mapProcurementItemToUpsertPayload,
  type ProcurementOption,
} from '@/lib/procurementMasters';

const ITEMS_STORAGE_KEY = 'gravium-os-items';
const LEGACY_ITEMS_STORAGE_KEY = 'gravium-os-items-demo';
const PROCUREMENT_CATEGORIES_STORAGE_KEY =
  'gravium-os-procurement-categories-demo';
const PROCUREMENT_UNITS_STORAGE_KEY = 'gravium-os-procurement-units-demo';

const defaultCategoryOptions: { value: string; label: string }[] = [
  { value: 'all', label: 'All Categories' },
  ...Object.entries(vendorCategoryLabels).map(([value, label]) => ({
    value,
    label,
  })),
];

const statusOptions: { value: string; label: string }[] = [
  { value: 'all', label: 'All Statuses' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

function normalizeCategoryValue(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, '_');
}

function createCategoryOption(value: string) {
  const trimmedValue = value.trim();

  return {
    value: normalizeCategoryValue(trimmedValue),
    label: formatCategory(trimmedValue),
  };
}

function getStoredCategoryOptions() {
  if (typeof window === 'undefined') return defaultCategoryOptions;

  try {
    const storedCategories = localStorage.getItem(PROCUREMENT_CATEGORIES_STORAGE_KEY);

    if (!storedCategories) return defaultCategoryOptions;

    const parsedCategories = JSON.parse(storedCategories);

    if (!Array.isArray(parsedCategories)) return defaultCategoryOptions;

    const optionMap = new Map<string, string>();

    defaultCategoryOptions.forEach(option => {
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
    return defaultCategoryOptions;
  }
}

function getDefaultUnitOptions() {
  return defaultCostEstimateUnits.map(unit => {
    const value = normalizeUnitValue(unit.shortLabel);

    return {
      value,
      label: formatUnitLabel(value),
    };
  });
}

function createUnitOption(value: string) {
  const normalizedValue = normalizeUnitValue(value);

  return {
    value: normalizedValue,
    label: formatUnitLabel(normalizedValue),
  };
}

function getStoredUnitOptions() {
  const defaultUnitOptions = getDefaultUnitOptions();

  if (typeof window === 'undefined') return defaultUnitOptions;

  try {
    const storedUnits = localStorage.getItem(PROCUREMENT_UNITS_STORAGE_KEY);

    if (!storedUnits) return defaultUnitOptions;

    const parsedUnits = JSON.parse(storedUnits);

    if (!Array.isArray(parsedUnits)) return defaultUnitOptions;

    const optionMap = new Map<string, string>();

    defaultUnitOptions.forEach(option => {
      optionMap.set(option.value, option.label);
    });

    parsedUnits.forEach(option => {
      if (
        option &&
        typeof option.value === 'string' &&
        typeof option.label === 'string'
      ) {
        optionMap.set(option.value, option.label);
      }
    });

    return Array.from(optionMap, ([value, label]) => ({ value, label }));
  } catch {
    return defaultUnitOptions;
  }
}

interface DropdownOption {
  value: string;
  label: string;
}

interface DropdownFieldProps {
  label: string;
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  searchable?: boolean;
  allowCustom?: boolean;
  customAddLabel?: string;
  placeholder?: string;
}

function DropdownField({
  label,
  value,
  options,
  onChange,
  searchable = false,
  allowCustom = false,
  customAddLabel = 'Add option',
  placeholder = 'Select option',
}: DropdownFieldProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selectedOption = options.find(option => option.value === value);
  const displayValue = selectedOption?.label ?? formatCategory(value);
  const searchValue = query.trim().toLowerCase();

  const matchingOptions = searchValue
    ? options.filter(option => option.label.toLowerCase().includes(searchValue))
    : options;

  const canUseCustom =
    allowCustom &&
    query.trim().length > 0 &&
    !options.some(
      option => option.label.toLowerCase() === query.trim().toLowerCase()
    );

  const handleSelect = (nextValue: string) => {
    onChange(nextValue);
    setQuery('');
    setIsOpen(false);
  };

  return (
    <label className="relative grid min-w-0 gap-2">
      <span className="text-sm font-medium text-foreground">{label}</span>

      {searchable ? (
        <div className="relative">
          <input
            value={isOpen ? query : displayValue}
            onFocus={() => {
              setQuery('');
              setIsOpen(true);
            }}
            onBlur={() => {
              window.setTimeout(() => setIsOpen(false), 120);
            }}
            onChange={event => {
              setQuery(event.target.value);
              setIsOpen(true);
            }}
            onKeyDown={event => {
              if (event.key === 'Enter' && canUseCustom) {
                event.preventDefault();
                handleSelect(query.trim());
              }
            }}
            placeholder={placeholder}
            className="h-10 w-full rounded-lg border border-border bg-background px-3 pr-9 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-foreground"
          />
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(current => !current)}
          onBlur={() => {
            window.setTimeout(() => setIsOpen(false), 120);
          }}
          className="flex h-10 w-full items-center justify-between rounded-lg border border-border bg-background px-3 text-left text-sm text-foreground outline-none transition focus:border-foreground"
        >
          <span>{displayValue}</span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </button>
      )}

      {isOpen && (
        <div className="absolute left-0 right-0 top-[68px] z-[100] max-h-56 min-w-full overflow-y-auto rounded-xl border border-border bg-card text-card-foreground shadow-xl">
          {matchingOptions.map(option => (
            <button
              key={option.value}
              type="button"
              onMouseDown={event => event.preventDefault()}
              onClick={() => handleSelect(option.value)}
              className="block w-full px-3 py-2 text-left text-sm transition hover:bg-muted"
            >
              {option.label}
            </button>
          ))}

          {canUseCustom && (
            <button
              type="button"
              onMouseDown={event => event.preventDefault()}
              onClick={() => handleSelect(query.trim())}
              className="block w-full border-t border-border px-3 py-2 text-left text-sm transition hover:bg-muted"
            >
              {customAddLabel}: {query.trim()}
            </button>
          )}

          {matchingOptions.length === 0 && !canUseCustom && (
            <p className="px-3 py-2 text-sm text-muted-foreground">
              No options found.
            </p>
          )}
        </div>
      )}
    </label>
  );
}

type ItemModalState =
  | { mode: 'create'; item: null }
  | { mode: 'edit'; item: ProcurementItem }
  | null;

interface ItemFormState {
  name: string;
  category: ItemCategory;
  defaultUnitLabel: string;
  purchaseRatePerUnit: string;
  markupPercent: string;
  defaultDescription: string;
  status: ItemStatus;
}

function createId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}`;
}

function formatINR(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatCategory(category: string) {
  return category
    .replaceAll('_', ' ')
    .replace(/\b\w/g, letter => letter.toUpperCase());
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

function calculateSellingRate(purchaseRate: number, markupPercent: number) {
  return Math.round(purchaseRate * (1 + markupPercent / 100));
}

function createFormState(item?: ProcurementItem): ItemFormState {
  return {
    name: item?.name ?? '',
    category: item?.category ?? 'carpentry',
    defaultUnitLabel: item?.defaultUnitLabel ?? 'sqft',
    purchaseRatePerUnit: item ? String(item.purchaseRatePerUnit) : '',
    markupPercent: item ? String(item.markupPercent) : '30',
    defaultDescription: item?.defaultDescription ?? '',
    status: item?.status ?? 'active',
  };
}

function getStoredItems() {
  if (typeof window === 'undefined') return [];

  const parseItems = (rawItems: string | null) => {
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
        ['active', 'inactive'].includes(item.status) &&
        typeof item.updatedAt === 'string'
      );
    }) as ProcurementItem[];
  };

  try {
    const storedItems = parseItems(localStorage.getItem(ITEMS_STORAGE_KEY));

    if (storedItems.length > 0) return storedItems;

    const legacyItems = parseItems(localStorage.getItem(LEGACY_ITEMS_STORAGE_KEY));

    if (legacyItems.length > 0) {
      return legacyItems;
    }

    return [];
  } catch {
    return [];
  }
}

function mergeDropdownOptions(...optionGroups: ProcurementOption[][]) {
  const optionMap = new Map<string, string>();

  optionGroups.flat().forEach(option => {
    if (!option || !option.value) return;

    optionMap.set(option.value, option.label || option.value);
  });

  return Array.from(optionMap, ([value, label]) => ({ value, label }));
}

function formatUnitLabel(value: string) {
  return value.trim().replaceAll('_', ' ');
}

function normalizeUnitValue(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, '_');
}

function normalizeSupabaseUnitOptions(options: ProcurementOption[]) {
  return options.map(option => {
    const value = normalizeUnitValue(option.value);
    const label = option.label?.trim() || value;

    return {
      value,
      label: formatUnitLabel(label),
    };
  });
}

type ItemActionMenuPosition = {
  top: number;
  left: number;
  width: number;
};

function ItemActionMenu({
  item,
  menuPosition,
  onClose,
  onEdit,
  onDelete,
}: {
  item: ProcurementItem;
  menuPosition: ItemActionMenuPosition | null;
  onClose: () => void;
  onEdit: (item: ProcurementItem) => void;
  onDelete: (item: ProcurementItem) => void;
}) {
  if (!menuPosition || typeof document === 'undefined') return null;

  const menuWidth = menuPosition.width;
  const safeLeft =
    typeof window === 'undefined'
      ? menuPosition.left
      : Math.min(menuPosition.left, window.innerWidth - menuWidth - 12);
  const safeTop =
    typeof window === 'undefined'
      ? menuPosition.top
      : Math.min(menuPosition.top, window.innerHeight - 104);

  return createPortal(
    <>
      <button
        type="button"
        aria-label="Close item actions"
        className="fixed inset-0 z-[9998] cursor-default bg-transparent"
        onClick={onClose}
      />

      <div
        className="fixed z-[9999] overflow-hidden rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-2xl"
        style={{
          top: Math.max(12, safeTop),
          left: Math.max(12, safeLeft),
          width: menuWidth,
        }}
      >
        <button
          type="button"
          onClick={() => {
            onEdit(item);
            onClose();
          }}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition hover:bg-muted"
        >
          <Pencil className="h-4 w-4" />
          Edit Item
        </button>

        <button
          type="button"
          onClick={() => {
            onDelete(item);
            onClose();
          }}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-destructive transition hover:bg-destructive/10"
        >
          <Trash2 className="h-4 w-4" />
          Delete
        </button>
      </div>
    </>,
    document.body
  );
}

export default function ItemsPage() {
  const [items, setItems] = useState<ProcurementItem[]>([]);
  const [categoryOptions, setCategoryOptions] = useState(() => defaultCategoryOptions);
  const [unitOptions, setUnitOptions] = useState(() => getDefaultUnitOptions());
  const [isLoadingMasters, setIsLoadingMasters] = useState(true);
  const [dataError, setDataError] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('all');
  const [status, setStatus] = useState<ItemStatus | 'all'>('all');
  const [modalState, setModalState] = useState<ItemModalState>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProcurementItem | null>(null);
  const [actionMenuItemId, setActionMenuItemId] = useState<string | null>(null);
  const [actionMenuPosition, setActionMenuPosition] =
    useState<ItemActionMenuPosition | null>(null);
  const [formState, setFormState] = useState<ItemFormState>(() =>
    createFormState()
  );
  const {
    showOperationLoading,
    showOperationSuccess,
  } = useOperationFeedback();

  const loadProcurementMasters = async () => {
    setIsLoadingMasters(true);
    setDataError('');

    try {
      let [nextItems, nextCategories, nextUnits] = await Promise.all([
        fetchProcurementItems(),
        fetchProcurementCategories(),
        fetchProcurementUnits(),
      ]);

      const hasLocalMigrationData =
        getLocalProcurementItems().length > 0 ||
        getLocalProcurementCategoryOptions().length > 0 ||
        getLocalProcurementUnitOptions().length > 0;

      const shouldImportLocalData =
        hasLocalMigrationData &&
        (nextItems.length === 0 ||
          nextCategories.length === 0 ||
          nextUnits.length === 0);

      if (shouldImportLocalData) {
        await importLocalProcurementMastersToSupabase();

        [nextItems, nextCategories, nextUnits] = await Promise.all([
          fetchProcurementItems(),
          fetchProcurementCategories(),
          fetchProcurementUnits(),
        ]);
      }

      setItems(nextItems);
      setCategoryOptions(mergeDropdownOptions(defaultCategoryOptions, nextCategories));
      setUnitOptions(nextUnits.length > 0 ? normalizeSupabaseUnitOptions(nextUnits) : getDefaultUnitOptions());
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not load Supabase item masters.';

      setDataError(message);
      setItems(getStoredItems());
      setCategoryOptions(getStoredCategoryOptions());
      setUnitOptions(getStoredUnitOptions());
    } finally {
      setIsLoadingMasters(false);
    }
  };

  useEffect(() => {
    void loadProcurementMasters();
  }, []);

  useEffect(() => {
    if (!actionMenuItemId) return;

    const closeActionMenu = () => {
      setActionMenuItemId(null);
      setActionMenuPosition(null);
    };

    window.addEventListener('resize', closeActionMenu);
    window.addEventListener('scroll', closeActionMenu, true);

    return () => {
      window.removeEventListener('resize', closeActionMenu);
      window.removeEventListener('scroll', closeActionMenu, true);
    };
  }, [actionMenuItemId]);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();

    return items.filter(item => {
      const matchesSearch =
        !query ||
        item.name.toLowerCase().includes(query) ||
        item.defaultDescription.toLowerCase().includes(query) ||
        item.defaultUnitLabel.toLowerCase().includes(query);

      const matchesCategory = category === 'all' || item.category === category;
      const matchesStatus = status === 'all' || item.status === status;

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [category, items, search, status]);

  const categoryFilterOptions = useMemo(() => {
    const optionMap = new Map<string, string>();

    categoryOptions.forEach(option => {
      optionMap.set(option.value, option.label);
    });

    items.forEach(item => {
      if (!optionMap.has(item.category)) {
        optionMap.set(item.category, formatCategory(item.category));
      }
    });

    return Array.from(optionMap, ([value, label]) => ({ value, label }));
  }, [categoryOptions, items]);

  const formCategoryOptions = categoryFilterOptions.filter(
    option => option.value !== 'all'
  );

  const upsertProcurementCategoryOption = async (option: ProcurementOption) => {
    if (!option.value || option.value === 'all') return;

    const { error } = await supabase
      .from('procurement_categories')
      .upsert(
        {
          id: `category-${option.value}`,
          value: option.value,
          label: option.label,
        },
        { onConflict: 'value' }
      );

    if (error) throw error;
  };

  const upsertProcurementUnitOption = async (option: ProcurementOption) => {
    if (!option.value) return;

    const { error } = await supabase
      .from('procurement_units')
      .upsert(
        {
          id: `unit-${option.value}`,
          value: option.value,
          label: option.label,
          short_label: option.value,
        },
        { onConflict: 'value' }
      );

    if (error) throw error;
  };

  const registerCategoryOption = (value: string) => {
    const nextOption = createCategoryOption(value);

    setCategoryOptions(currentOptions => {
      const exists = currentOptions.some(
        option => option.value === nextOption.value
      );

      if (exists) return currentOptions;

      return [...currentOptions, nextOption];
    });

    return nextOption.value;
  };

  const registerUnitOption = (value: string) => {
    const nextOption = createUnitOption(value);

    setUnitOptions(currentOptions => {
      const exists = currentOptions.some(
        option => option.value.toLowerCase() === nextOption.value.toLowerCase()
      );

      if (exists) return currentOptions;

      return [...currentOptions, nextOption];
    });

    return nextOption.value;
  };

  const activeItemCount = items.filter(item => item.status === 'active').length;
  const averageMarkup =
    items.length > 0
      ? Math.round(
          items.reduce((total, item) => total + item.markupPercent, 0) /
            items.length
        )
      : 0;
  const averageSaleRate =
    items.length > 0
      ? Math.round(
          items.reduce((total, item) => total + item.sellingRatePerUnit, 0) /
            items.length
        )
      : 0;

  const handleItemNameChange = (nextName: string) => {
    setFormState(current => {
      const previousAutoDescription = createItemMasterDefaultDescription(
        current.name
      );
      const isDescriptionManual =
        current.defaultDescription.trim() &&
        current.defaultDescription !== previousAutoDescription;

      return {
        ...current,
        name: nextName,
        defaultDescription: isDescriptionManual
          ? current.defaultDescription
          : createItemMasterDefaultDescription(nextName),
      };
    });
  };

  const openCreateModal = () => {
    setFormState(createFormState());
    setModalState({ mode: 'create', item: null });
  };

  const openEditModal = (item: ProcurementItem) => {
    setFormState(createFormState(item));
    setModalState({ mode: 'edit', item });
  };

  const closeModal = () => {
    setModalState(null);
    setFormState(createFormState());
  };

  const handleSubmitItem = async () => {
    const trimmedName = formState.name.trim();
    const trimmedUnit = formState.defaultUnitLabel.trim();
    const purchaseRate = Number(formState.purchaseRatePerUnit);
    const markupPercent = Number(formState.markupPercent);

    if (!trimmedName || !trimmedUnit || Number.isNaN(purchaseRate)) return;
    if (Number.isNaN(markupPercent)) return;

    const isEditingItem = modalState?.mode === 'edit';
    showOperationLoading(isEditingItem ? 'Saving Item' : 'Adding Item');
    setDataError('');

    const categoryOption = createCategoryOption(formState.category);
    const unitOption = createUnitOption(normalizeUnitValue(trimmedUnit));
    const itemCategory = registerCategoryOption(formState.category);
    const itemUnit = registerUnitOption(normalizeUnitValue(trimmedUnit));

    const item: ProcurementItem = {
      id: modalState?.mode === 'edit' ? modalState.item.id : createId('item'),
      name: trimmedName,
      category: itemCategory,
      defaultUnitLabel: itemUnit,
      purchaseRatePerUnit: purchaseRate,
      markupPercent,
      sellingRatePerUnit: calculateSellingRate(purchaseRate, markupPercent),
      defaultDescription: formState.defaultDescription.trim(),
      status: formState.status,
      updatedAt: new Date().toISOString(),
    };

    try {
      await upsertProcurementCategoryOption(categoryOption);
      await upsertProcurementUnitOption(unitOption);

      const { data, error } = await supabase
        .from('procurement_items')
        .upsert(mapProcurementItemToUpsertPayload(item), { onConflict: 'id' })
        .select('*')
        .maybeSingle();

      if (error) throw error;

      const savedItem = data
        ? mapItemRecordToProcurementItem(data as ProcurementItemRecord)
        : item;

      setItems(currentItems => {
        const exists = currentItems.some(currentItem => currentItem.id === savedItem.id);

        if (exists) {
          return currentItems.map(currentItem =>
            currentItem.id === savedItem.id ? savedItem : currentItem
          );
        }

        return [savedItem, ...currentItems];
      });

      closeModal();
      await showOperationSuccess(isEditingItem ? 'Item Saved' : 'Item Added');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not save item.';
      setDataError(message);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    showOperationLoading('Deleting Item');
    setDataError('');

    try {
      const { error } = await supabase
        .from('procurement_items')
        .delete()
        .eq('id', deleteTarget.id);

      if (error) throw error;

      setItems(currentItems =>
        currentItems.filter(item => item.id !== deleteTarget.id)
      );

      setDeleteTarget(null);
      await showOperationSuccess('Item Deleted');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not delete item.';
      setDataError(message);
    }
  };

  const purchaseRatePreview = Number(formState.purchaseRatePerUnit);
  const markupPreview = Number(formState.markupPercent);
  const sellingRatePreview =
    Number.isNaN(purchaseRatePreview) || Number.isNaN(markupPreview)
      ? 0
      : calculateSellingRate(purchaseRatePreview, markupPreview);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Gravium OS"
        title="Items"
        description="Manage reusable item presets for estimates, procurement rates, markups, units, and default descriptions."
        actions={
          <Button type="button" onClick={openCreateModal} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Item
          </Button>
        }
      />

      {(isLoadingMasters || dataError) && (
        <div className="mb-4 rounded-2xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
          {isLoadingMasters ? 'Loading item masters from Supabase...' : dataError}
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
        <SectionCard className="shadow-none">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Total Items</p>
              <p className="mt-1 text-3xl font-semibold text-foreground">
                {items.length}
              </p>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Package className="h-5 w-5" />
            </div>
          </div>
        </SectionCard>

        <SectionCard className="shadow-none">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Active Items</p>
              <p className="mt-1 text-3xl font-semibold text-foreground">
                {activeItemCount}
              </p>
            </div>

            <StatusBadge variant="success">Ready</StatusBadge>
          </div>
        </SectionCard>

        <SectionCard className="col-span-2 shadow-none md:col-span-1">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Avg Markup</p>
              <p className="mt-1 text-3xl font-semibold text-foreground">
                {averageMarkup}%
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Avg sale rate {formatINR(averageSaleRate)}
              </p>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Calculator className="h-5 w-5" />
            </div>
          </div>
        </SectionCard>
      </div>

      <SectionCard className="mb-6 overflow-visible shadow-none">
        <div className="grid gap-3 overflow-visible md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_220px_180px]">
          <label className="grid min-w-0 gap-2">
            <span className="text-sm font-medium text-foreground">Search</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Search item, unit, or description"
                className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-foreground"
              />
            </div>
          </label>

          <DropdownField
            label="Scope / Category"
            value={category}
            options={categoryFilterOptions}
            searchable
            placeholder="Search scope or category"
            onChange={setCategory}
          />

          <DropdownField
            label="Status"
            value={status}
            options={statusOptions}
            onChange={value => setStatus(value as ItemStatus | 'all')}
          />
        </div>
      </SectionCard>

      {filteredItems.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-sm">
          <div className="hidden grid-cols-[minmax(260px,1fr)_minmax(360px,1.1fr)_72px] items-center gap-4 border-b border-border bg-muted/35 px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground lg:grid">
            <span>Item</span>
            <span>Rates</span>
            <span className="text-center">Actions</span>
          </div>

          <div className="divide-y divide-border">
            {filteredItems.map(item => (
              <article
                key={item.id}
                className="relative grid gap-3 bg-card px-4 py-4 text-card-foreground transition hover:bg-muted/25 lg:grid-cols-[minmax(260px,1fr)_minmax(360px,1.1fr)_72px] lg:items-center lg:gap-4"
              >
                <div className="min-w-0 pr-12 lg:pr-0">
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-2">
                      <h3 className="truncate text-sm font-semibold text-foreground sm:text-base">
                        {item.name}
                      </h3>

                      <span className="hidden lg:inline-flex">
                        <StatusBadge
                          variant={item.status === 'active' ? 'success' : 'warning'}
                        >
                          {item.status === 'active' ? 'Active' : 'Inactive'}
                        </StatusBadge>
                      </span>
                    </div>

                    <div className="mt-1 flex min-w-0 items-center gap-2">
                      <p className="truncate text-xs text-muted-foreground sm:text-sm">
                        {formatCategory(item.category)}
                      </p>

                      <span className="shrink-0 lg:hidden">
                        <StatusBadge
                          variant={item.status === 'active' ? 'success' : 'warning'}
                        >
                          {item.status === 'active' ? 'Active' : 'Inactive'}
                        </StatusBadge>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
                  <div className="min-w-0 rounded-xl border border-border bg-background px-3 py-2">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground lg:text-[11px]">
                      Cost
                    </p>
                    <p className="mt-1 text-xs font-semibold text-foreground sm:text-sm">
                      {formatINR(item.purchaseRatePerUnit)}
                      <span className="text-muted-foreground"> / {item.defaultUnitLabel}</span>
                    </p>
                  </div>

                  <div className="min-w-0 rounded-xl border border-foreground/15 bg-muted/35 px-3 py-2 lg:order-3">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground lg:text-[11px]">
                      Sale
                    </p>
                    <p className="mt-1 text-xs font-semibold text-foreground sm:text-sm">
                      {formatINR(item.sellingRatePerUnit)}
                      <span className="text-muted-foreground"> / {item.defaultUnitLabel}</span>
                    </p>
                  </div>

                  <div className="col-span-2 min-w-0 rounded-xl border border-border bg-background px-3 py-2 lg:order-2 lg:col-span-1">
                    <div className="flex items-center justify-between gap-3 lg:block">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground lg:text-[11px]">
                        Markup
                      </p>
                      <p className="text-xs font-semibold text-foreground sm:text-sm lg:mt-1">
                        {item.markupPercent}%
                      </p>
                    </div>
                  </div>
                </div>

                <div className="absolute right-4 top-4 flex justify-end lg:relative lg:right-auto lg:top-auto">
                  <button
                    type="button"
                    onClick={event => {
                      const rect = event.currentTarget.getBoundingClientRect();
                      const isCurrentMenuOpen = actionMenuItemId === item.id;

                      setActionMenuItemId(isCurrentMenuOpen ? null : item.id);
                      setActionMenuPosition(
                        isCurrentMenuOpen
                          ? null
                          : {
                              top: rect.bottom + 8,
                              left: rect.right - 176,
                              width: 176,
                            }
                      );
                    }}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition hover:bg-muted hover:text-foreground"
                    aria-label={`Open actions for ${item.name}`}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>

                  {actionMenuItemId === item.id && (
                    <ItemActionMenu
                      item={item}
                      menuPosition={actionMenuPosition}
                      onClose={() => {
                        setActionMenuItemId(null);
                        setActionMenuPosition(null);
                      }}
                      onEdit={openEditModal}
                      onDelete={setDeleteTarget}
                    />
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : (
        <EmptyState
          icon={Package}
          title={items.length === 0 ? 'No items yet' : 'No items found'}
          description={
            items.length === 0
              ? 'Add your first procurement item to start building real estimate presets.'
              : 'Try changing the search term or filters to find matching items.'
          }
          action={
            items.length === 0 ? (
              <Button type="button" onClick={openCreateModal}>
                Add Item
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSearch('');
                  setCategory('all');
                  setStatus('all');
                }}
              >
                Clear Filters
              </Button>
            )
          }
        />
      )}

      {modalState && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl border border-border bg-card p-5 text-card-foreground shadow-xl sm:rounded-3xl">
            <h2 className="text-lg font-semibold text-foreground">
              {modalState.mode === 'create' ? 'Add Item' : 'Edit Item'}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage default unit, cost rate, markup, sale rate, and estimate description.
            </p>

            <div className="mt-5 grid gap-4">
              <label className="grid gap-2">
                <span className="text-sm font-medium text-foreground">Item Name</span>
                <input
                  value={formState.name}
                  onChange={event => handleItemNameChange(event.target.value)}
                  placeholder="e.g. TV Unit"
                  className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-foreground"
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <DropdownField
                  label="Scope / Category"
                  value={formState.category}
                  options={formCategoryOptions}
                  searchable
                  allowCustom
                  customAddLabel="Add Scope / Category"
                  placeholder="Search or add scope"
                  onChange={value => {
                    const categoryValue = registerCategoryOption(value);

                    setFormState(current => ({
                      ...current,
                      category: categoryValue,
                    }));
                  }}
                />

                <DropdownField
                  label="Status"
                  value={formState.status}
                  options={statusOptions.filter(option => option.value !== 'all')}
                  onChange={value =>
                    setFormState(current => ({
                      ...current,
                      status: value as ItemStatus,
                    }))
                  }
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <DropdownField
                  label="Default Unit"
                  value={formState.defaultUnitLabel}
                  options={unitOptions}
                  searchable
                  allowCustom
                  customAddLabel="Add Unit"
                  placeholder="Search or add unit"
                  onChange={value => {
                    const unitValue = registerUnitOption(value);

                    setFormState(current => ({
                      ...current,
                      defaultUnitLabel: unitValue,
                    }));
                  }}
                />

                <label className="grid gap-2">
                  <span className="text-sm font-medium text-foreground">Cost Rate</span>
                  <input
                    type="number"
                    min="0"
                    value={formState.purchaseRatePerUnit}
                    onChange={event =>
                      setFormState(current => ({
                        ...current,
                        purchaseRatePerUnit: event.target.value,
                      }))
                    }
                    placeholder="500"
                    className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-foreground"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-medium text-foreground">Markup %</span>
                  <input
                    type="number"
                    min="0"
                    value={formState.markupPercent}
                    onChange={event =>
                      setFormState(current => ({
                        ...current,
                        markupPercent: event.target.value,
                      }))
                    }
                    placeholder="30"
                    className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-foreground"
                  />
                </label>
              </div>

              <div className="rounded-2xl border border-border bg-muted/30 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Calculated Sale Rate
                </p>
                <p className="mt-1 text-xl font-semibold text-foreground">
                  {formatINR(sellingRatePreview)}
                </p>
              </div>

              <label className="grid gap-2">
                <span className="text-sm font-medium text-foreground">
                  Default Description
                </span>
                <textarea
                  value={formState.defaultDescription}
                  onChange={event =>
                    setFormState(current => ({
                      ...current,
                      defaultDescription: event.target.value,
                    }))
                  }
                  rows={4}
                  placeholder="Default estimate description for this item"
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-foreground"
                />
              </label>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={closeModal}>
                Cancel
              </Button>

              <Button
                type="button"
                onClick={handleSubmitItem}
                disabled={
                  !formState.name.trim() ||
                  !formState.defaultUnitLabel.trim() ||
                  formState.purchaseRatePerUnit === '' ||
                  formState.markupPercent === ''
                }
              >
                {modalState.mode === 'create' ? 'Add Item' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6">
          <div className="w-full max-w-md rounded-t-3xl border border-border bg-card p-5 text-card-foreground shadow-xl sm:rounded-3xl">
            <h2 className="text-lg font-semibold text-foreground">
              Delete item?
            </h2>

            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              This will remove{' '}
              <span className="font-medium text-foreground">
                {deleteTarget.name}
              </span>{' '}
              from the Items master. This change will be saved to Supabase.
            </p>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </Button>

              <Button
                type="button"
                variant="destructive"
                onClick={handleConfirmDelete}
              >
                Delete Item
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
