import { PackageCheck, ShieldAlert, Sparkles, CheckCircle2 } from 'lucide-react';

import { EmptyState } from '@/components/common/EmptyState';
import { SectionCard } from '@/components/common/SectionCard';
import { StatusBadge } from '@/components/common/StatusBadge';
import { demoVendors } from '@/features/vendors/data';
import { WorkPackageCard } from './WorkPackageCard';
import type { WorkPackage } from '../types';

interface TimelineWorkPackagesProps {
  workPackages: WorkPackage[];
  onStartWork?: (workPackageId: string) => void;
  onPauseWork?: (workPackageId: string) => void;
  onResumeWork?: (workPackageId: string) => void;
  onCompleteWork?: (workPackageId: string) => void;
  onMarkDelayed?: (workPackageId: string) => void;
  onUpdateDelayReason?: (workPackageId: string) => void;
}

function getVendorName(vendorId?: string) {
  if (!vendorId) return undefined;

  return demoVendors.find(vendor => vendor.id === vendorId)?.name;
}

function isNeedsAttention(workPackage: WorkPackage) {
  return (
    workPackage.status === 'blocked_by_payment' ||
    workPackage.status === 'blocked_by_dependency' ||
    workPackage.status === 'delayed' ||
    workPackage.status === 'paused'
  );
}

function isCompleted(workPackage: WorkPackage) {
  return workPackage.status === 'completed';
}

function isActiveOrUpcoming(workPackage: WorkPackage) {
  return !isNeedsAttention(workPackage) && !isCompleted(workPackage);
}

function WorkPackageGroup({
  title,
  description,
  workPackages,
  icon: Icon,
  badgeVariant,
  onStartWork,
  onPauseWork,
  onResumeWork,
  onCompleteWork,
  onMarkDelayed,
  onUpdateDelayReason,
}: {
  title: string;
  description: string;
  workPackages: WorkPackage[];
  icon: typeof ShieldAlert;
  badgeVariant: 'danger' | 'warning' | 'info' | 'success' | 'muted';
  onStartWork?: (workPackageId: string) => void;
  onPauseWork?: (workPackageId: string) => void;
  onResumeWork?: (workPackageId: string) => void;
  onCompleteWork?: (workPackageId: string) => void;
  onMarkDelayed?: (workPackageId: string) => void;
  onUpdateDelayReason?: (workPackageId: string) => void;
}) {
  if (workPackages.length === 0) return null;

  return (
    <SectionCard
      title={title}
      description={description}
      actions={
        <StatusBadge variant={badgeVariant}>
          {workPackages.length}
        </StatusBadge>
      }
    >
      <div className="mb-4 flex items-center gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span>{description}</span>
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        {workPackages.map(workPackage => (
          <WorkPackageCard
            key={workPackage.id}
            workPackage={workPackage}
            vendorName={getVendorName(workPackage.vendorId)}
            onStartWork={onStartWork}
            onPauseWork={onPauseWork}
            onResumeWork={onResumeWork}
            onCompleteWork={onCompleteWork}
            onMarkDelayed={onMarkDelayed}
            onUpdateDelayReason={onUpdateDelayReason}
          />
        ))}
      </div>
    </SectionCard>
  );
}

export function TimelineWorkPackages({
  workPackages,
  onStartWork,
  onPauseWork,
  onResumeWork,
  onCompleteWork,
  onMarkDelayed,
  onUpdateDelayReason,
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

  const needsAttention = workPackages.filter(isNeedsAttention);
  const activeOrUpcoming = workPackages.filter(isActiveOrUpcoming);
  const completed = workPackages.filter(isCompleted);

  return (
    <div className="grid min-w-0 gap-6">
      <WorkPackageGroup
        title="Needs Attention"
        description="Blocked, delayed, or paused work that needs action before the timeline can move smoothly."
        workPackages={needsAttention}
        icon={ShieldAlert}
        badgeVariant="danger"
        onStartWork={onStartWork}
        onPauseWork={onPauseWork}
        onResumeWork={onResumeWork}
        onCompleteWork={onCompleteWork}
        onMarkDelayed={onMarkDelayed}
        onUpdateDelayReason={onUpdateDelayReason}
      />

      <WorkPackageGroup
        title="Active / Upcoming"
        description="Work that is ready, in progress, or not yet started."
        workPackages={activeOrUpcoming}
        icon={Sparkles}
        badgeVariant="info"
        onStartWork={onStartWork}
        onPauseWork={onPauseWork}
        onResumeWork={onResumeWork}
        onCompleteWork={onCompleteWork}
        onMarkDelayed={onMarkDelayed}
        onUpdateDelayReason={onUpdateDelayReason}
      />

      <WorkPackageGroup
        title="Completed"
        description="Finished work packages that are no longer blocking the current timeline."
        workPackages={completed}
        icon={CheckCircle2}
        badgeVariant="success"
        onStartWork={onStartWork}
        onPauseWork={onPauseWork}
        onResumeWork={onResumeWork}
        onCompleteWork={onCompleteWork}
        onMarkDelayed={onMarkDelayed}
        onUpdateDelayReason={onUpdateDelayReason}
      />
    </div>
  );
}
