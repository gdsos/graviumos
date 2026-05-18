import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, FileCheck2, LockKeyhole, Plus, RotateCcw } from 'lucide-react';

import { PageHeader } from '@/components/common/PageHeader';
import { SectionCard } from '@/components/common/SectionCard';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';

import {
  demoPaymentGates,
  demoTimelineAlerts,
  demoTimelineProject,
  demoWorkPackages,
} from '@/features/timeline/data';

import {
  calculateTimelineSummary,
  generateTimelineAlerts,
  getPaymentGateById,
  getWorkPackageById,
  markPaymentGateReceived,
} from '@/features/timeline/engine';

import { CreateTimelineWizard } from '@/features/timeline/components/CreateTimelineWizard';
import { generateTimelineFromApprovedEstimate } from '@/features/timeline/generator';
import { IntelligentAssistPanel } from '@/features/timeline/components/IntelligentAssistPanel';
import { NextActionsPanel } from '@/features/timeline/components/NextActionsPanel';
import { PaymentGateBar } from '@/features/timeline/components/PaymentGateBar';
import { TimelineSummaryCards } from '@/features/timeline/components/TimelineSummaryCards';
import { TimelineWorkPackages } from '@/features/timeline/components/TimelineWorkPackages';

import type {
  PaymentGate,
  TimelineAlert,
  TimelineProject,
  WorkPackage,
  WorkPackageStatus,
} from '@/features/timeline/types';

const TIMELINE_STORAGE_KEY = 'gravium-os-villa-athani-client-dummy-timeline';
const COST_ESTIMATE_STORAGE_KEY = 'gravium-os-cost-estimates-demo';

type LinkedCostEstimateStatus = 'draft' | 'approved' | 'revision';

type StoredCostEstimateRecord = {
  id: string;
  projectId?: string;
  projectName: string;
  clientName?: string;
  status: LinkedCostEstimateStatus;
  version: number;
  grandTotal: number;
  updatedAt: string;
  areas: Array<{
    id: string;
    name: string;
  }>;
  lineItems: Array<{
    id: string;
    areaId: string;
    name: string;
    description: string;
    quantity: number;
    unitLabel: string;
    ratePerUnit: number;
    vendorName?: string;
    remarks?: string;
  }>;
};

const fallbackCostEstimateRecords: StoredCostEstimateRecord[] = [
  {
    id: 'estimate-villa-athani',
    projectId: 'project-villa-athani',
    projectName: 'Villa, Athani',
    clientName: 'Rafeek Muhammed Ali',
    status: 'approved',
    version: 1,
    grandTotal: 1870215,
    updatedAt: new Date().toISOString(),
    areas: [],
    lineItems: [],
  },
];

function getStoredCostEstimateRecords() {
  if (typeof window === 'undefined') return fallbackCostEstimateRecords;

  try {
    const storedRecords = localStorage.getItem(COST_ESTIMATE_STORAGE_KEY);

    if (!storedRecords) return fallbackCostEstimateRecords;

    const parsedRecords = JSON.parse(storedRecords);

    if (!Array.isArray(parsedRecords)) return fallbackCostEstimateRecords;

    return parsedRecords.filter(record => {
      return (
        record &&
        typeof record.id === 'string' &&
        typeof record.projectName === 'string' &&
        ['draft', 'approved', 'revision'].includes(record.status) &&
        typeof record.version === 'number' &&
        typeof record.grandTotal === 'number' &&
        Array.isArray(record.areas) &&
        Array.isArray(record.lineItems)
      );
    }) as StoredCostEstimateRecord[];
  } catch {
    return fallbackCostEstimateRecords;
  }
}

function getLinkedCostEstimate(
  records: StoredCostEstimateRecord[],
  projectId: string
) {
  return records.find(record => record.projectId === projectId);
}

function getApprovedCostEstimateRecords(records: StoredCostEstimateRecord[]) {
  return records.filter(record => record.projectId && record.status === 'approved');
}

function getWaitingCostEstimateRecords(records: StoredCostEstimateRecord[]) {
  return records.filter(record => record.projectId && record.status !== 'approved');
}

function getEstimateStatusTitle(status?: LinkedCostEstimateStatus) {
  if (status === 'approved') return 'Approved';
  if (status === 'revision') return 'Revision Draft';
  if (status === 'draft') return 'Draft';

  return 'No Estimate';
}

function getEstimateStatusVariant(status?: LinkedCostEstimateStatus) {
  if (status === 'approved') return 'success';
  if (status === 'revision') return 'warning';
  if (status === 'draft') return 'warning';

  return 'muted';
}

function getTimelineSourceMessage(record?: StoredCostEstimateRecord) {
  if (!record) {
    return 'Create and approve a linked cost estimate before building the project timeline.';
  }

  if (record.status === 'approved') {
    return 'Approved cost estimate found. Timeline can be planned after contract signing and booking payment confirmation.';
  }

  if (record.status === 'revision') {
    return 'A revision draft is active. Approve the revision before updating or creating the timeline.';
  }

  return 'This estimate is still a draft. Approve the estimate before creating the timeline.';
}


type StoredTimelineState = {
  hasTimeline: boolean;
  paymentGates: PaymentGate[];
  workPackages: WorkPackage[];
  timelineConfirmedAt?: string;
};

type TimelineTab = 'overview' | 'work' | 'payments' | 'gantt' | 'alerts';

const tabs: Array<{ id: TimelineTab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'work', label: 'Work' },
  { id: 'payments', label: 'Payments' },
  { id: 'gantt', label: 'Gantt' },
  { id: 'alerts', label: 'Assist' },
];

type GeneratedTimelineReviewDraft = {
  paymentGates: PaymentGate[];
  workPackages: WorkPackage[];
};

const workPackageStatusOptions: WorkPackageStatus[] = [
  'not_started',
  'ready',
  'in_progress',
  'paused',
  'blocked_by_payment',
  'blocked_by_dependency',
  'completed',
  'delayed',
];

function getStoredTimelineState(): StoredTimelineState | null {
  if (typeof window === 'undefined') return null;

  try {
    const storedTimeline = localStorage.getItem(TIMELINE_STORAGE_KEY);

    if (!storedTimeline) return null;

    const parsedTimeline = JSON.parse(storedTimeline) as Partial<StoredTimelineState>;

    if (
      typeof parsedTimeline.hasTimeline === 'boolean' &&
      Array.isArray(parsedTimeline.paymentGates) &&
      Array.isArray(parsedTimeline.workPackages)
    ) {
      return {
        hasTimeline: parsedTimeline.hasTimeline,
        paymentGates: parsedTimeline.paymentGates,
        workPackages: parsedTimeline.workPackages,
        timelineConfirmedAt:
          typeof parsedTimeline.timelineConfirmedAt === 'string'
            ? parsedTimeline.timelineConfirmedAt
            : '',
      };
    }

    return null;
  } catch {
    return null;
  }
}

function formatINR(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateString: string) {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${dateString}T00:00:00`));
}

function toTitleCase(value: string) {
  return value
    .replaceAll('_', ' ')
    .replace(/\b\w/g, letter => letter.toUpperCase());
}

function getDayDifference(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  const dayInMs = 24 * 60 * 60 * 1000;

  return Math.max(0, Math.round((end.getTime() - start.getTime()) / dayInMs));
}

function getTimelineSpanPercent(
  dateString: string,
  timelineStartDate: string,
  timelineEndDate: string
) {
  const totalDays = Math.max(1, getDayDifference(timelineStartDate, timelineEndDate));
  const offsetDays = getDayDifference(timelineStartDate, dateString);

  return Math.min(100, Math.max(0, (offsetDays / totalDays) * 100));
}

function getWorkPackageBarStyle(
  workPackage: WorkPackage,
  timelineStartDate: string,
  timelineEndDate: string
) {
  const totalDays = Math.max(1, getDayDifference(timelineStartDate, timelineEndDate));
  const offsetDays = getDayDifference(
    timelineStartDate,
    workPackage.estimatedStartDate
  );
  const durationDays = Math.max(
    1,
    getDayDifference(workPackage.estimatedStartDate, workPackage.estimatedEndDate) + 1
  );

  return {
    marginLeft: `${Math.min(96, Math.max(0, (offsetDays / totalDays) * 100))}%`,
    width: `${Math.min(100, Math.max(3, (durationDays / totalDays) * 100))}%`,
  };
}

function getGanttBarTone(status: WorkPackageStatus) {
  if (status === 'blocked_by_payment' || status === 'blocked_by_dependency') {
    return 'bg-amber-500/80';
  }

  if (status === 'in_progress') return 'bg-blue-500/80';
  if (status === 'completed') return 'bg-emerald-500/80';
  if (status === 'delayed') return 'bg-red-500/80';

  return 'bg-primary';
}

function getProjectStatusVariant(status: string) {
  if (status === 'active') return 'success';
  if (status === 'on_hold') return 'warning';
  if (status === 'completed') return 'info';

  return 'muted';
}

function getNextStatusAfterPaymentUnlock(
  workPackage: WorkPackage,
  allWorkPackages: WorkPackage[]
): WorkPackageStatus {
  const hasOpenDependency = workPackage.dependsOnWorkPackageIds.some(
    dependencyId => {
      const dependency = getWorkPackageById(allWorkPackages, dependencyId);

      return dependency?.status !== 'completed';
    }
  );

  if (hasOpenDependency) return 'blocked_by_dependency';

  return workPackage.actualStartDate ? 'in_progress' : 'ready';
}

function getTodayDateString() {
  return new Date().toISOString().slice(0, 10);
}

function getActualDurationDays(startDate: string, endDate: string) {
  return getDayDifference(startDate, endDate) + 1;
}

function appendTimelineNote(existingNote: string | undefined, nextNote: string) {
  const trimmedNote = existingNote?.trim();

  return trimmedNote ? `${trimmedNote} ${nextNote}` : nextNote;
}

export default function TimelinePage() {
  const storedTimeline = getStoredTimelineState();

  const [activeTab, setActiveTab] = useState<TimelineTab>('overview');
  const [hasTimeline, setHasTimeline] = useState(
    () => storedTimeline?.hasTimeline ?? false
  );
  const [paymentGates, setPaymentGates] = useState<PaymentGate[]>(
    () => storedTimeline?.paymentGates ?? demoPaymentGates
  );
  const [workPackages, setWorkPackages] = useState<WorkPackage[]>(
    () => storedTimeline?.workPackages ?? demoWorkPackages
  );
  const [ignoredAlertIds, setIgnoredAlertIds] = useState<string[]>([]);
  const [showCreateWizard, setShowCreateWizard] = useState(false);
  const [pendingTimelineDraft, setPendingTimelineDraft] =
    useState<GeneratedTimelineReviewDraft | null>(null);
  const [timelineConfirmedAt, setTimelineConfirmedAt] = useState(
    () => storedTimeline?.timelineConfirmedAt ?? ''
  );
  const [costEstimateRecords, setCostEstimateRecords] = useState<
    StoredCostEstimateRecord[]
  >(() => getStoredCostEstimateRecords());
  const [selectedTimelineProjectId, setSelectedTimelineProjectId] = useState(
    demoTimelineProject.id
  );
  const [timelineStartDate, setTimelineStartDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [isContractSigned, setIsContractSigned] = useState(false);
  const [isBookingPaymentCollected, setIsBookingPaymentCollected] = useState(false);
  const [bookingPaymentPercent, setBookingPaymentPercent] = useState('35');
  const [stageOnePaymentPercent, setStageOnePaymentPercent] = useState('30');
  const [stageTwoPaymentPercent, setStageTwoPaymentPercent] = useState('25');
  const [handoverPaymentPercent, setHandoverPaymentPercent] = useState('10');

  useEffect(() => {
    localStorage.setItem(
      TIMELINE_STORAGE_KEY,
      JSON.stringify({
        hasTimeline,
        paymentGates,
        workPackages,
        timelineConfirmedAt,
      })
    );
  }, [hasTimeline, paymentGates, timelineConfirmedAt, workPackages]);

  const summary = useMemo(
    () => calculateTimelineSummary(workPackages, paymentGates),
    [paymentGates, workPackages]
  );

  const generatedAlerts = useMemo(
    () => generateTimelineAlerts(workPackages, paymentGates),
    [paymentGates, workPackages]
  );

  const alerts = useMemo(() => {
    const sourceAlerts = hasTimeline ? generatedAlerts : demoTimelineAlerts;

    const uniqueAlerts = sourceAlerts.filter(
      (alert, index, array) =>
        array.findIndex(currentAlert => currentAlert.id === alert.id) === index
    );

    return uniqueAlerts.filter(alert => !ignoredAlertIds.includes(alert.id));
  }, [generatedAlerts, hasTimeline, ignoredAlertIds]);

  const blockedWorkPackages = useMemo(
    () =>
      workPackages.filter(
        workPackage =>
          workPackage.status === 'blocked_by_payment' ||
          workPackage.status === 'blocked_by_dependency'
      ),
    [workPackages]
  );

  const criticalWorkPackages = useMemo(
    () =>
      workPackages.filter(
        workPackage =>
          workPackage.priority === 'critical' &&
          workPackage.status !== 'completed'
      ),
    [workPackages]
  );

  const approvedCostEstimateRecords = useMemo(
    () => getApprovedCostEstimateRecords(costEstimateRecords),
    [costEstimateRecords]
  );
  const waitingCostEstimateRecords = useMemo(
    () => getWaitingCostEstimateRecords(costEstimateRecords),
    [costEstimateRecords]
  );
  const linkedCostEstimate = useMemo(
    () => getLinkedCostEstimate(costEstimateRecords, selectedTimelineProjectId),
    [costEstimateRecords, selectedTimelineProjectId]
  );
  const activeTimelineProject = useMemo<TimelineProject>(
    () => ({
      ...demoTimelineProject,
      id: linkedCostEstimate?.projectId ?? selectedTimelineProjectId,
      name: linkedCostEstimate?.projectName ?? demoTimelineProject.name,
      clientName: linkedCostEstimate?.clientName ?? demoTimelineProject.clientName,
      revenue: linkedCostEstimate?.grandTotal ?? demoTimelineProject.revenue,
    }),
    [linkedCostEstimate, selectedTimelineProjectId]
  );
  const timelineDateRange = useMemo(() => {
    if (workPackages.length === 0) {
      return {
        startDate: activeTimelineProject.startDate,
        endDate: activeTimelineProject.currentProjectedHandoverDate,
      };
    }

    const startDates = workPackages
      .map(workPackage => workPackage.estimatedStartDate)
      .filter(Boolean)
      .sort();

    const endDates = workPackages
      .map(workPackage => workPackage.estimatedEndDate)
      .filter(Boolean)
      .sort();

    return {
      startDate: startDates[0] ?? activeTimelineProject.startDate,
      endDate:
        endDates[endDates.length - 1] ??
        activeTimelineProject.currentProjectedHandoverDate,
    };
  }, [
    activeTimelineProject.currentProjectedHandoverDate,
    activeTimelineProject.startDate,
    workPackages,
  ]);

  const isTimelineEstimateApproved = linkedCostEstimate?.status === 'approved';
  const timelineSourceMessage = getTimelineSourceMessage(linkedCostEstimate);
  const paymentPercentageValues = {
    booking: bookingPaymentPercent === '' ? 0 : Number(bookingPaymentPercent) || 0,
    stageOne:
      stageOnePaymentPercent === '' ? 0 : Number(stageOnePaymentPercent) || 0,
    stageTwo:
      stageTwoPaymentPercent === '' ? 0 : Number(stageTwoPaymentPercent) || 0,
    handover:
      handoverPaymentPercent === '' ? 0 : Number(handoverPaymentPercent) || 0,
  };
  const paymentPercentageTotal =
    paymentPercentageValues.booking +
    paymentPercentageValues.stageOne +
    paymentPercentageValues.stageTwo +
    paymentPercentageValues.handover;
  const isPaymentPercentageMatched = paymentPercentageTotal === 100;
  const canBuildTimeline =
    isTimelineEstimateApproved &&
    isContractSigned &&
    isBookingPaymentCollected &&
    Boolean(timelineStartDate) &&
    isPaymentPercentageMatched;

  const handleMarkPaymentReceived = (paymentGate: PaymentGate) => {
    const today = new Date().toISOString().slice(0, 10);

    setPaymentGates(currentPaymentGates =>
      markPaymentGateReceived(currentPaymentGates, paymentGate.id, today)
    );

    setWorkPackages(currentWorkPackages =>
      currentWorkPackages.map(workPackage => {
        if (workPackage.paymentGateId !== paymentGate.id) return workPackage;
        if (workPackage.status !== 'blocked_by_payment') return workPackage;

        return {
          ...workPackage,
          status: getNextStatusAfterPaymentUnlock(
            workPackage,
            currentWorkPackages
          ),
          notes: workPackage.notes
            ? `${workPackage.notes} Payment gate received on ${today}.`
            : `Payment gate received on ${today}.`,
        };
      })
    );
  };

  const handleMarkPaymentPending = (paymentGate: PaymentGate) => {
    const confirmed = window.confirm(
      'Unmark this payment? Related work packages will be blocked by payment again.'
    );

    if (!confirmed) return;

    setPaymentGates(currentPaymentGates =>
      currentPaymentGates.map(currentPaymentGate =>
        currentPaymentGate.id === paymentGate.id
          ? {
              ...currentPaymentGate,
              status: 'pending',
              receivedDate: undefined,
            }
          : currentPaymentGate
      )
    );

    setWorkPackages(currentWorkPackages =>
      currentWorkPackages.map(workPackage =>
        workPackage.paymentGateId === paymentGate.id
          ? {
              ...workPackage,
              status: 'blocked_by_payment',
              notes: workPackage.notes
                ? `${workPackage.notes} Payment was unmarked and work was blocked again.`
                : 'Payment was unmarked and work was blocked again.',
            }
          : workPackage
      )
    );
  };

  const handleApplySuggestion = (alert: TimelineAlert) => {
    window.alert(
      `Timeline shift assistant will be added later. Suggested shift: ${
        alert.suggestedShiftDays ?? 0
      } day(s).`
    );
  };

  const handleIgnoreAlert = (alert: TimelineAlert) => {
    setIgnoredAlertIds(current => [...current, alert.id]);
  };

  const handleOpenTimelineWizard = () => {
    if (!canBuildTimeline || !linkedCostEstimate) return;

    const generatedTimeline = generateTimelineFromApprovedEstimate({
      source: linkedCostEstimate,
      startDate: timelineStartDate,
      paymentPercentages: paymentPercentageValues,
    });

    const today = new Date().toISOString().slice(0, 10);
    const bookingGateId = generatedTimeline.paymentGates.find(
      paymentGate => paymentGate.type === 'execution_booking'
    )?.id;

    const preparedTimeline = isBookingPaymentCollected && bookingGateId
      ? {
          paymentGates: markPaymentGateReceived(
            generatedTimeline.paymentGates,
            bookingGateId,
            today
          ),
          workPackages: generatedTimeline.workPackages.map(workPackage =>
            workPackage.paymentGateId === bookingGateId &&
            workPackage.status === 'blocked_by_payment'
              ? {
                  ...workPackage,
                  status: getNextStatusAfterPaymentUnlock(
                    workPackage,
                    generatedTimeline.workPackages
                  ),
                  notes: workPackage.notes
                    ? `${workPackage.notes} Booking payment received on ${today}.`
                    : `Booking payment received on ${today}.`,
                }
              : workPackage
          ),
        }
      : generatedTimeline;

    setPendingTimelineDraft(preparedTimeline);
    setIgnoredAlertIds([]);
    setHasTimeline(false);
    setTimelineConfirmedAt('');
    setShowCreateWizard(false);
    setActiveTab('overview');
  };

  const handleRefreshCostEstimateSources = () => {
    setCostEstimateRecords(getStoredCostEstimateRecords());
  };

  const handleSelectTimelineSource = (projectId?: string) => {
    if (!projectId) return;

    setSelectedTimelineProjectId(projectId);
    setIsContractSigned(false);
    setIsBookingPaymentCollected(false);
    setPendingTimelineDraft(null);
    setTimelineConfirmedAt('');
    setShowCreateWizard(false);
    setActiveTab('overview');
  };

  const handleUseTimelineDraft = (generatedTimeline: {
    paymentGates: PaymentGate[];
    workPackages: WorkPackage[];
  }) => {
    setPaymentGates(generatedTimeline.paymentGates);
    setWorkPackages(generatedTimeline.workPackages);
    setIgnoredAlertIds([]);
    setHasTimeline(true);
    setTimelineConfirmedAt(new Date().toISOString());
    setShowCreateWizard(false);
    setActiveTab('overview');
  };

  const handleFetchDevTimelineData = () => {
    setPaymentGates(demoPaymentGates);
    setWorkPackages(demoWorkPackages);
    setPendingTimelineDraft(null);
    setIgnoredAlertIds([]);
    setHasTimeline(true);
    setShowCreateWizard(false);
    setActiveTab('overview');
  };

  const handleHideDevTimelineData = () => {
    localStorage.removeItem(TIMELINE_STORAGE_KEY);
    setPaymentGates(demoPaymentGates);
    setWorkPackages(demoWorkPackages);
    setPendingTimelineDraft(null);
    setIgnoredAlertIds([]);
    setHasTimeline(false);
    setTimelineConfirmedAt('');
    setShowCreateWizard(false);
    setActiveTab('overview');
  };

  const handleResetTimeline = () => {
    const confirmed = window.confirm(
      'Reset timeline? This will remove the created timeline and return this project to the no-timeline state.'
    );

    if (!confirmed) return;

    localStorage.removeItem(TIMELINE_STORAGE_KEY);
    setPaymentGates(demoPaymentGates);
    setWorkPackages(demoWorkPackages);
    setPendingTimelineDraft(null);
    setIgnoredAlertIds([]);
    setHasTimeline(false);
    setShowCreateWizard(false);
    setActiveTab('overview');
  };

  const handleUpdatePendingWorkPackage = (
    workPackageId: string,
    updates: Partial<WorkPackage>
  ) => {
    setPendingTimelineDraft(current => {
      if (!current) return current;

      return {
        ...current,
        workPackages: current.workPackages.map(workPackage =>
          workPackage.id === workPackageId
            ? { ...workPackage, ...updates }
            : workPackage
        ),
      };
    });
  };

  const handleConfirmPendingTimeline = () => {
    if (!pendingTimelineDraft) return;

    setPaymentGates(pendingTimelineDraft.paymentGates);
    setWorkPackages(pendingTimelineDraft.workPackages);
    setPendingTimelineDraft(null);
    setIgnoredAlertIds([]);
    setHasTimeline(true);
    setTimelineConfirmedAt(new Date().toISOString());
    setShowCreateWizard(false);
    setActiveTab('overview');
  };

  const handleCancelPendingTimeline = () => {
    setPendingTimelineDraft(null);
    setHasTimeline(false);
    setTimelineConfirmedAt('');
    setActiveTab('overview');
  };

  const handleStartWorkPackage = (workPackageId: string) => {
    const today = getTodayDateString();

    setWorkPackages(currentWorkPackages =>
      currentWorkPackages.map(workPackage => {
        if (workPackage.id !== workPackageId) return workPackage;

        if (
          workPackage.status === 'blocked_by_payment' ||
          workPackage.status === 'blocked_by_dependency'
        ) {
          window.alert('This work package is blocked. Clear the blocker before starting work.');
          return workPackage;
        }

        return {
          ...workPackage,
          actualStartDate: workPackage.actualStartDate ?? today,
          actualEndDate: undefined,
          actualDurationDays: undefined,
          status: 'in_progress',
          notes: appendTimelineNote(workPackage.notes, `Work started on ${today}.`),
        };
      })
    );
  };

  const handlePauseWorkPackage = (workPackageId: string) => {
    const reason = window.prompt('Why is this work being paused?')?.trim();
    if (!reason) return;

    const today = getTodayDateString();

    setWorkPackages(currentWorkPackages =>
      currentWorkPackages.map(workPackage => {
        if (workPackage.id !== workPackageId) return workPackage;

        return {
          ...workPackage,
          status: 'paused',
          pausePeriods: [
            ...workPackage.pausePeriods,
            {
              id: `pause-${workPackage.id}-${Date.now()}`,
              pauseStart: today,
              reason,
              createdBy: 'Admin',
            },
          ],
          notes: appendTimelineNote(workPackage.notes, `Paused on ${today}: ${reason}`),
        };
      })
    );
  };

  const handleResumeWorkPackage = (workPackageId: string) => {
    const today = getTodayDateString();

    setWorkPackages(currentWorkPackages =>
      currentWorkPackages.map(workPackage => {
        if (workPackage.id !== workPackageId) return workPackage;

        return {
          ...workPackage,
          status: workPackage.actualStartDate ? 'in_progress' : 'ready',
          pausePeriods: workPackage.pausePeriods.map((pausePeriod, index, array) =>
            index === array.length - 1 && !pausePeriod.pauseEnd
              ? { ...pausePeriod, pauseEnd: today }
              : pausePeriod
          ),
          notes: appendTimelineNote(workPackage.notes, `Work resumed on ${today}.`),
        };
      })
    );
  };

  const handleCompleteWorkPackage = (workPackageId: string) => {
    const today = getTodayDateString();

    setWorkPackages(currentWorkPackages =>
      currentWorkPackages.map(workPackage => {
        if (workPackage.id !== workPackageId) return workPackage;

        const actualStartDate = workPackage.actualStartDate ?? today;

        return {
          ...workPackage,
          actualStartDate,
          actualEndDate: today,
          actualDurationDays: getActualDurationDays(actualStartDate, today),
          status: 'completed',
          pausePeriods: workPackage.pausePeriods.map(pausePeriod =>
            pausePeriod.pauseEnd ? pausePeriod : { ...pausePeriod, pauseEnd: today }
          ),
          notes: appendTimelineNote(workPackage.notes, `Work completed on ${today}.`),
        };
      })
    );
  };

  const handleMarkWorkPackageDelayed = (workPackageId: string) => {
    const reason = window.prompt('Add the delay reason for this work package:')?.trim();
    if (!reason) return;

    const today = getTodayDateString();

    setWorkPackages(currentWorkPackages =>
      currentWorkPackages.map(workPackage =>
        workPackage.id === workPackageId
          ? {
              ...workPackage,
              status: 'delayed',
              overrideReason: reason,
              notes: appendTimelineNote(
                workPackage.notes,
                `Marked delayed on ${today}: ${reason}`
              ),
            }
          : workPackage
      )
    );
  };

  const handleUpdateDelayReason = (workPackageId: string) => {
    const currentWorkPackage = workPackages.find(
      workPackage => workPackage.id === workPackageId
    );

    const reason = window.prompt(
      'Update delay reason:',
      currentWorkPackage?.overrideReason ?? ''
    )?.trim();

    if (!reason) return;

    setWorkPackages(currentWorkPackages =>
      currentWorkPackages.map(workPackage =>
        workPackage.id === workPackageId
          ? {
              ...workPackage,
              status:
                workPackage.status === 'completed' ? workPackage.status : 'delayed',
              overrideReason: reason,
            }
          : workPackage
      )
    );
  };

  const renderGeneratedTimelineReview = () => {
    if (!pendingTimelineDraft) return null;

    const firstStartDate =
      pendingTimelineDraft.workPackages[0]?.estimatedStartDate ?? timelineStartDate;
    const finalEndDate =
      pendingTimelineDraft.workPackages[pendingTimelineDraft.workPackages.length - 1]
        ?.estimatedEndDate ?? firstStartDate;

    return (
      <section className="mb-6 overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-sm">
        <div className="border-b border-border px-4 py-4 sm:px-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-foreground">
                  Review Draft Timeline
                </p>
                <StatusBadge variant="warning">Review Draft</StatusBadge>
                <StatusBadge variant="outline">Not Active Yet</StatusBadge>
              </div>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                This planned timeline is still editable and is not active yet. Confirm it only after dates, assignees, and payment gates are reviewed.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatDate(firstStartDate)} - {formatDate(finalEndDate)} -{' '}
                {pendingTimelineDraft.workPackages.length} work package(s)
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancelPendingTimeline}
              >
                Cancel Review
              </Button>
              <Button type="button" onClick={handleConfirmPendingTimeline}>
                Confirm Planned Timeline
              </Button>
            </div>
          </div>
        </div>

        <div className="grid gap-3 p-3 sm:p-4">
          {pendingTimelineDraft.workPackages.map(workPackage => (
            <div
              key={workPackage.id}
              className="rounded-2xl border border-border bg-background p-3 sm:p-4"
            >
              <div className="grid gap-3 xl:grid-cols-[minmax(0,1.4fr)_150px_150px_180px_180px] xl:items-end">
                <label className="grid gap-1">
                  <span className="text-xs font-medium text-muted-foreground">
                    Work Package
                  </span>
                  <input
                    value={workPackage.title}
                    onChange={event =>
                      handleUpdatePendingWorkPackage(workPackage.id, {
                        title: event.target.value,
                      })
                    }
                    className="min-h-10 rounded-lg border border-border bg-card px-3 text-sm text-foreground outline-none focus:border-foreground"
                  />
                </label>

                <label className="grid gap-1">
                  <span className="text-xs font-medium text-muted-foreground">
                    Start
                  </span>
                  <input
                    type="date"
                    value={workPackage.estimatedStartDate}
                    onChange={event =>
                      handleUpdatePendingWorkPackage(workPackage.id, {
                        estimatedStartDate: event.target.value,
                      })
                    }
                    className="min-h-10 rounded-lg border border-border bg-card px-3 text-sm text-foreground outline-none focus:border-foreground"
                  />
                </label>

                <label className="grid gap-1">
                  <span className="text-xs font-medium text-muted-foreground">
                    End
                  </span>
                  <input
                    type="date"
                    value={workPackage.estimatedEndDate}
                    onChange={event =>
                      handleUpdatePendingWorkPackage(workPackage.id, {
                        estimatedEndDate: event.target.value,
                      })
                    }
                    className="min-h-10 rounded-lg border border-border bg-card px-3 text-sm text-foreground outline-none focus:border-foreground"
                  />
                </label>

                <label className="grid gap-1">
                  <span className="text-xs font-medium text-muted-foreground">
                    Assigned To
                  </span>
                  <input
                    value={workPackage.assigneeName}
                    onChange={event =>
                      handleUpdatePendingWorkPackage(workPackage.id, {
                        assigneeName: event.target.value,
                      })
                    }
                    className="min-h-10 rounded-lg border border-border bg-card px-3 text-sm text-foreground outline-none focus:border-foreground"
                  />
                </label>

                <label className="grid gap-1">
                  <span className="text-xs font-medium text-muted-foreground">
                    Status
                  </span>
                  <select
                    value={workPackage.status}
                    onChange={event =>
                      handleUpdatePendingWorkPackage(workPackage.id, {
                        status: event.target.value as WorkPackageStatus,
                      })
                    }
                    className="min-h-10 rounded-lg border border-border bg-card px-3 text-sm text-foreground outline-none focus:border-foreground"
                  >
                    {workPackageStatusOptions.map(statusOption => (
                      <option key={statusOption} value={statusOption}>
                        {toTitleCase(statusOption)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {workPackage.description && (
                <p className="mt-3 line-clamp-2 text-xs leading-5 text-muted-foreground">
                  {workPackage.description}
                </p>
              )}
            </div>
          ))}
        </div>

        <div className="border-t border-border px-4 py-4 sm:px-5">
          <p className="mb-3 text-sm font-medium text-foreground">
            Payment Gates Preview
          </p>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {pendingTimelineDraft.paymentGates.map(paymentGate => (
              <div
                key={paymentGate.id}
                className="rounded-xl border border-border bg-background p-3"
              >
                <p className="text-sm font-medium text-foreground">
                  {paymentGate.title}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatDate(paymentGate.dueDate)}
                </p>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {formatINR(paymentGate.amount)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  };

  const renderCriticalWork = () => (
    <SectionCard
      title="Critical Open Work"
      description="Critical items that still need attention before handover."
    >
      <div className="grid gap-3">
        {criticalWorkPackages.length > 0 ? (
          criticalWorkPackages.map(workPackage => {
            const paymentGate = getPaymentGateById(
              paymentGates,
              workPackage.paymentGateId
            );

            return (
              <div
                key={workPackage.id}
                className="min-w-0 rounded-2xl border border-border bg-background p-4"
              >
                <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">
                      {workPackage.title}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {workPackage.estimatedStartDate} →{' '}
                      {workPackage.estimatedEndDate}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <StatusBadge variant="danger">
                      {workPackage.status.replaceAll('_', ' ')}
                    </StatusBadge>

                    {paymentGate && (
                      <StatusBadge variant="outline">
                        {paymentGate.title}
                      </StatusBadge>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <p className="rounded-2xl border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
            No critical open work right now.
          </p>
        )}
      </div>
    </SectionCard>
  );

  const renderProjectSnapshot = () => (
    <SectionCard
      title="Project Snapshot"
      description="Timeline control view for the selected project."
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-border bg-background p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Client
          </p>
          <p className="mt-2 truncate text-sm font-semibold text-foreground">
            {activeTimelineProject.clientName}
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-background p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Revenue
          </p>
          <p className="mt-2 text-sm font-semibold text-foreground">
            {formatINR(activeTimelineProject.revenue)}
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-background p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Expected
          </p>
          <p className="mt-2 text-sm font-semibold text-foreground">
            {formatDate(activeTimelineProject.expectedHandoverDate)}
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-background p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Projected
          </p>
          <p className="mt-2 text-sm font-semibold text-foreground">
            {formatDate(activeTimelineProject.currentProjectedHandoverDate)}
          </p>
        </div>
      </div>
    </SectionCard>
  );

  const renderAssistPreview = () => {
    if (alerts.length === 0) return null;

    return (
      <SectionCard
        title="Intelligent Assist Preview"
        description={`${alerts.length} alert(s) found. Showing only the most important actions here. Open Assist for the full explanation.`}
        actions={
          <Button
            type="button"
            variant="outline"
            onClick={() => setActiveTab('alerts')}
          >
            View All Alerts
          </Button>
        }
      >
        <div className="grid gap-3">
          {alerts.slice(0, 2).map(alert => (
            <div
              key={alert.id}
              className="rounded-2xl border border-border bg-background p-4"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {alert.title}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {alert.description}
                  </p>
                </div>

                <StatusBadge
                  variant={
                    alert.severity === 'danger'
                      ? 'danger'
                      : alert.severity === 'warning'
                        ? 'warning'
                        : 'info'
                  }
                >
                  {alert.severity}
                </StatusBadge>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    );
  };

  const renderGanttChart = () => {
    const timelineStartDate = timelineDateRange.startDate;
    const timelineEndDate = timelineDateRange.endDate;
    const totalDays = getDayDifference(timelineStartDate, timelineEndDate) + 1;

    return (
      <section className="min-w-0 overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-sm">
        <div className="border-b border-border px-4 py-3 sm:px-5">
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold text-foreground">
                  Gantt Timeline
                </h2>
                <StatusBadge variant="outline">{activeTimelineProject.name}</StatusBadge>
              </div>
              <p className="mt-1 text-xs leading-5 text-muted-foreground sm:text-sm">
                {formatDate(timelineStartDate)} - {formatDate(timelineEndDate)} -{' '}
                {totalDays} day(s) - {formatINR(activeTimelineProject.revenue)}
              </p>
            </div>
          </div>
        </div>

        <div className="min-w-0 overflow-x-auto overscroll-x-contain">
          <div className="min-w-[820px]">
            <div className="grid grid-cols-[240px_minmax(0,1fr)] border-b border-border bg-muted/20 text-xs font-medium text-muted-foreground">
              <div className="sticky left-0 z-20 border-r border-border bg-card px-4 py-2">
                Work Package
              </div>
              <div className="relative px-4 py-2">
                <div className="flex items-center justify-between">
                  <span>{formatDate(timelineStartDate)}</span>
                  <span>{formatDate(timelineEndDate)}</span>
                </div>

                {paymentGates.map(paymentGate => {
                  const left = getTimelineSpanPercent(
                    paymentGate.dueDate,
                    timelineStartDate,
                    timelineEndDate
                  );

                  return (
                    <div
                      key={paymentGate.id}
                      className="absolute bottom-0 top-0 w-px bg-primary/40"
                      style={{ left: `${left}%` }}
                      title={`${paymentGate.title} - ${formatINR(paymentGate.amount)}`}
                    />
                  );
                })}
              </div>
            </div>

            <div>
              {workPackages.map(workPackage => (
                <div
                  key={workPackage.id}
                  className="grid grid-cols-[240px_minmax(0,1fr)] border-b border-border last:border-b-0"
                >
                  <div className="sticky left-0 z-10 min-w-0 border-r border-border bg-card px-4 py-2.5">
                    <p className="truncate text-sm font-medium text-foreground">
                      {workPackage.title}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      Assigned to : {workPackage.assigneeName}
                    </p>
                  </div>

                  <div className="relative min-h-14 bg-background px-4">
                    <div className="absolute inset-y-0 left-1/4 border-l border-dashed border-border/70" />
                    <div className="absolute inset-y-0 left-1/2 border-l border-dashed border-border/70" />
                    <div className="absolute inset-y-0 left-3/4 border-l border-dashed border-border/70" />

                    {paymentGates.map(paymentGate => {
                      const left = getTimelineSpanPercent(
                        paymentGate.dueDate,
                        timelineStartDate,
                        timelineEndDate
                      );

                      return (
                        <div
                          key={`${workPackage.id}-${paymentGate.id}`}
                          className="absolute inset-y-0 w-px bg-primary/15"
                          style={{ left: `${left}%` }}
                        />
                      );
                    })}

                    <div
                      className={`absolute top-1/2 h-3 -translate-y-1/2 rounded-full ${getGanttBarTone(
                        workPackage.status
                      )}`}
                      style={getWorkPackageBarStyle(
                        workPackage,
                        timelineStartDate,
                        timelineEndDate
                      )}
                    />

                    <div className="absolute bottom-1 right-4 text-[11px] text-muted-foreground">
                      {formatDate(workPackage.estimatedStartDate)} -{' '}
                      {formatDate(workPackage.estimatedEndDate)}
                    </div>
                  </div>
                </div>
              ))}
            </div>

          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-border px-4 py-3 text-xs text-muted-foreground sm:px-5">
          {paymentGates.map(paymentGate => (
            <span
              key={paymentGate.id}
              className="rounded-full border border-border bg-background px-2.5 py-1"
            >
              {paymentGate.title}: {formatINR(paymentGate.amount)}
            </span>
          ))}
        </div>
      </section>
    );
  };

  const renderTabContent = () => {
    if (activeTab === 'overview') {
      return (
        <div className="grid min-w-0 gap-6">
          <NextActionsPanel
            workPackages={workPackages}
            paymentGates={paymentGates}
            onGoToPayments={() => setActiveTab('payments')}
            onGoToWork={() => setActiveTab('work')}
            onGoToAlerts={() => setActiveTab('alerts')}
          />

          <TimelineSummaryCards summary={summary} />

          <PaymentGateBar
            paymentGates={paymentGates}
            onMarkReceived={handleMarkPaymentReceived}
            onMarkPending={handleMarkPaymentPending}
          />

          {renderAssistPreview()}
          {renderProjectSnapshot()}
          {renderCriticalWork()}
        </div>
      );
    }

    if (activeTab === 'work') {
      return (
        <TimelineWorkPackages
          workPackages={workPackages}
          onStartWork={handleStartWorkPackage}
          onPauseWork={handlePauseWorkPackage}
          onResumeWork={handleResumeWorkPackage}
          onCompleteWork={handleCompleteWorkPackage}
          onMarkDelayed={handleMarkWorkPackageDelayed}
          onUpdateDelayReason={handleUpdateDelayReason}
        />
      );
    }

    if (activeTab === 'payments') {
      return (
        <PaymentGateBar
          paymentGates={paymentGates}
          onMarkReceived={handleMarkPaymentReceived}
          onMarkPending={handleMarkPaymentPending}
        />
      );
    }

    if (activeTab === 'gantt') {
      return renderGanttChart();
    }

    return (
      <IntelligentAssistPanel
        alerts={alerts}
        onApplySuggestion={handleApplySuggestion}
        onIgnoreAlert={handleIgnoreAlert}
      />
    );
  };

  return (
    <div className="mx-auto w-full max-w-7xl overflow-hidden px-4 py-5 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Project Timeline Management"
        title={activeTimelineProject.name}
        description={
          showCreateWizard
            ? hasTimeline
              ? 'Edit the active project timeline. Dashboard, payment gates, and operational actions are hidden while editing.'
              : 'Create the first active timeline for this project. Dashboard, payment gates, and operational actions will appear after creation.'
            : hasTimeline
              ? 'Interior project execution timeline with payment gates, work packages, dependencies, pauses, and intelligent assist.'
              : 'Create one active timeline for this project before using dashboard, work packages, payments, or Intelligent Assist.'
        }
        actions={
          hasTimeline ? (
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <Button
                type="button"
                onClick={handleOpenTimelineWizard}
                disabled={!canBuildTimeline}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                Edit Timeline
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={handleResetTimeline}
                className="gap-2"
              >
                <RotateCcw className="h-4 w-4" />
                Reset
              </Button>

              <Button type="button" className="gap-2">
                <CalendarClock className="h-4 w-4" />
                Override
              </Button>
            </div>
          ) : null
        }
      />

      <div className="mb-5 rounded-2xl border border-dashed border-border bg-muted/20 p-3 text-card-foreground">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">
              Dev Client Timeline Data
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Use this temporary control to show or hide the Villa - Athani client timeline while the real timeline workflow is being built.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleFetchDevTimelineData}
              className="h-10 justify-center"
            >
              Fetch Data
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={handleHideDevTimelineData}
              className="h-10 justify-center"
            >
              Hide Data
            </Button>
          </div>
        </div>
      </div>

      <div className="mb-5 rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
              {isTimelineEstimateApproved ? (
                <FileCheck2 className="h-5 w-5" />
              ) : (
                <LockKeyhole className="h-5 w-5" />
              )}
            </div>

            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">
                Timeline Source
              </p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {timelineSourceMessage}
              </p>
              {linkedCostEstimate && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {linkedCostEstimate.projectName} - v{linkedCostEstimate.version} -{' '}
                  {formatINR(linkedCostEstimate.grandTotal)}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <StatusBadge variant={getEstimateStatusVariant(linkedCostEstimate?.status)}>
              {getEstimateStatusTitle(linkedCostEstimate?.status)}
            </StatusBadge>

            <Button
              type="button"
              variant="outline"
              onClick={handleRefreshCostEstimateSources}
              className="h-9"
            >
              Refresh Estimates
            </Button>
          </div>
        </div>
      </div>

      <div className="mb-5 rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">
              Approved Estimate Sources
            </p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Select an approved cost estimate before creating or updating a timeline.
            </p>
          </div>

          <StatusBadge variant="outline">
            {approvedCostEstimateRecords.length} Approved
          </StatusBadge>
        </div>

        {approvedCostEstimateRecords.length > 0 ? (
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {approvedCostEstimateRecords.map(record => {
              const isSelected = record.projectId === selectedTimelineProjectId;

              return (
                <button
                  key={record.id}
                  type="button"
                  onClick={() => handleSelectTimelineSource(record.projectId)}
                  className={`rounded-2xl border p-4 text-left transition ${
                    isSelected
                      ? 'border-emerald-500/40 bg-emerald-500/10'
                      : 'border-border bg-background hover:bg-muted/50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {record.projectName}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {record.clientName ?? 'No client name'} - v{record.version}
                      </p>
                    </div>

                    {isSelected && <StatusBadge variant="success">Selected</StatusBadge>}
                  </div>

                  <p className="mt-3 text-sm font-semibold text-foreground">
                    {formatINR(record.grandTotal)}
                  </p>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="mt-4 rounded-2xl border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
            No approved cost estimates found. Approve an estimate first, then refresh this list.
          </p>
        )}

        {waitingCostEstimateRecords.length > 0 && (
          <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
              Waiting For Approval
            </p>
            <div className="mt-3 grid gap-2">
              {waitingCostEstimateRecords.map(record => (
                <div
                  key={record.id}
                  className="flex flex-col gap-2 rounded-xl border border-border bg-background p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {record.projectName}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {record.clientName ?? 'No client name'} - v{record.version}
                    </p>
                  </div>

                  <StatusBadge variant={getEstimateStatusVariant(record.status)}>
                    {getEstimateStatusTitle(record.status)}
                  </StatusBadge>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mb-5 rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">
              Timeline Planning Controls
            </p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Confirm contract and booking payment before building the execution timeline.
            </p>
          </div>

          <StatusBadge variant={canBuildTimeline ? 'success' : 'warning'}>
            {canBuildTimeline ? 'Ready To Build' : 'Waiting'}
          </StatusBadge>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr_180px]">
          <label className="flex min-h-11 items-center gap-3 rounded-xl border border-border bg-background px-3 text-sm text-foreground">
            <input
              type="checkbox"
              checked={isContractSigned}
              onChange={event => setIsContractSigned(event.target.checked)}
              disabled={!isTimelineEstimateApproved}
            />
            Contract Signed
          </label>

          <label className="flex min-h-11 items-center gap-3 rounded-xl border border-border bg-background px-3 text-sm text-foreground">
            <input
              type="checkbox"
              checked={isBookingPaymentCollected}
              onChange={event =>
                setIsBookingPaymentCollected(event.target.checked)
              }
              disabled={!isTimelineEstimateApproved}
            />
            Booking Payment Collected
          </label>

          <label className="grid gap-1">
            <span className="text-xs font-medium text-muted-foreground">
              Timeline Start Date
            </span>
            <input
              type="date"
              value={timelineStartDate}
              onChange={event => setTimelineStartDate(event.target.value)}
              disabled={!isTimelineEstimateApproved}
              className="min-h-11 rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-foreground disabled:opacity-50"
            />
          </label>
        </div>

        <div className="mt-4 rounded-2xl border border-border bg-background p-3">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium text-foreground">
              Payment Gate Percentages
            </p>
            <p
              className={`text-xs ${
                isPaymentPercentageMatched
                  ? 'text-emerald-600 dark:text-emerald-300'
                  : 'text-amber-700 dark:text-amber-300'
              }`}
            >
              Total: {paymentPercentageTotal}%
            </p>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <label className="grid gap-1">
              <span className="text-xs text-muted-foreground">Booking</span>
              <input
                type="number"
                min="0"
                value={bookingPaymentPercent}
                onChange={event => setBookingPaymentPercent(event.target.value)}
                className="min-h-10 rounded-lg border border-border bg-card px-3 text-sm text-foreground outline-none focus:border-foreground"
              />
            </label>

            <label className="grid gap-1">
              <span className="text-xs text-muted-foreground">Stage 1</span>
              <input
                type="number"
                min="0"
                value={stageOnePaymentPercent}
                onChange={event => setStageOnePaymentPercent(event.target.value)}
                className="min-h-10 rounded-lg border border-border bg-card px-3 text-sm text-foreground outline-none focus:border-foreground"
              />
            </label>

            <label className="grid gap-1">
              <span className="text-xs text-muted-foreground">Stage 2</span>
              <input
                type="number"
                min="0"
                value={stageTwoPaymentPercent}
                onChange={event => setStageTwoPaymentPercent(event.target.value)}
                className="min-h-10 rounded-lg border border-border bg-card px-3 text-sm text-foreground outline-none focus:border-foreground"
              />
            </label>

            <label className="grid gap-1">
              <span className="text-xs text-muted-foreground">Handover</span>
              <input
                type="number"
                min="0"
                value={handoverPaymentPercent}
                onChange={event => setHandoverPaymentPercent(event.target.value)}
                className="min-h-10 rounded-lg border border-border bg-card px-3 text-sm text-foreground outline-none focus:border-foreground"
              />
            </label>
          </div>

          {!isPaymentPercentageMatched && (
            <p className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-muted-foreground">
              Payment gate percentages must total 100% before building the timeline.
            </p>
          )}
        </div>
      </div>

      {renderGeneratedTimelineReview()}

      {showCreateWizard && isTimelineEstimateApproved && (
        <div className="mb-6">
          <CreateTimelineWizard
            onClose={() => setShowCreateWizard(false)}
            onUseDraft={handleUseTimelineDraft}
          />
        </div>
      )}

      {!showCreateWizard && !hasTimeline && !pendingTimelineDraft && (
        <SectionCard
          title="No timeline created yet"
          description="Create a timeline from a design-only workflow or from an approved cost estimate before using dashboard, payment gates, work packages, or Intelligent Assist."
        >
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              type="button"
              onClick={handleOpenTimelineWizard}
              disabled={!canBuildTimeline}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Build Timeline
            </Button>
          </div>
        </SectionCard>
      )}

      {!showCreateWizard && hasTimeline && (
        <>
          <div className="mb-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-foreground">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge variant="success">Confirmed Planned Timeline</StatusBadge>
                  <StatusBadge variant="outline">Baseline Locked</StatusBadge>
                </div>
                <p className="mt-2 leading-6 text-muted-foreground">
                  This planned timeline is now the active baseline. Execution updates should be tracked separately as actual progress, pauses, completions, and delays.
                </p>
              </div>
              {timelineConfirmedAt && (
                <p className="shrink-0 text-xs font-medium text-muted-foreground">
                  Confirmed On {formatDate(timelineConfirmedAt.slice(0, 10))}
                </p>
              )}
            </div>
          </div>
          <div className="mb-5 min-w-0 rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-sm">
            <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <StatusBadge variant={getProjectStatusVariant(activeTimelineProject.status)}>
                  {toTitleCase(activeTimelineProject.status)}
                </StatusBadge>

                <StatusBadge variant="outline">
                  {activeTimelineProject.projectType}
                </StatusBadge>

                {activeTimelineProject.location && (
                  <StatusBadge variant="outline">
                    {activeTimelineProject.location}
                  </StatusBadge>
                )}
              </div>

              <div className="text-sm text-muted-foreground">
                {formatDate(activeTimelineProject.startDate)} →{' '}
                {formatDate(activeTimelineProject.currentProjectedHandoverDate)}
              </div>
            </div>
          </div>

          <div className="mb-5 overflow-hidden rounded-2xl border border-border bg-card p-1 text-card-foreground shadow-sm">
            <div className="grid grid-cols-5 gap-1">
              {tabs.map(tab => {
                const isActive = activeTab === tab.id;

                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`rounded-xl px-2 py-2.5 text-xs font-medium transition sm:text-sm ${
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {blockedWorkPackages.length > 0 && (
            <div className="mb-5 min-w-0 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
              <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-medium text-amber-800 dark:text-amber-300">
                    {blockedWorkPackages.length} work package(s) need attention
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Payment and dependency gates are currently affecting the timeline.
                  </p>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setActiveTab('alerts')}
                  className="w-full sm:w-auto"
                >
                  View Alerts
                </Button>
              </div>
            </div>
          )}

          <div className="min-w-0">{renderTabContent()}</div>
        </>
      )}
    </div>
  );
}

