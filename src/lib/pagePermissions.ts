import type { Profile, DeptCode } from './supabase';

export type PageAccess = 'hidden' | 'view' | 'manage';

export type PagePermissionKey =
  | 'portal.projects'
  | 'portal.items'
  | 'portal.vendors'
  | 'portal.cost-estimates'
  | 'portal.timeline'
  | 'portal.leads'
  | 'portal.financials'
  | 'portal.payroll'
  | 'portal.whiteboard';

export type StoredPageAccess = Exclude<PageAccess, 'hidden'>;
export type PagePermissions = Partial<Record<PagePermissionKey, StoredPageAccess>>;

export interface PagePermissionConfig {
  key: PagePermissionKey;
  label: string;
  group: string;
  path: string;
  description: string;
}

export const PAGE_PERMISSION_CONFIGS: PagePermissionConfig[] = [
  {
    key: 'portal.projects',
    label: 'Projects',
    group: 'Core',
    path: '/portal/projects',
    description: 'View assigned project workspace and project details.',
  },
  {
    key: 'portal.whiteboard',
    label: 'Whiteboard',
    group: 'Core',
    path: '/portal/whiteboard',
    description: 'Access shared notes, ideas, and collaboration space.',
  },
  {
    key: 'portal.items',
    label: 'Items',
    group: 'Procurement',
    path: '/portal/items',
    description: 'View or manage item master data.',
  },
  {
    key: 'portal.vendors',
    label: 'Vendors',
    group: 'Procurement',
    path: '/portal/vendors',
    description: 'View or manage vendor directory.',
  },
  {
    key: 'portal.cost-estimates',
    label: 'Cost Estimates',
    group: 'Procurement',
    path: '/portal/cost-estimates',
    description: 'View or manage project cost estimates.',
  },
  {
    key: 'portal.timeline',
    label: 'Timeline',
    group: 'Execution',
    path: '/portal/timeline',
    description: 'View or manage execution timelines.',
  },
  {
    key: 'portal.leads',
    label: 'Leads',
    group: 'Sales',
    path: '/portal/leads',
    description: 'View or manage lead pipeline.',
  },
  {
    key: 'portal.financials',
    label: 'Financials',
    group: 'Finance',
    path: '/portal/financials',
    description: 'View or manage financial summaries.',
  },
  {
    key: 'portal.payroll',
    label: 'Payroll',
    group: 'Finance',
    path: '/portal/payroll',
    description: 'View or manage payroll records.',
  },
];

export function normalizePagePermissions(value: unknown): PagePermissions {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const source = value as Record<string, unknown>;
  const normalized: PagePermissions = {};

  for (const config of PAGE_PERMISSION_CONFIGS) {
    const access = source[config.key];

    if (access === 'view' || access === 'manage') {
      normalized[config.key] = access;
    }
  }

  return normalized;
}

export function getDefaultPagePermissions({
  role,
  departmentCodes,
}: {
  role: Profile['role'] | 'employee' | 'department_head';
  departmentCodes: DeptCode[] | string[];
}): PagePermissions {
  const defaults: PagePermissions = {};
  const isDeptHead = role === 'department_head';

  const grant = (key: PagePermissionKey, access: StoredPageAccess) => {
    defaults[key] = access;
  };

  if (isDeptHead) {
    grant('portal.projects', 'manage');
    grant('portal.whiteboard', 'manage');
  } else {
    grant('portal.projects', 'view');
    grant('portal.whiteboard', 'view');
  }

  if (departmentCodes.includes('MS')) {
    grant('portal.leads', isDeptHead ? 'manage' : 'view');
  }

  if (departmentCodes.includes('FI')) {
    grant('portal.financials', isDeptHead ? 'manage' : 'view');
    grant('portal.payroll', isDeptHead ? 'manage' : 'view');
  }

  if (departmentCodes.includes('PL')) {
    grant('portal.items', isDeptHead ? 'manage' : 'view');
    grant('portal.vendors', isDeptHead ? 'manage' : 'view');
    grant('portal.cost-estimates', isDeptHead ? 'manage' : 'view');
  }

  if (departmentCodes.includes('DE')) {
    grant('portal.timeline', isDeptHead ? 'manage' : 'view');
    grant('portal.cost-estimates', 'view');
  }

  return defaults;
}

export function getPageAccess(
  profile: Profile | null | undefined,
  key: PagePermissionKey
): PageAccess {
  return normalizePagePermissions(profile?.page_permissions)[key] ?? 'hidden';
}

export function hasPageAccess(
  profile: Profile | null | undefined,
  key: PagePermissionKey,
  minimum: Exclude<PageAccess, 'hidden'> = 'view'
): boolean {
  const access = getPageAccess(profile, key);

  if (minimum === 'view') {
    return access === 'view' || access === 'manage';
  }

  return access === 'manage';
}

export function canManagePage(
  profile: Profile | null | undefined,
  key: PagePermissionKey
): boolean {
  return hasPageAccess(profile, key, 'manage');
}
