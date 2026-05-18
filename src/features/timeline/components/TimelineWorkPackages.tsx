import {
  AlertTriangle,
  CheckCircle2,
  MessageSquareText,
  MoreHorizontal,
  PackageCheck,
  PauseCircle,
  PlayCircle,
  RotateCcw,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';

import { EmptyState } from '@/components/common/EmptyState';
import { SectionCard } from '@/components/common/SectionCard';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';
import { demoVendors } from '@/features/vendors/data';
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

type WorkPackageAction = {
  label: string;
  icon: typeof PlayCircle;
  onClick?: () => void;
};

function getVendorName(vendorId?: string) {
  if (!vendorId) return undefined;

  return demoVendors.find(vendor => vendor.id === vendorId)?.name;
}

function formatLabel(value: string) {
  return value
    .split('_')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function getStatusVariant(status: WorkPackage['status']) {
  if (status === 'completed') return 'success';
  if (status === 'delayed') return 'danger';
  if (status === 'paused') return 'warning';
  if (status === 'blocked_by_payment') return 'danger';
  if (status === 'blocked_by_dependency') return 'warning';
  if (status === 'in_progress') return 'info';
  if (status === 'ready') return 'outline';

  return 'muted';
}

function getPriorityVariant(priority: WorkPackage['priority']) {
  if (priority === 'critical') return 'danger';
  if (priority === 'high') return 'warning';
  if (priority === 'medium') return 'info';

  return 'muted';
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

function getLatestPauseReason(workPackage: WorkPackage) {
  return workPackage.pausePeriods[workPackage.pausePeriods.length - 1]?.reason;
}

function getWorkPackageTitleParts(title: string) {
  const separatorIndex = title.indexOf(' - ');

  if (separatorIndex === -1) {
    return {
      areaName: title,
      workName: '',
    };
  }

  return {
    areaName: title.slice(0, separatorIndex).trim(),
    workName: title.slice(separatorIndex + 3).trim(),
  };
}

function formatDisplayDate(dateString?: string) {
  if (!dateString) return '-';

  const [year, month, day] = dateString.split('-');

  if (!year || !month || !day) return dateString;

  return `${day}/${month}/${year}`;
}

function getActualStartLabel(workPackage: WorkPackage) {
  return workPackage.actualStartDate
    ? formatDisplayDate(workPackage.actualStartDate)
    : 'Not Started';
}

function getActualEndLabel(workPackage: WorkPackage) {
  if (workPackage.actualEndDate) {
    return formatDisplayDate(workPackage.actualEndDate);
  }

  if (workPackage.actualStartDate) return 'In Progress';

  return '-';
}

function getPrimaryAction({
  workPackage,
  onStartWork,
  onResumeWork,
  onCompleteWork,
}: {
  workPackage: WorkPackage;
  onStartWork?: (workPackageId: string) => void;
  onResumeWork?: (workPackageId: string) => void;
  onCompleteWork?: (workPackageId: string) => void;
}): WorkPackageAction | null {
  if (
    workPackage.status === 'blocked_by_payment' ||
    workPackage.status === 'blocked_by_dependency' ||
    workPackage.status === 'completed'
  ) {
    return null;
  }

  if (workPackage.status === 'paused') {
    return {
      label: 'Resume',
      icon: RotateCcw,
      onClick: () => onResumeWork?.(workPackage.id),
    };
  }

  if (workPackage.status === 'in_progress') {
    return {
      label: 'Complete',
      icon: CheckCircle2,
      onClick: () => onCompleteWork?.(workPackage.id),
    };
  }

  return {
    label: 'Start',
    icon: PlayCircle,
    onClick: () => onStartWork?.(workPackage.id),
  };
}

function getSecondaryActions({
  workPackage,
  onStartWork,
  onPauseWork,
  onResumeWork,
  onCompleteWork,
  onMarkDelayed,
  onUpdateDelayReason,
}: TimelineWorkPackagesProps & {
  workPackage: WorkPackage;
}): WorkPackageAction[] {
  const isBlocked =
    workPackage.status === 'blocked_by_payment' ||
    workPackage.status === 'blocked_by_dependency';
  const isCompleted = workPackage.status === 'completed';

  const actions: WorkPackageAction[] = [];

  if (
    !isBlocked &&
    !isCompleted &&
    workPackage.status !== 'in_progress' &&
    workPackage.status !== 'paused'
  ) {
    actions.push({
      label: 'Start Work',
      icon: PlayCircle,
      onClick: () => onStartWork?.(workPackage.id),
    });
  }

  if (workPackage.status === 'in_progress' || workPackage.status === 'delayed') {
    actions.push({
      label: 'Pause Work',
      icon: PauseCircle,
      onClick: () => onPauseWork?.(workPackage.id),
    });
  }

  if (workPackage.status === 'paused') {
    actions.push({
      label: 'Resume Work',
      icon: RotateCcw,
      onClick: () => onResumeWork?.(workPackage.id),
    });
  }

  if (!isBlocked && !isCompleted) {
    actions.push({
      label: 'Complete Work',
      icon: CheckCircle2,
      onClick: () => onCompleteWork?.(workPackage.id),
    });
  }

  if (!isCompleted && workPackage.status !== 'delayed') {
    actions.push({
      label: 'Mark Delayed',
      icon: AlertTriangle,
      onClick: () => onMarkDelayed?.(workPackage.id),
    });
  }

  if (workPackage.status === 'delayed' || workPackage.overrideReason) {
    actions.push({
      label: 'Delay Reason',
      icon: MessageSquareText,
      onClick: () => onUpdateDelayReason?.(workPackage.id),
    });
  }

  return actions;
}

function WorkPackageRow({
  workPackage,
  onStartWork,
  onPauseWork,
  onResumeWork,
  onCompleteWork,
  onMarkDelayed,
  onUpdateDelayReason,
}: TimelineWorkPackagesProps & {
  workPackage: WorkPackage;
}) {
  const vendorName = getVendorName(workPackage.vendorId);
  const latestPauseReason = getLatestPauseReason(workPackage);
  const titleParts = getWorkPackageTitleParts(workPackage.title);
  const primaryAction = getPrimaryAction({
    workPackage,
    onStartWork,
    onResumeWork,
    onCompleteWork,
  });
  const secondaryActions = getSecondaryActions({
    workPackage,
    workPackages: [],
    onStartWork,
    onPauseWork,
    onResumeWork,
    onCompleteWork,
    onMarkDelayed,
    onUpdateDelayReason,
  });
  const PrimaryIcon = primaryAction?.icon;

  return (
    <div className="grid min-w-0 gap-3 border-b border-border px-3 py-3 last:border-b-0 xl:grid-cols-[minmax(300px,1.5fr)_150px_150px_minmax(150px,0.8fr)_96px_176px] xl:items-center xl:gap-4 xl:px-4">
      <div className="min-w-0">
        <div className="mb-1 flex min-w-0 flex-wrap items-center gap-2">
          <p className="mr-1 truncate text-base font-semibold text-foreground">
            {titleParts.areaName}
          </p>

          <StatusBadge variant={getStatusVariant(workPackage.status)}>
            {formatLabel(workPackage.status)}
          </StatusBadge>
          <StatusBadge variant={getPriorityVariant(workPackage.priority)}>
            {formatLabel(workPackage.priority)}
          </StatusBadge>
        </div>

        {titleParts.workName && (
          <p className="line-clamp-2 text-sm leading-5 text-muted-foreground">
            {titleParts.workName}
          </p>
        )}

        <p className="mt-1 truncate text-xs text-muted-foreground">
          Vendor: {vendorName ?? workPackage.assigneeName}
        </p>
      </div>

      <div className="grid grid-cols-[86px_minmax(0,1fr)] gap-2 xl:block">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground xl:hidden">
          Planned
        </p>
        <div className="space-y-1 text-sm">
          <p className="grid grid-cols-[42px_minmax(0,1fr)] gap-2 text-foreground">
            <span className="text-muted-foreground">From</span>
            <span>{formatDisplayDate(workPackage.estimatedStartDate)}</span>
          </p>
          <p className="grid grid-cols-[42px_minmax(0,1fr)] gap-2 text-foreground">
            <span className="text-muted-foreground">To</span>
            <span>{formatDisplayDate(workPackage.estimatedEndDate)}</span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-[86px_minmax(0,1fr)] gap-2 xl:block">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground xl:hidden">
          Actual
        </p>
        <div className="space-y-1 text-sm">
          <p className="grid grid-cols-[42px_minmax(0,1fr)] gap-2 text-foreground">
            <span className="text-muted-foreground">From</span>
            <span>{getActualStartLabel(workPackage)}</span>
          </p>
          <p className="grid grid-cols-[42px_minmax(0,1fr)] gap-2 text-foreground">
            <span className="text-muted-foreground">To</span>
            <span>{getActualEndLabel(workPackage)}</span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-[86px_minmax(0,1fr)] gap-2 xl:block">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground xl:hidden">
          Pause / Delay
        </p>
        <div className="min-w-0">
          {workPackage.overrideReason ? (
            <p className="truncate text-sm text-red-600 dark:text-red-300">
              {workPackage.overrideReason}
            </p>
          ) : latestPauseReason ? (
            <p className="truncate text-sm text-amber-700 dark:text-amber-300">
              {latestPauseReason}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Clear</p>
          )}

          {workPackage.pausePeriods.length > 0 && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {workPackage.pausePeriods.length} pause(s)
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-[86px_minmax(0,1fr)] gap-2 xl:block xl:text-center">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground xl:hidden">
          Dependencies
        </p>
        <p className="text-sm text-muted-foreground">
          {workPackage.dependsOnWorkPackageIds.length || 0}
        </p>
      </div>

      <div className="flex min-w-0 items-center gap-2 xl:justify-center">
        {primaryAction && PrimaryIcon ? (
          <Button
            type="button"
            size="sm"
            onClick={primaryAction.onClick}
            className="min-w-0 flex-1 gap-2 xl:max-w-[118px]"
          >
            <PrimaryIcon className="h-4 w-4" />
            {primaryAction.label}
          </Button>
        ) : (
          <p className="min-w-0 flex-1 rounded-lg border border-border px-2 py-1.5 text-center text-xs text-muted-foreground xl:max-w-[118px]">
            No Action
          </p>
        )}

        <details className="relative shrink-0">
          <summary className="flex h-9 w-10 cursor-pointer list-none items-center justify-center rounded-lg border border-border text-muted-foreground transition hover:text-foreground [&::-webkit-details-marker]:hidden">
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">More Actions</span>
          </summary>

          <div className="absolute right-0 z-30 mt-2 w-48 overflow-hidden rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-xl">
            {secondaryActions.length > 0 ? (
              secondaryActions.map(action => {
                const Icon = action.icon;

                return (
                  <button
                    key={action.label}
                    type="button"
                    onClick={action.onClick}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted"
                  >
                    <Icon className="h-4 w-4" />
                    {action.label}
                  </button>
                );
              })
            ) : (
              <p className="px-3 py-2 text-sm text-muted-foreground">
                No actions available
              </p>
            )}
          </div>
        </details>
      </div>
    </div>
  );
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
      <div className="mb-3 flex items-center gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
        <Icon className="h-4 w-4 shrink-0" />
        <span>{description}</span>
      </div>

      <div className="rounded-2xl border border-border bg-card">
        <div className="overflow-x-auto">
          <div className="min-w-full">
            <div className="hidden border-b border-border px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground xl:grid xl:grid-cols-[minmax(300px,1.5fr)_150px_150px_minmax(150px,0.8fr)_96px_176px] xl:gap-4">
              <span>Work Package</span>
              <span>Planned</span>
              <span>Actual</span>
              <span>Pause / Delay</span>
              <span className="text-center">Dependencies</span>
              <span className="text-center">Actions</span>
            </div>

            {workPackages.map(workPackage => (
              <WorkPackageRow
            key={workPackage.id}
            workPackage={workPackage}
            workPackages={workPackages}
            onStartWork={onStartWork}
            onPauseWork={onPauseWork}
            onResumeWork={onResumeWork}
            onCompleteWork={onCompleteWork}
            onMarkDelayed={onMarkDelayed}
            onUpdateDelayReason={onUpdateDelayReason}
              />
            ))}
          </div>
        </div>
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
        title="No Work Packages"
        description="Create work packages to start building the project timeline."
      />
    );
  }

  const needsAttention = workPackages.filter(isNeedsAttention);
  const activeOrUpcoming = workPackages.filter(isActiveOrUpcoming);
  const completed = workPackages.filter(isCompleted);

  return (
    <div className="grid min-w-0 gap-5">
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
