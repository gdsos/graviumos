import { useAuth } from '../../contexts/AuthContext';
import Leads from '../admin/Leads';

export default function PortalLeads() {
  const { isMS, isAdmin } = useAuth();

  if (!isMS() && !isAdmin()) {
    return (
      <div className="max-w-2xl mx-auto mt-20 flex flex-col items-center gap-4">
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 w-full">
          <p className="text-sm font-semibold text-red-900">Access Restricted</p>
          <p className="text-sm text-red-700 mt-1">The Leads module is only accessible to the Marketing & Sales department.</p>
        </div>
      </div>
    );
  }

  return <Leads />;
}
