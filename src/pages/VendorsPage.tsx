import { useEffect, useMemo, useRef, useState, type SVGProps } from 'react';
import {
  CalendarPlus,
  Mail,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Phone,
  Plus,
  RefreshCcw,
  RotateCcw,
  Store,
  Trash2,
  UsersRound,
  X,
} from 'lucide-react';

import { EmptyState } from '@/components/common/EmptyState';
import { PageHeader } from '@/components/common/PageHeader';
import { useOperationFeedback } from '@/contexts/OperationFeedbackContext';
import { SectionCard } from '@/components/common/SectionCard';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';

import {
  demoVendors,
  vendorAvailabilityLabels,
  vendorCategoryLabels,
  vendorStatusLabels,
} from '@/features/vendors/data';
import { VendorCard } from '@/features/vendors/components/VendorCard';
import { VendorFilters } from '@/features/vendors/components/VendorFilters';
import { VendorFormModal } from '@/features/vendors/components/VendorFormModal';
import type {
  Vendor,
  VendorAvailability,
  VendorCategory,
  VendorStatus,
} from '@/features/vendors/types';

type VendorModalState =
  | { mode: 'create'; vendor: null }
  | { mode: 'edit'; vendor: Vendor }
  | null;
const VENDORS_STORAGE_KEY = 'gravium-os-vendors-demo';
const PROCUREMENT_CATEGORIES_STORAGE_KEY =
  'gravium-os-procurement-categories-demo';

interface ProcurementCategoryOption {
  value: string;
  label: string;
}

function formatCategoryLabel(value: string) {
  return value
    .trim()
    .replaceAll('_', ' ')
    .replace(/\b\w/g, letter => letter.toUpperCase());
}

function normalizeCategoryValue(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, '_');
}

function createCategoryOption(value: string): ProcurementCategoryOption {
  const trimmedValue = value.trim();

  return {
    value: normalizeCategoryValue(trimmedValue),
    label: formatCategoryLabel(trimmedValue),
  };
}

function getDefaultCategoryOptions(): ProcurementCategoryOption[] {
  return [
    { value: 'all', label: 'All Categories' },
    ...Object.entries(vendorCategoryLabels).map(([value, label]) => ({
      value,
      label,
    })),
  ];
}

function getStoredCategoryOptions(): ProcurementCategoryOption[] {
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

function getVendorAvailabilityVariant(availability: VendorAvailability) {
  if (availability === 'available') return 'success';
  if (availability === 'busy') return 'warning';
  return 'muted';
}

function getVendorStatusVariant(status: VendorStatus) {
  if (status === 'active') return 'success';
  if (status === 'blacklisted') return 'danger';
  return 'muted';
}

function getRatingPillClass(rating: number) {
  if (rating >= 4.5) {
    return 'border-amber-400/60 bg-amber-500/15 text-amber-700 dark:text-amber-200';
  }

  if (rating >= 3.5) {
    return 'border-slate-300/70 bg-slate-400/15 text-slate-700 dark:text-slate-200';
  }

  return 'border-orange-500/50 bg-orange-600/15 text-orange-700 dark:text-orange-200';
}

function getWhatsAppUrl(phone: string) {
  const cleanedPhone = phone.replace(/\D/g, '');

  if (!cleanedPhone) return null;

  return `https://wa.me/${cleanedPhone}`;
}

function WhatsAppIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      {...props}
    >
      <path
        d="M16 3C8.8 3 3 8.55 3 15.4c0 2.4.72 4.65 1.96 6.55L3.5 29l7.25-1.9A13.64 13.64 0 0 0 16 28c7.2 0 13-5.55 13-12.6S23.2 3 16 3Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path
        d="M11.55 9.2c-.35 0-.9.12-1.34.58-.45.48-1.2 1.18-1.2 2.9 0 1.72 1.25 3.38 1.43 3.62.18.24 2.43 3.9 6.05 5.32 3 .98 3.63.78 4.28.73.65-.05 2.12-.86 2.42-1.7.3-.84.3-1.55.21-1.7-.09-.15-.33-.24-.69-.42-.36-.18-2.12-1.05-2.45-1.17-.33-.12-.57-.18-.81.18-.24.36-.93 1.17-1.14 1.41-.21.24-.42.27-.78.09-.36-.18-1.52-.56-2.9-1.78-1.07-.95-1.8-2.13-2.01-2.49-.21-.36-.02-.55.16-.73.16-.16.36-.42.54-.63.18-.21.24-.36.36-.6.12-.24.06-.45-.03-.63-.09-.18-.81-1.96-1.11-2.68-.29-.7-.59-.6-.81-.61-.21-.01-.45-.01-.69-.01Z"
        fill="currentColor"
      />
    </svg>
  );
}

function VendorDetailsPanel({
  vendor,
  onClose,
  onEdit,
  onDelete,
}: {
  vendor: Vendor | null;
  onClose: () => void;
  onEdit: (vendor: Vendor) => void;
  onDelete: (vendor: Vendor) => void;
}) {
  const [isManageOpen, setIsManageOpen] = useState(false);
  const panelRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!vendor) return;

    setIsManageOpen(false);

    window.requestAnimationFrame(() => {
      panelRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
        inline: 'nearest',
      });
    });
  }, [vendor]);

  if (!vendor) return null;

  const categoryLabel =
    vendorCategoryLabels[vendor.category] ?? formatCategoryLabel(vendor.category);
  const whatsappUrl = getWhatsAppUrl(vendor.phone);

  const handleFutureAction = (actionName: string) => {
    window.alert(`${actionName} will be connected after the related module flow is finalised.`);
  };

  const contactIconButtonClass =
    'flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition hover:bg-muted hover:text-foreground';

  return (
    <aside
      ref={panelRef}
      className="hidden overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-sm lg:block"
    >
      <div className="relative border-b border-border p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Vendor Details
            </p>
            <h2 className="mt-2 truncate text-xl font-semibold text-foreground">
              {vendor.name}
            </h2>
            <div className="mt-1 flex min-w-0 items-center gap-2">
              <p className="truncate text-sm text-muted-foreground">{categoryLabel}</p>
              <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${getRatingPillClass(vendor.rating)}`}>
                Rating {vendor.rating.toFixed(1)}
              </span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setIsManageOpen(current => !current)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition hover:bg-muted hover:text-foreground"
              aria-label="Open vendor management actions"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition hover:bg-muted hover:text-foreground"
              aria-label="Close vendor details"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {isManageOpen && (
          <div className="absolute right-5 top-16 z-20 w-52 overflow-hidden rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-xl">
            <button
              type="button"
              onClick={() => {
                setIsManageOpen(false);
                onEdit(vendor);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition hover:bg-muted"
            >
              <Pencil className="h-4 w-4" />
              Edit Vendor
            </button>

            <button
              type="button"
              onClick={() => {
                setIsManageOpen(false);
                onDelete(vendor);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-destructive transition hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4" />
              Delete Vendor
            </button>
          </div>
        )}

        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <StatusBadge variant={getVendorStatusVariant(vendor.status)}>
              {vendorStatusLabels[vendor.status]}
            </StatusBadge>

            <StatusBadge variant={getVendorAvailabilityVariant(vendor.availability)}>
              {vendorAvailabilityLabels[vendor.availability]}
            </StatusBadge>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {vendor.email ? (
              <a
                href={`mailto:${vendor.email}`}
                className={contactIconButtonClass}
                aria-label={`Email ${vendor.name}`}
                title="Email vendor"
              >
                <Mail className="h-4 w-4" />
              </a>
            ) : (
              <button
                type="button"
                className={contactIconButtonClass}
                disabled
                aria-label="Email unavailable"
                title="Email unavailable"
              >
                <Mail className="h-4 w-4" />
              </button>
            )}

            {whatsappUrl ? (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className={contactIconButtonClass}
                aria-label={`WhatsApp ${vendor.name}`}
                title="WhatsApp"
              >
                <WhatsAppIcon className="h-4 w-4" />
              </a>
            ) : (
              <button
                type="button"
                className={contactIconButtonClass}
                disabled
                aria-label="WhatsApp unavailable"
                title="WhatsApp unavailable"
              >
                <MessageCircle className="h-4 w-4" />
              </button>
            )}

            <button
              type="button"
              className={contactIconButtonClass}
              onClick={() => handleFutureAction('Create vendor follow-up task')}
              aria-label={`Create follow-up for ${vendor.name}`}
              title="Follow up"
            >
              <CalendarPlus className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-5 p-5">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Quick Actions</h3>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              className="justify-center gap-2"
              onClick={() => handleFutureAction('Request updated pricing')}
            >
              <RefreshCcw className="h-4 w-4" />
              Request Pricing
            </Button>

            <Button
              type="button"
              variant="outline"
              className="justify-center gap-2"
              onClick={() => handleFutureAction('Assign vendor to project')}
            >
              <UsersRound className="h-4 w-4" />
              Assign Project
            </Button>

            <Button
              type="button"
              variant="outline"
              className="justify-center gap-2"
              onClick={() => handleFutureAction('Log vendor interaction')}
            >
              <MessageCircle className="h-4 w-4" />
              Log Interaction
            </Button>

            <Button
              type="button"
              variant="outline"
              className="justify-center gap-2"
              onClick={() => handleFutureAction('Schedule vendor site visit')}
            >
              <CalendarPlus className="h-4 w-4" />
              Site Visit
            </Button>

            <Button
              type="button"
              variant="outline"
              className="justify-center gap-2"
              onClick={() => handleFutureAction('Mark vendor pricing as outdated')}
            >
              <RefreshCcw className="h-4 w-4" />
              Pricing Outdated
            </Button>

            <Button
              type="button"
              variant="outline"
              className="justify-center gap-2"
              onClick={() => handleFutureAction('Create procurement task')}
            >
              <Store className="h-4 w-4" />
              Procurement Task
            </Button>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-foreground">Contact</h3>

          <div className="mt-3 space-y-2 text-sm text-muted-foreground">
            <p className="flex min-w-0 items-center gap-2">
              <UsersRound className="h-4 w-4 shrink-0" />
              <span className="truncate">{vendor.contactPerson}</span>
            </p>

            <p className="flex min-w-0 items-center gap-2">
              <Phone className="h-4 w-4 shrink-0" />
              <span className="truncate">{vendor.phone}</span>
            </p>

            {vendor.email && (
              <p className="flex min-w-0 items-center gap-2">
                <Mail className="h-4 w-4 shrink-0" />
                <span className="break-all">{vendor.email}</span>
              </p>
            )}

            <p className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{vendor.location}</span>
            </p>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-foreground">Scope</h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {vendor.scopeOfWork}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-background p-4">
          <p className="text-xs text-muted-foreground">Assigned Projects</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">
            {vendor.assignedProjectCount}
          </p>
        </div>
      </div>
    </aside>
  );
}

export default function VendorsPage() {
  const [categoryOptions, setCategoryOptions] = useState(() =>
    getStoredCategoryOptions()
  );
  const [vendors, setVendors] = useState<Vendor[]>(() => {
    if (typeof window === 'undefined') return demoVendors;

    try {
      const storedVendors = localStorage.getItem(VENDORS_STORAGE_KEY);

      if (!storedVendors) return demoVendors;

      const parsedVendors = JSON.parse(storedVendors) as Vendor[];

      return Array.isArray(parsedVendors) ? parsedVendors : demoVendors;
    } catch {
      return demoVendors;
    }
  });
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<VendorCategory | 'all'>('all');
  const [status, setStatus] = useState<VendorStatus | 'all'>('all');
  const [availability, setAvailability] = useState<VendorAvailability | 'all'>('all');
  const [modalState, setModalState] = useState<VendorModalState>(null);
  const [deleteTarget, setDeleteTarget] = useState<Vendor | null>(null);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const {
    showOperationLoading,
    showOperationSuccess,
  } = useOperationFeedback();

  useEffect(() => {
    localStorage.setItem(VENDORS_STORAGE_KEY, JSON.stringify(vendors));
  }, [vendors]);

  useEffect(() => {
    localStorage.setItem(
      PROCUREMENT_CATEGORIES_STORAGE_KEY,
      JSON.stringify(categoryOptions.filter(option => option.value !== 'all'))
    );
  }, [categoryOptions]);

  const categoryFilterOptions = useMemo(() => {
    const optionMap = new Map<string, string>();

    categoryOptions.forEach(option => {
      optionMap.set(option.value, option.label);
    });

    vendors.forEach(vendor => {
      if (!optionMap.has(vendor.category)) {
        optionMap.set(vendor.category, formatCategoryLabel(vendor.category));
      }
    });

    return Array.from(optionMap, ([value, label]) => ({ value, label }));
  }, [categoryOptions, vendors]);

  const formCategoryOptions = categoryFilterOptions.filter(
    option => option.value !== 'all'
  );

  const registerCategoryOption = (value: string): VendorCategory => {
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

  const filteredVendors = useMemo(() => {
    const searchTerm = search.trim().toLowerCase();

    return vendors.filter(vendor => {
      const matchesSearch =
        !searchTerm ||
        [
          vendor.name,
          vendor.scopeOfWork,
          vendor.contactPerson,
          vendor.phone,
          vendor.email,
          vendor.location,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(searchTerm);

      const matchesCategory = category === 'all' || vendor.category === category;
      const matchesStatus = status === 'all' || vendor.status === status;
      const matchesAvailability =
        availability === 'all' || vendor.availability === availability;

      return (
        matchesSearch &&
        matchesCategory &&
        matchesStatus &&
        matchesAvailability
      );
    });
  }, [availability, category, search, status, vendors]);

  const activeVendorCount = vendors.filter(vendor => vendor.status === 'active').length;
  const availableVendorCount = vendors.filter(
    vendor => vendor.availability === 'available'
  ).length;
  const busyVendorCount = vendors.filter(vendor => vendor.availability === 'busy').length;

  const handleSubmitVendor = async (vendor: Vendor) => {
    const isEditingVendor = modalState?.mode === 'edit';
    showOperationLoading(isEditingVendor ? 'Saving Vendor' : 'Adding Vendor');

    setVendors(currentVendors => {
      const exists = currentVendors.some(
        currentVendor => currentVendor.id === vendor.id
      );

      if (exists) {
        return currentVendors.map(currentVendor =>
          currentVendor.id === vendor.id ? vendor : currentVendor
        );
      }

      return [vendor, ...currentVendors];
    });

    setModalState(null);
    await showOperationSuccess(isEditingVendor ? 'Vendor Saved' : 'Vendor Added');
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    showOperationLoading('Deleting Vendor');

    setVendors(currentVendors =>
      currentVendors.filter(vendor => vendor.id !== deleteTarget.id)
    );

    if (selectedVendor?.id === deleteTarget.id) {
      setSelectedVendor(null);
    }

    setDeleteTarget(null);
    await showOperationSuccess('Vendor Deleted');
  };

  // For demo purposes, allow resetting to original demo data
  const handleResetDemoData = () => {
  const confirmed = window.confirm(
    'Reset vendors to the original demo data? This will remove locally added vendors.'
  );

  if (!confirmed) return;

  localStorage.removeItem(VENDORS_STORAGE_KEY);
  setVendors(demoVendors);
  setSearch('');
  setCategory('all');
  setStatus('all');
  setAvailability('all');
};

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Gravium OS"
        title="Vendors"
        description="Global vendor directory for execution, procurement, site work, and future timeline planning."
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

            <Button
              type="button"
              onClick={() => setModalState({ mode: 'create', vendor: null })}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Vendor
            </Button>
          </div>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
        <SectionCard className="shadow-none">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Total Vendors</p>
              <p className="mt-1 text-3xl font-semibold text-foreground">
                {vendors.length}
              </p>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Store className="h-5 w-5" />
            </div>
          </div>
        </SectionCard>

        <SectionCard className="shadow-none">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Active Vendors</p>
              <p className="mt-1 text-3xl font-semibold text-foreground">
                {activeVendorCount}
              </p>
            </div>

            <StatusBadge variant="success">Active</StatusBadge>
          </div>
        </SectionCard>

        <SectionCard className="col-span-2 shadow-none md:col-span-1">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Availability</p>
              <p className="mt-1 text-3xl font-semibold text-foreground">
                {availableVendorCount}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {busyVendorCount} currently busy
              </p>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <UsersRound className="h-5 w-5" />
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="mb-6">
        <VendorFilters
          search={search}
          category={category}
          status={status}
          availability={availability}
          categoryOptions={categoryFilterOptions}
          onSearchChange={setSearch}
          onCategoryChange={setCategory}
          onStatusChange={setStatus}
          onAvailabilityChange={setAvailability}
        />
      </div>

      {filteredVendors.length > 0 ? (
        <div className={selectedVendor ? 'grid gap-4 lg:grid-cols-[minmax(0,1fr)_460px]' : 'grid gap-4'}>
          <div className="overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-sm">
            <div className="hidden grid-cols-[minmax(240px,1.15fr)_minmax(220px,1fr)_minmax(220px,1fr)_170px] items-center gap-4 border-b border-border bg-muted/35 px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground lg:grid">
              <span>Vendor</span>
              <span>Scope</span>
              <span>Contact</span>
              {selectedVendor ? <span /> : <span className="text-center">Actions</span>}
            </div>

            <div className="divide-y divide-border">
              {filteredVendors.map(vendor => (
                <VendorCard
                  key={vendor.id}
                  vendor={vendor}
                  isSelected={selectedVendor?.id === vendor.id}
                  hideDesktopActions={Boolean(selectedVendor)}
                  onSelect={setSelectedVendor}
                  onEdit={selectedVendor =>
                    setModalState({ mode: 'edit', vendor: selectedVendor })
                  }
                  onDelete={setDeleteTarget}
                />
              ))}
            </div>
          </div>

          <VendorDetailsPanel
            vendor={selectedVendor}
            onClose={() => setSelectedVendor(null)}
            onEdit={selectedVendor =>
              setModalState({ mode: 'edit', vendor: selectedVendor })
            }
            onDelete={setDeleteTarget}
          />
        </div>
      ) : (
        <EmptyState
          icon={Store}
          title="No vendors found"
          description="Try changing the search term or filters to find matching vendors."
          action={
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setSearch('');
                setCategory('all');
                setStatus('all');
                setAvailability('all');
              }}
            >
              Clear Filters
            </Button>
          }
        />
      )}

      <VendorFormModal
        open={modalState !== null}
        mode={modalState?.mode ?? 'create'}
        vendor={modalState?.vendor ?? null}
        categoryOptions={formCategoryOptions}
        onCreateCategory={registerCategoryOption}
        onClose={() => setModalState(null)}
        onSubmit={handleSubmitVendor}
      />

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6">
          <div className="w-full max-w-md rounded-t-3xl border border-border bg-card p-5 text-card-foreground shadow-xl sm:rounded-3xl">
            <h2 className="text-lg font-semibold text-foreground">
              Delete vendor?
            </h2>

            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              This will remove{' '}
              <span className="font-medium text-foreground">
                {deleteTarget.name}
              </span>{' '}
              from the local vendor list. This does not affect Supabase yet.
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
                Delete Vendor
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}