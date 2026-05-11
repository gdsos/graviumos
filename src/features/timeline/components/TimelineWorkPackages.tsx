import { PackageCheck } from 'lucide-react';

import { EmptyState } from '@/components/common/EmptyState';
import { SectionCard } from '@/components/common/SectionCard';
import { demoVendors } from '@/features/vendors/data';
import { WorkPackageCard } from './WorkPackageCard';
import type { WorkPackage } from '../types';

interface TimelineWorkPackagesProps {
  workPackages: WorkPackage[];
}

function getVendorName(vendorId?: string) {
  if (!vendorId) return undefined;

  return demoVendors.find(vendor => vendor.id === vendorId)?.name;
}

export function TimelineWorkPackages({
  workPackages,
}: TimelineWorkPackagesProps) {
  if (workPackages.length === 0) {
    return (
      <EmptyState
        icon={PackageCheck}
        title="No work packages"
        description="Create work packages to start building the project timeline."
      />
    );
  }

  return (
    <SectionCard
      title="Work Packages"
      description="Estimated and actual timelines, dependencies, vendors, pauses, and blockers."
    >
      <div className="grid gap-4 lg:grid-cols-2">
        {workPackages.map(workPackage => (
          <WorkPackageCard
            key={workPackage.id}
            workPackage={workPackage}
            vendorName={getVendorName(workPackage.vendorId)}
          />
        ))}
      </div>
    </SectionCard>
  );
}
