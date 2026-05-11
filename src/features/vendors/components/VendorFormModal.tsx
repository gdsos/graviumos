import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

import { FormField } from '@/components/common/FormField';
import { Button } from '@/components/ui/button';

import {
  vendorAvailabilityLabels,
  vendorCategoryLabels,
  vendorStatusLabels,
} from '../data';

import type {
  Vendor,
  VendorAvailability,
  VendorCategory,
  VendorStatus,
} from '../types';

type VendorFormMode = 'create' | 'edit';

interface VendorFormModalProps {
  open: boolean;
  mode: VendorFormMode;
  vendor?: Vendor | null;
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
  notes: string;
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
  notes: '',
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
    notes: vendor.notes ?? '',
  };
}

export function VendorFormModal({
  open,
  mode,
  vendor,
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

  const categories = Object.entries(vendorCategoryLabels) as Array<
    [VendorCategory, string]
  >;

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
      category: form.category,
      scopeOfWork: form.scopeOfWork.trim(),
      contactPerson: form.contactPerson.trim(),
      phone: `${form.phoneCountryCode} ${form.phoneNumber.trim()}`,
      email: form.email.trim() || undefined,
      location: form.location.trim(),
      rating: Number(form.rating) || 0,
      status: form.status,
      availability: form.availability,
      assignedProjectCount: Number(form.assignedProjectCount) || 0,
      notes: form.notes.trim() || undefined,
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

            <FormField label="Category" required>
              <select
                value={form.category}
                onChange={event =>
                  updateForm('category', event.target.value as VendorCategory)
                }
                className={inputClass}
              >
                {categories.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
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
              <div className="grid grid-cols-[120px_1fr] gap-2">
                <select
                  value={form.phoneCountryCode}
                  onChange={event =>
                    updateForm('phoneCountryCode', event.target.value)
                  }
                  className={inputClass}
                >
                  {phoneCountryCodes.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>

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
              <select
                value={form.status}
                onChange={event =>
                  updateForm('status', event.target.value as VendorStatus)
                }
                className={inputClass}
              >
                {statuses.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Availability" required>
              <select
                value={form.availability}
                onChange={event =>
                  updateForm(
                    'availability',
                    event.target.value as VendorAvailability
                  )
                }
                className={inputClass}
              >
                {availabilities.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
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

            <FormField label="Assigned Projects">
              <input
                type="number"
                min="0"
                value={form.assignedProjectCount}
                onChange={event =>
                  updateForm('assignedProjectCount', event.target.value)
                }
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
            </div>

            <div className="sm:col-span-2">
              <FormField label="Notes">
                <textarea
                  value={form.notes}
                  onChange={event => updateForm('notes', event.target.value)}
                  rows={3}
                  className={inputClass}
                  placeholder="Internal notes, quality comments, coordination details..."
                />
              </FormField>
            </div>
          </div>

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
