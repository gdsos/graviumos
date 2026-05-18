import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Link2,
  MessageSquareText,
  PauseCircle,
  PlayCircle,
  RotateCcw,
  UserRound,
} from 'lucide-react';

import { StatusBadge } from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';
import type { WorkPackage } from '../types';

interface WorkPackageCardProps {
  workPackage: WorkPackage;
  vendorName?: string;
  dependencyCount?: number;
  onStartWork?: (workPackageId: string) => void;
  onPauseWork?: (workPackageId: string) => void;
  onResumeWork?: (workPackageId: string) => void;
  onCompleteWork?: (workPackageId: string) => void;
  onMarkDelayed?: (workPackageId: string) => void;
  onUpdateDelayReason?: (workPackageId: string) => void;
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

function formatLabel(value: string) {
  return value
    .split('_')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function WorkPackageCard({
  workPackage,
  vendorName,
  dependencyCount = workPackage.dependsOnWorkPackageIds.length,
  onStartWork,
  onPauseWork,
  onResumeWork,
  onCompleteWork,
  onMarkDelayed,
  onUpdateDelayReason,
}: WorkPackageCardProps) {
  const hasActualTimeline =
    workPackage.actualStartDate || workPackage.actualEndDate;
  const isBlocked =
    workPackage.status === 'blocked_by_payment' ||
    workPackage.status === 'blocked_by_dependency';
  const isCompleted = workPackage.status === 'completed';
  const canStart =
    !isBlocked &&
    !isCompleted &&
    workPackage.status !== 'in_progress' &&
    workPackage.status !== 'paused';
  const canPause =
    workPackage.status === 'in_progress' || workPackage.status === 'delayed';
  const canResume = workPackage.status === 'paused';
  const canComplete = !isBlocked && !isCompleted;
  const canMarkDelayed = !isCompleted && workPackage.status !== 'delayed';

  return (
    <article className="min-w-0 rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-sm sm:p-5">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap gap-2">
            <StatusBadge variant={getStatusVariant(workPackage.status)}>
              {formatLabel(workPackage.status)}
            </StatusBadge>

            <StatusBadge variant={getPriorityVariant(workPackage.priority)}>
              {formatLabel(workPackage.priority)}
            </StatusBadge>

            <StatusBadge variant="outline">
              {formatLabel(workPackage.phase)}
            </StatusBadge>
          </div>

          <h3 className="text-base font-semibold text-foreground">
            {workPackage.title}
          </h3>

          {workPackage.description && (
            <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">
              {workPackage.description}
            </p>
          )}
        </div>

        {workPackage.manualOverrideEnabled && (
          <StatusBadge variant="info">Override</StatusBadge>
        )}
      </div>

      <div className="mt-4 grid min-w-0 gap-3 md:grid-cols-2">
        <div className="min-w-0 rounded-xl border border-border bg-background p-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Estimated
          </p>
          <div className="flex min-w-0 items-center gap-2 text-foreground">
            <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate text-sm">
              {workPackage.estimatedStartDate} → {workPackage.estimatedEndDate}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {workPackage.estimatedDurationDays} day(s)
          </p>
        </div>

        <div className="min-w-0 rounded-xl border border-border bg-background p-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Actual
          </p>
          {hasActualTimeline ? (
            <>
              <div className="flex min-w-0 items-center gap-2 text-foreground">
                <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate text-sm">
                  {workPackage.actualStartDate ?? '—'} →{' '}
                  {workPackage.actualEndDate ?? 'In progress'}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {workPackage.actualDurationDays ?? '—'} day(s)
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Not started yet</p>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
        <div className="flex min-w-0 items-center gap-2">
          <UserRound className="h-4 w-4 shrink-0" />
          <span className="truncate">{workPackage.assigneeName}</span>
        </div>

        <div className="flex min-w-0 items-center gap-2">
          <Link2 className="h-4 w-4 shrink-0" />
          <span className="truncate">
            {dependencyCount} dependenc{dependencyCount === 1 ? 'y' : 'ies'}
          </span>
        </div>

        {vendorName && (
          <div className="min-w-0 sm:col-span-2">
            <span className="font-medium text-foreground">Vendor:</span>{' '}
            <span className="text-muted-foreground">{vendorName}</span>
          </div>
        )}
      </div>

      {workPackage.pausePeriods.length > 0 && (
        <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3">
          <div className="mb-1 flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-300">
            <PauseCircle className="h-4 w-4" />
            Pause history
          </div>

          <div className="space-y-2">
            {workPackage.pausePeriods.map(pausePeriod => (
              <p
                key={pausePeriod.id}
                className="text-xs leading-5 text-muted-foreground"
              >
                {pausePeriod.pauseStart} → {pausePeriod.pauseEnd ?? 'Open'}:{' '}
                {pausePeriod.reason}
              </p>
            ))}
          </div>
        </div>
      )}

      {workPackage.overrideReason && (
        <p className="mt-4 rounded-xl border border-border bg-muted/40 p-3 text-xs leading-5 text-muted-foreground">
          Override reason: {workPackage.overrideReason}
        </p>
      )}
      <div className="mt-4 border-t border-border pt-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Execution Actions
        </p>

        <div className="grid gap-2 sm:grid-cols-2">
          {canStart && (
            <Button
              type="button"
              variant="outline"
              onClick={() => onStartWork?.(workPackage.id)}
              className="justify-center gap-2"
            >
              <PlayCircle className="h-4 w-4" />
              Start Work
            </Button>
          )}

          {canPause && (
            <Button
              type="button"
              variant="outline"
              onClick={() => onPauseWork?.(workPackage.id)}
              className="justify-center gap-2"
            >
              <PauseCircle className="h-4 w-4" />
              Pause Work
            </Button>
          )}

          {canResume && (
            <Button
              type="button"
              variant="outline"
              onClick={() => onResumeWork?.(workPackage.id)}
              className="justify-center gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Resume Work
            </Button>
          )}

          {canComplete && (
            <Button
              type="button"
              variant="outline"
              onClick={() => onCompleteWork?.(workPackage.id)}
              className="justify-center gap-2"
            >
              <CheckCircle2 className="h-4 w-4" />
              Complete Work
            </Button>
          )}

          {canMarkDelayed && (
            <Button
              type="button"
              variant="outline"
              onClick={() => onMarkDelayed?.(workPackage.id)}
              className="justify-center gap-2"
            >
              <AlertTriangle className="h-4 w-4" />
              Mark Delayed
            </Button>
          )}

          {(workPackage.status === 'delayed' || workPackage.overrideReason) && (
            <Button
              type="button"
              variant="outline"
              onClick={() => onUpdateDelayReason?.(workPackage.id)}
              className="justify-center gap-2"
            >
              <MessageSquareText className="h-4 w-4" />
              Delay Reason
            </Button>
          )}
        </div>

        {workPackage.overrideReason && (
          <p className="mt-3 rounded-xl border border-border bg-background px-3 py-2 text-xs leading-5 text-muted-foreground">
            Delay Reason: {workPackage.overrideReason}
          </p>
        )}
      </div>

    </article>
  );
}
