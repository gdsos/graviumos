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

export function getDependencyClusterWorkPackageIds(
  workPackages: WorkPackage[],
  seedWorkPackageIds: string[]
) {
  const clusterIds = new Set(seedWorkPackageIds);
  let didAddWorkPackage = true;

  while (didAddWorkPackage) {
    didAddWorkPackage = false;

    workPackages.forEach(workPackage => {
      if (clusterIds.has(workPackage.id)) return;

      const dependsOnCluster = workPackage.dependsOnWorkPackageIds.some(
        dependencyId => clusterIds.has(dependencyId)
      );

      if (!dependsOnCluster) return;

      clusterIds.add(workPackage.id);
      didAddWorkPackage = true;
    });
  }

  return Array.from(clusterIds);
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


function getCalendarDayDifference(startDate: string, endDate: string) {
  const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
  const [endYear, endMonth, endDay] = endDate.split('-').map(Number);

  if (!startYear || !startMonth || !startDay || !endYear || !endMonth || !endDay) {
    return 0;
  }

  const start = Date.UTC(startYear, startMonth - 1, startDay);
  const end = Date.UTC(endYear, endMonth - 1, endDay);

  return Math.round((end - start) / (24 * 60 * 60 * 1000));
}

function getTodayDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function isBookingPaymentGate(paymentGate: PaymentGate, gateIndex: number) {
  return paymentGate.type === 'execution_booking' || gateIndex === 0;
}

function canShiftWorkPackage(workPackage: WorkPackage) {
  return (
    workPackage.status !== 'completed' &&
    workPackage.status !== 'in_progress' &&
    !workPackage.actualStartDate
  );
}

function getPaymentGateShiftScope(
  workPackages: WorkPackage[],
  paymentGates: PaymentGate[],
  paymentGate: PaymentGate
) {
  const gateIndex = paymentGates.findIndex(candidate => candidate.id === paymentGate.id);
  const bookingGate = isBookingPaymentGate(paymentGate, gateIndex);

  const relatedWorkPackageIds = workPackages
    .filter(workPackage => {
      if (!canShiftWorkPackage(workPackage)) return false;

      if (bookingGate) return true;

      return workPackage.estimatedStartDate >= paymentGate.dueDate;
    })
    .map(workPackage => workPackage.id);

  const relatedPaymentGateIds = paymentGates
    .filter(candidate => {
      if (candidate.status === 'received') return false;

      if (bookingGate) return true;

      return candidate.dueDate >= paymentGate.dueDate;
    })
    .map(candidate => candidate.id);

  return {
    bookingGate,
    relatedWorkPackageIds,
    relatedPaymentGateIds,
  };
}


export function generateTimelineAlerts(
  workPackages: WorkPackage[],
  paymentGates: PaymentGate[]
): TimelineAlert[] {
  const alerts: TimelineAlert[] = [];

  const today = getTodayDateString();

  const pendingPaymentGates = paymentGates.filter(
    paymentGate =>
      paymentGate.status !== 'received' &&
      paymentGate.blocksWorkPackageIds.length > 0
  );

  pendingPaymentGates.forEach(paymentGate => {
    const daysUntilDue = getCalendarDayDifference(today, paymentGate.dueDate);
    const isDueOrOverdue = daysUntilDue <= 0;
    const isInsideWarningWindow = daysUntilDue <= 3;
    const {
      bookingGate,
      relatedWorkPackageIds,
      relatedPaymentGateIds,
    } = getPaymentGateShiftScope(workPackages, paymentGates, paymentGate);

    if (!bookingGate && !isInsideWarningWindow) return;

    const suggestedShiftDays = isDueOrOverdue
      ? Math.max(1, Math.abs(daysUntilDue) + 1)
      : undefined;
    const directBlockedCount = paymentGate.blocksWorkPackageIds.length;
    const shiftScopeLabel = bookingGate
      ? 'the full remaining plan'
      : 'work packages and payment gates starting from this gate';
    const dueLabel =
      daysUntilDue > 0
        ? `due in ${daysUntilDue} day(s)`
        : daysUntilDue === 0
          ? 'due today'
          : `overdue by ${Math.abs(daysUntilDue)} day(s)`;

    alerts.push({
      id: `payment-alert-${paymentGate.id}`,
      projectId: paymentGate.projectId,
      type: 'payment_blocker',
      severity: isDueOrOverdue ? 'danger' : 'warning',
      title: `${paymentGate.title} is ${dueLabel}`,
      description: isDueOrOverdue
        ? `${directBlockedCount} direct work package(s) are blocked. Apply shift to move ${shiftScopeLabel} while this payment is pending.`
        : `${directBlockedCount} direct work package(s) may be blocked soon. This gate is ${dueLabel}; Apply shift will unlock on the due date if payment is still pending.`,
      relatedWorkPackageIds,
      relatedPaymentGateIds,
      suggestedShiftDays,
      canApplySuggestion:
        isDueOrOverdue &&
        (suggestedShiftDays ?? 0) > 0 &&
        (relatedWorkPackageIds.length > 0 || relatedPaymentGateIds.length > 0),
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
