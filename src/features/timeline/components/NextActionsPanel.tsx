import { ArrowRight, CheckCircle2, CircleDollarSign, PauseCircle, ShieldAlert } from 'lucide-react';

import { StatusBadge } from '@/components/common/StatusBadge';
import type { PaymentGate, WorkPackage } from '../types';

interface NextActionsPanelProps {
  workPackages: WorkPackage[];
  paymentGates: PaymentGate[];
  onGoToPayments?: () => void;
  onGoToWork?: () => void;
  onGoToAlerts?: () => void;
}

type NextAction = {
  id: string;
  title: string;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  icon: typeof ShieldAlert;
  actionLabel: string;
  onClick?: () => void;
};

function getPriorityVariant(priority: NextAction['priority']) {
  if (priority === 'critical') return 'danger';
  if (priority === 'high') return 'warning';
  if (priority === 'medium') return 'info';
  return 'muted';
}

function getBlockedPaymentGate(paymentGates: PaymentGate[]) {
  return paymentGates.find(paymentGate => paymentGate.status !== 'received');
}

function getBlockedWorkPackage(workPackages: WorkPackage[]) {
  return workPackages.find(
    workPackage =>
      workPackage.status === 'blocked_by_payment' ||
      workPackage.status === 'blocked_by_dependency'
  );
}

function getPausedWorkPackage(workPackages: WorkPackage[]) {
  return workPackages.find(workPackage => workPackage.status === 'paused');
}

function getUpcomingWorkPackage(workPackages: WorkPackage[]) {
  return workPackages.find(
    workPackage =>
      workPackage.status === 'ready' ||
      workPackage.status === 'not_started' ||
      workPackage.status === 'in_progress'
  );
}

export function NextActionsPanel({
  workPackages,
  paymentGates,
  onGoToPayments,
  onGoToWork,
  onGoToAlerts,
}: NextActionsPanelProps) {
  const blockedPaymentGate = getBlockedPaymentGate(paymentGates);
  const blockedWorkPackage = getBlockedWorkPackage(workPackages);
  const pausedWorkPackage = getPausedWorkPackage(workPackages);
  const upcomingWorkPackage = getUpcomingWorkPackage(workPackages);

  const actions: NextAction[] = [];

  if (blockedPaymentGate) {
    actions.push({
      id: `payment-${blockedPaymentGate.id}`,
      title: `Confirm ${blockedPaymentGate.title}`,
      description: `${blockedPaymentGate.blocksWorkPackageIds.length} work package(s) are blocked until this payment is marked received.`,
      priority: blockedPaymentGate.status === 'overdue' ? 'critical' : 'high',
      icon: CircleDollarSign,
      actionLabel: 'Open Payments',
      onClick: onGoToPayments,
    });
  }

  if (blockedWorkPackage) {
    actions.push({
      id: `blocked-${blockedWorkPackage.id}`,
      title: `Resolve blocker: ${blockedWorkPackage.title}`,
      description:
        blockedWorkPackage.status === 'blocked_by_payment'
          ? 'This work package is waiting for payment confirmation.'
          : 'This work package is waiting for another dependency to finish.',
      priority: 'critical',
      icon: ShieldAlert,
      actionLabel: 'Review Work',
      onClick: onGoToWork,
    });
  }

  if (pausedWorkPackage) {
    actions.push({
      id: `paused-${pausedWorkPackage.id}`,
      title: `Review pause: ${pausedWorkPackage.title}`,
      description:
        pausedWorkPackage.pausePeriods.find(pause => !pause.pauseEnd)?.reason ??
        'This work package is currently paused.',
      priority: 'high',
      icon: PauseCircle,
      actionLabel: 'Check Alerts',
      onClick: onGoToAlerts,
    });
  }

  if (upcomingWorkPackage) {
    actions.push({
      id: `upcoming-${upcomingWorkPackage.id}`,
      title: `Prepare next work: ${upcomingWorkPackage.title}`,
      description: `Assignee: ${upcomingWorkPackage.assigneeName}. Estimated ${upcomingWorkPackage.estimatedStartDate} to ${upcomingWorkPackage.estimatedEndDate}.`,
      priority: 'medium',
      icon: ArrowRight,
      actionLabel: 'Open Work',
      onClick: onGoToWork,
    });
  }

  const visibleActions = actions.slice(0, 4);

  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-sm">
      <div className="border-b border-border px-4 py-4 sm:px-5">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Operational Focus
          </p>
          <h2 className="text-lg font-semibold text-foreground">
            What should I do next?
          </h2>
          <p className="text-sm leading-6 text-muted-foreground">
            Priority actions based on payments, blockers, pauses, and upcoming work.
          </p>
        </div>
      </div>

      <div className="grid gap-3 p-3 sm:p-4">
        {visibleActions.length > 0 ? (
          visibleActions.map((action, index) => {
            const Icon = action.icon;

            return (
              <div
                key={action.id}
                className="flex min-w-0 flex-col gap-3 rounded-2xl border border-border bg-background p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <Icon className="h-4 w-4" />
                  </div>

                  <div className="min-w-0">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <StatusBadge variant={getPriorityVariant(action.priority)}>
                        {index + 1}. {action.priority}
                      </StatusBadge>
                    </div>

                    <p className="font-medium text-foreground">{action.title}</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      {action.description}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={action.onClick}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground transition hover:bg-muted sm:w-auto"
                >
                  {action.actionLabel}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            );
          })
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-6 text-center">
            <CheckCircle2 className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium text-foreground">
              No urgent next action
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              The current timeline has no immediate blockers or pending actions.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
