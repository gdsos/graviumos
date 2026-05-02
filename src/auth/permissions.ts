export const rolePermissions: Record<string, string[]> = {
  super_admin: [
    "settings.view",
    "users.manage",
    "reports.view",
  ],

  employee: [
    "profile.view",
  ],
};

export const hasPermission = (
  role: string | undefined,
  permission: string
): boolean => {
  if (!role) return false;

  return rolePermissions[role]?.includes(permission) ?? false;
};