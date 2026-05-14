import { useEffect, useMemo, useState } from 'react';
import {
  Calculator,
  ChevronDown,
  Package,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
} from 'lucide-react';

import { EmptyState } from '@/components/common/EmptyState';
import { PageHeader } from '@/components/common/PageHeader';
import { SectionCard } from '@/components/common/SectionCard';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';

import { defaultCostEstimateUnits } from '@/features/cost-estimate/data';
import { demoProcurementItems } from '@/features/items/data';
import { vendorCategoryLabels } from '@/features/vendors/data';
import type {
  ItemCategory,
  ItemStatus,
  ProcurementItem,
} from '@/features/items/types';

const ITEMS_STORAGE_KEY = 'gravium-os-items-demo';
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
  return defaultCostEstimateUnits.map(unit => ({
    value: unit.shortLabel,
    label: unit.shortLabel,
  }));
}

function createUnitOption(value: string) {
  const trimmedValue = value.trim();

  return {
    value: trimmedValue,
    label: trimmedValue,
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
  if (typeof window === 'undefined') return demoProcurementItems;

  try {
    const storedItems = localStorage.getItem(ITEMS_STORAGE_KEY);

    if (!storedItems) return demoProcurementItems;

    const parsedItems = JSON.parse(storedItems);

    if (!Array.isArray(parsedItems)) return demoProcurementItems;

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
  } catch {
    return demoProcurementItems;
  }
}

export default function ItemsPage() {
  const [items, setItems] = useState<ProcurementItem[]>(() => getStoredItems());
  const [categoryOptions, setCategoryOptions] = useState(() =>
    getStoredCategoryOptions()
  );
  const [unitOptions, setUnitOptions] = useState(() => getStoredUnitOptions());
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('all');
  const [status, setStatus] = useState<ItemStatus | 'all'>('all');
  const [modalState, setModalState] = useState<ItemModalState>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProcurementItem | null>(null);
  const [formState, setFormState] = useState<ItemFormState>(() =>
    createFormState()
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    localStorage.setItem(ITEMS_STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    localStorage.setItem(
      PROCUREMENT_CATEGORIES_STORAGE_KEY,
      JSON.stringify(categoryOptions.filter(option => option.value !== 'all'))
    );
  }, [categoryOptions]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    localStorage.setItem(PROCUREMENT_UNITS_STORAGE_KEY, JSON.stringify(unitOptions));
  }, [unitOptions]);

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
  }, [items]);

  const formCategoryOptions = categoryFilterOptions.filter(
    option => option.value !== 'all'
  );

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

  const handleSubmitItem = () => {
    const trimmedName = formState.name.trim();
    const trimmedUnit = formState.defaultUnitLabel.trim();
    const purchaseRate = Number(formState.purchaseRatePerUnit);
    const markupPercent = Number(formState.markupPercent);

    if (!trimmedName || !trimmedUnit || Number.isNaN(purchaseRate)) return;
    if (Number.isNaN(markupPercent)) return;

    const itemCategory = registerCategoryOption(formState.category);
    const itemUnit = registerUnitOption(trimmedUnit);

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

    setItems(currentItems => {
      const exists = currentItems.some(currentItem => currentItem.id === item.id);

      if (exists) {
        return currentItems.map(currentItem =>
          currentItem.id === item.id ? item : currentItem
        );
      }

      return [item, ...currentItems];
    });

    closeModal();
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;

    setItems(currentItems =>
      currentItems.filter(item => item.id !== deleteTarget.id)
    );

    setDeleteTarget(null);
  };

  const handleResetDemoData = () => {
    const confirmed = window.confirm(
      'Reset items to the original demo data? This will remove locally added items.'
    );

    if (!confirmed) return;

    localStorage.removeItem(ITEMS_STORAGE_KEY);
    setItems(demoProcurementItems);
    setSearch('');
    setCategory('all');
    setStatus('all');
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
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={handleResetDemoData}
              className="gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Reset Demo
            </Button>

            <Button type="button" onClick={openCreateModal} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Item
            </Button>
          </div>
        }
      />

      <div className="mb-6 grid gap-4 md:grid-cols-3">
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

        <SectionCard className="shadow-none">
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
        <div className="grid gap-4 lg:grid-cols-2">
          {filteredItems.map(item => (
            <div
              key={item.id}
              className="flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card p-3 text-card-foreground shadow-sm sm:p-4"
            >
              <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                <div className="order-2 min-w-0 flex-1 sm:order-1">
                  <p className="break-words text-base font-semibold leading-snug text-foreground sm:truncate sm:text-lg">
                    {item.name}
                  </p>
                  <p className="mt-1 break-words text-xs text-muted-foreground sm:text-sm">
                    {formatCategory(item.category)} - {item.defaultUnitLabel}
                  </p>
                </div>

                <div className="order-1 self-start sm:order-2">
                  <StatusBadge
                    variant={item.status === 'active' ? 'success' : 'warning'}
                  >
                    {item.status === 'active' ? 'Active' : 'Inactive'}
                  </StatusBadge>
                </div>
              </div>

              <div className="mt-4 grid min-w-0 grid-cols-1 gap-2 rounded-xl border border-border bg-muted/30 p-3 min-[390px]:grid-cols-3 sm:gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground sm:text-xs">
                    Cost Rate
                  </p>
                  <p className="mt-1 break-words text-sm font-semibold text-foreground sm:text-base">
                    {formatINR(item.purchaseRatePerUnit)}
                  </p>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Markup
                  </p>
                  <p className="mt-1 font-semibold text-foreground">
                    {item.markupPercent}%
                  </p>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Sale Rate
                  </p>
                  <p className="mt-1 font-semibold text-foreground">
                    {formatINR(item.sellingRatePerUnit)}
                  </p>
                </div>
              </div>

              <p className="mt-4 line-clamp-3 break-words text-sm leading-6 text-muted-foreground sm:line-clamp-2">
                {item.defaultDescription || 'No default description added yet.'}
              </p>

              <div className="mt-auto grid grid-cols-1 gap-2 pt-4 sm:grid-cols-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => openEditModal(item)}
                  className="h-10 w-full justify-center gap-2"
                >
                  <Pencil className="h-4 w-4" />
                  Edit Item
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDeleteTarget(item)}
                  className="h-10 w-full justify-center gap-2 text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Package}
          title="No items found"
          description="Try changing the search term or filters to find matching items."
          action={
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
              from the local item list. This does not affect Supabase yet.
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
