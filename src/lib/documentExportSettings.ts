import { supabase } from './supabase';

export interface DocumentOrganizationSettings {
  organizationName: string;
  addressLines: string[];
  email: string;
  phone: string;
  logoPath: string;
  fallbackLogoPath: string;
  signaturePath: string;
  invertLogoOnDark: boolean;
}

export const DOCUMENT_SETTINGS_STORAGE_KEY = 'gravium-os-document-settings';
export const DOCUMENT_TERMS_STORAGE_KEY = 'gravium-os-document-terms';

export const DEFAULT_DOCUMENT_ORGANIZATION_SETTINGS: DocumentOrganizationSettings = {
  organizationName: 'GRAVIUM DESIGN STUDIO LLP',
  addressLines: ['<Address Line 1>', '<Address Line 2>'],
  email: '<Email>',
  phone: '<Phone>',
  logoPath: '/brand/Organization-Logo.png',
  fallbackLogoPath: '/Organization-Logo.png',
  signaturePath: '/brand/Authorized-Signature.png',
  invertLogoOnDark: true,
};

export const DEFAULT_COST_ESTIMATE_TERMS = [
  'This estimate is prepared based on the currently approved design scope and available site information.',
  'Material, finish, brand, site condition, or scope changes may revise the final estimate.',
  'Work will begin only after written approval, contract confirmation, and agreed advance payment.',
  'Taxes, statutory charges, and payment terms are subject to the final approved contract.',
];

export interface DocumentExportSettings {
  organizationSettings: DocumentOrganizationSettings;
  costEstimateTerms: string[];
}

type DocumentExportSettingsInput = {
  organizationSettings?: Partial<DocumentOrganizationSettings>;
  costEstimateTerms?: unknown;
};

type DocumentExportSettingsRow = {
  id: string;
  organization_name: string | null;
  address_lines: unknown;
  email: string | null;
  phone: string | null;
  logo_path: string | null;
  fallback_logo_path: string | null;
  signature_path: string | null;
  invert_logo_on_dark: boolean | null;
  cost_estimate_terms: unknown;
};

function normalizeString(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function normalizeStringArray(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) return fallback;

  const normalized = value
    .filter(item => typeof item === 'string' && item.trim())
    .map(item => item.trim());

  return normalized.length > 0 ? normalized : fallback;
}

function normalizeDocumentExportSettings(
  value: DocumentExportSettingsInput | undefined
): DocumentExportSettings {
  const organizationSettings: Partial<DocumentOrganizationSettings> = value?.organizationSettings ?? {};

  return {
    organizationSettings: {
      organizationName: normalizeString(
        organizationSettings.organizationName,
        DEFAULT_DOCUMENT_ORGANIZATION_SETTINGS.organizationName
      ),
      addressLines: normalizeStringArray(
        organizationSettings.addressLines,
        DEFAULT_DOCUMENT_ORGANIZATION_SETTINGS.addressLines
      ),
      email: normalizeString(
        organizationSettings.email,
        DEFAULT_DOCUMENT_ORGANIZATION_SETTINGS.email
      ),
      phone: normalizeString(
        organizationSettings.phone,
        DEFAULT_DOCUMENT_ORGANIZATION_SETTINGS.phone
      ),
      logoPath: normalizeString(
        organizationSettings.logoPath,
        DEFAULT_DOCUMENT_ORGANIZATION_SETTINGS.logoPath
      ),
      fallbackLogoPath: normalizeString(
        organizationSettings.fallbackLogoPath,
        DEFAULT_DOCUMENT_ORGANIZATION_SETTINGS.fallbackLogoPath
      ),
      signaturePath: normalizeString(
        organizationSettings.signaturePath,
        DEFAULT_DOCUMENT_ORGANIZATION_SETTINGS.signaturePath
      ),
      invertLogoOnDark:
        typeof organizationSettings.invertLogoOnDark === 'boolean'
          ? organizationSettings.invertLogoOnDark
          : DEFAULT_DOCUMENT_ORGANIZATION_SETTINGS.invertLogoOnDark,
    },
    costEstimateTerms: normalizeStringArray(
      value?.costEstimateTerms,
      DEFAULT_COST_ESTIMATE_TERMS
    ),
  };
}

function mapRowToDocumentExportSettings(
  row: DocumentExportSettingsRow | null | undefined
): DocumentExportSettings {
  if (!row) return normalizeDocumentExportSettings(undefined);

  return normalizeDocumentExportSettings({
    organizationSettings: {
      organizationName: row.organization_name ?? undefined,
      addressLines: Array.isArray(row.address_lines)
        ? (row.address_lines as string[])
        : undefined,
      email: row.email ?? undefined,
      phone: row.phone ?? undefined,
      logoPath: row.logo_path ?? undefined,
      fallbackLogoPath: row.fallback_logo_path ?? undefined,
      signaturePath: row.signature_path ?? undefined,
      invertLogoOnDark:
        typeof row.invert_logo_on_dark === 'boolean'
          ? row.invert_logo_on_dark
          : undefined,
    },
    costEstimateTerms: Array.isArray(row.cost_estimate_terms)
      ? (row.cost_estimate_terms as string[])
      : undefined,
  });
}

function mapSettingsToRow(settings: DocumentExportSettings) {
  const normalized = normalizeDocumentExportSettings(settings);

  return {
    id: 'default',
    organization_name: normalized.organizationSettings.organizationName,
    address_lines: normalized.organizationSettings.addressLines,
    email: normalized.organizationSettings.email,
    phone: normalized.organizationSettings.phone,
    logo_path: normalized.organizationSettings.logoPath,
    fallback_logo_path: normalized.organizationSettings.fallbackLogoPath,
    signature_path: normalized.organizationSettings.signaturePath,
    invert_logo_on_dark: normalized.organizationSettings.invertLogoOnDark,
    cost_estimate_terms: normalized.costEstimateTerms,
  };
}

export function getLocalDocumentExportSettings() {
  if (typeof window === 'undefined') return null;

  try {
    const storedSettings = window.localStorage.getItem(DOCUMENT_SETTINGS_STORAGE_KEY);
    const storedTerms = window.localStorage.getItem(DOCUMENT_TERMS_STORAGE_KEY);

    if (!storedSettings && !storedTerms) return null;

    const parsedSettings = storedSettings
      ? (JSON.parse(storedSettings) as Partial<DocumentOrganizationSettings>)
      : {};

    const parsedTerms = storedTerms
      ? (JSON.parse(storedTerms) as Record<string, unknown>)
      : {};

    return normalizeDocumentExportSettings({
      organizationSettings: parsedSettings,
      costEstimateTerms: Array.isArray(parsedTerms['cost-estimate'])
        ? (parsedTerms['cost-estimate'] as string[])
        : undefined,
    });
  } catch {
    return null;
  }
}

export function clearLocalDocumentExportSettings() {
  if (typeof window === 'undefined') return;

  window.localStorage.removeItem(DOCUMENT_SETTINGS_STORAGE_KEY);
  window.localStorage.removeItem(DOCUMENT_TERMS_STORAGE_KEY);
}

export async function fetchDocumentExportSettings() {
  const { data, error } = await supabase
    .from('document_export_settings')
    .select('*')
    .eq('id', 'default')
    .maybeSingle();

  if (error) throw error;

  return mapRowToDocumentExportSettings(data as DocumentExportSettingsRow | null);
}

export async function saveDocumentExportSettings(settings: DocumentExportSettings) {
  const { error } = await supabase
    .from('document_export_settings')
    .upsert(mapSettingsToRow(settings), { onConflict: 'id' });

  if (error) throw error;

  clearLocalDocumentExportSettings();
  return normalizeDocumentExportSettings(settings);
}

export async function importLocalDocumentExportSettingsToSupabase() {
  const localSettings = getLocalDocumentExportSettings();

  if (!localSettings) return null;

  await saveDocumentExportSettings(localSettings);
  return localSettings;
}
