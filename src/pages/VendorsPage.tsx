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
import type {
  Vendor,
  VendorAvailability,
  VendorCategory,
  VendorStatus,
} from '@/features/vendors/types';

export default function VendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>(demoVendors);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<VendorCategory | 'all'>('all');
  const [status, setStatus] = useState<VendorStatus | 'all'>('all');
  const [availability, setAvailability] = useState<VendorAvailability | 'all'>('all');

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

  const handleEditVendor = (vendor: Vendor) => {
    window.alert(`Edit vendor coming next: ${vendor.name}`);
  };

  const handleDeleteVendor = (vendor: Vendor) => {
    const confirmed = window.confirm(`Delete ${vendor.name}?`);

    if (!confirmed) return;

    setVendors(currentVendors =>
      currentVendors.filter(currentVendor => currentVendor.id !== vendor.id)
    );
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
            onClick={() => window.alert('Add vendor modal coming next.')}
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
              onEdit={handleEditVendor}
              onDelete={handleDeleteVendor}
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
    </div>
  );
}