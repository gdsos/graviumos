import { useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';

import type { VendorAvailability, VendorCategory, VendorStatus } from '../types';
import {
  vendorAvailabilityLabels,
  vendorStatusLabels,
} from '../data';

interface DropdownOption {
  value: string;
  label: string;
}

interface VendorFiltersProps {
  search: string;
  category: VendorCategory | 'all';
  status: VendorStatus | 'all';
  availability: VendorAvailability | 'all';
  categoryOptions: DropdownOption[];
  onSearchChange: (value: string) => void;
  onCategoryChange: (value: VendorCategory | 'all') => void;
  onStatusChange: (value: VendorStatus | 'all') => void;
  onAvailabilityChange: (value: VendorAvailability | 'all') => void;
}

interface DropdownFieldProps {
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  searchable?: boolean;
  placeholder?: string;
}

const inputClass =
  'h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-foreground';

function formatCategoryLabel(value: string) {
  return value
    .replaceAll('_', ' ')
    .replace(/\b\w/g, letter => letter.toUpperCase());
}

function DropdownField({
  value,
  options,
  onChange,
  searchable = false,
  placeholder = 'Select option',
}: DropdownFieldProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selectedOption = options.find(option => option.value === value);
  const displayValue = selectedOption?.label ?? formatCategoryLabel(value);
  const searchValue = query.trim().toLowerCase();
  const matchingOptions = searchValue
    ? options.filter(option => option.label.toLowerCase().includes(searchValue))
    : options;

  const handleSelect = (nextValue: string) => {
    onChange(nextValue);
    setQuery('');
    setIsOpen(false);
  };

  return (
    <div className="relative min-w-0">
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
            placeholder={placeholder}
            className={`${inputClass} w-full pr-9`}
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
          <span className="truncate">{displayValue}</span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      )}

      {isOpen && (
        <div className="absolute left-0 right-0 top-11 z-[100] max-h-56 min-w-full overflow-y-auto rounded-xl border border-border bg-card text-card-foreground shadow-xl">
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

          {matchingOptions.length === 0 && (
            <p className="px-3 py-2 text-sm text-muted-foreground">
              No options found.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function VendorFilters({
  search,
  category,
  status,
  availability,
  categoryOptions,
  onSearchChange,
  onCategoryChange,
  onStatusChange,
  onAvailabilityChange,
}: VendorFiltersProps) {
  const statusOptions: DropdownOption[] = [
    { value: 'all', label: 'All Statuses' },
    ...Object.entries(vendorStatusLabels).map(([value, label]) => ({
      value,
      label,
    })),
  ];

  const availabilityOptions: DropdownOption[] = [
    { value: 'all', label: 'All Availability' },
    ...Object.entries(vendorAvailabilityLabels).map(([value, label]) => ({
      value,
      label,
    })),
  ];

  return (
    <div className="grid gap-3 overflow-visible rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-sm md:grid-cols-2 xl:grid-cols-[1.5fr_1fr_1fr_1fr]">
      <label className="relative min-w-0">
        <span className="sr-only">Search vendors</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={event => onSearchChange(event.target.value)}
          placeholder="Search vendor, scope, contact, location..."
          className={`${inputClass} w-full pl-9`}
        />
      </label>

      <DropdownField
        value={category}
        options={categoryOptions}
        searchable
        placeholder="Search category"
        onChange={value => onCategoryChange(value as VendorCategory | 'all')}
      />

      <DropdownField
        value={status}
        options={statusOptions}
        onChange={value => onStatusChange(value as VendorStatus | 'all')}
      />

      <DropdownField
        value={availability}
        options={availabilityOptions}
        onChange={value =>
          onAvailabilityChange(value as VendorAvailability | 'all')
        }
      />
    </div>
  );
}
