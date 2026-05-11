import { useMemo, useState } from 'react';
import { Plus, Store, UsersRound } from 'lucide-react';

import { EmptyState } from '@/components/common/EmptyState';
import { PageHeader } from '@/components/common/PageHeader';
import { SectionCard } from '@/components/common/SectionCard';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';

import { demoVendors } from '@/features/vendors/data';
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

export default function VendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>(demoVendors);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<VendorCategory | 'all'>('all');
  const [status, setStatus] = useState<VendorStatus | 'all'>('all');
  const [availability, setAvailability] = useState<VendorAvailability | 'all'>('all');
  const [modalState, setModalState] = useState<VendorModalState>(null);
  const [deleteTarget, setDeleteTarget] = useState<Vendor | null>(null);

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
          vendor.notes,
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

  const handleSubmitVendor = (vendor: Vendor) => {
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
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;

    setVendors(currentVendors =>
      currentVendors.filter(vendor => vendor.id !== deleteTarget.id)
    );

    setDeleteTarget(null);
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Gravium OS"
        title="Vendors"
        description="Global vendor directory for execution, procurement, site work, and future timeline planning."
        actions={
          <Button
            type="button"
            onClick={() => setModalState({ mode: 'create', vendor: null })}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Vendor
          </Button>
        }
      />

      <div className="mb-6 grid gap-4 md:grid-cols-3">
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

        <SectionCard className="shadow-none">
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
          onSearchChange={setSearch}
          onCategoryChange={setCategory}
          onStatusChange={setStatus}
          onAvailabilityChange={setAvailability}
        />
      </div>

      {filteredVendors.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredVendors.map(vendor => (
            <VendorCard
              key={vendor.id}
              vendor={vendor}
              onEdit={selectedVendor =>
                setModalState({ mode: 'edit', vendor: selectedVendor })
              }
              onDelete={setDeleteTarget}
            />
          ))}
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