import { Search } from 'lucide-react';
import type { VendorAvailability, VendorCategory, VendorStatus } from '../types';
import {
  vendorAvailabilityLabels,
  vendorCategoryLabels,
  vendorStatusLabels,
} from '../data';

interface VendorFiltersProps {
  search: string;
  category: VendorCategory | 'all';
  status: VendorStatus | 'all';
  availability: VendorAvailability | 'all';
  onSearchChange: (value: string) => void;
  onCategoryChange: (value: VendorCategory | 'all') => void;
  onStatusChange: (value: VendorStatus | 'all') => void;
  onAvailabilityChange: (value: VendorAvailability | 'all') => void;
}

const inputClass =
  'h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-foreground';

export function VendorFilters({
  search,
  category,
  status,
  availability,
  onSearchChange,
  onCategoryChange,
  onStatusChange,
  onAvailabilityChange,
}: VendorFiltersProps) {
  const categories = Object.entries(vendorCategoryLabels) as Array<[VendorCategory, string]>;
  const statuses = Object.entries(vendorStatusLabels) as Array<[VendorStatus, string]>;
  const availabilities = Object.entries(vendorAvailabilityLabels) as Array<[VendorAvailability, string]>;

  return (
    <div className="grid gap-3 rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-sm lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
      <label className="relative">
        <span className="sr-only">Search vendors</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={event => onSearchChange(event.target.value)}
          placeholder="Search vendor, scope, contact, location..."
          className={`${inputClass} w-full pl-9`}
        />
      </label>

      <select
        value={category}
        onChange={event => onCategoryChange(event.target.value as VendorCategory | 'all')}
        className={inputClass}
      >
        <option value="all">All categories</option>
        {categories.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>

      <select
        value={status}
        onChange={event => onStatusChange(event.target.value as VendorStatus | 'all')}
        className={inputClass}
      >
        <option value="all">All statuses</option>
        {statuses.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>

      <select
        value={availability}
        onChange={event => onAvailabilityChange(event.target.value as VendorAvailability | 'all')}
        className={inputClass}
      >
        <option value="all">All availability</option>
        {availabilities.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </div>
  );
}
