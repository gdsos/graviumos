import type { Profile } from '../../lib/supabase';
import type { ProjectWorkspaceMode } from './projectTypes';

interface ProjectAccessArgs {
  mode: ProjectWorkspaceMode;
  isAdmin: () => boolean;
  isFinance: () => boolean;
  isDeptHead: () => boolean;
}

export function getProjectAccess({
  mode,
  isAdmin,
  isFinance,
  isDeptHead,
}: ProjectAccessArgs) {
  if (mode === 'admin') {
    return {
      canManage: true,
      canEditFinancials: true,
      canManageSubEntries: true,
      canViewTasks: true,
      defaultDetailTab: 'overview' as const,
    };
  }

  const canManage = isAdmin() || isDeptHead();
  const canEditFinancials = isAdmin() || isFinance();

  return {
    canManage,
    canEditFinancials,
    canManageSubEntries: canEditFinancials,
    canViewTasks: true,
    defaultDetailTab: canEditFinancials ? ('overview' as const) : ('tasks' as const),
  };
}

export function getPortalDepartmentMemberIds(
  profile: Profile | null | undefined,
  allProfiles: Profile[]
) {
  const userDeptIds = profile?.department_ids || [];

  const deptMemberIds = allProfiles
    .filter(p =>
      p.department_ids?.some(depId =>
        userDeptIds.includes(depId)
      )
    )
    .map(p => p.id);

  return [
    ...new Set([
      ...deptMemberIds,
      ...(profile?.id ? [profile.id] : []),
    ]),
  ];
}
