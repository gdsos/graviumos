import { useAuth } from '../../contexts/AuthContext';
import { PInlineNotification } from '@porsche-design-system/components-react';
import Payroll from '../admin/Payroll';

export default function PortalPayroll() {
  const { isFinance, isAdmin } = useAuth();

  if (!isFinance() && !isAdmin()) {
    return (
      <div className="max-w-2xl mx-auto mt-20">
        <PInlineNotification
          heading="Access Restricted"
          description="The Payroll module is only accessible to the Finance department."
          state="error"
          dismissButton={false}
        />
      </div>
    );
  }

  return <Payroll />;
}
