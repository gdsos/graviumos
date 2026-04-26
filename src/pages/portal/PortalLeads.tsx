import { useAuth } from '../../contexts/AuthContext';
import { PInlineNotification } from '@porsche-design-system/components-react';
import Leads from '../admin/Leads';

export default function PortalLeads() {
  const { isMS, isAdmin } = useAuth();

  if (!isMS() && !isAdmin()) {
    return (
      <div className="max-w-2xl mx-auto mt-20 flex flex-col items-center gap-4">
        <PInlineNotification
          heading="Access Restricted"
          description="The Leads module is only accessible to the Marketing & Sales department."
          state="error"
          dismissButton={false}
        />
      </div>
    );
  }

  return <Leads />;
}
