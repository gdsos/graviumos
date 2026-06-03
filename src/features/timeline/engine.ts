import type {
  PaymentGate,
  TimelineAlert,
  TimelineSummary,
  WorkPackage,
} from './types';

function toDate(dateString?: string) {
  if (!dateString) return null;
  return new Date(`${dateString}T00:00:00`);
}

function diffDays(startDate?: string, endDate?: string) {
  const start = toDate(startDate);
  const end = toDate(endDate);

  if (!start || !end) return 0;

  const diff = end.getTime() - start.getTime();
  return Math.max(0, Math.round(diff / (1000 * 60 * 60 * 24)) + 1);
}

export function getPaymentGateById(
  paymentGates: PaymentGate[],
  paymentGateId?: string
) {
  if (!paymentGateId) return undefined;

  return paymentGates.find(paymentGate => paymentGate.id === paymentGateId);
}

export function getWorkPackageById(
  workPackages: WorkPackage[],
  workPackageId: string
) {
  return workPackages.find(workPackage => workPackage.id === workPackageId);
}

export function isPaymentGateBlocking(paymentGate?: PaymentGate) {
  if (!paymentGate) return false;

  return paymentGate.status !== 'received';
}

export function getBlockedByPaymentWorkPackages(
  workPackages: WorkPackage[],
  paymentGates: PaymentGate[]
) {
  return workPackages.filter(workPackage => {
    const paymentGate = getPaymentGateById(
      paymentGates,
      workPackage.paymentGateId
    );

    return isPaymentGateBlocking(paymentGate);
  });
}

export function getBlockedByDependencyWorkPackages(
  workPackages: WorkPackage[]
) {
  return workPackages.filter(workPackage =>
    workPackage.dependsOnWorkPackageIds.some(dependencyId => {
      const dependency = getWorkPackageById(workPackages, dependencyId);

      return dependency?.status !== 'completed';
    })
  );
}

export function getPausedWorkPackages(workPackages: WorkPackage[]) {
  return workPackages.filter(workPackage =>
    workPackage.pausePeriods.some(pausePeriod => !pausePeriod.pauseEnd)
  );
}

export function getDelayedWorkPackages(workPackages: WorkPackage[]) {
  return workPackages.filter(workPackage => {
    if (workPackage.status === 'delayed') return true;

    if (!workPackage.actualEndDate) return false;

    const estimatedEnd = toDate(workPackage.estimatedEndDate);
    const actualEnd = toDate(workPackage.actualEndDate);

    if (!estimatedEnd || !actualEnd) return false;

    return actualEnd.getTime() > estimatedEnd.getTime();
  });
}

export function calculateWorkPackageDelayDays(workPackage: WorkPackage) {
  if (!workPackage.actualEndDate) {
    return 0;
  }

  const estimatedEnd = toDate(workPackage.estimatedEndDate);
  const actualEnd = toDate(workPackage.actualEndDate);

  if (!estimatedEnd || !actualEnd) return 0;

  const diff = actualEnd.getTime() - estimatedEnd.getTime();

  return Math.max(0, Math.round(diff / (1000 * 60 * 60 * 24)));
}

export function calculateActualDuration(workPackage: WorkPackage) {
  if (workPackage.actualDurationDays) return workPackage.actualDurationDays;

  return diffDays(workPackage.actualStartDate, workPackage.actualEndDate);
}

export function calculateProjectedDelayDays(workPackages: WorkPackage[]) {
  return getDelayedWorkPackages(workPackages).reduce(
    (totalDelay, workPackage) =>
      totalDelay + calculateWorkPackageDelayDays(workPackage),
    0
  );
}

export function getCriticalWorkPackages(workPackages: WorkPackage[]) {
  return workPackages.filter(
    workPackage =>
      workPackage.priority === 'critical' ||
      workPackage.status === 'blocked_by_payment' ||
      workPackage.status === 'blocked_by_dependency' ||
      workPackage.status === 'delayed'
  );
}

export function calculateTimelineSummary(
  workPackages: WorkPackage[],
  paymentGates: PaymentGate[]
): TimelineSummary {
  const delayedWorkPackages = getDelayedWorkPackages(workPackages);
  const blockedByPayment = getBlockedByPaymentWorkPackages(
    workPackages,
    paymentGates
  );
  const blockedByDependency = getBlockedByDependencyWorkPackages(workPackages);
  const pausedWorkPackages = getPausedWorkPackages(workPackages);

  return {
    totalWorkPackages: workPackages.length,
    completedWorkPackages: workPackages.filter(
      workPackage => workPackage.status === 'completed'
    ).length,
    delayedWorkPackages: delayedWorkPackages.length,
    blockedWorkPackages: new Set([
      ...blockedByPayment.map(workPackage => workPackage.id),
      ...blockedByDependency.map(workPackage => workPackage.id),
    ]).size,
    pausedWorkPackages: pausedWorkPackages.length,
    pendingPaymentGates: paymentGates.filter(
      paymentGate => paymentGate.status !== 'received'
    ).length,
    receivedPaymentGates: paymentGates.filter(
      paymentGate => paymentGate.status === 'received'
    ).length,
    projectedDelayDays: calculateProjectedDelayDays(workPackages),
  };
}

export function generateTimelineAlerts(
  workPackages: WorkPackage[],
  paymentGates: PaymentGate[]
): TimelineAlert[] {
  const alerts: TimelineAlert[] = [];

  const pendingPaymentGates = paymentGates.filter(
    paymentGate =>
      paymentGate.status !== 'received' &&
      paymentGate.blocksWorkPackageIds.length > 0
  );

  pendingPaymentGates.forEach(paymentGate => {
    alerts.push({
      id: `payment-alert-${paymentGate.id}`,
      projectId: paymentGate.projectId,
      type: 'payment_blocker',
      severity: paymentGate.status === 'overdue' ? 'danger' : 'warning',
      title: `${paymentGate.title} is ${paymentGate.status}`,
      description: `${paymentGate.blocksWorkPackageIds.length} work package(s) are blocked until this payment is marked received.`,
      relatedWorkPackageIds: paymentGate.blocksWorkPackageIds,
      relatedPaymentGateIds: [paymentGate.id],
      suggestedShiftDays: paymentGate.status === 'overdue' ? 3 : undefined,
      canApplySuggestion: paymentGate.status === 'overdue',
    });
  });

  getPausedWorkPackages(workPackages).forEach(workPackage => {
    alerts.push({
      id: `pause-alert-${workPackage.id}`,
      projectId: workPackage.projectId,
      type: 'pause',
      severity: 'warning',
      title: `${workPackage.title} is paused`,
      description:
        workPackage.pausePeriods.find(pausePeriod => !pausePeriod.pauseEnd)
          ?.reason ?? 'This work package is currently paused.',
      relatedWorkPackageIds: [workPackage.id],
      canApplySuggestion: false,
    });
  });

  getBlockedByDependencyWorkPackages(workPackages).forEach(workPackage => {
    alerts.push({
      id: `dependency-alert-${workPackage.id}`,
      projectId: workPackage.projectId,
      type: 'dependency_conflict',
      severity: 'warning',
      title: `${workPackage.title} is waiting on dependencies`,
      description: 'One or more dependent work packages are not completed yet.',
      relatedWorkPackageIds: [
        workPackage.id,
        ...workPackage.dependsOnWorkPackageIds,
      ],
      canApplySuggestion: false,
    });
  });

  getDelayedWorkPackages(workPackages).forEach(workPackage => {
    const delayDays = calculateWorkPackageDelayDays(workPackage);

    alerts.push({
      id: `delay-alert-${workPackage.id}`,
      projectId: workPackage.projectId,
      type: 'delay',
      severity: delayDays >= 3 ? 'danger' : 'warning',
      title: `${workPackage.title} is delayed`,
      description:
        delayDays > 0
          ? `Actual completion exceeded estimate by ${delayDays} day(s).`
          : 'This work package is marked as delayed.',
      relatedWorkPackageIds: [workPackage.id],
      suggestedShiftDays: delayDays > 0 ? delayDays : undefined,
      canApplySuggestion: delayDays > 0,
    });
  });

  return alerts;
}

export function markPaymentGateReceived(
  paymentGates: PaymentGate[],
  paymentGateId: string,
  receivedDate: string
) {
  return paymentGates.map(paymentGate =>
    paymentGate.id === paymentGateId
      ? {
          ...paymentGate,
          status: 'received' as const,
          receivedDate,
        }
      : paymentGate
  );
}
