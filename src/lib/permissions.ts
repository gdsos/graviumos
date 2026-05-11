import type { Department, Profile } from './supabase';

export type DepartmentCode =
  | 'DE' // Design & Execution
  | 'PL' // Procurement & Logistics
  | 'FI' // Finance
  | 'MS' // Marketing & Sales
  | string;

export type AppPermission =
  | 'timeline.view'
  | 'timeline.edit'
  | 'timeline.managePayments'
  | 'vendors.view'
  | 'vendors.edit'
  | 'projects.view'
  | 'projects.edit'
  | 'people.view'
  | 'people.manage'
  | 'financials.view'
  | 'financials.edit';

interface PermissionContext {
  profile: Profile | null;
  userDepartments: Department[];
}

export function isSuperAdmin(profile: Profile | null) {
  return profile?.role === 'super_admin';
}

export function isDepartmentHead(profile: Profile | null) {
  return profile?.role === 'department_head' || profile?.role === 'super_admin';
}

export function isInDepartment(
  userDepartments: Department[],
  departmentCode: DepartmentCode
) {
  return userDepartments.some(department => department.code === departmentCode);
}

export function canViewTimeline({
  profile,
  userDepartments,
}: PermissionContext) {
  return (
    isSuperAdmin(profile) ||
    isInDepartment(userDepartments, 'DE') ||
    isInDepartment(userDepartments, 'PL')
  );
}

export function canEditTimeline({
  profile,
  userDepartments,
}: PermissionContext) {
  return (
    isSuperAdmin(profile) ||
    isInDepartment(userDepartments, 'DE') ||
    isInDepartment(userDepartments, 'PL')
  );
}

export function canManageTimelinePayments({
  profile,
  userDepartments,
}: PermissionContext) {
  return (
    isSuperAdmin(profile) ||
    isInDepartment(userDepartments, 'FI')
  );
}

export function canViewVendors({
  profile,
  userDepartments,
}: PermissionContext) {
  return (
    isSuperAdmin(profile) ||
    isInDepartment(userDepartments, 'DE') ||
    isInDepartment(userDepartments, 'PL')
  );
}

export function canEditVendors({
  profile,
  userDepartments,
}: PermissionContext) {
  return (
    isSuperAdmin(profile) ||
    isInDepartment(userDepartments, 'PL')
  );
}

export function canViewFinancials({
  profile,
  userDepartments,
}: PermissionContext) {
  return (
    isSuperAdmin(profile) ||
    isInDepartment(userDepartments, 'FI')
  );
}

export function canManagePeople({ profile }: PermissionContext) {
  return isSuperAdmin(profile);
}

export function hasPermission(
  permission: AppPermission,
  context: PermissionContext
) {
  switch (permission) {
    case 'timeline.view':
      return canViewTimeline(context);

    case 'timeline.edit':
      return canEditTimeline(context);

    case 'timeline.managePayments':
      return canManageTimelinePayments(context);

    case 'vendors.view':
      return canViewVendors(context);

    case 'vendors.edit':
      return canEditVendors(context);

    case 'financials.view':
    case 'financials.edit':
      return canViewFinancials(context);

    case 'people.view':
    case 'people.manage':
      return canManagePeople(context);

    case 'projects.view':
    case 'projects.edit':
      return isSuperAdmin(context.profile) || isDepartmentHead(context.profile);

    default:
      return false;
  }
}