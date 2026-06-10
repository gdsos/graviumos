import { useEffect, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';

import { FormField } from '@/components/common/FormField';
import { Button } from '@/components/ui/button';

import {
  vendorAvailabilityLabels,
  vendorStatusLabels,
} from '../data';

import type {
  Vendor,
  VendorAvailability,
  VendorCategory,
  VendorStatus,
} from '../types';

type VendorFormMode = 'create' | 'edit';

interface DropdownOption {
  value: string;
  label: string;
}

interface VendorFormModalProps {
  open: boolean;
  mode: VendorFormMode;
  vendor?: Vendor | null;
  categoryOptions: DropdownOption[];
  onCreateCategory: (value: string) => VendorCategory;
  onClose: () => void;
  onSubmit: (vendor: Vendor) => void;
}

interface VendorFormState {
  name: string;
  category: VendorCategory;
  scopeOfWork: string;
  contactPerson: string;
  phoneCountryCode: string;
  phoneNumber: string;
  email: string;
  location: string;
  rating: string;
  status: VendorStatus;
  availability: VendorAvailability;
  assignedProjectCount: string;
}

const emptyForm: VendorFormState = {
  name: '',
  category: 'civil',
  scopeOfWork: '',
  contactPerson: '',
  phoneCountryCode: '+91',
  phoneNumber: '',
  email: '',
  location: '',
  rating: '4.0',
  status: 'active',
  availability: 'available',
  assignedProjectCount: '0',
};

const inputClass =
  'w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-foreground';

const phoneCountryCodes = [
  { value: '+91', label: 'IN +91' },
  { value: '+971', label: 'UAE +971' },
  { value: '+966', label: 'SA +966' },
  { value: '+974', label: 'QA +974' },
  { value: '+965', label: 'KW +965' },
  { value: '+968', label: 'OM +968' },
];

interface DropdownFieldProps {
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  searchable?: boolean;
  allowCustom?: boolean;
  placeholder?: string;
}

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
  allowCustom = false,
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
            onKeyDown={event => {
              if (event.key === 'Enter' && canUseCustom) {
                event.preventDefault();
                handleSelect(query.trim());
              }
            }}
            placeholder={placeholder}
            className={`${inputClass} pr-9`}
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

          {canUseCustom && (
            <button
              type="button"
              onMouseDown={event => event.preventDefault()}
              onClick={() => handleSelect(query.trim())}
              className="block w-full border-t border-border px-3 py-2 text-left text-sm transition hover:bg-muted"
            >
              Add Category: {query.trim()}
            </button>
          )}

          {matchingOptions.length === 0 && !canUseCustom && (
            <p className="px-3 py-2 text-sm text-muted-foreground">
              No options found.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function createId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `vendor-${Date.now()}`;
}

function parsePhone(phone: string) {
  const trimmedPhone = phone.trim();

  const matchedCountryCode = phoneCountryCodes.find(option =>
    trimmedPhone.startsWith(option.value)
  );

  if (!matchedCountryCode) {
    return {
      phoneCountryCode: '+91',
      phoneNumber: trimmedPhone.replace(/\D/g, '').slice(-10),
    };
  }

  return {
    phoneCountryCode: matchedCountryCode.value,
    phoneNumber: trimmedPhone
      .replace(matchedCountryCode.value, '')
      .replace(/\D/g, '')
      .slice(0, 10),
  };
}

function mapVendorToForm(vendor: Vendor): VendorFormState {
  const parsedPhone = parsePhone(vendor.phone);

  return {
    name: vendor.name,
    category: vendor.category,
    scopeOfWork: vendor.scopeOfWork,
    contactPerson: vendor.contactPerson,
    phoneCountryCode: parsedPhone.phoneCountryCode,
    phoneNumber: parsedPhone.phoneNumber,
    email: vendor.email ?? '',
    location: vendor.location,
    rating: String(vendor.rating),
    status: vendor.status,
    availability: vendor.availability,
    assignedProjectCount: String(vendor.assignedProjectCount),
  };
}

export function VendorFormModal({
  open,
  mode,
  vendor,
  categoryOptions,
  onCreateCategory,
  onClose,
  onSubmit,
}: VendorFormModalProps) {
  const [form, setForm] = useState<VendorFormState>(emptyForm);

  useEffect(() => {
    if (!open) return;

    if (mode === 'edit' && vendor) {
      setForm(mapVendorToForm(vendor));
      return;
    }

    setForm(emptyForm);
  }, [mode, open, vendor]);

  if (!open) return null;

  const statuses = Object.entries(vendorStatusLabels) as Array<
    [VendorStatus, string]
  >;

  const availabilities = Object.entries(vendorAvailabilityLabels) as Array<
    [VendorAvailability, string]
  >;

  const updateForm = <K extends keyof VendorFormState>(
    key: K,
    value: VendorFormState[K]
  ) => {
    setForm(current => ({ ...current, [key]: value }));
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    const now = new Date().toISOString().slice(0, 10);

    const nextVendor: Vendor = {
      id: vendor?.id ?? createId(),
      name: form.name.trim(),
      category: onCreateCategory(form.category),
      scopeOfWork: form.scopeOfWork.trim(),
      contactPerson: form.contactPerson.trim(),
      phone: `${form.phoneCountryCode} ${form.phoneNumber.trim()}`,
      email: form.email.trim() || undefined,
      location: form.location.trim(),
      rating: Number(form.rating) || 0,
      status: form.status,
      availability: form.availability,
      assignedProjectCount: Number(form.assignedProjectCount) || 0,
      createdAt: vendor?.createdAt ?? now,
      updatedAt: now,
    };

    onSubmit(nextVendor);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6">
      <div className="flex h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl border border-border bg-card text-card-foreground shadow-xl sm:h-auto sm:max-h-[92dvh] sm:rounded-3xl">
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Vendor Directory
            </p>
            <h2 className="mt-1 text-xl font-semibold text-foreground">
              {mode === 'edit' ? 'Edit Vendor' : 'Add Vendor'}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage global vendor information for future project timeline planning.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-border p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto px-5 py-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Vendor Name" required>
              <input
                value={form.name}
                onChange={event => updateForm('name', event.target.value)}
                required
                className={inputClass}
                placeholder="e.g. Premium Texture Works"
              />
            </FormField>

            <FormField label="Scope / Category" required>
              <DropdownField
                value={form.category}
                options={categoryOptions}
                searchable
                allowCustom
                placeholder="Search or add category"
                onChange={value => updateForm('category', onCreateCategory(value))}
              />
            </FormField>

            <FormField label="Contact Person" required>
              <input
                value={form.contactPerson}
                onChange={event =>
                  updateForm('contactPerson', event.target.value)
                }
                required
                className={inputClass}
                placeholder="Contact person"
              />
            </FormField>

            <FormField label="Phone" required>
              <div className="grid grid-cols-[128px_1fr] gap-2">
                <div className="w-[128px] shrink-0">
                  <DropdownField
                    value={form.phoneCountryCode}
                    options={phoneCountryCodes}
                    onChange={value => updateForm('phoneCountryCode', value)}
                    placeholder="Code"
                  />
                </div>

                <input
                  value={form.phoneNumber}
                  onChange={event => {
                    const digitsOnly = event.target.value.replace(/\D/g, '').slice(0, 10);
                    updateForm('phoneNumber', digitsOnly);
                  }}
                  required
                  inputMode="numeric"
                  maxLength={10}
                  pattern="[0-9]{10}"
                  className={inputClass}
                  placeholder="10 digit number"
                />
              </div>
            </FormField>

            <FormField label="Email">
              <input
                type="email"
                value={form.email}
                onChange={event => updateForm('email', event.target.value)}
                className={inputClass}
                placeholder="vendor@example.com"
              />
            </FormField>

            <FormField label="Location" required>
              <input
                value={form.location}
                onChange={event => updateForm('location', event.target.value)}
                required
                className={inputClass}
                placeholder="Kochi"
              />
            </FormField>

            <FormField label="Status" required>
              <DropdownField
                value={form.status}
                options={statuses.map(([value, label]) => ({ value, label }))}
                onChange={value => updateForm('status', value as VendorStatus)}
              />
            </FormField>

            <FormField label="Availability" required>
              <DropdownField
                value={form.availability}
                options={availabilities.map(([value, label]) => ({
                  value,
                  label,
                }))}
                onChange={value =>
                  updateForm('availability', value as VendorAvailability)
                }
              />
            </FormField>

            <FormField label="Rating">
              <input
                type="number"
                min="0"
                max="5"
                step="0.1"
                value={form.rating}
                onChange={event => updateForm('rating', event.target.value)}
                className={inputClass}
              />
            </FormField>

            <div className="sm:col-span-2">
              <FormField label="Scope of Work" required>
                <textarea
                  value={form.scopeOfWork}
                  onChange={event =>
                    updateForm('scopeOfWork', event.target.value)
                  }
                  required
                  rows={3}
                  className={inputClass}
                  placeholder="Describe the vendor scope..."
                />
              </FormField>
            </div>          </div>

          <div className="mt-6 flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>

            <Button type="submit">
              {mode === 'edit' ? 'Save Changes' : 'Add Vendor'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
