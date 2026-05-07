import { useAuth } from '../../contexts/AuthContext';
import Financials from '../admin/Financials';

export default function PortalFinancials() {
  const { isFinance, isAdmin } = useAuth();

  if (!isFinance() && !isAdmin()) {
    return (
      <div className="max-w-2xl mx-auto mt-20">
        <div className="p-4 rounded-lg bg-red-50 border border-red-200">
          <p className="text-sm font-semibold text-red-900">Access Restricted</p>
          <p className="text-sm text-red-700 mt-1">The Financials module is only accessible to the Finance department.</p>
        </div>
      </div>
    );
  }

  return <Financials />;
}
