import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
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
import type { WorkPackage } from '../types';

type TimelineVendorOption = {
  id: string;
  name: string;
  category?: string;
  phone?: string;
  status?: string;
  availability?: string;
};

interface TimelineWorkPackagesProps {
  workPackages: WorkPackage[];
  vendors?: TimelineVendorOption[];
  onAssignVendor?: (workPackageId: string, vendorId?: string) => void;
  onStartWork?: (workPackageId: string) => void;
  onPauseWork?: (workPackageId: string) => void;
  onResumeWork?: (workPackageId: string) => void;
  onCompleteWork?: (workPackageId: string) => void;
  onMarkDelayed?: (workPackageId: string) => void;
  onUpdateDelayReason?: (workPackageId: string) => void;
  onResolveDelay?: (workPackageId: string) => void;
  onUpdatePrerequisites?: (workPackageId: string, dependencyIds: string[]) => void;
}

type WorkPackageAction = {
  label: string;
  icon: typeof PlayCircle;
  onClick?: () => void;
};

function getVendorName(vendorId: string | undefined, vendors: TimelineVendorOption[] = []) {
  if (!vendorId) return undefined;

  return vendors.find(vendor => vendor.id === vendorId)?.name;
}


function formatLabel(value: string) {
  return value
    .split('_')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatTimelineDateTime(value?: string, fallbackDate?: string) {
  const rawValue = value ?? fallbackDate;

  if (!rawValue) return 'Not set';

  const parsedDate = new Date(value ?? `${fallbackDate}T00:00:00`);

  if (Number.isNaN(parsedDate.getTime())) return rawValue;

  if (!value && fallbackDate) {
    return parsedDate.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  return parsedDate.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatPauseDuration(startAt?: string, endAt?: string) {
  if (!startAt || !endAt) return null;

  const startDate = new Date(startAt);
  const endDate = new Date(endAt);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return null;
  }

  const diffMinutes = Math.max(0, Math.round((endDate.getTime() - startDate.getTime()) / 60000));
  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;

  if (hours > 0 && minutes > 0) return `${hours} hr ${minutes} min`;
  if (hours > 0) return `${hours} hr`;

  return `${minutes} min`;
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

function getActiveDelayInfo(workPackage: WorkPackage) {
  if (workPackage.delayInfo?.status === 'open') return workPackage.delayInfo;

  if (workPackage.overrideReason) {
    return {
      reason: workPackage.overrideReason,
      owner: undefined,
      impactDays: undefined,
      expectedRecoveryDate: undefined,
      status: 'open',
    };
  }

  return null;
}

function formatDelayOwner(owner?: string) {
  if (!owner) return 'Not Set';

  return formatLabel(owner);
}

function getDelayHistoryEntries(workPackage: WorkPackage) {
  const delayHistoryById = new Map<string, NonNullable<WorkPackage['delayInfo']>>();

  (workPackage.delayHistory ?? []).forEach((delayItem, index) => {
    const delayItemId = delayItem.id ?? `legacy-delay-${workPackage.id}-${index}`;

    delayHistoryById.set(delayItemId, {
      ...delayItem,
      id: delayItemId,
    });
  });

  if (workPackage.delayInfo) {
    const delayInfoId = workPackage.delayInfo.id ?? `current-delay-${workPackage.id}`;

    delayHistoryById.set(delayInfoId, {
      ...workPackage.delayInfo,
      id: delayInfoId,
    });
  }

  return Array.from(delayHistoryById.values()).sort((first, second) =>
    first.flaggedAt.localeCompare(second.flaggedAt)
  );
}

function formatDelayDateTime(value?: string) {
  return formatTimelineDateTime(value, value?.slice(0, 10));
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
  onResolveDelay,
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
      label: 'Flag Delay',
      icon: AlertTriangle,
      onClick: () => onMarkDelayed?.(workPackage.id),
    });
  }

  if (workPackage.status === 'delayed' || workPackage.overrideReason || workPackage.delayInfo) {
    actions.push({
      label: 'Update Delay',
      icon: MessageSquareText,
      onClick: () => onUpdateDelayReason?.(workPackage.id),
    });
  }

  if (workPackage.status === 'delayed' || workPackage.delayInfo?.status === 'open') {
    actions.push({
      label: 'Resolve Delay',
      icon: CheckCircle2,
      onClick: () => onResolveDelay?.(workPackage.id),
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

function VendorAssignmentPicker({
  workPackage,
  vendors = [],
  onAssignVendor,
  mode = 'full',
}: {
  workPackage: WorkPackage;
  vendors?: TimelineVendorOption[];
  onAssignVendor?: (workPackageId: string, vendorId?: string) => void;
  mode?: 'full' | 'icon';
}) {
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({
    top: 0,
    left: 0,
    width: 280,
  });

  const selectedVendor = vendors.find(vendor => vendor.id === workPackage.vendorId);
  const displayName = selectedVendor?.name ?? workPackage.assigneeName ?? 'Assign Vendor';
  const normalizedQuery = query.trim().toLowerCase();

  const matchingVendors = vendors
    .filter(vendor => {
      if (vendor.status && vendor.status !== 'active') return false;
      if (!normalizedQuery) return true;

      return [vendor.name, vendor.category, vendor.phone]
        .filter(Boolean)
        .some(value => String(value).toLowerCase().includes(normalizedQuery));
    })
    .slice(0, 8);

  const openPicker = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    const menuWidth = 280;

    if (rect) {
      const rawLeft = mode === 'icon' ? rect.right - menuWidth : rect.left;
      const safeLeft =
        typeof window === 'undefined'
          ? rawLeft
          : Math.min(Math.max(12, rawLeft), window.innerWidth - menuWidth - 12);

      setMenuPosition({
        top: rect.bottom + 8,
        left: safeLeft,
        width: mode === 'icon' ? menuWidth : Math.max(menuWidth, rect.width),
      });
    }

    setIsOpen(true);
  };

  const handleSelectVendor = (vendor: TimelineVendorOption) => {
    onAssignVendor?.(workPackage.id, vendor.id);
    setQuery('');
    setIsOpen(false);
  };

  const handleClearVendor = () => {
    onAssignVendor?.(workPackage.id, undefined);
    setQuery('');
    setIsOpen(false);
  };

  if (!onAssignVendor) {
    return (
      <span className="truncate text-sm font-medium text-foreground">
        {displayName}
      </span>
    );
  }

  return (
    <div className={mode === 'icon' ? 'shrink-0' : 'min-w-0'}>
      <button
        ref={buttonRef}
        type="button"
        aria-label={`Change vendor for ${displayName}`}
        title="Change vendor"
        onClick={() => {
          if (isOpen) {
            setIsOpen(false);
          } else {
            openPicker();
          }
        }}
        className={
          mode === 'icon'
            ? 'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition hover:bg-muted hover:text-foreground'
            : 'flex w-full min-w-0 items-center justify-between gap-2 rounded-xl border border-border bg-background px-3 py-2 text-left text-sm font-medium text-foreground transition hover:bg-muted'
        }
      >
        {mode === 'icon' ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <>
            <span className="truncate">{displayName}</span>
            <span className="shrink-0 text-xs text-muted-foreground">Change</span>
          </>
        )}
      </button>

      {isOpen && (
        <>
          <button
            type="button"
            aria-label="Close vendor picker"
            className="fixed inset-0 z-[219] cursor-default bg-transparent"
            onClick={() => setIsOpen(false)}
          />

          <div
            className="fixed z-[220] rounded-xl border border-border bg-popover p-2 text-popover-foreground shadow-2xl"
            style={{
              top: menuPosition.top,
              left: menuPosition.left,
              width: menuPosition.width,
            }}
          >
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search vendor"
            className="mb-2 h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-foreground"
            autoFocus
          />

          <div className="max-h-52 overflow-y-auto">
            {matchingVendors.length > 0 ? (
              matchingVendors.map(vendor => (
                <button
                  key={vendor.id}
                  type="button"
                  onClick={() => handleSelectVendor(vendor)}
                  className="flex w-full min-w-0 flex-col rounded-lg px-3 py-2 text-left transition hover:bg-muted"
                >
                  <span className="truncate text-sm font-medium text-foreground">
                    {vendor.name}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {[vendor.category, vendor.phone].filter(Boolean).join(' - ') || 'Vendor'}
                  </span>
                </button>
              ))
            ) : (
              <p className="px-3 py-2 text-sm text-muted-foreground">
                No matching vendors
              </p>
            )}
          </div>

          {workPackage.vendorId && (
            <div className="mt-2 border-t border-border pt-2">
              <button
                type="button"
                onClick={handleClearVendor}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted"
              >
                Clear
              </button>
            </div>
          )}
          </div>
        </>
      )}
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
  onResolveDelay,
  onUpdatePrerequisites,
  vendors,
  onAssignVendor,
}: TimelineWorkPackagesProps & {
  workPackage: WorkPackage;
  editingDependencyId: string | null;
  onEditPrerequisites: (workPackageId: string) => void;
  onCloseDependencyEditor: () => void;
}) {
  const [historyModalTab, setHistoryModalTab] = useState<'pause' | 'delay' | null>(null);
  const vendorName = getVendorName(workPackage.vendorId, vendors);
  const latestPauseReason = getLatestPauseReason(workPackage);
  const activeDelayInfo = getActiveDelayInfo(workPackage);
  const delayHistoryEntries = getDelayHistoryEntries(workPackage);
  const hasHistoryEntries =
    workPackage.pausePeriods.length > 0 || delayHistoryEntries.length > 0;
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
    onResolveDelay,
  });
  const dependencyPreview = getDependencyPreview(workPackage, workPackages);
  const dependencyWorkPackages = getDependencyWorkPackages(workPackage, workPackages);
  const dependentWorkPackages = getDependentWorkPackages(workPackage, workPackages);
  const isDependencyEditorOpen = editingDependencyId === workPackage.id;

  return (
    <>
      <article className="border-b border-border px-3 py-3 last:border-b-0 xl:hidden">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-1 min-w-0">
              <p className="truncate text-base font-semibold text-foreground">
                {titleParts.areaName}
              </p>
              <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2">
                <StatusBadge variant={getStatusVariant(workPackage.status)}>
                  {formatLabel(workPackage.status)}
                </StatusBadge>
                <StatusBadge variant={getPriorityVariant(workPackage.priority)}>
                  {formatLabel(workPackage.priority)}
                </StatusBadge>
              </div>
            </div>

            {titleParts.workName && (
              <p className="line-clamp-1 text-sm text-muted-foreground">
                {titleParts.workName}
              </p>
            )}

            <div className="mt-3 flex w-full min-w-0 items-center justify-between gap-3 rounded-xl border border-border bg-background/60 p-3 text-sm">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Vendor
                </p>
                <p className="mt-0.5 truncate text-sm font-medium text-foreground">
                  {vendorName ?? workPackage.assigneeName ?? 'Assign Vendor'}
                </p>
              </div>

              {onAssignVendor ? (
                <VendorAssignmentPicker
                  workPackage={workPackage}
                  vendors={vendors}
                  onAssignVendor={onAssignVendor}
                  mode="icon"
                />
              ) : null}
            </div>
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

          {(activeDelayInfo || latestPauseReason) && (
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Issue</span>
              <span className="line-clamp-1 text-right font-medium text-red-600 dark:text-red-300">
                {activeDelayInfo?.reason ?? latestPauseReason}
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

      <div className="hidden min-w-0 gap-3 border-b border-border px-3 py-3 last:border-b-0 xl:grid xl:grid-cols-[minmax(220px,1.3fr)_minmax(105px,0.55fr)_minmax(105px,0.55fr)_minmax(118px,0.65fr)_minmax(120px,0.55fr)_minmax(112px,0.45fr)] xl:items-center xl:gap-3 xl:px-4">
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

          <div className="mt-2">
            <VendorAssignmentPicker
              workPackage={workPackage}
              vendors={vendors}
              onAssignVendor={onAssignVendor}
            />
          </div>
        </div>

        <div className="min-w-0">
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

        <div className="min-w-0">
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

        <div className="min-w-0">
          <div className="min-w-0">
            {activeDelayInfo ? (
              <div className="rounded-xl border border-red-500/25 bg-red-500/10 p-2">
                <p className="line-clamp-2 text-sm font-semibold text-red-600 dark:text-red-300">
                  Delay: {activeDelayInfo.reason}
                </p>

                <div className="mt-2 grid gap-1 text-xs text-muted-foreground">
                  <p>
                    Source:{' '}
                    <span className="font-medium text-foreground">
                      {formatDelayOwner(activeDelayInfo.owner)}
                    </span>
                  </p>
                  <p>
                    Impact:{' '}
                    <span className="font-medium text-foreground">
                      {activeDelayInfo.impactDays ?? 0} day(s)
                    </span>
                  </p>
                  <p>
                    Recovery:{' '}
                    <span className="font-medium text-foreground">
                      {activeDelayInfo.expectedRecoveryDate
                        ? formatDisplayDate(activeDelayInfo.expectedRecoveryDate)
                        : 'Not set'}
                    </span>
                  </p>
                </div>
              </div>
            ) : latestPauseReason ? (
              <p className="truncate text-sm text-amber-700 dark:text-amber-300">
                Latest pause: {latestPauseReason}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Clear</p>
            )}

            {hasHistoryEntries && (
              <div className="mt-2 grid gap-1">
                <button
                  type="button"
                  onClick={() =>
                    setHistoryModalTab(
                      workPackage.pausePeriods.length > 0 ? 'pause' : 'delay'
                    )
                  }
                  className="inline-flex text-left text-xs font-semibold text-muted-foreground underline-offset-4 transition hover:text-foreground hover:underline"
                >
                  View All
                </button>
                <p className="text-[11px] text-muted-foreground">
                  {workPackage.pausePeriods.length} pause(s) ?{' '}
                  {delayHistoryEntries.length} delay(s)
                </p>
              </div>
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

      {historyModalTab && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/45 px-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-[2rem] border border-border bg-card p-5 text-card-foreground shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-lg font-semibold text-foreground">
                  Pause / Delay History
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {titleParts.areaName}
                  {titleParts.workName ? ` - ${titleParts.workName}` : ''}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setHistoryModalTab(null)}
                className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                Close
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl border border-border bg-background p-1">
              <button
                type="button"
                onClick={() => setHistoryModalTab('pause')}
                className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                  historyModalTab === 'pause'
                    ? 'bg-foreground text-background'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                Pauses ({workPackage.pausePeriods.length})
              </button>
              <button
                type="button"
                onClick={() => setHistoryModalTab('delay')}
                className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                  historyModalTab === 'delay'
                    ? 'bg-foreground text-background'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                Delays ({delayHistoryEntries.length})
              </button>
            </div>

            <div className="mt-4 max-h-[55vh] overflow-y-auto pr-1">
              {historyModalTab === 'pause' ? (
                workPackage.pausePeriods.length > 0 ? (
                  <div className="grid gap-3">
                    {workPackage.pausePeriods.map((pausePeriod, pauseIndex) => {
                      const durationLabel = formatPauseDuration(
                        pausePeriod.pauseStartAt,
                        pausePeriod.pauseEndAt
                      );

                      return (
                        <div
                          key={pausePeriod.id}
                          className="rounded-2xl border border-border bg-background p-4 text-sm"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <p className="font-semibold text-foreground">
                              Pause {pauseIndex + 1}
                            </p>
                            <StatusBadge
                              variant={pausePeriod.pauseEnd ? 'outline' : 'warning'}
                            >
                              {pausePeriod.pauseEnd ? 'Closed' : 'Open'}
                            </StatusBadge>
                          </div>

                          <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
                            <p>
                              From:{' '}
                              <span className="font-medium text-foreground">
                                {formatTimelineDateTime(
                                  pausePeriod.pauseStartAt,
                                  pausePeriod.pauseStart
                                )}
                              </span>
                            </p>
                            <p>
                              To:{' '}
                              <span className="font-medium text-foreground">
                                {pausePeriod.pauseEnd
                                  ? formatTimelineDateTime(
                                      pausePeriod.pauseEndAt,
                                      pausePeriod.pauseEnd
                                    )
                                  : 'Still paused'}
                              </span>
                            </p>
                            <p>
                              Duration:{' '}
                              <span className="font-medium text-foreground">
                                {durationLabel ?? 'Not available'}
                              </span>
                            </p>
                          </div>

                          <p className="mt-3 rounded-xl bg-amber-500/10 px-3 py-2 text-sm leading-6 text-amber-700 dark:text-amber-300">
                            {pausePeriod.reason}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="rounded-2xl border border-dashed border-border bg-background p-5 text-sm text-muted-foreground">
                    No pause history recorded for this work package.
                  </p>
                )
              ) : delayHistoryEntries.length > 0 ? (
                <div className="grid gap-3">
                  {delayHistoryEntries.map((delayItem, delayIndex) => (
                    <div
                      key={delayItem.id ?? `delay-${delayIndex}`}
                      className="rounded-2xl border border-border bg-background p-4 text-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-semibold text-foreground">
                          Delay {delayIndex + 1}
                        </p>
                        <StatusBadge
                          variant={delayItem.status === 'resolved' ? 'success' : 'danger'}
                        >
                          {formatLabel(delayItem.status)}
                        </StatusBadge>
                      </div>

                      <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
                        <p>
                          Source:{' '}
                          <span className="font-medium text-foreground">
                            {formatDelayOwner(delayItem.owner)}
                          </span>
                        </p>
                        <p>
                          Impact:{' '}
                          <span className="font-medium text-foreground">
                            {delayItem.impactDays} day(s)
                          </span>
                        </p>
                        <p>
                          Flagged:{' '}
                          <span className="font-medium text-foreground">
                            {formatDelayDateTime(delayItem.flaggedAt)}
                          </span>
                        </p>
                        <p>
                          Resolved:{' '}
                          <span className="font-medium text-foreground">
                            {delayItem.resolvedAt
                              ? formatDelayDateTime(delayItem.resolvedAt)
                              : 'Open'}
                          </span>
                        </p>
                        <p className="lg:col-span-2">
                          Recovery:{' '}
                          <span className="font-medium text-foreground">
                            {formatDisplayDate(delayItem.expectedRecoveryDate)}
                          </span>
                        </p>
                      </div>

                      <p className="mt-3 rounded-xl bg-red-500/10 px-3 py-2 text-sm leading-6 text-red-600 dark:text-red-300">
                        {delayItem.reason}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-2xl border border-dashed border-border bg-background p-5 text-sm text-muted-foreground">
                  No delay history recorded for this work package.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

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
  onResolveDelay,
  onUpdatePrerequisites,
  vendors,
  onAssignVendor,
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
  onResolveDelay?: (workPackageId: string) => void;
  onUpdatePrerequisites?: (workPackageId: string, dependencyIds: string[]) => void;
  vendors?: TimelineVendorOption[];
  onAssignVendor?: (workPackageId: string, vendorId?: string) => void;
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
            <div className="hidden border-b border-border px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground xl:grid xl:grid-cols-[minmax(220px,1.3fr)_minmax(105px,0.55fr)_minmax(105px,0.55fr)_minmax(118px,0.65fr)_minmax(120px,0.55fr)_minmax(112px,0.45fr)] xl:gap-3">
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
            onResolveDelay={onResolveDelay}
            onUpdatePrerequisites={onUpdatePrerequisites}
            vendors={vendors}
            onAssignVendor={onAssignVendor}
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
  onResolveDelay,
  onUpdatePrerequisites,
  vendors,
  onAssignVendor,
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
        onResolveDelay={onResolveDelay}
        onUpdatePrerequisites={onUpdatePrerequisites}
        vendors={vendors}
        onAssignVendor={onAssignVendor}
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
        onResolveDelay={onResolveDelay}
        onUpdatePrerequisites={onUpdatePrerequisites}
        vendors={vendors}
        onAssignVendor={onAssignVendor}
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
        onResolveDelay={onResolveDelay}
        onUpdatePrerequisites={onUpdatePrerequisites}
        vendors={vendors}
        onAssignVendor={onAssignVendor}
      />
    </div>
  );
}
