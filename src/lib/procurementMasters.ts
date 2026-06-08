import type { ProcurementItem } from '@/features/items/types';
import type { Vendor } from '@/features/vendors/types';
import {
  supabase,
  type ProcurementCategoryRecord,
  type ProcurementItemRecord,
  type ProcurementUnitRecord,
  type VendorRecord,
} from './supabase';

export interface ProcurementOption {
  value: string;
  label: string;
}

export interface ProcurementUnitOption {
  value: string;
  label: string;
}

export const ITEMS_STORAGE_KEY = 'gravium-os-items';
export const LEGACY_ITEMS_STORAGE_KEY = 'gravium-os-items-demo';
export const VENDORS_STORAGE_KEY = 'gravium-os-vendors';
export const PROCUREMENT_CATEGORIES_STORAGE_KEY =
  'gravium-os-procurement-categories-demo';
export const PROCUREMENT_UNITS_STORAGE_KEY = 'gravium-os-procurement-units-demo';

function normalizeValue(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, '_');
}

function readJsonArray(storageKey: string) {
  if (typeof window === 'undefined') return [];

  try {
    const rawValue = window.localStorage.getItem(storageKey);

    if (!rawValue) return [];

    const parsedValue = JSON.parse(rawValue);

    return Array.isArray(parsedValue) ? parsedValue : [];
  } catch {
    return [];
  }
}

function isOptionRecord(value: unknown): value is ProcurementOption {
  return (
    Boolean(value) &&
    typeof value === 'object' &&
    typeof (value as ProcurementOption).value === 'string' &&
    typeof (value as ProcurementOption).label === 'string'
  );
}

function isProcurementItem(value: unknown): value is ProcurementItem {
  const item = value as ProcurementItem;

  return (
    Boolean(item) &&
    typeof item === 'object' &&
    typeof item.id === 'string' &&
    typeof item.name === 'string' &&
    typeof item.category === 'string' &&
    typeof item.defaultUnitLabel === 'string' &&
    typeof item.purchaseRatePerUnit === 'number' &&
    typeof item.markupPercent === 'number' &&
    typeof item.sellingRatePerUnit === 'number' &&
    typeof item.defaultDescription === 'string' &&
    (item.status === 'active' || item.status === 'inactive') &&
    typeof item.updatedAt === 'string'
  );
}

function isVendor(value: unknown): value is Vendor {
  const vendor = value as Vendor;

  return (
    Boolean(vendor) &&
    typeof vendor === 'object' &&
    typeof vendor.id === 'string' &&
    typeof vendor.name === 'string' &&
    typeof vendor.category === 'string' &&
    typeof vendor.scopeOfWork === 'string' &&
    typeof vendor.contactPerson === 'string' &&
    typeof vendor.phone === 'string' &&
    typeof vendor.location === 'string' &&
    typeof vendor.rating === 'number' &&
    ['active', 'inactive', 'blacklisted'].includes(vendor.status) &&
    ['available', 'busy', 'on_hold'].includes(vendor.availability) &&
    typeof vendor.assignedProjectCount === 'number' &&
    typeof vendor.createdAt === 'string' &&
    typeof vendor.updatedAt === 'string'
  );
}

function mergeOptions(...optionGroups: ProcurementOption[][]) {
  const optionMap = new Map<string, ProcurementOption>();

  optionGroups.flat().forEach(option => {
    if (!option || option.value === 'all') return;

    const cleanValue = normalizeValue(option.value);
    const cleanLabel = option.label.trim() || option.value.trim();

    if (!cleanValue) return;

    optionMap.set(cleanValue, {
      value: cleanValue,
      label: cleanLabel,
    });
  });

  return Array.from(optionMap.values()).sort((a, b) =>
    a.label.localeCompare(b.label)
  );
}

function dedupeItems(items: ProcurementItem[]) {
  const itemMap = new Map<string, ProcurementItem>();

  items.forEach(item => {
    const key = item.name.trim().toLowerCase();

    if (!key) return;

    itemMap.set(key, item);
  });

  return Array.from(itemMap.values());
}

function dedupeVendors(vendors: Vendor[]) {
  const vendorMap = new Map<string, Vendor>();

  vendors.forEach(vendor => {
    const key = vendor.name.trim().toLowerCase();

    if (!key) return;

    vendorMap.set(key, vendor);
  });

  return Array.from(vendorMap.values());
}

export function getLocalProcurementCategoryOptions() {
  return readJsonArray(PROCUREMENT_CATEGORIES_STORAGE_KEY).filter(isOptionRecord);
}

export function getLocalProcurementUnitOptions() {
  return readJsonArray(PROCUREMENT_UNITS_STORAGE_KEY).filter(isOptionRecord);
}

export function getLocalProcurementItems() {
  const realItems = readJsonArray(ITEMS_STORAGE_KEY).filter(isProcurementItem);
  const legacyItems = readJsonArray(LEGACY_ITEMS_STORAGE_KEY).filter(isProcurementItem);

  return dedupeItems([...legacyItems, ...realItems]);
}

export function getLocalVendors() {
  return dedupeVendors(readJsonArray(VENDORS_STORAGE_KEY).filter(isVendor));
}

export function mapCategoryRecordToOption(
  record: ProcurementCategoryRecord
): ProcurementOption {
  return {
    value: record.value,
    label: record.label,
  };
}

export function mapUnitRecordToOption(
  record: ProcurementUnitRecord
): ProcurementUnitOption {
  return {
    value: record.value,
    label: record.label,
  };
}

export function mapItemRecordToProcurementItem(
  record: ProcurementItemRecord
): ProcurementItem {
  return {
    id: record.id,
    name: record.name,
    category: record.category,
    defaultUnitLabel: record.default_unit_label,
    purchaseRatePerUnit: Number(record.purchase_rate_per_unit) || 0,
    markupPercent: Number(record.markup_percent) || 0,
    sellingRatePerUnit: Number(record.selling_rate_per_unit) || 0,
    defaultDescription: record.default_description,
    status: record.status,
    updatedAt: record.updated_at,
  };
}

export function mapVendorRecordToVendor(record: VendorRecord): Vendor {
  return {
    id: record.id,
    name: record.name,
    category: record.category,
    scopeOfWork: record.scope_of_work,
    contactPerson: record.contact_person,
    phone: record.phone,
    email: record.email || undefined,
    location: record.location,
    rating: Number(record.rating) || 0,
    status: record.status,
    availability: record.availability,
    assignedProjectCount: Number(record.assigned_project_count) || 0,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}

export function mapProcurementItemToUpsertPayload(
  item: ProcurementItem,
  createdBy?: string | null
) {
  return {
    id: item.id,
    name: item.name,
    category: item.category,
    default_unit_label: item.defaultUnitLabel,
    purchase_rate_per_unit: item.purchaseRatePerUnit,
    markup_percent: item.markupPercent,
    selling_rate_per_unit: item.sellingRatePerUnit,
    default_description: item.defaultDescription,
    status: item.status,
    created_by: createdBy ?? null,
  };
}

export function mapVendorToUpsertPayload(vendor: Vendor, createdBy?: string | null) {
  return {
    id: vendor.id,
    name: vendor.name,
    category: vendor.category,
    scope_of_work: vendor.scopeOfWork,
    contact_person: vendor.contactPerson,
    phone: vendor.phone,
    email: vendor.email ?? '',
    location: vendor.location,
    rating: vendor.rating,
    status: vendor.status,
    availability: vendor.availability,
    assigned_project_count: vendor.assignedProjectCount,
    created_by: createdBy ?? null,
  };
}

export async function fetchProcurementCategories() {
  const { data, error } = await supabase
    .from('procurement_categories')
    .select('*')
    .eq('is_active', true)
    .order('label', { ascending: true });

  if (error) throw error;

  return ((data || []) as ProcurementCategoryRecord[]).map(mapCategoryRecordToOption);
}

export async function fetchProcurementUnits() {
  const { data, error } = await supabase
    .from('procurement_units')
    .select('*')
    .eq('is_active', true)
    .order('label', { ascending: true });

  if (error) throw error;

  return ((data || []) as ProcurementUnitRecord[]).map(mapUnitRecordToOption);
}

export async function fetchProcurementItems() {
  const { data, error } = await supabase
    .from('procurement_items')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) throw error;

  return ((data || []) as ProcurementItemRecord[]).map(mapItemRecordToProcurementItem);
}

export async function fetchVendorsMaster() {
  const { data, error } = await supabase
    .from('vendors')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) throw error;

  return ((data || []) as VendorRecord[]).map(mapVendorRecordToVendor);
}

export async function importLocalProcurementMastersToSupabase(createdBy?: string | null) {
  const localCategories = getLocalProcurementCategoryOptions();
  const localUnits = getLocalProcurementUnitOptions();
  const localItems = getLocalProcurementItems();
  const localVendors = getLocalVendors();

  const mergedCategories = mergeOptions(localCategories);
  const mergedUnits = mergeOptions(localUnits);

  if (mergedCategories.length > 0) {
    const { error } = await supabase
      .from('procurement_categories')
      .upsert(
        mergedCategories.map(option => ({
          id: `category-${option.value}`,
          value: option.value,
          label: option.label,
          created_by: createdBy ?? null,
        })),
        { onConflict: 'value' }
      );

    if (error) throw error;
  }

  if (mergedUnits.length > 0) {
    const { error } = await supabase
      .from('procurement_units')
      .upsert(
        mergedUnits.map(option => ({
          id: `unit-${option.value}`,
          value: option.value,
          label: option.label,
          short_label: option.value,
          created_by: createdBy ?? null,
        })),
        { onConflict: 'value' }
      );

    if (error) throw error;
  }

  if (localItems.length > 0) {
    const { error } = await supabase
      .from('procurement_items')
      .upsert(
        localItems.map(item => mapProcurementItemToUpsertPayload(item, createdBy)),
        { onConflict: 'id' }
      );

    if (error) throw error;
  }

  if (localVendors.length > 0) {
    const { error } = await supabase
      .from('vendors')
      .upsert(
        localVendors.map(vendor => mapVendorToUpsertPayload(vendor, createdBy)),
        { onConflict: 'id' }
      );

    if (error) throw error;
  }

  return {
    categories: mergedCategories.length,
    units: mergedUnits.length,
    items: localItems.length,
    vendors: localVendors.length,
  };
}
