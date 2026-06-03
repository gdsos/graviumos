import { useAuth } from '../../contexts/AuthContext';
import { hasPageAccess } from '../../lib/pagePermissions';
import Leads from '../admin/Leads';

export default function PortalLeads() {
  const { profile, departments, isAdmin } = useAuth();
  const canViewLeads = isAdmin() || hasPageAccess(profile, 'portal.leads', 'view');
  const portalEyebrow =
    departments.find(department => profile?.department_ids?.includes(department.id))?.name ??
    'Gravium OS';

  if (!canViewLeads) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20">
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4">
          <p className="text-sm font-semibold text-foreground">Access Restricted</p>
          <p className="mt-1 text-sm text-muted-foreground">
            You do not have access to view this page.
          </p>
        </div>
      </div>
    );
  }

  return <Leads eyebrow={portalEyebrow} portalMode />;
}
