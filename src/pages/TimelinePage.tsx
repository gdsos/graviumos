import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, ChevronDown, ChevronUp, Pencil, Plus, RotateCcw, Save,
  Trash2,
} from 'lucide-react';

import { PageHeader } from '@/components/common/PageHeader';
import { SectionCard } from '@/components/common/SectionCard';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';
import { DateInput } from '@/components/common/DateInput';

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

const TIMELINE_STORAGE_KEY = 'gravium-os-timeline';
const COST_ESTIMATE_STORAGE_KEY = 'gravium-os-cost-estimates';

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

function getStoredCostEstimateRecords() {
  if (typeof window === 'undefined') return [];

  try {
    const storedRecords = localStorage.getItem(COST_ESTIMATE_STORAGE_KEY);

    if (!storedRecords) return [];

    const parsedRecords = JSON.parse(storedRecords);

    if (!Array.isArray(parsedRecords)) return [];

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
    return [];
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

const emptyTimelineProject: TimelineProject = {
  id: 'timeline-project-unselected',
  name: 'Select an approved estimate',
  clientName: 'No client selected',
  projectType: 'Execution Timeline',
  status: 'active',
  startDate: new Date().toISOString().slice(0, 10),
  expectedHandoverDate: new Date().toISOString().slice(0, 10),
  currentProjectedHandoverDate: new Date().toISOString().slice(0, 10),
  revenue: 0,
  location: '',
};


type StoredTimelineState = {
  hasTimeline: boolean;
  paymentGates: PaymentGate[];
  workPackages: WorkPackage[];
  timelineConfirmedAt?: string;
  selectedTimelineProjectId?: string;
};

type TimelineTab = 'overview' | 'work' | 'payments' | 'schedule' | 'alerts';

const tabs: Array<{ id: TimelineTab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'work', label: 'Work' },
  { id: 'payments', label: 'Payments' },
  { id: 'schedule', label: 'Schedule' },
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
        selectedTimelineProjectId:
          typeof parsedTimeline.selectedTimelineProjectId === 'string'
            ? parsedTimeline.selectedTimelineProjectId
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


function formatCompactDate(dateString: string) {
  const [year, month, day] = dateString.split('-');

  if (!year || !month || !day) return dateString;

  return `${day}/${month}/${year}`;
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

function getScheduleBarTone(status: WorkPackageStatus) {
  if (status === 'blocked_by_payment' || status === 'blocked_by_dependency') {
    return 'bg-amber-500/80';
  }

  if (status === 'in_progress') return 'bg-blue-500/80';
  if (status === 'completed') return 'bg-emerald-500/80';
  if (status === 'delayed') return 'bg-red-500/80';

  return 'bg-primary';
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
    () => storedTimeline?.paymentGates ?? []
  );
  const [workPackages, setWorkPackages] = useState<WorkPackage[]>(
    () => storedTimeline?.workPackages ?? []
  );
  const [ignoredAlertIds, setIgnoredAlertIds] = useState<string[]>([]);
  const [showCreateWizard, setShowCreateWizard] = useState(false);
  const [pendingTimelineDraft, setPendingTimelineDraft] =
    useState<GeneratedTimelineReviewDraft | null>(null);
  const [isDeleteTimelineDialogOpen, setIsDeleteTimelineDialogOpen] =
    useState(false);
  const [openPendingStatusMenuId, setOpenPendingStatusMenuId] = useState<
    string | null
  >(null);
  const [timelineConfirmedAt, setTimelineConfirmedAt] = useState(
    () => storedTimeline?.timelineConfirmedAt ?? ''
  );
  const [showEstimateSourcePicker, setShowEstimateSourcePicker] = useState(false);
  const [isPlanningControlsLocked, setIsPlanningControlsLocked] = useState(false);
  const [showPaymentGateControls, setShowPaymentGateControls] = useState(false);
  const [costEstimateRecords, setCostEstimateRecords] = useState<
    StoredCostEstimateRecord[]
  >(() => getStoredCostEstimateRecords());
  const [selectedTimelineProjectId, setSelectedTimelineProjectId] = useState(
    () => storedTimeline?.selectedTimelineProjectId ?? ''
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
        selectedTimelineProjectId,
      })
    );
  }, [
    hasTimeline,
    paymentGates,
    selectedTimelineProjectId,
    timelineConfirmedAt,
    workPackages,
  ]);

  const summary = useMemo(
    () => calculateTimelineSummary(workPackages, paymentGates),
    [paymentGates, workPackages]
  );

  const generatedAlerts = useMemo(
    () => generateTimelineAlerts(workPackages, paymentGates),
    [paymentGates, workPackages]
  );

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
  useEffect(() => {
    if (!hasTimeline || selectedTimelineProjectId) return;

    const onlyApprovedProjectEstimate =
      approvedCostEstimateRecords.length === 1
        ? approvedCostEstimateRecords[0]
        : null;

    if (onlyApprovedProjectEstimate?.projectId) {
      setSelectedTimelineProjectId(onlyApprovedProjectEstimate.projectId);
    }
  }, [approvedCostEstimateRecords, hasTimeline, selectedTimelineProjectId]);

  const activeTimelineProject = useMemo<TimelineProject>(
    () => ({
      ...emptyTimelineProject,
      id: (linkedCostEstimate?.projectId ?? selectedTimelineProjectId) || emptyTimelineProject.id,
      name: linkedCostEstimate?.projectName ?? emptyTimelineProject.name,
      clientName: linkedCostEstimate?.clientName ?? emptyTimelineProject.clientName,
      revenue: linkedCostEstimate?.grandTotal ?? 0,
      startDate: timelineStartDate || emptyTimelineProject.startDate,
    }),
    [linkedCostEstimate, selectedTimelineProjectId, timelineStartDate]
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
  const hasSelectedApprovedProjectEstimate = Boolean(
    linkedCostEstimate?.projectId && linkedCostEstimate.status === 'approved'
  );
  const hasActiveTimeline = hasTimeline && hasSelectedApprovedProjectEstimate;
  const alerts = useMemo(() => {
    const sourceAlerts = hasActiveTimeline ? generatedAlerts : [];

    const uniqueAlerts = sourceAlerts.filter(
      (alert, index, array) =>
        array.findIndex(currentAlert => currentAlert.id === alert.id) === index
    );

    return uniqueAlerts.filter(alert => !ignoredAlertIds.includes(alert.id));
  }, [generatedAlerts, hasActiveTimeline, ignoredAlertIds]);

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
    hasSelectedApprovedProjectEstimate &&
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
    if (!canBuildTimeline || !linkedCostEstimate || !hasSelectedApprovedProjectEstimate) return;

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
    setShowEstimateSourcePicker(false);
    setShowCreateWizard(false);
    setActiveTab('overview');
  };

  const handleRefreshCostEstimateSources = () => {
    setCostEstimateRecords(getStoredCostEstimateRecords());
  };

  const handleSelectTimelineSource = (projectId?: string) => {
    if (!projectId) return;

    const isChangingSource = selectedTimelineProjectId !== projectId;

    setSelectedTimelineProjectId(projectId);
    setIsContractSigned(false);
    setIsBookingPaymentCollected(false);
    setPendingTimelineDraft(null);
    setTimelineConfirmedAt('');
    setShowEstimateSourcePicker(false);
    setShowCreateWizard(false);
    setActiveTab('overview');

    if (isChangingSource) {
      setPaymentGates([]);
      setWorkPackages([]);
      setHasTimeline(false);
      setIgnoredAlertIds([]);
      setIsPlanningControlsLocked(false);
      setShowPaymentGateControls(false);
    }
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

  const handleReviseTimeline = () => {
    if (!hasActiveTimeline || workPackages.length === 0) return;

    setPendingTimelineDraft({
      paymentGates,
      workPackages,
    });
    setIgnoredAlertIds([]);
    setShowCreateWizard(false);
    setShowEstimateSourcePicker(false);
    setActiveTab('overview');
  };

  const handleResetTimeline = () => {
    setIsDeleteTimelineDialogOpen(true);
  };

  const handleConfirmDeleteTimeline = () => {
    localStorage.removeItem(TIMELINE_STORAGE_KEY);
    setPaymentGates([]);
    setWorkPackages([]);
    setPendingTimelineDraft(null);
    setIgnoredAlertIds([]);
    setHasTimeline(false);
    setTimelineConfirmedAt('');
    setShowCreateWizard(false);
    setShowEstimateSourcePicker(false);
    setIsPlanningControlsLocked(false);
    setShowPaymentGateControls(false);
    setIsDeleteTimelineDialogOpen(false);
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

    if (!hasTimeline) {
      setTimelineConfirmedAt('');
    }

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
                  <DateInput
                    value={workPackage.estimatedStartDate}
                    onChange={value =>
                      handleUpdatePendingWorkPackage(workPackage.id, {
                        estimatedStartDate: value,
                      })
                    }
                    placeholder="Select start date"
                    popoverMode="fixed"
                  />
                </label>

                <label className="grid gap-1">
                  <span className="text-xs font-medium text-muted-foreground">
                    End
                  </span>
                  <DateInput
                    value={workPackage.estimatedEndDate}
                    onChange={value =>
                      handleUpdatePendingWorkPackage(workPackage.id, {
                        estimatedEndDate: value,
                      })
                    }
                    placeholder="Select end date"
                    popoverMode="fixed"
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
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() =>
                        setOpenPendingStatusMenuId(current =>
                          current === workPackage.id ? null : workPackage.id
                        )
                      }
                      className="flex min-h-10 w-full items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 text-left text-sm text-foreground outline-none transition hover:bg-muted/40 focus:border-foreground"
                    >
                      <span>{toTitleCase(workPackage.status)}</span>
                      <ChevronDown
                        className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                          openPendingStatusMenuId === workPackage.id
                            ? 'rotate-180'
                            : ''
                        }`}
                      />
                    </button>

                    {openPendingStatusMenuId === workPackage.id && (
                      <div className="absolute left-0 right-0 top-11 z-50 overflow-hidden rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-xl">
                        {workPackageStatusOptions.map(statusOption => (
                          <button
                            key={statusOption}
                            type="button"
                            onMouseDown={event => event.preventDefault()}
                            onClick={() => {
                              handleUpdatePendingWorkPackage(workPackage.id, {
                                status: statusOption,
                              });
                              setOpenPendingStatusMenuId(null);
                            }}
                            className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                              statusOption === workPackage.status
                                ? 'bg-muted text-foreground'
                                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                            }`}
                          >
                            {toTitleCase(statusOption)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
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

  const renderScheduleView = () => {
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
                  Schedule View
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
                      className={`absolute top-1/2 h-3 -translate-y-1/2 rounded-full ${getScheduleBarTone(
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

    if (activeTab === 'schedule') {
      return renderScheduleView();
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
          hasActiveTimeline ? (
            <div className="flex w-full flex-row gap-2 sm:w-auto">
              <Button
                type="button"
                onClick={handleReviseTimeline}
                disabled={workPackages.length === 0}
                className="flex-1 gap-2 bg-foreground text-background hover:bg-foreground/90 disabled:opacity-60 sm:flex-none"
              >
                <Pencil className="h-4 w-4" />
                <span className="whitespace-nowrap">Revise Timeline</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={handleResetTimeline}
                className="flex-1 gap-2 border-red-500/35 text-red-600 hover:border-red-500/60 hover:bg-red-500/10 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 sm:flex-none"
              >
                <Trash2 className="h-4 w-4" />
                <span className="whitespace-nowrap">Delete Timeline</span>
              </Button>
            </div>
          ) : null
        }
      />

      <div className="mb-5 rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-foreground">
                Approved Estimate Source
              </p>
              <StatusBadge variant="outline">
                {approvedCostEstimateRecords.length} Approved
              </StatusBadge>
            </div>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Use one approved estimate as the source for timeline planning.
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRefreshCostEstimateSources}
            className="h-9 w-9 shrink-0 p-0"
            aria-label="Refresh estimate sources"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>

        {linkedCostEstimate ? (
          <div className="mt-4 rounded-2xl border border-border bg-background p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {linkedCostEstimate.projectName}
                  </p>
                  <StatusBadge variant={getEstimateStatusVariant(linkedCostEstimate.status)}>
                    {getEstimateStatusTitle(linkedCostEstimate.status)}
                  </StatusBadge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {linkedCostEstimate.clientName ?? 'No client name'} - v{linkedCostEstimate.version}
                </p>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {formatINR(linkedCostEstimate.grandTotal)}
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={() => setShowEstimateSourcePicker(current => !current)}
                className="h-9 w-full justify-center gap-2 lg:w-auto lg:shrink-0"
                disabled={approvedCostEstimateRecords.length === 0}
              >
                {showEstimateSourcePicker ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
                {showEstimateSourcePicker ? 'Hide Sources' : 'Change Source'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed border-border bg-muted/30 p-4">
            <p className="text-sm text-muted-foreground">
              No approved source selected. Choose an approved estimate before building the timeline.
            </p>

            <Button
              type="button"
              variant="outline"
              onClick={() => setShowEstimateSourcePicker(current => !current)}
              className="mt-3 h-9 w-full justify-center gap-2 sm:w-auto"
              disabled={approvedCostEstimateRecords.length === 0}
            >
              {showEstimateSourcePicker ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
              {showEstimateSourcePicker ? 'Hide Sources' : 'Choose Source'}
            </Button>
          </div>
        )}

        {showEstimateSourcePicker && (
          approvedCostEstimateRecords.length > 0 ? (
            <div className="mt-4 grid gap-2">
              {approvedCostEstimateRecords.map(record => {
                const isSelected = record.projectId === selectedTimelineProjectId;

                return (
                  <button
                    key={record.id}
                    type="button"
                    onClick={() => handleSelectTimelineSource(record.projectId)}
                    className={`rounded-xl border px-3 py-3 text-left transition ${
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
                          {record.clientName ?? 'No client name'} - v{record.version} - {formatINR(record.grandTotal)}
                        </p>
                      </div>

                      {isSelected && <StatusBadge variant="success">Selected</StatusBadge>}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="mt-4 rounded-2xl border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
              No approved cost estimates found. Approve an estimate first, then refresh this list.
            </p>
          )
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

      {hasSelectedApprovedProjectEstimate && !hasActiveTimeline && !pendingTimelineDraft && (
      <div className="mb-5 rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-foreground">
                Timeline Planning Controls
              </p>
              <StatusBadge variant={canBuildTimeline ? 'success' : 'warning'}>
                {canBuildTimeline ? 'Ready' : 'Waiting'}
              </StatusBadge>
              {isPlanningControlsLocked && (
                <StatusBadge variant="outline">Locked</StatusBadge>
              )}
            </div>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Confirm the basics before building the planned timeline.
            </p>
          </div>

          <Button
            type="button"
            variant={isPlanningControlsLocked ? 'outline' : 'default'}
            size="sm"
            onClick={() => {
              if (isPlanningControlsLocked) {
                setIsPlanningControlsLocked(false);
                return;
              }

              if (!canBuildTimeline) return;

              setIsPlanningControlsLocked(true);
              setShowPaymentGateControls(false);
            }}
            disabled={!isPlanningControlsLocked && !canBuildTimeline}
            className="hidden h-9 justify-center gap-2 sm:inline-flex sm:px-4"
            aria-label={isPlanningControlsLocked ? 'Edit planning controls' : 'Save and lock planning controls'}
          >
            {isPlanningControlsLocked ? (
              <Pencil className="h-4 w-4" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            <span>{isPlanningControlsLocked ? 'Edit' : 'Save & Lock'}</span>
          </Button>
        </div>

        {isPlanningControlsLocked ? (
          <div className="mt-4 rounded-2xl border border-border bg-background p-3">
            <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Contract</p>
                <p className="mt-0.5 font-semibold text-foreground">
                  {isContractSigned ? 'Signed' : 'Pending'}
                </p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground">Booking</p>
                <p className="mt-0.5 font-semibold text-foreground">
                  {isBookingPaymentCollected ? 'Collected' : 'Pending'}
                </p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground">Start Date</p>
                <p className="mt-0.5 font-semibold text-foreground">
                  {formatCompactDate(timelineStartDate)}
                </p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground">Payment Split</p>
                <p className="mt-0.5 font-semibold text-foreground">
                  {paymentPercentageTotal}%
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(260px,0.8fr)_minmax(260px,1fr)]">
            <div className="grid gap-2">
              <div className="grid grid-cols-2 gap-2">
                <label className="flex min-h-11 items-center gap-2 rounded-xl border border-border bg-background px-3">
                  <input
                    type="checkbox"
                    checked={isContractSigned}
                    onChange={event => setIsContractSigned(event.target.checked)}
                    disabled={!isTimelineEstimateApproved}
                    className="h-4 w-4 shrink-0"
                  />
                  <span className="text-sm font-medium text-foreground">
                    Contract Signed
                  </span>
                </label>

                <label className="flex min-h-11 items-center gap-2 rounded-xl border border-border bg-background px-3">
                  <input
                    type="checkbox"
                    checked={isBookingPaymentCollected}
                    onChange={event => setIsBookingPaymentCollected(event.target.checked)}
                    disabled={!isTimelineEstimateApproved}
                    className="h-4 w-4 shrink-0"
                  />
                  <span className="text-sm font-medium text-foreground">
                    Booking Paid
                  </span>
                </label>
              </div>

              <label className="grid gap-1">
                <span className="text-xs font-medium text-muted-foreground">
                  Timeline Start Date
                </span>
                <DateInput
                  value={timelineStartDate}
                  onChange={setTimelineStartDate}
                  placeholder="Select start date"
                  popoverMode="fixed"
                />
              </label>
            </div>

            <div className="rounded-2xl border border-border bg-background p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Payment Split
                  </p>
                  <p className={`mt-1 text-xs font-semibold ${
                    isPaymentPercentageMatched
                      ? 'text-emerald-600 dark:text-emerald-300'
                      : 'text-amber-700 dark:text-amber-300'
                  }`}>
                    Total {paymentPercentageTotal}%
                  </p>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPaymentGateControls(current => !current)}
                  className="h-9 gap-2 px-3"
                  aria-label={showPaymentGateControls ? 'Save payment split' : 'Edit payment split'}
                >
                  {showPaymentGateControls ? (
                    <Save className="h-4 w-4" />
                  ) : (
                    <Pencil className="h-4 w-4" />
                  )}
                  <span>{showPaymentGateControls ? 'Save' : 'Edit'}</span>
                </Button>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <label className="rounded-xl border border-border bg-card px-3 py-2">
                  <span className="block text-xs text-muted-foreground">Booking</span>
                  {showPaymentGateControls ? (
                    <input
                      inputMode="numeric"
                      value={bookingPaymentPercent}
                      onChange={event => setBookingPaymentPercent(event.target.value)}
                      className="mt-1 w-full bg-transparent text-sm font-semibold text-foreground outline-none"
                    />
                  ) : (
                    <span className="mt-1 block text-sm font-semibold text-foreground">
                      {bookingPaymentPercent || 0}%
                    </span>
                  )}
                </label>

                <label className="rounded-xl border border-border bg-card px-3 py-2">
                  <span className="block text-xs text-muted-foreground">Stage 1</span>
                  {showPaymentGateControls ? (
                    <input
                      inputMode="numeric"
                      value={stageOnePaymentPercent}
                      onChange={event => setStageOnePaymentPercent(event.target.value)}
                      className="mt-1 w-full bg-transparent text-sm font-semibold text-foreground outline-none"
                    />
                  ) : (
                    <span className="mt-1 block text-sm font-semibold text-foreground">
                      {stageOnePaymentPercent || 0}%
                    </span>
                  )}
                </label>

                <label className="rounded-xl border border-border bg-card px-3 py-2">
                  <span className="block text-xs text-muted-foreground">Stage 2</span>
                  {showPaymentGateControls ? (
                    <input
                      inputMode="numeric"
                      value={stageTwoPaymentPercent}
                      onChange={event => setStageTwoPaymentPercent(event.target.value)}
                      className="mt-1 w-full bg-transparent text-sm font-semibold text-foreground outline-none"
                    />
                  ) : (
                    <span className="mt-1 block text-sm font-semibold text-foreground">
                      {stageTwoPaymentPercent || 0}%
                    </span>
                  )}
                </label>

                <label className="rounded-xl border border-border bg-card px-3 py-2">
                  <span className="block text-xs text-muted-foreground">Handover</span>
                  {showPaymentGateControls ? (
                    <input
                      inputMode="numeric"
                      value={handoverPaymentPercent}
                      onChange={event => setHandoverPaymentPercent(event.target.value)}
                      className="mt-1 w-full bg-transparent text-sm font-semibold text-foreground outline-none"
                    />
                  ) : (
                    <span className="mt-1 block text-sm font-semibold text-foreground">
                      {handoverPaymentPercent || 0}%
                    </span>
                  )}
                </label>
              </div>

              {!isPaymentPercentageMatched && (
                <p className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-muted-foreground">
                  Payment gate percentages must total 100% before building the timeline.
                </p>
              )}
            </div>
          </div>
        )}

        <div className="mt-4 flex justify-end sm:hidden">
          <Button
            type="button"
            variant={isPlanningControlsLocked ? 'outline' : 'default'}
            size="sm"
            onClick={() => {
              if (isPlanningControlsLocked) {
                setIsPlanningControlsLocked(false);
                return;
              }

              if (!canBuildTimeline) return;

              setIsPlanningControlsLocked(true);
              setShowPaymentGateControls(false);
            }}
            disabled={!isPlanningControlsLocked && !canBuildTimeline}
            className="h-10 w-full justify-center gap-2"
            aria-label={isPlanningControlsLocked ? 'Edit planning controls' : 'Save and lock planning controls'}
          >
            {isPlanningControlsLocked ? (
              <Pencil className="h-4 w-4" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            <span>{isPlanningControlsLocked ? 'Edit Planning Controls' : 'Save & Lock Planning Controls'}</span>
          </Button>
        </div>
      </div>
      )}

      {renderGeneratedTimelineReview()}

      {isDeleteTimelineDialogOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/45 px-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[2rem] border border-border bg-card p-6 text-card-foreground shadow-2xl">
            <div>
              <p className="text-lg font-semibold text-foreground">
                Delete Timeline?
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                This will remove the confirmed planned timeline for this project. The approved cost estimate and project revenue will remain unchanged.
              </p>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDeleteTimelineDialogOpen(false)}
              >
                Keep Timeline
              </Button>

              <Button
                type="button"
                onClick={handleConfirmDeleteTimeline}
                className="gap-2 bg-red-600 text-white hover:bg-red-700"
              >
                <Trash2 className="h-4 w-4" />
                Delete Timeline
              </Button>
            </div>
          </div>
        </div>
      )}

      {showCreateWizard && isTimelineEstimateApproved && (
        <div className="mb-6">
          <CreateTimelineWizard
            onClose={() => setShowCreateWizard(false)}
            onUseDraft={handleUseTimelineDraft}
          />
        </div>
      )}

      {!showCreateWizard && !hasActiveTimeline && !pendingTimelineDraft && (
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

      {!showCreateWizard && hasActiveTimeline && (
        <>
          <div className="mb-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-foreground">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge variant="success">Confirmed Planned Timeline</StatusBadge>
                <StatusBadge variant="outline">Baseline Locked</StatusBadge>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarClock className="h-4 w-4 shrink-0" />
                  {formatCompactDate(timelineDateRange.startDate)}
                </span>
                <span className="text-muted-foreground/70">-</span>
                <span className="inline-flex items-center gap-1.5">
                  <CalendarClock className="h-4 w-4 shrink-0" />
                  {formatCompactDate(timelineDateRange.endDate)}
                </span>
              </div>
            </div>
          </div>
          <div className="mb-5 overflow-hidden rounded-2xl border border-border bg-card p-1 text-card-foreground shadow-sm">
            <div className="grid grid-cols-4 gap-1 sm:grid-cols-5">
              {tabs.map(tab => {
                const isActive = activeTab === tab.id;

                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`rounded-xl px-2 py-2.5 text-xs font-medium transition sm:text-sm ${
                      tab.id === 'schedule' ? 'hidden sm:block ' : ''
                    }${
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

