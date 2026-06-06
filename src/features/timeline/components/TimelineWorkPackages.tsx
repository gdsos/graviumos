import { useState } from 'react';
import { createPortal } from 'react-dom';

import {
  AlertTriangle,
  CheckCircle2,
  Link2,
  MessageSquareText,
  MoreHorizontal,
  PackageCheck,
  PauseCircle,
  PlayCircle,
  RotateCcw,
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
  onUpdatePrerequisites?: (workPackageId: string, dependencyIds: string[]) => void;
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

function getShortDateRange(startDate?: string, endDate?: string) {
  return `${formatDisplayDate(startDate)} - ${formatDisplayDate(endDate)}`;
}

function getMobileActualLabel(workPackage: WorkPackage) {
  if (workPackage.actualEndDate) {
    return `Completed ${formatDisplayDate(workPackage.actualEndDate)}`;
  }

  if (workPackage.actualStartDate) {
    return `In Progress from ${formatDisplayDate(workPackage.actualStartDate)}`;
  }

  return 'Not Started';
}

function getWorkPackageDisplayName(workPackage: WorkPackage) {
  const titleParts = getWorkPackageTitleParts(workPackage.title);

  return titleParts.workName
    ? `${titleParts.areaName} - ${titleParts.workName}`
    : titleParts.areaName;
}

function getDependencyWorkPackages(
  workPackage: WorkPackage,
  workPackages: WorkPackage[]
) {
  return workPackage.dependsOnWorkPackageIds
    .map(dependencyId =>
      workPackages.find(candidate => candidate.id === dependencyId)
    )
    .filter((dependency): dependency is WorkPackage => Boolean(dependency));
}

function getDependentWorkPackages(
  workPackage: WorkPackage,
  workPackages: WorkPackage[]
) {
  return workPackages.filter(candidate =>
    candidate.dependsOnWorkPackageIds.includes(workPackage.id)
  );
}

function getDependencyPreview(
  workPackage: WorkPackage,
  workPackages: WorkPackage[]
) {
  const dependencies = getDependencyWorkPackages(workPackage, workPackages);

  if (dependencies.length === 0) return 'None';

  return dependencies.map(getWorkPackageDisplayName).join(', ');
}

function canSelectAsDependency({
  workPackage,
  candidate,
}: {
  workPackage: WorkPackage;
  candidate: WorkPackage;
}) {
  if (candidate.id === workPackage.id) return false;

  return !candidate.dependsOnWorkPackageIds.includes(workPackage.id);
}

function DependencyEditor({
  workPackage,
  workPackages,
  onUpdatePrerequisites,
  onClose,
}: {
  workPackage: WorkPackage;
  workPackages: WorkPackage[];
  onUpdatePrerequisites?: (workPackageId: string, dependencyIds: string[]) => void;
  onClose: () => void;
}) {
  const selectedDependencyIds = new Set(workPackage.dependsOnWorkPackageIds);
  const availablePrerequisites = workPackages.filter(candidate =>
    canSelectAsDependency({ workPackage, candidate })
  );

  const handleToggleDependency = (dependencyId: string) => {
    if (!onUpdatePrerequisites) return;

    const nextDependencyIds = selectedDependencyIds.has(dependencyId)
      ? workPackage.dependsOnWorkPackageIds.filter(
          currentDependencyId => currentDependencyId !== dependencyId
        )
      : [...workPackage.dependsOnWorkPackageIds, dependencyId];

    onUpdatePrerequisites(workPackage.id, nextDependencyIds);
  };

  return (
    <div className="mt-3 rounded-2xl border border-border bg-muted/30 p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">
            Edit Dependencies
          </p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Choose the work packages that must finish before this package can start.
          </p>
        </div>

        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onClose}
          className="w-full sm:w-auto"
        >
          Done
        </Button>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {availablePrerequisites.length > 0 ? (
          availablePrerequisites.map(candidate => {
            const isSelected = selectedDependencyIds.has(candidate.id);

            return (
              <button
                key={candidate.id}
                type="button"
                onClick={() => handleToggleDependency(candidate.id)}
                className={`flex min-w-0 items-start gap-2 rounded-xl border px-3 py-2 text-left transition ${
                  isSelected
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <span
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border text-[10px] font-bold ${
                    isSelected
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-card'
                  }`}
                >
                  {isSelected ? 'On' : ''}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">
                    {getWorkPackageDisplayName(candidate)}
                  </span>
                  <span className="mt-0.5 block text-xs">
                    Status: {formatLabel(candidate.status)}
                  </span>
                </span>
              </button>
            );
          })
        ) : (
          <p className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-muted-foreground">
            No other work packages are available for dependency linking.
          </p>
        )}
      </div>
    </div>
  );
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

type ActionMenuPosition = {
  top: number;
  left: number;
};

function isWorkPackageBlocked(workPackage: WorkPackage) {
  return (
    workPackage.status === 'blocked_by_payment' ||
    workPackage.status === 'blocked_by_dependency'
  );
}

function getActionDisabledReason(workPackage: WorkPackage) {
  if (workPackage.status === 'blocked_by_payment') return 'Blocked By Payment';
  if (workPackage.status === 'blocked_by_dependency') return 'Blocked By Dependency';
  if (workPackage.status === 'completed') return 'Already Completed';

  return '';
}

function getStartPauseButtonConfig({
  workPackage,
  onStartWork,
  onPauseWork,
  onResumeWork,
}: {
  workPackage: WorkPackage;
  onStartWork?: (workPackageId: string) => void;
  onPauseWork?: (workPackageId: string) => void;
  onResumeWork?: (workPackageId: string) => void;
}) {
  if (workPackage.status === 'paused') {
    return {
      label: 'Resume Work',
      icon: RotateCcw,
      onClick: () => onResumeWork?.(workPackage.id),
      disabled: false,
      disabledTitle: '',
    };
  }

  if (workPackage.status === 'in_progress' || workPackage.status === 'delayed') {
    return {
      label: 'Pause Work',
      icon: PauseCircle,
      onClick: () => onPauseWork?.(workPackage.id),
      disabled: false,
      disabledTitle: '',
    };
  }

  const disabled =
    isWorkPackageBlocked(workPackage) || workPackage.status === 'completed';

  return {
    label: 'Start Work',
    icon: PlayCircle,
    onClick: () => onStartWork?.(workPackage.id),
    disabled,
    disabledTitle: disabled ? getActionDisabledReason(workPackage) : '',
  };
}

function getCompleteButtonConfig({
  workPackage,
  onCompleteWork,
}: {
  workPackage: WorkPackage;
  onCompleteWork?: (workPackageId: string) => void;
}) {
  const disabled =
    isWorkPackageBlocked(workPackage) || workPackage.status === 'completed';

  return {
    label: 'Complete Work',
    icon: CheckCircle2,
    onClick: () => onCompleteWork?.(workPackage.id),
    disabled,
    disabledTitle: disabled ? getActionDisabledReason(workPackage) : '',
  };
}

function WorkPackageActionMenu({
  actions,
  menuPosition,
  onClose,
}: {
  actions: WorkPackageAction[];
  menuPosition: ActionMenuPosition | null;
  onClose: () => void;
}) {
  if (!menuPosition || typeof document === 'undefined') return null;

  const menuWidth = 220;
  const safeLeft =
    typeof window === 'undefined'
      ? menuPosition.left
      : Math.min(menuPosition.left, window.innerWidth - menuWidth - 12);

  return createPortal(
    <>
      <button
        type="button"
        aria-label="Close work package actions"
        className="fixed inset-0 z-[9998] cursor-default bg-transparent"
        onClick={onClose}
      />

      <div
        className="fixed z-[9999] w-[220px] overflow-hidden rounded-2xl border border-border bg-popover p-1 text-popover-foreground shadow-2xl"
        style={{
          top: menuPosition.top,
          left: Math.max(12, safeLeft),
        }}
      >
        {actions.length > 0 ? (
          actions.map(action => {
            const Icon = action.icon;

            return (
              <button
                key={action.label}
                type="button"
                onClick={() => {
                  action.onClick?.();
                  onClose();
                }}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition hover:bg-muted"
              >
                <Icon className="h-4 w-4" />
                {action.label}
              </button>
            );
          })
        ) : (
          <p className="px-3 py-2.5 text-sm text-muted-foreground">
            No more actions
          </p>
        )}
      </div>
    </>,
    document.body
  );
}

function WorkPackageActionButtons({
  workPackage,
  secondaryActions,
  onStartWork,
  onPauseWork,
  onResumeWork,
  onCompleteWork,
}: {
  workPackage: WorkPackage;
  secondaryActions: WorkPackageAction[];
  onStartWork?: (workPackageId: string) => void;
  onPauseWork?: (workPackageId: string) => void;
  onResumeWork?: (workPackageId: string) => void;
  onCompleteWork?: (workPackageId: string) => void;
}) {
  const [menuPosition, setMenuPosition] = useState<ActionMenuPosition | null>(null);
  const startPauseAction = getStartPauseButtonConfig({
    workPackage,
    onStartWork,
    onPauseWork,
    onResumeWork,
  });
  const completeAction = getCompleteButtonConfig({
    workPackage,
    onCompleteWork,
  });
  const visibleMenuActions = secondaryActions.filter(
    action =>
      ![
        'Start Work',
        'Pause Work',
        'Resume Work',
        'Complete Work',
      ].includes(action.label)
  );
  const StartPauseIcon = startPauseAction.icon;
  const CompleteIcon = completeAction.icon;

  return (
    <div className="flex min-w-0 items-center justify-center gap-2">
      <button
        type="button"
        aria-label={startPauseAction.label}
        title={startPauseAction.disabledTitle || startPauseAction.label}
        onClick={startPauseAction.onClick}
        disabled={startPauseAction.disabled}
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
      >
        <StartPauseIcon className="h-4 w-4" />
      </button>

      <button
        type="button"
        aria-label={completeAction.label}
        title={completeAction.disabledTitle || completeAction.label}
        onClick={completeAction.onClick}
        disabled={completeAction.disabled}
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
      >
        <CompleteIcon className="h-4 w-4" />
      </button>

      <button
        type="button"
        aria-label="More work package actions"
        title="More Actions"
        onClick={event => {
          const rect = event.currentTarget.getBoundingClientRect();

          setMenuPosition(current =>
            current
              ? null
              : {
                  top: rect.bottom + 8,
                  left: rect.right - 220,
                }
          );
        }}
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground transition hover:bg-muted hover:text-foreground"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      <WorkPackageActionMenu
        actions={visibleMenuActions}
        menuPosition={menuPosition}
        onClose={() => setMenuPosition(null)}
      />
    </div>
  );
}

function WorkPackageRow({
  workPackage,
  workPackages,
  editingDependencyId,
  onEditPrerequisites,
  onCloseDependencyEditor,
  onStartWork,
  onPauseWork,
  onResumeWork,
  onCompleteWork,
  onMarkDelayed,
  onUpdateDelayReason,
  onUpdatePrerequisites,
}: TimelineWorkPackagesProps & {
  workPackage: WorkPackage;
  editingDependencyId: string | null;
  onEditPrerequisites: (workPackageId: string) => void;
  onCloseDependencyEditor: () => void;
}) {
  const vendorName = getVendorName(workPackage.vendorId);
  const latestPauseReason = getLatestPauseReason(workPackage);
  const titleParts = getWorkPackageTitleParts(workPackage.title);
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
  const dependencyPreview = getDependencyPreview(workPackage, workPackages);
  const dependencyWorkPackages = getDependencyWorkPackages(workPackage, workPackages);
  const dependentWorkPackages = getDependentWorkPackages(workPackage, workPackages);
  const isDependencyEditorOpen = editingDependencyId === workPackage.id;

  return (
    <>
      <article className="border-b border-border px-3 py-3 last:border-b-0 xl:hidden">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-1 flex min-w-0 flex-wrap items-center gap-2">
              <p className="truncate text-base font-semibold text-foreground">
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
              <p className="line-clamp-1 text-sm text-muted-foreground">
                {titleParts.workName}
              </p>
            )}
          </div>
        </div>

        <div className="mt-3 grid gap-2 rounded-xl border border-border bg-background/60 p-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Planned</span>
            <span className="text-right font-medium text-foreground">
              {getShortDateRange(workPackage.estimatedStartDate, workPackage.estimatedEndDate)}
            </span>
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Actual</span>
            <span className="text-right font-medium text-foreground">
              {getMobileActualLabel(workPackage)}
            </span>
          </div>

          {(workPackage.overrideReason || latestPauseReason) && (
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Issue</span>
              <span className="line-clamp-1 text-right font-medium text-red-600 dark:text-red-300">
                {workPackage.overrideReason ?? latestPauseReason}
              </span>
            </div>
          )}
        </div>

        <div className="mt-3 rounded-xl border border-border bg-background/60 p-3 text-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                Prerequisites
              </p>
              <p className="mt-1 line-clamp-2 text-sm font-medium text-foreground">
                {dependencyPreview}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {`Unlocks ${dependentWorkPackages.length} Package${dependentWorkPackages.length === 1 ? '' : 's'}`}
              </p>
            </div>

            {onUpdatePrerequisites ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onEditPrerequisites(workPackage.id)}
                className="shrink-0 gap-2"
              >
                <Link2 className="h-4 w-4" />
                Edit
              </Button>
            ) : null}
          </div>

          {isDependencyEditorOpen && (
            <DependencyEditor
              workPackage={workPackage}
              workPackages={workPackages}
              onUpdatePrerequisites={onUpdatePrerequisites}
              onClose={onCloseDependencyEditor}
            />
          )}
        </div>

        <div className="mt-3">
          <WorkPackageActionButtons
            workPackage={workPackage}
            secondaryActions={secondaryActions}
            onStartWork={onStartWork}
            onPauseWork={onPauseWork}
            onResumeWork={onResumeWork}
            onCompleteWork={onCompleteWork}
          />
        </div>

      </article>

      <div className="hidden min-w-0 gap-3 border-b border-border px-3 py-3 last:border-b-0 xl:grid xl:grid-cols-[minmax(300px,1.5fr)_150px_150px_minmax(150px,0.8fr)_156px_152px] xl:items-center xl:gap-4 xl:px-4">
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

        <div className="block">
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

        <div className="block">
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

        <div className="block">
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

        <div className="block">
          <div className="rounded-xl border border-border bg-background px-3 py-2 text-center">
            <div className="flex items-center justify-center gap-2 text-sm font-medium text-foreground">
              <Link2 className="h-4 w-4 text-muted-foreground" />
              <span>
                {dependencyWorkPackages.length > 0 ? dependencyWorkPackages.length : 'None'}
              </span>
            </div>
            <p className="mt-1 whitespace-nowrap text-xs text-muted-foreground">
              {`Unlocks ${dependentWorkPackages.length} Package${dependentWorkPackages.length === 1 ? '' : 's'}`}
            </p>
          </div>

          {onUpdatePrerequisites ? (
            <button
              type="button"
              onClick={() => onEditPrerequisites(workPackage.id)}
              className="mt-2 w-full rounded-lg border border-border px-2 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              Edit
            </button>
          ) : null}
        </div>

        <div className="flex min-w-0 items-center justify-center">
          <WorkPackageActionButtons
            workPackage={workPackage}
            secondaryActions={secondaryActions}
            onStartWork={onStartWork}
            onPauseWork={onPauseWork}
            onResumeWork={onResumeWork}
            onCompleteWork={onCompleteWork}
          />
        </div>
      </div>

      {isDependencyEditorOpen && (
        <div className="hidden border-b border-border bg-muted/20 px-4 py-3 xl:block">
          <DependencyEditor
            workPackage={workPackage}
            workPackages={workPackages}
            onUpdatePrerequisites={onUpdatePrerequisites}
            onClose={onCloseDependencyEditor}
          />
        </div>
      )}
    </>
  );
}

function WorkPackageGroup({
  title,
  description,
  workPackages,
  allWorkPackages,
  editingDependencyId,
  onEditPrerequisites,
  onCloseDependencyEditor,
  badgeVariant,
  onStartWork,
  onPauseWork,
  onResumeWork,
  onCompleteWork,
  onMarkDelayed,
  onUpdateDelayReason,
  onUpdatePrerequisites,
}: {
  title: string;
  description: string;
  workPackages: WorkPackage[];
  allWorkPackages: WorkPackage[];
  editingDependencyId: string | null;
  onEditPrerequisites: (workPackageId: string) => void;
  onCloseDependencyEditor: () => void;
  badgeVariant: 'danger' | 'warning' | 'info' | 'success' | 'muted';
  onStartWork?: (workPackageId: string) => void;
  onPauseWork?: (workPackageId: string) => void;
  onResumeWork?: (workPackageId: string) => void;
  onCompleteWork?: (workPackageId: string) => void;
  onMarkDelayed?: (workPackageId: string) => void;
  onUpdateDelayReason?: (workPackageId: string) => void;
  onUpdatePrerequisites?: (workPackageId: string, dependencyIds: string[]) => void;
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
      <div className="rounded-2xl border border-border bg-card">
        <div className="overflow-x-auto">
          <div className="min-w-full">
            <div className="hidden border-b border-border px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground xl:grid xl:grid-cols-[minmax(300px,1.5fr)_150px_150px_minmax(150px,0.8fr)_156px_152px] xl:gap-4">
              <span>Work Package</span>
              <span>Planned</span>
              <span>Actual</span>
              <span>Pause / Delay</span>
              <span className="text-center">Prerequisites</span>
              <span className="text-center">Actions</span>
            </div>

            {workPackages.map(workPackage => (
              <WorkPackageRow
            key={workPackage.id}
            workPackage={workPackage}
            workPackages={allWorkPackages}
            editingDependencyId={editingDependencyId}
            onEditPrerequisites={onEditPrerequisites}
            onCloseDependencyEditor={onCloseDependencyEditor}
            onStartWork={onStartWork}
            onPauseWork={onPauseWork}
            onResumeWork={onResumeWork}
            onCompleteWork={onCompleteWork}
            onMarkDelayed={onMarkDelayed}
            onUpdateDelayReason={onUpdateDelayReason}
            onUpdatePrerequisites={onUpdatePrerequisites}
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
  onUpdatePrerequisites,
}: TimelineWorkPackagesProps) {
  const [editingDependencyId, setEditingDependencyId] = useState<string | null>(null);
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
        allWorkPackages={workPackages}
        editingDependencyId={editingDependencyId}
        onEditPrerequisites={setEditingDependencyId}
        onCloseDependencyEditor={() => setEditingDependencyId(null)}
        badgeVariant="danger"
        onStartWork={onStartWork}
        onPauseWork={onPauseWork}
        onResumeWork={onResumeWork}
        onCompleteWork={onCompleteWork}
        onMarkDelayed={onMarkDelayed}
        onUpdateDelayReason={onUpdateDelayReason}
        onUpdatePrerequisites={onUpdatePrerequisites}
      />

      <WorkPackageGroup
        title="Active / Upcoming"
        description="Work that is ready, in progress, or not yet started."
        workPackages={activeOrUpcoming}
        allWorkPackages={workPackages}
        editingDependencyId={editingDependencyId}
        onEditPrerequisites={setEditingDependencyId}
        onCloseDependencyEditor={() => setEditingDependencyId(null)}
        badgeVariant="info"
        onStartWork={onStartWork}
        onPauseWork={onPauseWork}
        onResumeWork={onResumeWork}
        onCompleteWork={onCompleteWork}
        onMarkDelayed={onMarkDelayed}
        onUpdateDelayReason={onUpdateDelayReason}
        onUpdatePrerequisites={onUpdatePrerequisites}
      />

      <WorkPackageGroup
        title="Completed"
        description="Finished work packages that are no longer blocking the current timeline."
        workPackages={completed}
        allWorkPackages={workPackages}
        editingDependencyId={editingDependencyId}
        onEditPrerequisites={setEditingDependencyId}
        onCloseDependencyEditor={() => setEditingDependencyId(null)}
        badgeVariant="success"
        onStartWork={onStartWork}
        onPauseWork={onPauseWork}
        onResumeWork={onResumeWork}
        onCompleteWork={onCompleteWork}
        onMarkDelayed={onMarkDelayed}
        onUpdateDelayReason={onUpdateDelayReason}
        onUpdatePrerequisites={onUpdatePrerequisites}
      />
    </div>
  );
}
