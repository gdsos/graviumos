import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Trash2,
} from 'lucide-react';

import { PageHeader } from '@/components/common/PageHeader';
import { SectionCard } from '@/components/common/SectionCard';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';
import { DateInput } from '@/components/common/DateInput';

import { supabase, type VendorRecord } from '@/lib/supabase';

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
import { TimelineWorkPackages } from '@/features/timeline/components/TimelineWorkPackages';

import type {
  PaymentGate,
  TimelineAlert,
  TimelineProject,
  WorkPackage,
  WorkPackageStatus,
} from '@/features/timeline/types';

const TIMELINE_STORAGE_KEY = 'gravium-os-timeline';

type LinkedCostEstimateStatus = 'draft' | 'approved' | 'revision';

type TimelineVendorRecord = {
  id: string;
  name: string;
  category?: string;
  phone?: string;
  status?: string;
  availability?: string;
};

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

type TimelineCostEstimateRow = {
  id: string;
  project_id: string | null;
  project_name: string;
  client_name: string | null;
  status: string;
  version: number | string | null;
  grand_total: number | string | null;
  updated_at: string | null;
  created_at: string | null;
  areas: unknown;
  line_items: unknown;
};

function toTimelineNumber(value: unknown, fallback = 0) {
  const numberValue =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value)
        : Number.NaN;

  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function isLinkedCostEstimateStatus(value: unknown): value is LinkedCostEstimateStatus {
  return value === 'draft' || value === 'approved' || value === 'revision';
}

function mapVendorRowToTimelineVendor(row: VendorRecord): TimelineVendorRecord {
  return {
    id: row.id,
    name: row.name,
    category: row.category || row.scope_of_work || undefined,
    phone: row.phone || undefined,
    status: row.status,
    availability: row.availability,
  };
}

function mapCostEstimateRowToTimelineRecord(
  row: TimelineCostEstimateRow
): StoredCostEstimateRecord | null {
  if (!isLinkedCostEstimateStatus(row.status)) return null;

  const areas = Array.isArray(row.areas) ? row.areas : [];
  const lineItems = Array.isArray(row.line_items) ? row.line_items : [];

  return {
    id: row.id,
    projectId: row.project_id ?? undefined,
    projectName: row.project_name,
    clientName: row.client_name ?? undefined,
    status: row.status,
    version: toTimelineNumber(row.version, 1),
    grandTotal: toTimelineNumber(row.grand_total),
    updatedAt: row.updated_at ?? row.created_at ?? new Date().toISOString(),
    areas: areas as StoredCostEstimateRecord['areas'],
    lineItems: lineItems as StoredCostEstimateRecord['lineItems'],
  };
}

async function fetchTimelineVendorRecords() {
  const { data, error } = await supabase
    .from('vendors')
    .select('*')
    .order('name', { ascending: true });

  if (error) throw error;

  return ((data ?? []) as VendorRecord[]).map(mapVendorRowToTimelineVendor);
}

async function fetchTimelineCostEstimateRecords() {
  const { data, error } = await supabase
    .from('cost_estimates')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) throw error;

  return ((data ?? []) as TimelineCostEstimateRow[])
    .map(mapCostEstimateRowToTimelineRecord)
    .filter((record): record is StoredCostEstimateRecord => Boolean(record));
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


function formatWorkPackageStatusLabel(status: string) {
  return status
    .replaceAll('_', ' ')
    .replace(/\b\w/g, character => character.toUpperCase());
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
  sourceEstimateId?: string;
  sourceEstimateVersion?: number;
  sourceEstimateUpdatedAt?: string;
  sourceEstimateProjectName?: string;
  sourceEstimateClientName?: string;
  sourceEstimateGrandTotal?: number;
};

type ProjectTimelineRow = {
  id: string;
  project_id: string;
  source_estimate_id: string | null;
  source_estimate_version: number | string | null;
  source_estimate_updated_at: string | null;
  source_estimate_project_name: string | null;
  source_estimate_client_name: string | null;
  source_estimate_grand_total: number | string | null;
  has_timeline: boolean;
  timeline_confirmed_at: string | null;
  payment_gates: unknown;
  work_packages: unknown;
  created_at: string | null;
  updated_at: string | null;
};

type ProjectTimelinePersistencePayload = {
  projectId: string;
  hasTimeline: boolean;
  paymentGates: PaymentGate[];
  workPackages: WorkPackage[];
  timelineConfirmedAt: string;
  sourceEstimateId: string;
  sourceEstimateVersion: number;
  sourceEstimateUpdatedAt: string;
  sourceEstimateProjectName: string;
  sourceEstimateClientName: string;
  sourceEstimateGrandTotal: number;
};

type FinanceTimelinePaymentGateRow = {
  id: string;
  project_id: string;
  timeline_gate_id: string | null;
  status: string | null;
  required_amount: number | string | null;
  collected_amount: number | string | null;
  outstanding_amount: number | string | null;
  marked_paid_at: string | null;
  updated_at: string | null;
};

type TimelineInputDialogMode = 'pause' | 'mark_delayed' | 'update_delay';

type TimelineDelayOwner =
  | 'client'
  | 'vendor'
  | 'gravium'
  | 'site_condition'
  | 'payment'
  | 'material'
  | 'other';

type TimelineInputDialogState = {
  mode: TimelineInputDialogMode;
  workPackageId: string;
  title: string;
  description: string;
  label: string;
  value: string;
  delayOwner?: TimelineDelayOwner;
  delayImpactDays?: string;
  delayExpectedRecoveryDate?: string;
  confirmLabel: string;
};

type TimelineNoticeDialogState = {
  title: string;
  description: string;
};

const timelineDelayOwnerOptions: Array<{
  value: TimelineDelayOwner;
  label: string;
}> = [
  { value: 'client', label: 'Client' },
  { value: 'vendor', label: 'Vendor' },
  { value: 'gravium', label: 'Gravium' },
  { value: 'site_condition', label: 'Site Condition' },
  { value: 'payment', label: 'Payment' },
  { value: 'material', label: 'Material' },
  { value: 'other', label: 'Other' },
];

function getTimelineDelayOwnerLabel(value?: TimelineDelayOwner) {
  return (
    timelineDelayOwnerOptions.find(option => option.value === value)?.label ??
    'Select Source'
  );
}


function mapProjectTimelineRowToStoredState(row: ProjectTimelineRow): StoredTimelineState {
  return {
    hasTimeline: row.has_timeline,
    paymentGates: Array.isArray(row.payment_gates)
      ? (row.payment_gates as PaymentGate[])
      : [],
    workPackages: Array.isArray(row.work_packages)
      ? (row.work_packages as WorkPackage[])
      : [],
    timelineConfirmedAt: row.timeline_confirmed_at ?? '',
    selectedTimelineProjectId: row.project_id,
    sourceEstimateId: row.source_estimate_id ?? '',
    sourceEstimateVersion: toTimelineNumber(row.source_estimate_version),
    sourceEstimateUpdatedAt: row.source_estimate_updated_at ?? '',
    sourceEstimateProjectName: row.source_estimate_project_name ?? '',
    sourceEstimateClientName: row.source_estimate_client_name ?? '',
    sourceEstimateGrandTotal: toTimelineNumber(row.source_estimate_grand_total),
  };
}

function mapProjectTimelineStateToRow(payload: ProjectTimelinePersistencePayload) {
  return {
    project_id: payload.projectId,
    source_estimate_id: payload.sourceEstimateId || null,
    source_estimate_version: payload.sourceEstimateVersion,
    source_estimate_updated_at: payload.sourceEstimateUpdatedAt || null,
    source_estimate_project_name: payload.sourceEstimateProjectName,
    source_estimate_client_name: payload.sourceEstimateClientName,
    source_estimate_grand_total: payload.sourceEstimateGrandTotal,
    has_timeline: payload.hasTimeline,
    timeline_confirmed_at: payload.timelineConfirmedAt || null,
    payment_gates: payload.paymentGates,
    work_packages: payload.workPackages,
  };
}

async function fetchProjectTimelineState(projectId: string) {
  const { data, error } = await supabase
    .from('project_timelines')
    .select('*')
    .eq('project_id', projectId)
    .maybeSingle();

  if (error) throw error;

  return data ? mapProjectTimelineRowToStoredState(data as ProjectTimelineRow) : null;
}

async function fetchLatestProjectTimelineState() {
  const { data, error } = await supabase
    .from('project_timelines')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  return data ? mapProjectTimelineRowToStoredState(data as ProjectTimelineRow) : null;
}

async function saveProjectTimelineState(payload: ProjectTimelinePersistencePayload) {
  const { error } = await supabase
    .from('project_timelines')
    .upsert(mapProjectTimelineStateToRow(payload), { onConflict: 'project_id' });

  if (error) throw error;
}

async function deleteProjectTimelineState(projectId: string) {
  const { error } = await supabase
    .from('project_timelines')
    .delete()
    .eq('project_id', projectId);

  if (error) throw error;
}

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
  sourceEstimateId?: string;
  sourceEstimateVersion?: number;
  sourceEstimateUpdatedAt?: string;
  sourceEstimateProjectName?: string;
  sourceEstimateClientName?: string;
  sourceEstimateGrandTotal?: number;
};


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
        sourceEstimateId:
          typeof parsedTimeline.sourceEstimateId === 'string'
            ? parsedTimeline.sourceEstimateId
            : '',
        sourceEstimateVersion:
          typeof parsedTimeline.sourceEstimateVersion === 'number'
            ? parsedTimeline.sourceEstimateVersion
            : 0,
        sourceEstimateUpdatedAt:
          typeof parsedTimeline.sourceEstimateUpdatedAt === 'string'
            ? parsedTimeline.sourceEstimateUpdatedAt
            : '',
        sourceEstimateProjectName:
          typeof parsedTimeline.sourceEstimateProjectName === 'string'
            ? parsedTimeline.sourceEstimateProjectName
            : '',
        sourceEstimateClientName:
          typeof parsedTimeline.sourceEstimateClientName === 'string'
            ? parsedTimeline.sourceEstimateClientName
            : '',
        sourceEstimateGrandTotal:
          typeof parsedTimeline.sourceEstimateGrandTotal === 'number'
            ? parsedTimeline.sourceEstimateGrandTotal
            : 0,
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


function formatCompactDate(dateString?: string) {
  if (!dateString) return 'Not set';

  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) return dateString;

  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

function formatDate(dateString?: string) {
  if (!dateString) return 'Not set';

  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) return dateString;

  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}


function getDayDifference(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  const dayInMs = 24 * 60 * 60 * 1000;

  return Math.max(0, Math.round((end.getTime() - start.getTime()) / dayInMs));
}

const SCHEDULE_LEFT_COLUMN_WIDTH = 280;
const SCHEDULE_CHART_LEFT_PADDING = 44;
const SCHEDULE_BASE_DAY_WIDTH = 44;
const SCHEDULE_MIN_ZOOM = 0.65;
const SCHEDULE_MAX_ZOOM = 3.2;

function clampScheduleZoom(value: number) {
  return Math.min(SCHEDULE_MAX_ZOOM, Math.max(SCHEDULE_MIN_ZOOM, value));
}

function getScheduleBaseDayWidth(viewportWidth: number, totalDays: number) {
  const visibleChartWidth = Math.max(0, viewportWidth - SCHEDULE_LEFT_COLUMN_WIDTH);
  const usableChartWidth = Math.max(1, visibleChartWidth - SCHEDULE_CHART_LEFT_PADDING - 24);

  if (visibleChartWidth <= 0 || totalDays <= 1) {
    return SCHEDULE_BASE_DAY_WIDTH;
  }

  return usableChartWidth / Math.max(1, totalDays);
}

function formatScheduleTickDate(dateString: string) {
  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) return dateString;

  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
  }).format(date);
}

function addDaysToDate(dateString: string, days: number) {
  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) return dateString;

  date.setDate(date.getDate() + days);

  return date.toISOString().slice(0, 10);
}

function getSchedulePointLeft(
  date: string,
  timelineStartDate: string,
  dayWidth: number
) {
  return (
    SCHEDULE_CHART_LEFT_PADDING +
    Math.max(0, getDayDifference(timelineStartDate, date) * dayWidth)
  );
}

function getScheduleDateTicks(
  timelineStartDate: string,
  totalDays: number,
  dayWidth: number
) {
  const step =
    dayWidth >= 54
      ? 1
      : dayWidth >= 34
        ? 3
        : dayWidth >= 22
          ? 7
          : 14;

  const ticks = [];

  for (let dayIndex = 0; dayIndex < totalDays; dayIndex += step) {
    ticks.push({
      date: addDaysToDate(timelineStartDate, dayIndex),
      left: SCHEDULE_CHART_LEFT_PADDING + dayIndex * dayWidth,
      isMajor: dayIndex === 0 || dayIndex % Math.max(step, 7) === 0,
      isEnd: dayIndex === totalDays - 1,
    });
  }

  if (ticks[ticks.length - 1]?.date !== addDaysToDate(timelineStartDate, totalDays - 1)) {
    ticks.push({
      date: addDaysToDate(timelineStartDate, totalDays - 1),
      left: SCHEDULE_CHART_LEFT_PADDING + (totalDays - 1) * dayWidth,
      isMajor: true,
      isEnd: true,
    });
  }

  return ticks;
}

function getScheduleDateRangeBarStyle(
  startDate: string,
  endDate: string,
  timelineStartDate: string,
  dayWidth: number
) {
  const offsetDays = Math.max(0, getDayDifference(timelineStartDate, startDate));
  const durationDays = Math.max(1, getDayDifference(startDate, endDate) + 1);

  return {
    left: `${SCHEDULE_CHART_LEFT_PADDING + offsetDays * dayWidth}px`,
    width: `${Math.max(dayWidth, durationDays * dayWidth)}px`,
  };
}

function getWorkPackageBarStyle(
  workPackage: WorkPackage,
  timelineStartDate: string,
  dayWidth: number
) {
  return getScheduleDateRangeBarStyle(
    workPackage.estimatedStartDate,
    workPackage.estimatedEndDate,
    timelineStartDate,
    dayWidth
  );
}

function getActualWorkPackageEndDate(workPackage: WorkPackage, today: string) {
  if (!workPackage.actualStartDate) return null;

  return workPackage.actualEndDate ?? today;
}

type WorkPackageScheduleSegmentKind = 'active' | 'paused';

type WorkPackageScheduleSegment = {
  id: string;
  kind: WorkPackageScheduleSegmentKind;
  startDate: string;
  endDate: string;
};

function getActualWorkPackageBarStyle(
  workPackage: WorkPackage,
  timelineStartDate: string,
  dayWidth: number,
  today: string
) {
  const actualEndDate = getActualWorkPackageEndDate(workPackage, today);

  if (!workPackage.actualStartDate || !actualEndDate) return null;

  return getScheduleDateRangeBarStyle(
    workPackage.actualStartDate,
    actualEndDate,
    timelineStartDate,
    dayWidth
  );
}

function getPreviousDate(date: string) {
  return addDaysToDate(date, -1);
}

function getNextDate(date: string) {
  return addDaysToDate(date, 1);
}

function isDateBeforeOrSame(startDate: string, endDate: string) {
  return getDayDifference(startDate, endDate) >= 0;
}

function getActualWorkPackageScheduleSegments(
  workPackage: WorkPackage,
  today: string
): WorkPackageScheduleSegment[] {
  const actualStartDate = workPackage.actualStartDate;
  const actualEndDate = getActualWorkPackageEndDate(workPackage, today);

  if (!actualStartDate || !actualEndDate) return [];

  const segments: WorkPackageScheduleSegment[] = [];
  let cursorDate = actualStartDate;

  const sortedPausePeriods = [...workPackage.pausePeriods].sort((first, second) =>
    first.pauseStart.localeCompare(second.pauseStart)
  );

  sortedPausePeriods.forEach((pausePeriod, index) => {
    if (!pausePeriod.pauseStart) return;

    const isLatestPausePeriod = index === sortedPausePeriods.length - 1;
    const isOpenPause =
      !pausePeriod.pauseEnd || (workPackage.status === 'paused' && isLatestPausePeriod);

    const pauseStartDate =
      pausePeriod.pauseStart < actualStartDate ? actualStartDate : pausePeriod.pauseStart;

    const resumeDate = pausePeriod.pauseEnd ?? today;
    const rawPauseEndDate = isOpenPause ? actualEndDate : getPreviousDate(resumeDate);
    const pauseEndDate =
      rawPauseEndDate > actualEndDate ? actualEndDate : rawPauseEndDate;

    if (!isDateBeforeOrSame(pauseStartDate, actualEndDate)) return;

    const activeEndDate = getPreviousDate(pauseStartDate);

    if (isDateBeforeOrSame(cursorDate, activeEndDate)) {
      segments.push({
        id: `${workPackage.id}-active-before-pause-${index}`,
        kind: 'active',
        startDate: cursorDate,
        endDate: activeEndDate,
      });
    }

    if (isDateBeforeOrSame(pauseStartDate, pauseEndDate)) {
      segments.push({
        id: `${workPackage.id}-paused-${pausePeriod.id ?? index}`,
        kind: 'paused',
        startDate: pauseStartDate,
        endDate: pauseEndDate,
      });
    }

    cursorDate = isOpenPause ? getNextDate(pauseEndDate) : resumeDate;
  });

  if (workPackage.status === 'paused') {
    return segments;
  }

  if (isDateBeforeOrSame(cursorDate, actualEndDate)) {
    segments.push({
      id: `${workPackage.id}-active-after-pauses`,
      kind: 'active',
      startDate: cursorDate,
      endDate: actualEndDate,
    });
  }

  return segments;
}

type WorkPackageDelayScheduleSegment = {
  id: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: NonNullable<WorkPackage['delayInfo']>['status'];
};

function getDateOnlyFromDateTime(value?: string, fallbackDate?: string) {
  if (value && value.length >= 10) return value.slice(0, 10);

  return fallbackDate ?? '';
}

function getDelayInfoId(workPackageId: string, existingId?: string) {
  return existingId ?? `delay-${workPackageId}-${Date.now()}`;
}

function upsertWorkPackageDelayHistory(
  delayHistory: WorkPackage['delayHistory'] | undefined,
  delayInfo: NonNullable<WorkPackage['delayInfo']>
) {
  const nextDelayHistory = [...(delayHistory ?? [])];
  const delayInfoId = getDelayInfoId('history', delayInfo.id);
  const existingIndex = nextDelayHistory.findIndex(
    historyItem => historyItem.id === delayInfoId
  );
  const normalizedDelayInfo = {
    ...delayInfo,
    id: delayInfoId,
  };

  if (existingIndex >= 0) {
    nextDelayHistory[existingIndex] = normalizedDelayInfo;
  } else {
    nextDelayHistory.push(normalizedDelayInfo);
  }

  return nextDelayHistory.sort((first, second) =>
    first.flaggedAt.localeCompare(second.flaggedAt)
  );
}

function getWorkPackageDelayHistory(workPackage: WorkPackage) {
  const historyById = new Map<string, NonNullable<WorkPackage['delayInfo']>>();

  (workPackage.delayHistory ?? []).forEach((delayItem, index) => {
    const delayItemId = delayItem.id ?? `legacy-delay-${workPackage.id}-${index}`;

    historyById.set(delayItemId, {
      ...delayItem,
      id: delayItemId,
    });
  });

  if (workPackage.delayInfo) {
    const delayInfoId = getDelayInfoId(workPackage.id, workPackage.delayInfo.id);

    historyById.set(delayInfoId, {
      ...workPackage.delayInfo,
      id: delayInfoId,
    });
  }

  return Array.from(historyById.values()).sort((first, second) =>
    first.flaggedAt.localeCompare(second.flaggedAt)
  );
}

function getWorkPackageDelayScheduleSegments(
  workPackage: WorkPackage,
  today: string
): WorkPackageDelayScheduleSegment[] {
  return getWorkPackageDelayHistory(workPackage)
    .map((delayInfo, index) => {
      const startDate = getDateOnlyFromDateTime(delayInfo.flaggedAt, today);
      const endDate =
        delayInfo.status === 'resolved'
          ? getDateOnlyFromDateTime(delayInfo.resolvedAt, startDate)
          : today;

      if (!startDate || !endDate) return null;

      return {
        id: delayInfo.id ?? `delay-segment-${workPackage.id}-${index}`,
        startDate,
        endDate,
        reason: delayInfo.reason,
        status: delayInfo.status,
      };
    })
    .filter((segment): segment is WorkPackageDelayScheduleSegment => Boolean(segment));
}

function getActualActiveScheduleBarTone() {
  return getScheduleBarTone('in_progress');
}

function getScheduleBarTone(status: WorkPackageStatus) {
  if (status === 'blocked_by_payment' || status === 'blocked_by_dependency') {
    return 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-700';
  }

  if (status === 'in_progress') {
    return 'bg-gradient-to-r from-blue-500 via-sky-500 to-cyan-500';
  }

  if (status === 'completed') {
    return 'bg-gradient-to-r from-emerald-500 via-green-500 to-teal-500';
  }

  if (status === 'delayed') {
    return 'bg-gradient-to-r from-red-500 via-rose-500 to-orange-500';
  }

  if (status === 'paused') {
    return 'bg-gradient-to-r from-zinc-400 via-neutral-500 to-stone-500';
  }

  return 'bg-gradient-to-r from-[#603B2A] via-[#555D3A] to-[#2F2F2F]';
}

function formatScheduleFinanceStatus(status?: string | null) {
  if (status === 'paid' || status === 'received') return 'Received';
  if (status === 'partial') return 'Partial';
  if (status === 'overpaid') return 'Overpaid';
  if (status === 'cancelled') return 'Cancelled';
  if (status === 'overdue') return 'Overdue';

  return 'Pending';
}

function getScheduleFinanceStatusVariant(status?: string | null) {
  if (status === 'paid' || status === 'received') return 'success';
  if (status === 'partial' || status === 'overpaid') return 'warning';
  if (status === 'cancelled' || status === 'overdue') return 'danger';

  return 'outline';
}

function getPaymentGateScheduleTone(index: number) {
  const tones = [
    {
      badge: 'bg-amber-500 text-black',
      line: 'bg-amber-500/45',
    },
    {
      badge: 'bg-blue-500 text-white',
      line: 'bg-blue-500/40',
    },
    {
      badge: 'bg-violet-500 text-white',
      line: 'bg-violet-500/40',
    },
    {
      badge: 'bg-emerald-500 text-black',
      line: 'bg-emerald-500/40',
    },
  ];

  return tones[index % tones.length];
}

function distributePaymentGatesAcrossTimeline(
  paymentGates: PaymentGate[],
  workPackages: WorkPackage[],
  fallbackStartDate: string
) {
  if (paymentGates.length === 0) return paymentGates;

  const packageStartDates = workPackages
    .map(workPackage => workPackage.estimatedStartDate)
    .filter(Boolean)
    .sort();

  const packageEndDates = workPackages
    .map(workPackage => workPackage.estimatedEndDate)
    .filter(Boolean)
    .sort();

  const startDate = packageStartDates[0] ?? fallbackStartDate;
  const endDate =
    packageEndDates[packageEndDates.length - 1] ??
    packageStartDates[packageStartDates.length - 1] ??
    fallbackStartDate;
  const totalDays = Math.max(1, getDayDifference(startDate, endDate));

  if (paymentGates.length === 1) {
    return paymentGates.map(paymentGate => ({
      ...paymentGate,
      dueDate: startDate,
    }));
  }

  return paymentGates.map((paymentGate, index) => {
    const offsetDays = Math.round((index / (paymentGates.length - 1)) * totalDays);

    return {
      ...paymentGate,
      dueDate: addDaysToDate(startDate, offsetDays),
    };
  });
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

async function deleteTimelineFinanceGateData(projectId: string) {
  const { data: gateRows, error: gateFetchError } = await supabase
    .from('project_finance_payment_gates')
    .select('id')
    .eq('project_id', projectId);

  if (gateFetchError) throw gateFetchError;

  const gateIds = (gateRows ?? [])
    .map(row => String(row.id))
    .filter(Boolean);

  if (gateIds.length === 0) return;

  const { data: allocationRows, error: allocationFetchError } = await supabase
    .from('project_cash_receipt_allocations')
    .select('id, receipt_id')
    .in('payment_gate_id', gateIds);

  if (allocationFetchError) throw allocationFetchError;

  const receiptIds = Array.from(
    new Set(
      (allocationRows ?? [])
        .map(row => row.receipt_id ? String(row.receipt_id) : '')
        .filter(Boolean)
    )
  );

  const { error: allocationDeleteError } = await supabase
    .from('project_cash_receipt_allocations')
    .delete()
    .in('payment_gate_id', gateIds);

  if (allocationDeleteError) throw allocationDeleteError;

  const { error: gateDeleteError } = await supabase
    .from('project_finance_payment_gates')
    .delete()
    .in('id', gateIds);

  if (gateDeleteError) throw gateDeleteError;

  if (receiptIds.length === 0) return;

  const { data: remainingAllocations, error: remainingAllocationError } = await supabase
    .from('project_cash_receipt_allocations')
    .select('receipt_id')
    .in('receipt_id', receiptIds);

  if (remainingAllocationError) throw remainingAllocationError;

  const receiptIdsStillAllocated = new Set(
    (remainingAllocations ?? [])
      .map(row => row.receipt_id ? String(row.receipt_id) : '')
      .filter(Boolean)
  );

  const orphanReceiptIds = receiptIds.filter(
    receiptId => !receiptIdsStillAllocated.has(receiptId)
  );

  if (orphanReceiptIds.length === 0) return;

  const { error: receiptDeleteError } = await supabase
    .from('project_cash_receipts')
    .delete()
    .in('id', orphanReceiptIds);

  if (receiptDeleteError) throw receiptDeleteError;
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
  const [shouldScrollToPendingTimelineReview, setShouldScrollToPendingTimelineReview] =
    useState(false);
  const [isDeleteTimelineDialogOpen, setIsDeleteTimelineDialogOpen] =
    useState(false);
const [timelineConfirmedAt, setTimelineConfirmedAt] = useState(
    () => storedTimeline?.timelineConfirmedAt ?? ''
  );
  const [showEstimateSourcePicker, setShowEstimateSourcePicker] = useState(false);
  const [openPendingVendorPickerId, setOpenPendingVendorPickerId] = useState<string | null>(null);
  const [pendingVendorQuery, setPendingVendorQuery] = useState('');
  const [pendingVendorPickerPosition, setPendingVendorPickerPosition] = useState({
    top: 0,
    left: 0,
    width: 280,
  });
  const pendingVendorPickerButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [isPlanningControlsLocked, setIsPlanningControlsLocked] = useState(false);
  const [showPaymentGateControls, setShowPaymentGateControls] = useState(false);
  const [costEstimateRecords, setCostEstimateRecords] = useState<
    StoredCostEstimateRecord[]
  >([]);
  const [vendorRecords, setVendorRecords] = useState<TimelineVendorRecord[]>([]);
  const [selectedTimelineProjectId, setSelectedTimelineProjectId] = useState(
    () => storedTimeline?.selectedTimelineProjectId ?? ''
  );
  const [timelineSourceEstimateId, setTimelineSourceEstimateId] = useState(
    () => storedTimeline?.sourceEstimateId ?? ''
  );
  const [timelineSourceEstimateVersion, setTimelineSourceEstimateVersion] =
    useState(() => storedTimeline?.sourceEstimateVersion ?? 0);
  const [timelineSourceEstimateUpdatedAt, setTimelineSourceEstimateUpdatedAt] =
    useState(() => storedTimeline?.sourceEstimateUpdatedAt ?? '');
  const [timelineSourceEstimateProjectName, setTimelineSourceEstimateProjectName] =
    useState(() => storedTimeline?.sourceEstimateProjectName ?? '');
  const [timelineSourceEstimateClientName, setTimelineSourceEstimateClientName] =
    useState(() => storedTimeline?.sourceEstimateClientName ?? '');
  const [timelineSourceEstimateGrandTotal, setTimelineSourceEstimateGrandTotal] =
    useState(() => storedTimeline?.sourceEstimateGrandTotal ?? 0);
  const [timelineStartDate, setTimelineStartDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [scheduleZoom, setScheduleZoom] = useState(1);
  const [scheduleDisplayMode, setScheduleDisplayMode] =
    useState<'status' | 'phase'>('status');
  const [scheduleViewportWidth, setScheduleViewportWidth] = useState(0);
  const scheduleScrollRef = useRef<HTMLDivElement | null>(null);
  const pendingScheduleScrollLeftRef = useRef<number | null>(null);
  const scheduleDragStartXRef = useRef<number | null>(null);
  const scheduleDragStartScrollLeftRef = useRef(0);
  const scheduleIsDraggingRef = useRef(false);
  const schedulePinchDistanceRef = useRef<number | null>(null);
  const schedulePinchZoomRef = useRef(1);
  const scheduleTotalDaysRef = useRef(1);
  const pendingTimelineReviewRef = useRef<HTMLElement | null>(null);
  const [isContractSigned, setIsContractSigned] = useState(false);
  const [isBookingPaymentCollected, setIsBookingPaymentCollected] = useState(false);
  const [bookingPaymentPercent, setBookingPaymentPercent] = useState('35');
  const [stageOnePaymentPercent, setStageOnePaymentPercent] = useState('30');
  const [stageTwoPaymentPercent, setStageTwoPaymentPercent] = useState('25');
  const [handoverPaymentPercent, setHandoverPaymentPercent] = useState('10');
  const [isTimelineStateHydrated, setIsTimelineStateHydrated] = useState(false);
  const [financePaymentGateRows, setFinancePaymentGateRows] = useState<
    FinanceTimelinePaymentGateRow[]
  >([]);
  const [timelineInputDialog, setTimelineInputDialog] =
    useState<TimelineInputDialogState | null>(null);
  const [isDelayOwnerPickerOpen, setIsDelayOwnerPickerOpen] = useState(false);
  const [timelineNoticeDialog, setTimelineNoticeDialog] =
    useState<TimelineNoticeDialogState | null>(null);

  const applyStoredTimelineState = (nextTimelineState: StoredTimelineState) => {
    setHasTimeline(nextTimelineState.hasTimeline);
    setPaymentGates(nextTimelineState.paymentGates);
    setWorkPackages(nextTimelineState.workPackages);
    setTimelineConfirmedAt(nextTimelineState.timelineConfirmedAt ?? '');
    setSelectedTimelineProjectId(nextTimelineState.selectedTimelineProjectId ?? '');
    setTimelineSourceEstimateId(nextTimelineState.sourceEstimateId ?? '');
    setTimelineSourceEstimateVersion(nextTimelineState.sourceEstimateVersion ?? 0);
    setTimelineSourceEstimateUpdatedAt(nextTimelineState.sourceEstimateUpdatedAt ?? '');
    setTimelineSourceEstimateProjectName(nextTimelineState.sourceEstimateProjectName ?? '');
    setTimelineSourceEstimateClientName(nextTimelineState.sourceEstimateClientName ?? '');
    setTimelineSourceEstimateGrandTotal(nextTimelineState.sourceEstimateGrandTotal ?? 0);
  };

  const financePaymentStatusByTimelineGateId = useMemo(() => {
    const statusMap: Record<
      string,
      {
        status: string;
        requiredAmount: number;
        collectedAmount: number;
        outstandingAmount: number;
      }
    > = {};

    financePaymentGateRows.forEach(paymentGate => {
      if (!paymentGate.timeline_gate_id) return;

      statusMap[paymentGate.timeline_gate_id] = {
        status: paymentGate.status ?? 'pending',
        requiredAmount: toTimelineNumber(paymentGate.required_amount),
        collectedAmount: toTimelineNumber(paymentGate.collected_amount),
        outstandingAmount: toTimelineNumber(paymentGate.outstanding_amount),
      };
    });

    return statusMap;
  }, [financePaymentGateRows]);

  const getFinancePaymentBlockerForWorkPackage = useCallback(
    (workPackageId: string) => {
      const blockingGate = paymentGates.find(gate =>
        gate.blocksWorkPackageIds.includes(workPackageId)
      );

      if (!blockingGate) return null;

      const financeStatus =
        financePaymentStatusByTimelineGateId[blockingGate.id];

      if (!financeStatus) {
        return {
          title: 'Finance Payment Not Synced',
          description: `${blockingGate.title} must be synced into Finance and collected before this work action can continue.`,
        };
      }

      const isCollected =
        financeStatus.status === 'paid' ||
        financeStatus.status === 'overpaid' ||
        (financeStatus.requiredAmount > 0 &&
          financeStatus.collectedAmount >= financeStatus.requiredAmount) ||
        financeStatus.outstandingAmount <= 0;

      if (isCollected) return null;

      return {
        title: 'Payment Required',
        description: `${blockingGate.title} is still ${financeStatus.status}. Record and allocate the required cash in Finance before continuing this work action.`,
      };
    },
    [financePaymentStatusByTimelineGateId, paymentGates]
  );

  const canContinueWorkAction = useCallback(
    (workPackageId: string) => {
      const blocker = getFinancePaymentBlockerForWorkPackage(workPackageId);

      if (!blocker) return true;

      setTimelineNoticeDialog(blocker);
      return false;
    },
    [getFinancePaymentBlockerForWorkPackage]
  );

  useEffect(() => {
    if (financePaymentGateRows.length === 0 || paymentGates.length === 0) return;

    setPaymentGates(currentPaymentGates => {
      let didChange = false;

      const nextPaymentGates = currentPaymentGates.map(paymentGate => {
        const financeStatus = financePaymentStatusByTimelineGateId[paymentGate.id];

        if (!financeStatus) return paymentGate;

        const isCollected =
          financeStatus.status === 'paid' ||
          financeStatus.status === 'overpaid' ||
          (financeStatus.requiredAmount > 0 &&
            financeStatus.collectedAmount >= financeStatus.requiredAmount) ||
          financeStatus.outstandingAmount <= 0;

        const nextStatus = isCollected ? 'received' : 'pending';
        const nextReceivedDate = isCollected
          ? paymentGate.receivedDate ?? getTodayDateString()
          : undefined;

        if (
          paymentGate.status === nextStatus &&
          paymentGate.receivedDate === nextReceivedDate
        ) {
          return paymentGate;
        }

        didChange = true;

        return {
          ...paymentGate,
          status: nextStatus as PaymentGate['status'],
          receivedDate: nextReceivedDate,
        };
      });

      return didChange ? nextPaymentGates : currentPaymentGates;
    });

    setWorkPackages(currentWorkPackages => {
      let didChange = false;

      const nextWorkPackages = currentWorkPackages.map(workPackage => {
        if (workPackage.status !== 'blocked_by_payment') return workPackage;

        const blockingGate = paymentGates.find(paymentGate =>
          paymentGate.blocksWorkPackageIds.includes(workPackage.id) ||
          paymentGate.id === workPackage.paymentGateId
        );

        if (!blockingGate) return workPackage;

        const financeStatus = financePaymentStatusByTimelineGateId[blockingGate.id];

        if (!financeStatus) return workPackage;

        const isCollected =
          financeStatus.status === 'paid' ||
          financeStatus.status === 'overpaid' ||
          (financeStatus.requiredAmount > 0 &&
            financeStatus.collectedAmount >= financeStatus.requiredAmount) ||
          financeStatus.outstandingAmount <= 0;

        if (!isCollected) return workPackage;

        const hasIncompleteDependencies = workPackage.dependsOnWorkPackageIds.some(
          dependencyId => {
            const dependency = currentWorkPackages.find(
              candidate => candidate.id === dependencyId
            );

            return dependency?.status !== 'completed';
          }
        );

        didChange = true;

        return {
          ...workPackage,
          status: hasIncompleteDependencies
            ? ('blocked_by_dependency' as const)
            : ('ready' as const),
          notes: appendTimelineNote(
            workPackage.notes,
            `${blockingGate.title} cleared in Finance. Payment blocker released.`
          ),
        };
      });

      return didChange ? nextWorkPackages : currentWorkPackages;
    });
  }, [
    financePaymentGateRows.length,
    financePaymentStatusByTimelineGateId,
    paymentGates,
  ]);

  useEffect(() => {
    let isMounted = true;

    async function fetchFinancePaymentGateRows() {
      if (!selectedTimelineProjectId) {
        setFinancePaymentGateRows([]);
        return;
      }

      const { data, error } = await supabase
        .from('project_finance_payment_gates')
        .select('id, project_id, timeline_gate_id, status, required_amount, collected_amount, outstanding_amount, marked_paid_at, updated_at')
        .eq('project_id', selectedTimelineProjectId)
        .order('gate_order', { ascending: true });

      if (!isMounted) return;

      if (error) {
        console.error('Could not fetch Finance payment gate status for Timeline.', error);
        setFinancePaymentGateRows([]);
        return;
      }

      setFinancePaymentGateRows((data ?? []) as FinanceTimelinePaymentGateRow[]);
    }

    void fetchFinancePaymentGateRows();

    if (!selectedTimelineProjectId) {
      return () => {
        isMounted = false;
      };
    }

    const channel = supabase
      .channel(`timeline-finance-payment-gates-${selectedTimelineProjectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'project_finance_payment_gates',
          filter: `project_id=eq.${selectedTimelineProjectId}`,
        },
        () => {
          void fetchFinancePaymentGateRows();
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      void supabase.removeChannel(channel);
    };
  }, [selectedTimelineProjectId]);


  useEffect(() => {
    let isMounted = true;

    async function hydrateProjectTimelineState() {
      if (!selectedTimelineProjectId) {
        setIsTimelineStateHydrated(false);

        try {
          const latestRemoteTimelineState = await fetchLatestProjectTimelineState();

          if (!isMounted) return;

          if (latestRemoteTimelineState) {
            applyStoredTimelineState(latestRemoteTimelineState);
          }

          setIsTimelineStateHydrated(true);
        } catch (error) {
          console.error('Could not hydrate latest timeline state from Supabase.', error);

          if (isMounted) {
            setIsTimelineStateHydrated(true);
          }
        }

        return;
      }

      setIsTimelineStateHydrated(false);

      try {
        const remoteTimelineState = await fetchProjectTimelineState(
          selectedTimelineProjectId
        );

        if (!isMounted) return;

        if (remoteTimelineState) {
          applyStoredTimelineState(remoteTimelineState);
          setIsTimelineStateHydrated(true);
          return;
        }

        const localTimelineState = getStoredTimelineState();

        if (
          localTimelineState?.selectedTimelineProjectId === selectedTimelineProjectId &&
          (
            localTimelineState.hasTimeline ||
            localTimelineState.paymentGates.length > 0 ||
            localTimelineState.workPackages.length > 0 ||
            Boolean(localTimelineState.sourceEstimateId)
          )
        ) {
          await saveProjectTimelineState({
            projectId: selectedTimelineProjectId,
            hasTimeline: localTimelineState.hasTimeline,
            paymentGates: localTimelineState.paymentGates,
            workPackages: localTimelineState.workPackages,
            timelineConfirmedAt: localTimelineState.timelineConfirmedAt ?? '',
            sourceEstimateId: localTimelineState.sourceEstimateId ?? '',
            sourceEstimateVersion: localTimelineState.sourceEstimateVersion ?? 0,
            sourceEstimateUpdatedAt: localTimelineState.sourceEstimateUpdatedAt ?? '',
            sourceEstimateProjectName: localTimelineState.sourceEstimateProjectName ?? '',
            sourceEstimateClientName: localTimelineState.sourceEstimateClientName ?? '',
            sourceEstimateGrandTotal: localTimelineState.sourceEstimateGrandTotal ?? 0,
          });

          window.localStorage.removeItem(TIMELINE_STORAGE_KEY);
        }

        if (isMounted) {
          setIsTimelineStateHydrated(true);
        }
      } catch (error) {
        console.error('Could not hydrate timeline state from Supabase.', error);

        if (isMounted) {
          setIsTimelineStateHydrated(true);
        }
      }
    }

    void hydrateProjectTimelineState();

    return () => {
      isMounted = false;
    };
  }, [selectedTimelineProjectId]);

  useEffect(() => {
    if (!isTimelineStateHydrated || !selectedTimelineProjectId) return;

    const hasPersistableTimelineState =
      hasTimeline ||
      paymentGates.length > 0 ||
      workPackages.length > 0 ||
      Boolean(timelineSourceEstimateId);

    if (!hasPersistableTimelineState) return;

    const saveTimeout = window.setTimeout(() => {
      void saveProjectTimelineState({
        projectId: selectedTimelineProjectId,
        hasTimeline,
        paymentGates,
        workPackages,
        timelineConfirmedAt,
        sourceEstimateId: timelineSourceEstimateId,
        sourceEstimateVersion: timelineSourceEstimateVersion,
        sourceEstimateUpdatedAt: timelineSourceEstimateUpdatedAt,
        sourceEstimateProjectName: timelineSourceEstimateProjectName,
        sourceEstimateClientName: timelineSourceEstimateClientName,
        sourceEstimateGrandTotal: timelineSourceEstimateGrandTotal,
      }).catch(error => {
        console.error('Could not save timeline state to Supabase.', error);
      });
    }, 450);

    return () => {
      window.clearTimeout(saveTimeout);
    };
  }, [
    hasTimeline,
    isTimelineStateHydrated,
    paymentGates,
    selectedTimelineProjectId,
    timelineConfirmedAt,
    timelineSourceEstimateClientName,
    timelineSourceEstimateGrandTotal,
    timelineSourceEstimateId,
    timelineSourceEstimateProjectName,
    timelineSourceEstimateUpdatedAt,
    timelineSourceEstimateVersion,
    workPackages,
  ]);

  useEffect(() => {
    let isMounted = true;

    async function refreshTimelineSourceData() {
      try {
        const [nextCostEstimateRecords, nextVendorRecords] = await Promise.all([
          fetchTimelineCostEstimateRecords(),
          fetchTimelineVendorRecords(),
        ]);

        if (!isMounted) return;

        setCostEstimateRecords(nextCostEstimateRecords);
        setVendorRecords(nextVendorRecords);
      } catch (error) {
        console.error('Could not refresh timeline source data from Supabase.', error);
      }
    }

    const handleRefreshTimelineSourceData = () => {
      void refreshTimelineSourceData();
    };

    void refreshTimelineSourceData();

    window.addEventListener('focus', handleRefreshTimelineSourceData);
    document.addEventListener('visibilitychange', handleRefreshTimelineSourceData);

    return () => {
      isMounted = false;
      window.removeEventListener('focus', handleRefreshTimelineSourceData);
      document.removeEventListener('visibilitychange', handleRefreshTimelineSourceData);
    };
  }, []);

  useEffect(() => {
    if (!shouldScrollToPendingTimelineReview || !pendingTimelineDraft) return;

    const scrollToReview = () => {
      pendingTimelineReviewRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });

      setShouldScrollToPendingTimelineReview(false);
    };

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(scrollToReview);
    });
  }, [pendingTimelineDraft, shouldScrollToPendingTimelineReview]);

  useEffect(() => {
    if (activeTab !== 'schedule') return;

    const scheduleElement = scheduleScrollRef.current;
    if (!scheduleElement) return;

    const updateScheduleViewportWidth = () => {
      setScheduleViewportWidth(scheduleElement.clientWidth);
    };

    updateScheduleViewportWidth();

    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(updateScheduleViewportWidth)
        : null;

    resizeObserver?.observe(scheduleElement);
    window.addEventListener('resize', updateScheduleViewportWidth);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', updateScheduleViewportWidth);
    };
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== 'schedule') return;

    const scheduleElement = scheduleScrollRef.current;

    if (!scheduleElement) return;

    const handleScheduleWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
        event.stopPropagation();
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const rect = scheduleElement.getBoundingClientRect();
      const cursorX = event.clientX - rect.left;
      const currentScrollLeft = scheduleElement.scrollLeft;
      const direction = event.deltaY > 0 ? -1 : 1;

      setScheduleZoom(currentZoom => {
        const nextZoom = clampScheduleZoom(currentZoom + direction * 0.08);

        if (nextZoom === currentZoom) return currentZoom;

        const currentTotalDays = scheduleTotalDaysRef.current;
        const baseDayWidth = getScheduleBaseDayWidth(
          scheduleViewportWidth || scheduleElement.clientWidth,
          currentTotalDays
        );
        const currentDayWidth = Math.max(1, baseDayWidth * currentZoom);
        const nextDayWidth = Math.max(1, baseDayWidth * nextZoom);
        const zoomRatio = nextDayWidth / Math.max(1, currentDayWidth);

        const effectiveCursorX = Math.max(
          cursorX,
          SCHEDULE_LEFT_COLUMN_WIDTH + 24
        );
        const timelineAnchorBeforeZoom = Math.max(
          0,
          currentScrollLeft + effectiveCursorX - SCHEDULE_LEFT_COLUMN_WIDTH
        );
        const nextScrollLeft =
          SCHEDULE_LEFT_COLUMN_WIDTH +
          timelineAnchorBeforeZoom * zoomRatio -
          effectiveCursorX;

        pendingScheduleScrollLeftRef.current =
          nextZoom <= 1 ? 0 : Math.max(0, nextScrollLeft);

        if (nextZoom <= 1) {
          scheduleElement.scrollLeft = 0;
        }

        return nextZoom;
      });
    };

    scheduleElement.addEventListener('wheel', handleScheduleWheel, {
      passive: false,
    });

    return () => {
      scheduleElement.removeEventListener('wheel', handleScheduleWheel);
    };
  }, [activeTab, scheduleViewportWidth]);

  useLayoutEffect(() => {
    if (activeTab !== 'schedule') return;

    const pendingScrollLeft = pendingScheduleScrollLeftRef.current;
    const scheduleElement = scheduleScrollRef.current;

    if (pendingScrollLeft === null || !scheduleElement) return;

    scheduleElement.scrollLeft = pendingScrollLeft;
    pendingScheduleScrollLeftRef.current = null;
  }, [activeTab, scheduleZoom]);

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

  const paymentGateAmountTotal = paymentGates.reduce(
    (total, paymentGate) => total + paymentGate.amount,
    0
  );

  const activeTimelineProject = useMemo<TimelineProject>(
    () => {
      const shouldUseConfirmedSource = hasTimeline && Boolean(selectedTimelineProjectId);
      const confirmedRevenue =
        timelineSourceEstimateGrandTotal > 0
          ? timelineSourceEstimateGrandTotal
          : paymentGateAmountTotal > 0
            ? paymentGateAmountTotal
            : linkedCostEstimate?.grandTotal ?? 0;

      return {
        ...emptyTimelineProject,
        id:
          (shouldUseConfirmedSource
            ? selectedTimelineProjectId
            : linkedCostEstimate?.projectId ?? selectedTimelineProjectId) ||
          emptyTimelineProject.id,
        name:
          (shouldUseConfirmedSource
            ? timelineSourceEstimateProjectName || linkedCostEstimate?.projectName
            : linkedCostEstimate?.projectName) || emptyTimelineProject.name,
        clientName:
          (shouldUseConfirmedSource
            ? timelineSourceEstimateClientName || linkedCostEstimate?.clientName
            : linkedCostEstimate?.clientName) || emptyTimelineProject.clientName,
        revenue: shouldUseConfirmedSource ? confirmedRevenue : linkedCostEstimate?.grandTotal ?? 0,
        startDate: timelineStartDate || emptyTimelineProject.startDate,
      };
    },
    [
      hasTimeline,
      linkedCostEstimate,
      paymentGateAmountTotal,
      selectedTimelineProjectId,
      timelineSourceEstimateClientName,
      timelineSourceEstimateGrandTotal,
      timelineSourceEstimateProjectName,
      timelineStartDate,
    ]
  );
  const timelineDateRange = useMemo(() => {
    if (workPackages.length === 0) {
      return {
        startDate: activeTimelineProject.startDate,
        endDate: activeTimelineProject.currentProjectedHandoverDate,
      };
    }

    const today = getTodayDateString();

    const startDates = workPackages
      .flatMap(workPackage => [
        workPackage.estimatedStartDate,
        workPackage.actualStartDate,
        ...getWorkPackageDelayScheduleSegments(workPackage, today).map(
          delaySegment => delaySegment.startDate
        ),
      ])
      .filter(Boolean)
      .sort();

    const endDates = workPackages
      .flatMap(workPackage => [
        workPackage.estimatedEndDate,
        workPackage.actualEndDate,
        workPackage.actualStartDate && !workPackage.actualEndDate ? today : undefined,
        ...getWorkPackageDelayScheduleSegments(workPackage, today).map(
          delaySegment => delaySegment.endDate
        ),
      ])
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
  const hasActiveTimeline = hasTimeline && Boolean(selectedTimelineProjectId);
  const hasTimelineSourceUnderRevision = Boolean(
    hasActiveTimeline &&
      linkedCostEstimate &&
      linkedCostEstimate.status !== 'approved'
  );
  const hasTimelineSourceApprovedChange = Boolean(
    hasActiveTimeline &&
      linkedCostEstimate &&
      linkedCostEstimate.status === 'approved' &&
      (timelineSourceEstimateId
        ? timelineSourceEstimateId !== linkedCostEstimate.id ||
          timelineSourceEstimateVersion !== linkedCostEstimate.version ||
          timelineSourceEstimateUpdatedAt !== linkedCostEstimate.updatedAt
        : Math.round(paymentGateAmountTotal) !== Math.round(linkedCostEstimate.grandTotal))
  );
  const isTimelineLockedByEstimateChange =
    hasTimelineSourceUnderRevision || hasTimelineSourceApprovedChange;
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
    Boolean(timelineStartDate) &&
    isPaymentPercentageMatched;

  const handleUpdatePaymentGateDate = (paymentGateId: string, dueDate: string) => {
    setPaymentGates(currentPaymentGates =>
      currentPaymentGates.map(paymentGate =>
        paymentGate.id === paymentGateId
          ? {
              ...paymentGate,
              dueDate,
            }
          : paymentGate
      )
    );

    setPendingTimelineDraft(currentDraft =>
      currentDraft
        ? {
            ...currentDraft,
            paymentGates: currentDraft.paymentGates.map(paymentGate =>
              paymentGate.id === paymentGateId
                ? {
                    ...paymentGate,
                    dueDate,
                  }
                : paymentGate
            ),
          }
        : currentDraft
    );
  };

  const handleAutoAssignPaymentGateDates = () => {
    setPaymentGates(currentPaymentGates =>
      distributePaymentGatesAcrossTimeline(
        currentPaymentGates,
        workPackages,
        timelineStartDate
      )
    );

    setPendingTimelineDraft(currentDraft =>
      currentDraft
        ? {
            ...currentDraft,
            paymentGates: distributePaymentGatesAcrossTimeline(
              currentDraft.paymentGates,
              currentDraft.workPackages,
              timelineStartDate
            ),
          }
        : currentDraft
    );
  };

  const handleApplySuggestion = (alert: TimelineAlert) => {
    setTimelineNoticeDialog({
      title: 'Timeline Assist',
      description: `Timeline shift assistant will be added later. Suggested shift: ${
        alert.suggestedShiftDays ?? 0
      } day(s).`,
    });
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
    const distributedPaymentGates = distributePaymentGatesAcrossTimeline(
      generatedTimeline.paymentGates,
      generatedTimeline.workPackages,
      timelineStartDate
    );
    const distributedTimeline = {
      paymentGates: distributedPaymentGates,
      workPackages: generatedTimeline.workPackages,
      sourceEstimateId: linkedCostEstimate.id,
      sourceEstimateVersion: linkedCostEstimate.version,
      sourceEstimateUpdatedAt: linkedCostEstimate.updatedAt,
      sourceEstimateProjectName: linkedCostEstimate.projectName,
      sourceEstimateClientName: linkedCostEstimate.clientName ?? '',
      sourceEstimateGrandTotal: linkedCostEstimate.grandTotal,
    };

    const today = new Date().toISOString().slice(0, 10);
    const bookingGateId = distributedPaymentGates.find(
      paymentGate => paymentGate.type === 'execution_booking'
    )?.id;

    const preparedTimeline = isBookingPaymentCollected && bookingGateId
      ? {
          paymentGates: markPaymentGateReceived(
            distributedPaymentGates,
            bookingGateId,
            today
          ),
          workPackages: distributedTimeline.workPackages.map(workPackage =>
            workPackage.paymentGateId === bookingGateId &&
            workPackage.status === 'blocked_by_payment'
              ? {
                  ...workPackage,
                  status: getNextStatusAfterPaymentUnlock(
                    workPackage,
                    distributedTimeline.workPackages
                  ),
                  notes: workPackage.notes
                    ? `${workPackage.notes} Booking payment received on ${today}.`
                    : `Booking payment received on ${today}.`,
                }
              : workPackage
          ),
        }
      : distributedTimeline;

    setPendingTimelineDraft(preparedTimeline);
    setIgnoredAlertIds([]);
    setHasTimeline(false);
    setTimelineConfirmedAt('');
    setShowEstimateSourcePicker(false);
    setShowCreateWizard(false);
    setActiveTab('overview');
  };

  const handleSelectTimelineSource = (projectId?: string) => {
    if (!projectId) return;

    const selectedRecord = approvedCostEstimateRecords.find(
      record => record.projectId === projectId
    );

    if (!selectedRecord) return;

    const isChangingSource = selectedTimelineProjectId !== projectId;

    setSelectedTimelineProjectId(projectId);
    setShowEstimateSourcePicker(false);
    setIsContractSigned(false);
    setIsBookingPaymentCollected(false);
    setPendingTimelineDraft(null);
    setTimelineConfirmedAt('');
    setShowCreateWizard(false);
    setActiveTab('overview');

    if (isChangingSource) {
      setPaymentGates([]);
      setWorkPackages([]);
      setHasTimeline(false);
      setIgnoredAlertIds([]);
      setIsPlanningControlsLocked(false);
      setShowPaymentGateControls(false);
      setTimelineSourceEstimateId('');
      setTimelineSourceEstimateVersion(0);
      setTimelineSourceEstimateUpdatedAt('');
      setTimelineSourceEstimateProjectName('');
      setTimelineSourceEstimateClientName('');
      setTimelineSourceEstimateGrandTotal(0);
    }
  };

  const handleUseTimelineDraft = (generatedTimeline: {
    paymentGates: PaymentGate[];
    workPackages: WorkPackage[];
    sourceEstimateId?: string;
    sourceEstimateVersion?: number;
    sourceEstimateUpdatedAt?: string;
    sourceEstimateProjectName?: string;
    sourceEstimateClientName?: string;
    sourceEstimateGrandTotal?: number;
  }) => {
    setPaymentGates(generatedTimeline.paymentGates);
    setWorkPackages(generatedTimeline.workPackages);
    setIgnoredAlertIds([]);
    setHasTimeline(true);
    setTimelineConfirmedAt(new Date().toISOString());
    setTimelineSourceEstimateId(
      generatedTimeline.sourceEstimateId ?? linkedCostEstimate?.id ?? ''
    );
    setTimelineSourceEstimateVersion(
      generatedTimeline.sourceEstimateVersion ?? linkedCostEstimate?.version ?? 0
    );
    setTimelineSourceEstimateUpdatedAt(
      generatedTimeline.sourceEstimateUpdatedAt ?? linkedCostEstimate?.updatedAt ?? ''
    );
    setTimelineSourceEstimateProjectName(
      generatedTimeline.sourceEstimateProjectName ?? linkedCostEstimate?.projectName ?? ''
    );
    setTimelineSourceEstimateClientName(
      generatedTimeline.sourceEstimateClientName ?? linkedCostEstimate?.clientName ?? ''
    );
    setTimelineSourceEstimateGrandTotal(
      generatedTimeline.sourceEstimateGrandTotal ?? linkedCostEstimate?.grandTotal ?? 0
    );
    setShowCreateWizard(false);
    setActiveTab('overview');
  };

  const handleReviseTimeline = async () => {
    if (!hasActiveTimeline) {
      return;
    }

    const latestRecords = await fetchTimelineCostEstimateRecords();
    setCostEstimateRecords(latestRecords);

    const latestLinkedEstimate = getLinkedCostEstimate(
      latestRecords,
      selectedTimelineProjectId
    );
    const sourceEstimate =
      latestLinkedEstimate?.status === 'approved' ? latestLinkedEstimate : linkedCostEstimate;

    if (!sourceEstimate || sourceEstimate.status !== 'approved') {
      setTimelineNoticeDialog({
        title: 'Approved Estimate Required',
        description: 'Approve the revised cost estimate before syncing the timeline.',
      });
      return;
    }

    const generatedTimeline = generateTimelineFromApprovedEstimate({
      source: sourceEstimate,
      startDate: timelineStartDate,
      paymentPercentages: paymentPercentageValues,
    });

    const distributedPaymentGates = distributePaymentGatesAcrossTimeline(
      generatedTimeline.paymentGates,
      generatedTimeline.workPackages,
      timelineStartDate
    );

    const receivedGateTypes = new Set(
      paymentGates
        .filter(paymentGate => paymentGate.status === 'received')
        .map(paymentGate => paymentGate.type)
    );

    const preparedPaymentGates = distributedPaymentGates.map(paymentGate => {
      if (!receivedGateTypes.has(paymentGate.type)) return paymentGate;

      const existingReceivedGate = paymentGates.find(
        currentPaymentGate =>
          currentPaymentGate.type === paymentGate.type &&
          currentPaymentGate.status === 'received'
      );

      return {
        ...paymentGate,
        status: 'received' as const,
        receivedDate:
          existingReceivedGate?.receivedDate ?? new Date().toISOString().slice(0, 10),
      };
    });

    const preparedWorkPackages = generatedTimeline.workPackages.map(workPackage => {
      const relatedPaymentGate = preparedPaymentGates.find(
        paymentGate => paymentGate.id === workPackage.paymentGateId
      );

      if (
        relatedPaymentGate?.status === 'received' &&
        workPackage.status === 'blocked_by_payment'
      ) {
        return {
          ...workPackage,
          status: getNextStatusAfterPaymentUnlock(
            workPackage,
            generatedTimeline.workPackages
          ),
        };
      }

      return workPackage;
    });

    setPendingTimelineDraft({
      paymentGates: preparedPaymentGates,
      workPackages: preparedWorkPackages,
      sourceEstimateId: sourceEstimate.id,
      sourceEstimateVersion: sourceEstimate.version,
      sourceEstimateUpdatedAt: sourceEstimate.updatedAt,
      sourceEstimateProjectName: sourceEstimate.projectName,
      sourceEstimateClientName: sourceEstimate.clientName ?? '',
      sourceEstimateGrandTotal: sourceEstimate.grandTotal,
    });
    setIgnoredAlertIds([]);
    setShowCreateWizard(false);
    setShowEstimateSourcePicker(false);
    setShouldScrollToPendingTimelineReview(true);
    setActiveTab('overview');
  };

  const handleResetTimeline = () => {
    setIsDeleteTimelineDialogOpen(true);
  };

  const handleConfirmDeleteTimeline = async () => {
    if (selectedTimelineProjectId) {
      try {
        await deleteTimelineFinanceGateData(selectedTimelineProjectId);
        await deleteProjectTimelineState(selectedTimelineProjectId);
      } catch (error) {
        console.error('Could not delete timeline state and linked Finance gate data from Supabase.', error);
      }
    }

    window.localStorage.removeItem(TIMELINE_STORAGE_KEY);
    setPaymentGates([]);
    setWorkPackages([]);
    setFinancePaymentGateRows([]);
    setPendingTimelineDraft(null);
    setIgnoredAlertIds([]);
    setHasTimeline(false);
    setTimelineConfirmedAt('');
    setShowCreateWizard(false);
    setShowEstimateSourcePicker(false);
    setIsPlanningControlsLocked(false);
    setShowPaymentGateControls(false);
    setTimelineSourceEstimateId('');
    setTimelineSourceEstimateVersion(0);
    setTimelineSourceEstimateUpdatedAt('');
    setTimelineSourceEstimateProjectName('');
    setTimelineSourceEstimateClientName('');
    setTimelineSourceEstimateGrandTotal(0);
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

  const handleAssignPendingWorkPackageVendor = (
    workPackageId: string,
    vendorId?: string
  ) => {
    const selectedVendor = vendorRecords.find(vendor => vendor.id === vendorId);

    handleUpdatePendingWorkPackage(workPackageId, {
      vendorId: selectedVendor?.id,
      assigneeName: selectedVendor?.name ?? 'Assign Vendor',
    });

    setPendingVendorQuery('');
    setOpenPendingVendorPickerId(null);
  };

  const openPendingVendorPicker = (workPackageId: string) => {
    const button = pendingVendorPickerButtonRefs.current[workPackageId];
    const rect = button?.getBoundingClientRect();

    if (rect) {
      setPendingVendorPickerPosition({
        top: rect.bottom + 8,
        left: rect.left,
        width: Math.max(280, rect.width),
      });
    }

    setPendingVendorQuery('');
    setOpenPendingVendorPickerId(workPackageId);
  };

  const renderPendingVendorPicker = (workPackage: WorkPackage) => {
    const selectedVendor = vendorRecords.find(
      vendor => vendor.id === workPackage.vendorId
    );
    const displayName =
      selectedVendor?.name ?? workPackage.assigneeName ?? 'Assign Vendor';
    const normalizedQuery = pendingVendorQuery.trim().toLowerCase();
    const matchingVendors = vendorRecords
      .filter(vendor => {
        if (vendor.status && vendor.status !== 'active') return false;
        if (!normalizedQuery) return true;

        return [vendor.name, vendor.category, vendor.phone]
          .filter(Boolean)
          .some(value => String(value).toLowerCase().includes(normalizedQuery));
      })
      .slice(0, 8);

    return (
      <div className="relative min-w-0">
        <button
          ref={element => {
            pendingVendorPickerButtonRefs.current[workPackage.id] = element;
          }}
          type="button"
          onClick={() => {
            if (openPendingVendorPickerId === workPackage.id) {
              setOpenPendingVendorPickerId(null);
            } else {
              openPendingVendorPicker(workPackage.id);
            }
          }}
          className="flex min-h-10 w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 text-left text-sm text-foreground transition hover:bg-muted"
        >
          <span className="truncate">{displayName}</span>
          <span className="shrink-0 text-xs text-muted-foreground">Change</span>
        </button>

        {openPendingVendorPickerId === workPackage.id && (
          <div
            className="fixed z-[220] rounded-xl border border-border bg-popover p-2 text-popover-foreground shadow-2xl"
            style={{
              top: pendingVendorPickerPosition.top,
              left: pendingVendorPickerPosition.left,
              width: pendingVendorPickerPosition.width,
            }}
          >
            <input
              value={pendingVendorQuery}
              onChange={event => setPendingVendorQuery(event.target.value)}
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
                    onClick={() =>
                      handleAssignPendingWorkPackageVendor(workPackage.id, vendor.id)
                    }
                    className="flex w-full min-w-0 flex-col rounded-lg px-3 py-2 text-left transition hover:bg-muted"
                  >
                    <span className="truncate text-sm font-medium text-foreground">
                      {vendor.name}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {[vendor.category, vendor.phone].filter(Boolean).join(' - ') ||
                        'Vendor'}
                    </span>
                  </button>
                ))
              ) : (
                <p className="px-3 py-2 text-sm text-muted-foreground">
                  No matching vendors
                </p>
              )}
            </div>

            <div className="mt-2 flex gap-2 border-t border-border pt-2">
              <button
                type="button"
                onClick={() => setOpenPendingVendorPickerId(null)}
                className="flex-1 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground transition hover:bg-muted"
              >
                Close
              </button>

              {workPackage.vendorId && (
                <button
                  type="button"
                  onClick={() =>
                    handleAssignPendingWorkPackageVendor(workPackage.id, undefined)
                  }
                  className="flex-1 rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const handleConfirmPendingTimeline = () => {
    if (!pendingTimelineDraft) return;

    setPaymentGates(pendingTimelineDraft.paymentGates);
    setWorkPackages(pendingTimelineDraft.workPackages);
    setPendingTimelineDraft(null);
    setIgnoredAlertIds([]);
    setHasTimeline(true);
    setTimelineConfirmedAt(new Date().toISOString());
    setTimelineSourceEstimateId(
      pendingTimelineDraft.sourceEstimateId ?? linkedCostEstimate?.id ?? ''
    );
    setTimelineSourceEstimateVersion(
      pendingTimelineDraft.sourceEstimateVersion ?? linkedCostEstimate?.version ?? 0
    );
    setTimelineSourceEstimateUpdatedAt(
      pendingTimelineDraft.sourceEstimateUpdatedAt ?? linkedCostEstimate?.updatedAt ?? ''
    );
    setTimelineSourceEstimateProjectName(
      pendingTimelineDraft.sourceEstimateProjectName ?? linkedCostEstimate?.projectName ?? ''
    );
    setTimelineSourceEstimateClientName(
      pendingTimelineDraft.sourceEstimateClientName ?? linkedCostEstimate?.clientName ?? ''
    );
    setTimelineSourceEstimateGrandTotal(
      pendingTimelineDraft.sourceEstimateGrandTotal ?? linkedCostEstimate?.grandTotal ?? 0
    );
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

  const handleAssignWorkPackageVendor = (workPackageId: string, vendorId?: string) => {
    const selectedVendor = vendorRecords.find(vendor => vendor.id === vendorId);

    setWorkPackages(currentWorkPackages =>
      currentWorkPackages.map(workPackage =>
        workPackage.id === workPackageId
          ? {
              ...workPackage,
              vendorId: selectedVendor?.id,
              assigneeName: selectedVendor?.name ?? 'Assign Vendor',
            }
          : workPackage
      )
    );
  };

  const handleUpdateWorkPackageDependencies = (
    workPackageId: string,
    dependencyIds: string[]
  ) => {
    setWorkPackages(currentWorkPackages => {
      const nextDependencyIds = Array.from(
        new Set(dependencyIds.filter(dependencyId => dependencyId !== workPackageId))
      );

      return currentWorkPackages.map(workPackage => {
        if (workPackage.id !== workPackageId) return workPackage;

        const hasIncompleteDependencies = nextDependencyIds.some(dependencyId => {
          const dependency = currentWorkPackages.find(
            candidate => candidate.id === dependencyId
          );

          return dependency?.status !== 'completed';
        });

        let nextStatus = workPackage.status;

        if (
          hasIncompleteDependencies &&
          ['not_started', 'ready', 'blocked_by_dependency'].includes(workPackage.status)
        ) {
          nextStatus = 'blocked_by_dependency';
        }

        if (!hasIncompleteDependencies && workPackage.status === 'blocked_by_dependency') {
          nextStatus = 'ready';
        }

        return {
          ...workPackage,
          dependsOnWorkPackageIds: nextDependencyIds,
          status: nextStatus,
        };
      });
    });
  };

  const handleStartWorkPackage = (workPackageId: string) => {
    const currentWorkPackage = workPackages.find(
      workPackage => workPackage.id === workPackageId
    );

    if (!currentWorkPackage) return;

    if (currentWorkPackage.status === 'blocked_by_payment') {
      if (!canContinueWorkAction(workPackageId)) return;
    } else if (currentWorkPackage.status === 'blocked_by_dependency') {
      setTimelineNoticeDialog({
        title: 'Work Package Blocked',
        description:
          'This work package is blocked. Clear the dependency blocker before starting work.',
      });
      return;
    } else if (!canContinueWorkAction(workPackageId)) {
      return;
    }

    const today = getTodayDateString();

    setWorkPackages(currentWorkPackages =>
      currentWorkPackages.map(workPackage =>
        workPackage.id === workPackageId
          ? {
              ...workPackage,
              actualStartDate: workPackage.actualStartDate ?? today,
              actualEndDate: undefined,
              actualDurationDays: undefined,
              status: 'in_progress',
              notes: appendTimelineNote(workPackage.notes, `Work started on ${today}.`),
            }
          : workPackage
      )
    );
  };

  const handlePauseWorkPackage = (workPackageId: string) => {
    if (!canContinueWorkAction(workPackageId)) return;

    setTimelineInputDialog({
      mode: 'pause',
      workPackageId,
      title: 'Pause Work Package',
      description: 'Add the reason for pausing this work package.',
      label: 'Pause reason',
      value: '',
      confirmLabel: 'Pause Work',
    });
  };

  const handleResumeWorkPackage = (workPackageId: string) => {
    if (!canContinueWorkAction(workPackageId)) return;

    const today = getTodayDateString();
    const now = new Date().toISOString();

    setWorkPackages(currentWorkPackages =>
      currentWorkPackages.map(workPackage => {
        if (workPackage.id !== workPackageId) return workPackage;

        return {
          ...workPackage,
          status: workPackage.actualStartDate ? 'in_progress' : 'ready',
          pausePeriods: workPackage.pausePeriods.map((pausePeriod, index, array) =>
            index === array.length - 1 && !pausePeriod.pauseEnd
              ? { ...pausePeriod, pauseEnd: today, pauseEndAt: now }
              : pausePeriod
          ),
          notes: appendTimelineNote(workPackage.notes, `Work resumed on ${today}.`),
        };
      })
    );
  };

  const handleCompleteWorkPackage = (workPackageId: string) => {
    const today = getTodayDateString();
    const now = new Date().toISOString();

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
            pausePeriod.pauseEnd
              ? pausePeriod
              : { ...pausePeriod, pauseEnd: today, pauseEndAt: now }
          ),
          notes: appendTimelineNote(workPackage.notes, `Work completed on ${today}.`),
        };
      })
    );
  };

  const handleMarkWorkPackageDelayed = (workPackageId: string) => {
    setIsDelayOwnerPickerOpen(false);

    const currentWorkPackage = workPackages.find(
      workPackage => workPackage.id === workPackageId
    );

    setTimelineInputDialog({
      mode: 'mark_delayed',
      workPackageId,
      title: 'Flag Delay / Risk',
      description:
        'Use this when work is still moving, but it is behind plan or at risk of missing the planned end date.',
      label: 'Delay reason',
      value: currentWorkPackage?.delayInfo?.reason ?? currentWorkPackage?.overrideReason ?? '',
      delayOwner: currentWorkPackage?.delayInfo?.owner ?? 'material',
      delayImpactDays:
        currentWorkPackage?.delayInfo?.impactDays !== undefined
          ? String(currentWorkPackage.delayInfo.impactDays)
          : '1',
      delayExpectedRecoveryDate:
        currentWorkPackage?.delayInfo?.expectedRecoveryDate ??
        currentWorkPackage?.estimatedEndDate ??
        getTodayDateString(),
      confirmLabel: 'Flag Delay',
    });
  };

  const handleUpdateDelayReason = (workPackageId: string) => {
    setIsDelayOwnerPickerOpen(false);

    const currentWorkPackage = workPackages.find(
      workPackage => workPackage.id === workPackageId
    );

    setTimelineInputDialog({
      mode: 'update_delay',
      workPackageId,
      title: 'Update Delay / Risk',
      description:
        'Update the delay source, impact days, recovery date, or reason.',
      label: 'Delay reason',
      value: currentWorkPackage?.delayInfo?.reason ?? currentWorkPackage?.overrideReason ?? '',
      delayOwner: currentWorkPackage?.delayInfo?.owner ?? 'material',
      delayImpactDays:
        currentWorkPackage?.delayInfo?.impactDays !== undefined
          ? String(currentWorkPackage.delayInfo.impactDays)
          : '1',
      delayExpectedRecoveryDate:
        currentWorkPackage?.delayInfo?.expectedRecoveryDate ??
        currentWorkPackage?.estimatedEndDate ??
        getTodayDateString(),
      confirmLabel: 'Save Delay',
    });
  };

  const handleResolveWorkPackageDelay = (workPackageId: string) => {
    const today = getTodayDateString();
    const now = new Date().toISOString();

    setWorkPackages(currentWorkPackages =>
      currentWorkPackages.map(workPackage => {
        if (workPackage.id !== workPackageId) return workPackage;

        const nextDelayInfo = workPackage.delayInfo
          ? {
              ...workPackage.delayInfo,
              id: getDelayInfoId(workPackage.id, workPackage.delayInfo.id),
              status: 'resolved' as const,
              resolvedAt: now,
              updatedAt: now,
            }
          : undefined;

        return {
          ...workPackage,
          status:
            workPackage.status === 'completed'
              ? 'completed'
              : workPackage.actualStartDate
                ? 'in_progress'
                : 'ready',
          overrideReason: undefined,
          delayInfo: nextDelayInfo,
          delayHistory: nextDelayInfo
            ? upsertWorkPackageDelayHistory(workPackage.delayHistory, nextDelayInfo)
            : workPackage.delayHistory,
          notes: appendTimelineNote(workPackage.notes, `Delay resolved on ${today}.`),
        };
      })
    );
  };

  const handleConfirmTimelineInputDialog = () => {
    if (!timelineInputDialog) return;

    const reason = timelineInputDialog.value.trim();

    if (!reason) return;

    const today = getTodayDateString();
    const now = new Date().toISOString();
    const { mode, workPackageId } = timelineInputDialog;

    if (mode === 'pause') {
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
                pauseStartAt: now,
                reason,
                createdBy: 'Admin',
              },
            ],
            notes: appendTimelineNote(workPackage.notes, `Paused on ${today}: ${reason}`),
          };
        })
      );
    }

    if (mode === 'mark_delayed' || mode === 'update_delay') {
      const delayOwner = timelineInputDialog.delayOwner ?? 'material';
      const delayImpactDays = Math.max(
        0,
        Number(timelineInputDialog.delayImpactDays ?? '0') || 0
      );
      const delayExpectedRecoveryDate =
        timelineInputDialog.delayExpectedRecoveryDate || today;

      setWorkPackages(currentWorkPackages =>
        currentWorkPackages.map(workPackage => {
          if (workPackage.id !== workPackageId) return workPackage;

          const flaggedAt = workPackage.delayInfo?.flaggedAt ?? now;
          const delayInfoId = getDelayInfoId(workPackage.id, workPackage.delayInfo?.id);
          const nextDelayInfo = {
            id: delayInfoId,
            reason,
            owner: delayOwner,
            impactDays: delayImpactDays,
            expectedRecoveryDate: delayExpectedRecoveryDate,
            status: 'open' as const,
            flaggedAt,
            updatedAt: now,
          };

          return {
            ...workPackage,
            status: workPackage.status === 'completed' ? workPackage.status : 'delayed',
            overrideReason: reason,
            delayInfo: nextDelayInfo,
            delayHistory: upsertWorkPackageDelayHistory(
              workPackage.delayHistory,
              nextDelayInfo
            ),
            notes: appendTimelineNote(
              workPackage.notes,
              `${mode === 'mark_delayed' ? 'Flagged delay' : 'Updated delay'} on ${today}: ${reason}`
            ),
          };
        })
      );
    }

    setIsDelayOwnerPickerOpen(false);
    setTimelineInputDialog(null);
  };

  const renderGeneratedTimelineReview = () => {
    if (!pendingTimelineDraft) return null;

    const firstStartDate =
      pendingTimelineDraft.workPackages[0]?.estimatedStartDate ?? timelineStartDate;
    const finalEndDate =
      pendingTimelineDraft.workPackages[pendingTimelineDraft.workPackages.length - 1]
        ?.estimatedEndDate ?? firstStartDate;

    return (
      <section
        ref={pendingTimelineReviewRef}
        className="mb-6 scroll-mt-24 overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-sm"
      >
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
              <div className="grid gap-3 lg:grid-cols-[minmax(360px,1fr)_180px_180px_minmax(220px,0.7fr)]">
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
                  {renderPendingVendorPicker(workPackage)}
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
                      {workPackage.estimatedStartDate} -{' '}
                      {workPackage.estimatedEndDate}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <StatusBadge variant="danger">
                      {formatWorkPackageStatusLabel(workPackage.status)}
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

  const renderTimelineSourceSnapshot = () => {
    const selectedSourceLabel = linkedCostEstimate
      ? `${linkedCostEstimate.projectName} - v${linkedCostEstimate.version}`
      : 'No approved estimate selected';
    const selectedClientLabel =
      linkedCostEstimate?.clientName ?? activeTimelineProject.clientName;
    const selectedRevenue = hasActiveTimeline
      ? activeTimelineProject.revenue
      : linkedCostEstimate?.grandTotal ?? activeTimelineProject.revenue;
    const timelineStatusLabel = hasActiveTimeline
      ? 'Confirmed Planned Timeline'
      : pendingTimelineDraft
        ? 'Review Draft Timeline'
        : hasSelectedApprovedProjectEstimate
          ? 'Source Selected'
          : 'Timeline Not Built';
    const timelineStatusVariant = hasActiveTimeline
      ? 'success'
      : pendingTimelineDraft
        ? 'warning'
        : hasSelectedApprovedProjectEstimate
          ? 'info'
          : 'muted';
    const dateRangeLabel = `${formatDate(timelineDateRange.startDate)} - ${formatDate(
      timelineDateRange.endDate
    )}`;
    const sourceDescription = linkedCostEstimate
      ? 'Timeline is linked to the approved estimate below. Change the source only when another approved estimate should drive planning.'
      : 'Choose one approved estimate as the source before building the timeline.';

    const snapshotMetrics = [
      {
        label: 'Work',
        value: `${summary.completedWorkPackages}/${summary.totalWorkPackages}`,
        helper: 'completed',
      },
      {
        label: 'Blocked',
        value: String(summary.blockedWorkPackages),
        helper: 'payment / prerequisite',
      },
      {
        label: 'Payments',
        value: `${summary.receivedPaymentGates}/${paymentGates.length}`,
        helper: 'received',
      },
      {
        label: 'Delayed',
        value: String(summary.delayedWorkPackages),
        helper: `${summary.projectedDelayDays} day(s)`,
      },
    ];

    return (
      <section className="mb-5 overflow-visible rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-foreground">
                Timeline Source & Snapshot
              </p>
              <StatusBadge variant={timelineStatusVariant}>
                {timelineStatusLabel}
              </StatusBadge>
              {hasActiveTimeline && (
                <StatusBadge variant="outline">Baseline Locked</StatusBadge>
              )}
            </div>

            <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
              {sourceDescription}
            </p>
          </div>

          <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowEstimateSourcePicker(current => !current)}
              className="h-9 justify-center gap-2"
              disabled={approvedCostEstimateRecords.length === 0}
            >
              {showEstimateSourcePicker ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
              Change Source
            </Button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <div className="flex h-full flex-col justify-between gap-4 rounded-2xl border border-border bg-background p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-base font-semibold text-foreground">
                    {selectedSourceLabel}
                  </p>
                  <StatusBadge variant={getEstimateStatusVariant(linkedCostEstimate?.status)}>
                    {getEstimateStatusTitle(linkedCostEstimate?.status)}
                  </StatusBadge>
                </div>

                <p className="mt-1 truncate text-sm text-muted-foreground">
                  {selectedClientLabel}
                </p>
              </div>

              <div className="shrink-0 text-left sm:text-right">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  Estimate Value
                </p>
                <p className="mt-1 text-base font-semibold text-foreground">
                  {formatINR(selectedRevenue)}
                </p>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-xl border border-border bg-card/60 px-3 py-2">
                <p className="text-xs text-muted-foreground">Timeline Range</p>
                <p className="mt-1 text-sm font-medium text-foreground">
                  {dateRangeLabel}
                </p>
              </div>

              <div className="rounded-xl border border-border bg-card/60 px-3 py-2">
                <p className="text-xs text-muted-foreground">Estimate Updated</p>
                <p className="mt-1 text-sm font-medium text-foreground">
                  {linkedCostEstimate?.updatedAt
                    ? formatDate(linkedCostEstimate.updatedAt)
                    : 'Not selected'}
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {snapshotMetrics.map(metric => (
              <div
                key={metric.label}
                className="rounded-2xl border border-border bg-background px-4 py-3"
              >
                <p className="text-xs text-muted-foreground">{metric.label}</p>
                <p className="mt-1 text-xl font-semibold text-foreground">
                  {metric.value}
                </p>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {metric.helper}
                </p>
              </div>
            ))}
          </div>
        </div>


      </section>
    );
  };

  const renderEstimateSourcePickerOverlay = () => {
    if (!showEstimateSourcePicker) return null;

    return (
      <div className="fixed inset-0 z-[9990] flex items-end bg-background/70 p-3 backdrop-blur-sm sm:items-center sm:justify-center">
        <button
          type="button"
          aria-label="Close source picker"
          className="absolute inset-0 cursor-default"
          onClick={() => setShowEstimateSourcePicker(false)}
        />

        <div className="relative z-[9991] max-h-[82vh] w-full overflow-hidden rounded-3xl border border-border bg-card text-card-foreground shadow-2xl sm:max-w-2xl">
          <div className="flex items-start justify-between gap-4 border-b border-border px-4 py-4 sm:px-5">
            <div className="min-w-0">
              <p className="text-base font-semibold text-foreground">
                Change Timeline Source
              </p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Choose the approved estimate that should drive this timeline.
              </p>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowEstimateSourcePicker(false)}
              className="shrink-0"
            >
              Close
            </Button>
          </div>

          <div className="max-h-[60vh] overflow-y-auto p-3 sm:p-4">
            <div className="grid gap-2">
              {approvedCostEstimateRecords.length > 0 ? (
                approvedCostEstimateRecords.map(record => {
                  const isSelected = record.projectId === selectedTimelineProjectId;

                  return (
                    <button
                      key={record.id}
                      type="button"
                      onClick={() => handleSelectTimelineSource(record.projectId)}
                      className={`flex min-w-0 flex-col gap-2 rounded-2xl border px-4 py-4 text-left transition ${
                        isSelected
                          ? 'border-emerald-500/60 bg-emerald-500/10 text-foreground'
                          : 'border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      <div className="flex min-w-0 items-center justify-between gap-3">
                        <p className="truncate text-sm font-semibold">
                          {record.projectName}
                        </p>
                        {isSelected ? (
                          <StatusBadge variant="success">Selected</StatusBadge>
                        ) : (
                          <StatusBadge variant={getEstimateStatusVariant(record.status)}>
                            {getEstimateStatusTitle(record.status)}
                          </StatusBadge>
                        )}
                      </div>

                      <div className="grid gap-1 text-xs sm:grid-cols-3">
                        <span className="truncate">
                          {record.clientName ?? 'No client'}
                        </span>
                        <span>Version {record.version}</span>
                        <span className="font-medium text-foreground">
                          {formatINR(record.grandTotal)}
                        </span>
                      </div>
                    </button>
                  );
                })
              ) : (
                <p className="rounded-2xl border border-dashed border-border bg-muted/30 px-4 py-4 text-sm text-muted-foreground">
                  No approved project-linked estimates are available yet.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderScheduleView = () => {
    const timelineStartDate = timelineDateRange.startDate;
    const timelineEndDate = timelineDateRange.endDate;
    const totalDays = getDayDifference(timelineStartDate, timelineEndDate) + 1;
    scheduleTotalDaysRef.current = totalDays;
    const baseDayWidth = getScheduleBaseDayWidth(scheduleViewportWidth, totalDays);
    const dayWidth = Math.max(1, baseDayWidth * scheduleZoom);
    const visibleChartWidth = Math.max(
      1,
      scheduleViewportWidth - SCHEDULE_LEFT_COLUMN_WIDTH
    );
    const scheduleCanvasWidth =
      scheduleZoom <= 1
        ? visibleChartWidth
        : Math.max(
            visibleChartWidth,
            SCHEDULE_CHART_LEFT_PADDING + totalDays * dayWidth + 48
          );
    const scheduleFullWidth = SCHEDULE_LEFT_COLUMN_WIDTH + scheduleCanvasWidth;
    const dateTicks = getScheduleDateTicks(timelineStartDate, totalDays, dayWidth);
    const today = new Date().toISOString().slice(0, 10);
    const todayOffsetDays = getDayDifference(timelineStartDate, today);
    const isTodayInsideSchedule =
      todayOffsetDays >= 0 && todayOffsetDays <= totalDays - 1;
    const todayMarkerLeft =
      SCHEDULE_LEFT_COLUMN_WIDTH +
      SCHEDULE_CHART_LEFT_PADDING +
      todayOffsetDays * dayWidth +
      dayWidth / 2;
    const scheduleZoomPercent = Math.round(scheduleZoom * 100);

    const handleScheduleZoom = (nextZoom: number) => {
      const normalizedZoom = clampScheduleZoom(nextZoom);
      const shouldResetScroll = scheduleZoom <= 1 || normalizedZoom <= 1;

      setScheduleZoom(normalizedZoom);

      if (shouldResetScroll) {
        window.requestAnimationFrame(() => {
          if (scheduleScrollRef.current) {
            scheduleScrollRef.current.scrollLeft = 0;
          }
        });
      }
    };

    return (
      <section className="min-w-0 overflow-hidden rounded-[1.75rem] border border-border bg-card text-card-foreground shadow-sm">
        <div className="border-b border-border bg-card px-4 py-4 sm:px-5">
          <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold text-foreground">
                  Schedule View
                </h2>
                <StatusBadge variant="outline">{activeTimelineProject.name}</StatusBadge>
              </div>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">
                {formatDate(timelineStartDate)} - {formatDate(timelineEndDate)}
                <span className="mx-2 text-muted-foreground/50">/</span>
                {totalDays} day(s)
                <span className="mx-2 text-muted-foreground/50">/</span>
                {formatINR(activeTimelineProject.revenue)}
              </p>

            </div>

            <div className="flex items-center justify-between gap-2 rounded-2xl border border-border bg-background p-1 sm:justify-start">
              <Button
                type="button"
                variant="ghost"
                onClick={() => handleScheduleZoom(scheduleZoom - 0.12)}
                className="h-8 rounded-xl px-3 text-base"
                aria-label="Zoom out schedule"
              >
                -
              </Button>
              <span className="min-w-14 text-center text-xs font-semibold text-muted-foreground">
                {scheduleZoomPercent}%
              </span>
              <Button
                type="button"
                variant="ghost"
                onClick={() => handleScheduleZoom(scheduleZoom + 0.12)}
                className="h-8 rounded-xl px-3 text-base"
                aria-label="Zoom in schedule"
              >
                +
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => handleScheduleZoom(1)}
                className="h-8 rounded-xl px-3 text-xs"
              >
                Reset
              </Button>
            </div>
          </div>
        </div>

        <div
          ref={scheduleScrollRef}
          className="min-w-0 cursor-grab select-none overflow-x-auto overflow-y-hidden overscroll-x-contain bg-background active:cursor-grabbing"
          style={{
            touchAction: 'pan-x',
            overflowX: scheduleZoom <= 1 ? 'hidden' : 'auto',
          }}
          onPointerDown={event => {
            if (event.pointerType === 'touch' || event.button !== 0) return;

            scheduleIsDraggingRef.current = true;
            scheduleDragStartXRef.current = event.clientX;
            scheduleDragStartScrollLeftRef.current = event.currentTarget.scrollLeft;
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={event => {
            if (!scheduleIsDraggingRef.current || scheduleDragStartXRef.current === null) {
              return;
            }

            const deltaX = event.clientX - scheduleDragStartXRef.current;

            event.currentTarget.scrollLeft =
              scheduleDragStartScrollLeftRef.current - deltaX;
          }}
          onPointerUp={event => {
            scheduleIsDraggingRef.current = false;
            scheduleDragStartXRef.current = null;

            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              event.currentTarget.releasePointerCapture(event.pointerId);
            }
          }}
          onPointerCancel={() => {
            scheduleIsDraggingRef.current = false;
            scheduleDragStartXRef.current = null;
          }}
          onTouchStart={event => {
            if (event.touches.length !== 2) return;

            const [firstTouch, secondTouch] = Array.from(event.touches);
            schedulePinchDistanceRef.current = Math.hypot(
              firstTouch.clientX - secondTouch.clientX,
              firstTouch.clientY - secondTouch.clientY
            );
            schedulePinchZoomRef.current = scheduleZoom;
          }}
          onTouchMove={event => {
            if (event.touches.length !== 2 || !schedulePinchDistanceRef.current) {
              return;
            }

            event.preventDefault();

            const [firstTouch, secondTouch] = Array.from(event.touches);
            const nextDistance = Math.hypot(
              firstTouch.clientX - secondTouch.clientX,
              firstTouch.clientY - secondTouch.clientY
            );

            handleScheduleZoom(
              schedulePinchZoomRef.current *
                (nextDistance / schedulePinchDistanceRef.current)
            );
          }}
          onTouchEnd={() => {
            schedulePinchDistanceRef.current = null;
          }}
        >
          <div
            className="relative"
            style={{ width: `${scheduleFullWidth}px` }}
          >

            {isTodayInsideSchedule && (
              <div
                className="pointer-events-none absolute bottom-0 z-[50]"
                style={{ left: `${todayMarkerLeft}px`, top: 0 }}
              >
                <div className="absolute top-[68px] bottom-0 w-[2px] -translate-x-1/2 bg-black/70 dark:bg-white/75" />

                <div className="absolute top-2 flex -translate-x-1/2 flex-col items-center">
                  <span className="mb-1 whitespace-nowrap rounded-full bg-black px-4 py-1.5 text-[12px] font-bold leading-none text-white shadow-md dark:bg-white dark:text-black">
                    {formatScheduleTickDate(today)}
                  </span>

                  <img
                    src="/favicon-v2.png"
                    alt=""
                    className="h-8 w-8 rounded-full object-contain shadow-lg dark:invert"
                  />
                </div>
              </div>
            )}

            {paymentGates.map((paymentGate, paymentGateIndex) => {
              const paymentGateLeft =
                SCHEDULE_LEFT_COLUMN_WIDTH +
                getSchedulePointLeft(paymentGate.dueDate, timelineStartDate, dayWidth);
              const paymentGateTone = getPaymentGateScheduleTone(paymentGateIndex);

              return (
                <div
                  key={`schedule-gate-marker-${paymentGate.id}`}
                  className="pointer-events-none absolute bottom-0 z-[60]"
                  style={{
                    left: `${paymentGateLeft}px`,
                    top: 0,
                  }}
                  title={`${paymentGate.title} - ${formatDate(paymentGate.dueDate)}`}
                >
                  <div
                    className={`absolute top-[74px] bottom-0 w-px -translate-x-1/2 ${paymentGateTone.line}`}
                  />
                  <div
                    className={`absolute top-[48px] flex h-7 w-7 -translate-x-1/2 items-center justify-center rounded-full border border-background text-xs font-bold shadow-md ${paymentGateTone.badge}`}
                  >
                    {paymentGateIndex + 1}
                  </div>
                </div>
              );
            })}

            <div
              className="grid border-b border-border bg-muted/25 text-xs font-medium text-muted-foreground"
              style={{
                gridTemplateColumns: `${SCHEDULE_LEFT_COLUMN_WIDTH}px ${scheduleCanvasWidth}px`,
              }}
            >
              <div className="relative sticky left-0 z-[90] border-r border-b border-border bg-card px-4 py-3">
                <span className="pointer-events-none absolute inset-x-0 bottom-[-2px] z-[95] h-[4px] border-b border-border bg-card" />
                <span className="relative z-[96]">Work Package</span>
              </div>

              <div
                className="relative h-16 bg-muted/20"
                style={{ width: `${scheduleCanvasWidth}px` }}
              >
                {dateTicks.map(tick => (
                  <div
                    key={`${tick.date}-${tick.left}`}
                    className={`absolute bottom-0 top-0 border-l ${
                      tick.isMajor ? 'border-border' : 'border-border/45'
                    }`}
                    style={{ left: `${tick.left}px` }}
                  >
                    <span
                      className={`absolute top-2 whitespace-nowrap text-[11px] font-semibold text-foreground ${
                        tick.isEnd ? 'right-2 text-right' : 'left-2'
                      }`}
                    >
                      {formatScheduleTickDate(tick.date)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              {workPackages.map((workPackage, rowIndex) => {
                const plannedBarStyle = getWorkPackageBarStyle(
                  workPackage,
                  timelineStartDate,
                  dayWidth
                );
                const actualBarStyle = getActualWorkPackageBarStyle(
                  workPackage,
                  timelineStartDate,
                  dayWidth,
                  today
                );
                const actualEndDate = getActualWorkPackageEndDate(workPackage, today);
                const actualSegments = getActualWorkPackageScheduleSegments(
                  workPackage,
                  today
                );
                const delaySegments = getWorkPackageDelayScheduleSegments(
                  workPackage,
                  today
                );

                return (
                  <div
                    key={workPackage.id}
                    className="grid border-b border-border last:border-b-0"
                    style={{
                      gridTemplateColumns: `${SCHEDULE_LEFT_COLUMN_WIDTH}px ${scheduleCanvasWidth}px`,
                    }}
                  >
                    <div className="relative sticky left-0 z-[80] min-w-0 border-r border-t border-border bg-card px-4 py-4">
                      <span className="pointer-events-none absolute inset-x-0 top-[-2px] z-[85] h-[4px] border-t border-border bg-card" />
                      <div className="relative z-[86] flex items-start gap-3">
                        <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border border-border bg-muted text-xs font-semibold text-muted-foreground">
                          {rowIndex + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {workPackage.title}
                          </p>
                          <p className="mt-1 truncate text-xs text-muted-foreground">
                            Assigned to: {workPackage.assigneeName}
                          </p>
                          <p className="mt-1 text-[11px] font-medium text-muted-foreground">
                            Plan: {formatScheduleTickDate(workPackage.estimatedStartDate)} -{' '}
                            {formatScheduleTickDate(workPackage.estimatedEndDate)}
                          </p>
                          <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">
                            Actual:{' '}
                            {workPackage.actualStartDate
                              ? `${formatScheduleTickDate(workPackage.actualStartDate)} - ${
                                  workPackage.actualEndDate
                                    ? formatScheduleTickDate(workPackage.actualEndDate)
                                    : 'Today'
                                }`
                              : 'Not started'}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div
                      className="relative h-[96px] bg-background"
                      style={{ width: `${scheduleCanvasWidth}px` }}
                    >
                      {dateTicks.map(tick => (
                        <div
                          key={`${workPackage.id}-${tick.date}-${tick.left}`}
                          className={`absolute inset-y-0 border-l ${
                            tick.isMajor ? 'border-border/70' : 'border-border/30'
                          }`}
                          style={{ left: `${tick.left}px` }}
                        />
                      ))}

                      {paymentGates.map(paymentGate => {
                        const left = getSchedulePointLeft(
                          paymentGate.dueDate,
                          timelineStartDate,
                          dayWidth
                        );

                        return (
                          <div
                            key={`${workPackage.id}-${paymentGate.id}`}
                            className="absolute inset-y-0 w-px bg-primary/15"
                            style={{ left: `${left}px` }}
                          />
                        );
                      })}

                      <div
                        className="absolute top-6 h-4 rounded-none border border-border/80 bg-muted/80 shadow-sm"
                        style={plannedBarStyle}
                        title={`Planned ${workPackage.title}: ${formatDate(
                          workPackage.estimatedStartDate
                        )} - ${formatDate(workPackage.estimatedEndDate)}`}
                      />

                      {scheduleDisplayMode === 'status' && actualBarStyle ? (
                        <button
                          type="button"
                          onPointerDown={event => event.stopPropagation()}
                          onMouseDown={event => event.stopPropagation()}
                          onTouchStart={event => event.stopPropagation()}
                          onClick={event => {
                            event.stopPropagation();
                            setScheduleDisplayMode('phase');
                          }}
                          className={`group/status-segment absolute bottom-7 h-6 cursor-pointer overflow-visible rounded-none border border-black/10 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${getScheduleBarTone(
                            workPackage.status
                          )}`}
                          style={actualBarStyle}
                          title={`Status ${workPackage.title}: ${formatDate(
                            workPackage.actualStartDate ?? ''
                          )} - ${formatDate(actualEndDate ?? '')}`}
                        >
                          <span className="pointer-events-none absolute bottom-full left-1/2 z-[300] mb-2 -translate-x-1/2 whitespace-nowrap rounded-xl border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-foreground opacity-0 shadow-lg transition group-hover/status-segment:opacity-100">
                            {formatScheduleTickDate(workPackage.actualStartDate ?? '')} -{' '}
                            {formatScheduleTickDate(actualEndDate ?? '')}
                          </span>
                        </button>
                      ) : null}

                      {scheduleDisplayMode === 'phase' ? (
                        <>
                          {actualSegments.map(segment => {
                            const segmentStyle = getScheduleDateRangeBarStyle(
                              segment.startDate,
                              segment.endDate,
                              timelineStartDate,
                              dayWidth
                            );

                            const segmentTitle =
                              segment.kind === 'paused'
                                ? `Paused ${workPackage.title}: ${formatDate(
                                    segment.startDate
                                  )} - ${formatDate(segment.endDate)}`
                                : `Active ${workPackage.title}: ${formatDate(
                                    segment.startDate
                                  )} - ${formatDate(segment.endDate)}`;

                            return (
                              <button
                                key={segment.id}
                                type="button"
                                onPointerDown={event => event.stopPropagation()}
                                onMouseDown={event => event.stopPropagation()}
                                onTouchStart={event => event.stopPropagation()}
                                onClick={event => {
                                  event.stopPropagation();
                                  setScheduleDisplayMode('status');
                                }}
                                className={`group/phase-segment absolute bottom-7 h-6 cursor-pointer overflow-visible rounded-none border border-black/10 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                                  segment.kind === 'paused'
                                    ? 'border-white/25 bg-transparent'
                                    : getActualActiveScheduleBarTone()
                                }`}
                                style={{
                                  ...segmentStyle,
                                  ...(segment.kind === 'paused'
                                    ? {
                                        backgroundImage:
                                          'repeating-linear-gradient(135deg, rgba(245,245,245,0.82) 0 8px, transparent 8px 16px)',
                                      }
                                    : null),
                                }}
                                title={segmentTitle}
                              >
                                <span className="pointer-events-none absolute bottom-full left-1/2 z-[300] mb-2 -translate-x-1/2 whitespace-nowrap rounded-xl border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-foreground opacity-0 shadow-lg transition group-hover/phase-segment:opacity-100">
                                  {segment.kind === 'paused' ? 'Paused' : 'Active'}{' '}
                                  {formatScheduleTickDate(segment.startDate)} -{' '}
                                  {segment.kind === 'paused' &&
                                  workPackage.status === 'paused'
                                    ? 'Ongoing'
                                    : formatScheduleTickDate(segment.endDate)}
                                </span>
                              </button>
                            );
                          })}

                          {delaySegments.map(delaySegment => {
                            const delaySegmentStyle = getScheduleDateRangeBarStyle(
                              delaySegment.startDate,
                              delaySegment.endDate,
                              timelineStartDate,
                              dayWidth
                            );

                            return (
                              <button
                                key={delaySegment.id}
                                type="button"
                                onPointerDown={event => event.stopPropagation()}
                                onMouseDown={event => event.stopPropagation()}
                                onTouchStart={event => event.stopPropagation()}
                                onClick={event => {
                                  event.stopPropagation();
                                  setScheduleDisplayMode('status');
                                }}
                                className="group/delay-segment absolute bottom-7 h-6 cursor-pointer overflow-visible rounded-none border border-red-950/30 bg-gradient-to-r from-red-500 via-rose-500 to-orange-500 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                                style={delaySegmentStyle}
                                title={`Delay ${workPackage.title}: ${formatDate(
                                  delaySegment.startDate
                                )} - ${formatDate(delaySegment.endDate)} - ${
                                  delaySegment.reason
                                }`}
                              >
                                <span className="pointer-events-none absolute bottom-full left-1/2 z-[300] mb-2 -translate-x-1/2 whitespace-nowrap rounded-xl border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-foreground opacity-0 shadow-lg transition group-hover/delay-segment:opacity-100">
                                  Delay {formatScheduleTickDate(delaySegment.startDate)} -{' '}
                                  {delaySegment.status === 'open'
                                    ? 'Ongoing'
                                    : formatScheduleTickDate(delaySegment.endDate)}
                                </span>
                              </button>
                            );
                          })}
                        </>
                      ) : null}

                      <div
                        className="pointer-events-none absolute top-1 z-[40] rounded-lg border border-border bg-card px-2 py-1 text-[11px] font-medium text-muted-foreground shadow-sm"
                        style={{
                          left: `calc(${plannedBarStyle.left} + ${plannedBarStyle.width})`,
                          transform: 'translateX(-100%)',
                        }}
                      >
                        Plan {formatScheduleTickDate(workPackage.estimatedEndDate)}
                      </div>

                      {actualBarStyle && actualEndDate ? (
                        <div
                          className="pointer-events-none absolute bottom-1 z-[40] rounded-lg border border-border bg-card px-2 py-1 text-[11px] font-medium text-muted-foreground shadow-sm"
                          style={{
                            left: `calc(${actualBarStyle.left} + ${actualBarStyle.width})`,
                            transform: 'translateX(-100%)',
                          }}
                        >
                          Actual {formatScheduleTickDate(actualEndDate)}
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="border-t border-border bg-card px-4 py-3 sm:px-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Payment Gate Markers
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Gate markers show scheduled collection points with Finance collection status.
            </p>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {paymentGates.map((paymentGate, paymentGateIndex) => {
              const paymentGateTone = getPaymentGateScheduleTone(paymentGateIndex);
              const financeStatus = financePaymentStatusByTimelineGateId[paymentGate.id];
              const displayStatus = financeStatus?.status ?? paymentGate.status;
              const displayAmount = financeStatus?.requiredAmount ?? paymentGate.amount;
              const collectedAmount = financeStatus?.collectedAmount ?? 0;
              const outstandingAmount =
                financeStatus?.outstandingAmount ?? displayAmount;

              return (
                <div
                  key={paymentGate.id}
                  className="min-w-0 rounded-2xl border border-border bg-background p-3 text-sm text-foreground"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        Gate {paymentGateIndex + 1}
                      </p>
                      <p className="mt-1 truncate font-semibold">
                        {paymentGate.title}
                      </p>
                    </div>

                    <StatusBadge variant={getScheduleFinanceStatusVariant(displayStatus)}>
                      {formatScheduleFinanceStatus(displayStatus)}
                    </StatusBadge>
                  </div>

                  <div className="mt-3 grid gap-2 text-xs text-muted-foreground">
                    <div className="flex items-center justify-between gap-3">
                      <span>Required</span>
                      <span className="font-semibold text-foreground">
                        {formatINR(displayAmount)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <span>Collected</span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        {formatINR(collectedAmount)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <span>Outstanding</span>
                      <span className="font-semibold text-amber-600 dark:text-amber-300">
                        {formatINR(outstandingAmount)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <span>Due</span>
                      <span className="font-semibold text-foreground">
                        {formatScheduleTickDate(paymentGate.dueDate)}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    <span className={`h-2 w-2 rounded-full ${paymentGateTone.badge}`} />
                    <span>{paymentGate.blocksWorkPackageIds.length} blocked package(s)</span>
                  </div>
                </div>
              );
            })}
          </div>
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
          onResolveDelay={handleResolveWorkPackageDelay}
          onUpdatePrerequisites={handleUpdateWorkPackageDependencies}
                    vendors={vendorRecords}
            onAssignVendor={handleAssignWorkPackageVendor}
/>
      );
    }

    if (activeTab === 'payments') {
      return (
        <PaymentGateBar
          paymentGates={paymentGates}
          financePaymentStatuses={financePaymentStatusByTimelineGateId}
          onUpdateDueDate={handleUpdatePaymentGateDate}
          onAutoAssignDueDates={handleAutoAssignPaymentGateDates}
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

      {renderTimelineSourceSnapshot()}
      {renderEstimateSourcePickerOverlay()}
      {isTimelineLockedByEstimateChange && (
        <div className="sticky top-4 z-[120] mb-5 rounded-2xl border border-amber-500/30 bg-card p-4 text-sm text-card-foreground shadow-2xl">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge variant="warning">Timeline Locked</StatusBadge>
                <p className="font-semibold">
                  {hasTimelineSourceUnderRevision
                    ? 'Cost estimate is under revision'
                    : 'Approved estimate has changed'}
                </p>
              </div>
              <p className="mt-1 leading-6 text-muted-foreground">
                The confirmed timeline is kept as a locked baseline. Payment gates and work packages will not update until you approve the revised estimate and sync it into a review draft.
              </p>
            </div>

            <Button
              type="button"
              onClick={handleReviseTimeline}
              disabled={!linkedCostEstimate || linkedCostEstimate.status !== 'approved'}
              className="h-9 shrink-0 justify-center gap-2 bg-foreground text-background hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RotateCcw className="h-4 w-4" />
              Sync Estimate
            </Button>
          </div>
        </div>
      )}

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
                <button
                  type="button"
                  onClick={() => setIsContractSigned(current => !current)}
                  disabled={!isTimelineEstimateApproved}
                  className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border px-4 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
                    isContractSigned
                      ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 dark:border-emerald-400/40 dark:bg-emerald-500/15 dark:text-emerald-200 dark:hover:bg-emerald-500/20'
                      : 'border-border bg-background text-foreground hover:bg-muted'
                  }`}
                >
                  <span className="inline-flex items-center gap-3">
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] ${
                        isContractSigned
                          ? 'border-white/70 bg-white/20 text-white dark:border-emerald-300 dark:bg-emerald-400 dark:text-black'
                          : 'border-muted-foreground/60'
                      }`}
                    >
                      {isContractSigned ? (
                        <Check className="h-3 w-3" />
                      ) : null}
                    </span>
                    <span className="text-sm font-medium">
                      Contract Signed
                    </span>
                  </span>

                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-current/70">
                    {isContractSigned ? 'Selected' : 'Required'}
                  </span>
                </button>

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

      {timelineNoticeDialog && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/45 px-4 backdrop-blur-sm">
          <div
            className="rounded-[2rem] border border-border bg-card p-6 text-card-foreground shadow-2xl"
            style={{
              width:
                timelineInputDialog?.mode === 'mark_delayed' ||
                timelineInputDialog?.mode === 'update_delay'
                  ? 'min(920px, calc(100vw - 32px))'
                  : 'min(32rem, calc(100vw - 32px))',
            }}
          >
            <div>
              <p className="text-lg font-semibold text-foreground">
                {timelineNoticeDialog.title}
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {timelineNoticeDialog.description}
              </p>
            </div>

            <div className="mt-6 flex justify-end">
              <Button
                type="button"
                onClick={() => setTimelineNoticeDialog(null)}
              >
                OK
              </Button>
            </div>
          </div>
        </div>
      )}

      {timelineInputDialog && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/45 px-4 backdrop-blur-sm">
          <div className="w-full max-w-[920px] rounded-[2rem] border border-border bg-card p-6 text-card-foreground shadow-2xl">
            <div>
              <p className="text-lg font-semibold text-foreground">
                {timelineInputDialog.title}
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {timelineInputDialog.description}
              </p>
            </div>

            {timelineInputDialog.mode === 'mark_delayed' ||
            timelineInputDialog.mode === 'update_delay' ? (
              <>
                <div className="mt-5 grid gap-3 md:grid-cols-[minmax(320px,1fr)_96px_220px]">
                  <div className="relative grid gap-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Delay Source
                    </span>

                    <button
                      type="button"
                      onClick={() => setIsDelayOwnerPickerOpen(current => !current)}
                      className="flex h-11 w-full items-center justify-between gap-3 rounded-2xl border border-border bg-background px-3 text-left text-sm font-medium text-foreground outline-none transition hover:border-foreground/40"
                    >
                      <span className="truncate">
                        {getTimelineDelayOwnerLabel(
                          timelineInputDialog.delayOwner ?? 'material'
                        )}
                      </span>
                      <span
                        aria-hidden="true"
                        className={`h-2 w-2 shrink-0 border-b border-r border-muted-foreground transition ${
                          isDelayOwnerPickerOpen ? '-rotate-135' : 'rotate-45'
                        }`}
                      />
                    </button>

                    {isDelayOwnerPickerOpen && (
                      <div className="absolute left-0 right-0 top-full z-[10020] mt-2 overflow-hidden rounded-2xl border border-border bg-popover p-1 text-popover-foreground shadow-2xl">
                        {timelineDelayOwnerOptions.map(option => {
                          const isSelected =
                            (timelineInputDialog.delayOwner ?? 'material') === option.value;

                          return (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => {
                                setTimelineInputDialog(current =>
                                  current
                                    ? {
                                        ...current,
                                        delayOwner: option.value,
                                      }
                                    : current
                                );
                                setIsDelayOwnerPickerOpen(false);
                              }}
                              className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium transition ${
                                isSelected
                                  ? 'bg-foreground text-background'
                                  : 'hover:bg-muted'
                              }`}
                            >
                              <span className="truncate">{option.label}</span>
                              {isSelected ? (
                                <span
                                  aria-hidden="true"
                                  className="h-1.5 w-1.5 shrink-0 rounded-full bg-current"
                                />
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <label className="grid gap-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Impact
                    </span>
                    <input
                      type="number"
                      min="0"
                      value={timelineInputDialog.delayImpactDays ?? ''}
                      onChange={event =>
                        setTimelineInputDialog(current =>
                          current
                            ? {
                                ...current,
                                delayImpactDays: event.target.value,
                              }
                            : current
                        )
                      }
                      className="h-11 w-full rounded-2xl border border-border bg-background px-3 text-center text-sm font-semibold text-foreground outline-none transition focus:border-foreground"
                      placeholder="0"
                    />
                  </label>

                  <label className="grid min-w-0 gap-2 md:w-[220px]">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Recovery Date
                    </span>
                    <DateInput
                      value={timelineInputDialog.delayExpectedRecoveryDate ?? ''}
                      onChange={value =>
                        setTimelineInputDialog(current =>
                          current
                            ? {
                                ...current,
                                delayExpectedRecoveryDate: value,
                              }
                            : current
                        )
                      }
                      placeholder="Select date"
                      popoverMode="fixed"
                    />
                  </label>
                </div>

                <label className="mt-4 grid gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Delay Reason
                  </span>
                  <textarea
                    value={timelineInputDialog.value}
                    onChange={event =>
                      setTimelineInputDialog(current =>
                        current
                          ? {
                              ...current,
                              value: event.target.value,
                            }
                          : current
                      )
                    }
                    rows={3}
                    autoFocus
                    className="min-h-24 w-full resize-none rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:border-foreground"
                    placeholder="Enter reason..."
                  />
                </label>
              </>
            ) : (
              <label className="mt-5 grid gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  {timelineInputDialog.label}
                </span>
                <textarea
                  value={timelineInputDialog.value}
                  onChange={event =>
                    setTimelineInputDialog(current =>
                      current
                        ? {
                            ...current,
                            value: event.target.value,
                          }
                        : current
                    )
                  }
                  rows={4}
                  autoFocus
                  className="min-h-28 resize-none rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:border-foreground"
                  placeholder="Enter reason..."
                />
              </label>
            )}

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsDelayOwnerPickerOpen(false);
                  setTimelineInputDialog(null);
                }}
              >
                Cancel
              </Button>

              <Button
                type="button"
                onClick={handleConfirmTimelineInputDialog}
                disabled={!timelineInputDialog.value.trim()}
              >
                {timelineInputDialog.confirmLabel}
              </Button>
            </div>
          </div>
        </div>
      )}

      {isDeleteTimelineDialogOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/45 px-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[2rem] border border-border bg-card p-6 text-card-foreground shadow-2xl">
            <div>
              <p className="text-lg font-semibold text-foreground">
                Delete Timeline?
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                This will remove the confirmed planned timeline and clear the linked Finance payment gates, cash receipt allocations, and gate receipt records for this timeline. Vendor and item masters will not be deleted.
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

