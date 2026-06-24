import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { ChangeEvent, MouseEvent } from 'react';
import { ArrowLeft, Check, ChevronDown, ExternalLink, FileText, MoreHorizontal, Pencil, Plus, Search, Trash2, UploadCloud, X,
} from 'lucide-react';
import { exportDesignEstimatePdf } from '@/features/cost-estimate/export';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { useAuth } from '../../contexts/AuthContext';
import { supabase, type Lead, type Project, type ProjectCheckpoint, type ProjectDocument } from '../../lib/supabase';
import { canManagePage } from '../../lib/pagePermissions';
import type { ProjectWorkspaceMode } from './projectTypes';
import { ensureProjectCheckpoints, sortProjectCheckpoints, updateProjectCheckpoint } from './projectCheckpoints';

interface ProjectWorkspaceProps {
  mode: ProjectWorkspaceMode;
}

const STATUS_STYLES: Record<string, string> = {
  Active: 'border-emerald-300/80 bg-emerald-500/35 text-emerald-950 dark:text-emerald-50',
  Completed: 'border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300',
  'On Hold': 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  Cancelled: 'border-destructive/20 bg-destructive/10 text-destructive',
};

const PROJECT_STATUSES = ['All Statuses', 'Active', 'Completed', 'On Hold', 'Cancelled'] as const;
const PROJECT_FORM_STATUSES = ['Active', 'Completed', 'On Hold', 'Cancelled'] as const;

type ProjectStatus = (typeof PROJECT_FORM_STATUSES)[number];
type ProjectStatusFilter = (typeof PROJECT_STATUSES)[number];

type FloatingMenuState =
  | { type: 'status-filter'; top: number; left: number; width: number }
  | { type: 'project-status'; top: number; left: number; width: number }
  | { type: 'project-actions'; top: number; right: number; project: Project };


interface ProjectFormState {
  name: string;
  client: string;
  status: ProjectStatus;
  description: string;
}

const EMPTY_PROJECT_FORM: ProjectFormState = {
  name: '',
  client: '',
  status: 'Active',
  description: '',
};

type ProjectDocumentForm = {
  name: string;
  document_url: string;
  category: string;
  notes: string;
};

type ProjectTimelineWorkPackageSummary = {
  id: string;
  title: string;
  status: string;
  actualEndDate: string | null;
  estimatedEndDate: string | null;
};

type ProjectTimelineSummary = {
  project_id: string;
  has_timeline: boolean;
  timeline_confirmed_at: string | null;
  work_packages: ProjectTimelineWorkPackageSummary[];
};

type ProjectCostEstimateStatus = 'draft' | 'approved' | 'revision';

type ProjectCostEstimateSummary = {
  project_id: string;
  status: ProjectCostEstimateStatus;
  version: number;
  updated_at: string | null;
};

type ProjectFinanceSummary = {
  project_id: string;
  source_estimate_id: string | null;
  source_estimate_version: number | null;
  last_synced_at: string | null;
  updated_at: string | null;
};

type ProjectStageAction = {
  label: string;
  description: string;
  lockedReason: string;
  isAvailable: boolean;
  to: string | null;
  statusLabel: string;
  checkpointKey?: ProjectCheckpoint['checkpoint_key'];
};

const EMPTY_PROJECT_DOCUMENT_FORM: ProjectDocumentForm = {
  name: '',
  document_url: '',
  category: 'Project Document',
  notes: '',
};

const DESIGN_PHASE_WORKFLOW_STATUSES = [
  'waiting',
  'in_progress',
  'approved',
  'bypassed',
] as const;

type DesignPhaseWorkflowStatus = (typeof DESIGN_PHASE_WORKFLOW_STATUSES)[number];

const DESIGN_PHASE_STATUS_STYLES: Record<DesignPhaseWorkflowStatus, string> = {
  waiting: 'border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  in_progress: 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  approved: 'border-[#00E676]/90 bg-[#00D084]/40 text-[#E9FFF4] shadow-[0_0_26px_rgba(0,208,132,0.24)]',
  bypassed: 'border-zinc-500/20 bg-zinc-500/10 text-zinc-600 dark:text-zinc-300',
};

const DESIGN_ESTIMATE_UNITS = ['view', '360'] as const;

type DesignEstimateUnit = (typeof DESIGN_ESTIMATE_UNITS)[number];

type DesignEstimateLineForm = {
  id: string;
  serviceName: string;
  unit: DesignEstimateUnit;
  quantity: string;
  rate: string;
};

function createDesignEstimateLineId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `design-estimate-line-${crypto.randomUUID()}`;
  }

  return `design-estimate-line-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createEmptyDesignEstimateLine(
  overrides: Partial<DesignEstimateLineForm> = {}
): DesignEstimateLineForm {
  return {
    id: createDesignEstimateLineId(),
    serviceName: '',
    unit: 'view',
    quantity: '1',
    rate: '',
    ...overrides,
  };
}

type CheckpointDetailTextField =
  | 'notes'
  | 'clientRequirements'
  | 'siteMeasurements'
  | 'customRequirements'
  | 'designApprovalNotes'
  | 'designEstimateNotes'
  | 'designBypassReason'
  | 'designServiceScope'
  | 'designFeeAmount'
  | 'designServiceEstimateNotes';

type ClientRequirementOutputUnit = string;

type ClientRequirementMeasurementForm = {
  id: string;
  widthCm: string;
  heightCm: string;
  lengthCm: string;
  quantity: string;
};

type ClientRequirementRowForm = {
  id: string;
  areaName: string;
  itemId: string;
  itemName: string;
  outputUnit: ClientRequirementOutputUnit;
  measurements: ClientRequirementMeasurementForm[];
  notes: string;
  unit: string;
  quantity: string;
};

type SavedClientRequirementMeasurementRow = {
  id: string;
  width_cm: number | null;
  height_cm: number | null;
  length_cm: number | null;
  quantity: number | null;
  area_sqm: number;
  area_sqft: number;
  length_rft: number;
};

type SavedClientRequirementRow = {
  id: string;
  area_name: string;
  item_id: string | null;
  item_name: string;
  unit: string;
  output_unit: ClientRequirementOutputUnit;
  quantity: number | null;
  calculated_quantity: number | null;
  measurement_rows: SavedClientRequirementMeasurementRow[];
  notes: string;
};


type SiteVisitProcurementItemOption = {
  id: string;
  name: string;
  defaultUnitLabel: string;
  sellingRatePerUnit: number;
  defaultDescription: string;
};


function createWorkspaceLocalId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createEmptyClientRequirementMeasurement(): ClientRequirementMeasurementForm {
  return {
    id: createWorkspaceLocalId('client-measurement'),
    widthCm: '',
    heightCm: '',
    lengthCm: '',
    quantity: '1',
  };
}

function createEmptyClientRequirementRow(): ClientRequirementRowForm {
  return {
    id: createWorkspaceLocalId('client-requirement'),
    areaName: '',
    itemId: '',
    itemName: '',
    outputUnit: 'sqft',
    measurements: [createEmptyClientRequirementMeasurement()],
    notes: '',
    unit: 'sqft',
    quantity: '',
  };
}

interface CheckpointDetailForm {
  notes: string;
  clientRequirements: string;
  clientRequirementRows: ClientRequirementRowForm[];
  siteMeasurements: string;
  customRequirements: string;
  designApprovalNotes: string;
  designEstimateNotes: string;
  designBypassReason: string;
  designServiceScope: string;
  designFeeAmount: string;
  designServiceEstimateNotes: string;
  designEstimateRows: DesignEstimateLineForm[];
  designEstimateApproved: boolean;
  designPhaseStatus: DesignPhaseWorkflowStatus;
  executionCompletionNotes: string;
  executionPendingWorks: string;
  executionHandoverReadiness: string;
  qcChecklistNotes: string;
  qcSnagList: string;
  qcReportNotes: string;
  handoverClientConfirmation: string;
  handoverDocuments: string;
  warrantyNotes: string;
  finalHandoverNotes: string;
}

const EMPTY_CHECKPOINT_DETAIL_FORM: CheckpointDetailForm = {
  notes: '',
  clientRequirements: '',
  clientRequirementRows: [],
  siteMeasurements: '',
  customRequirements: '',
  designApprovalNotes: '',
  designEstimateNotes: '',
  designBypassReason: '',
  designServiceScope: '',
  designFeeAmount: '',
  designServiceEstimateNotes: '',
  designEstimateRows: [createEmptyDesignEstimateLine()],
  designEstimateApproved: false,
  designPhaseStatus: 'waiting',
  executionCompletionNotes: '',
  executionPendingWorks: '',
  executionHandoverReadiness: '',
  qcChecklistNotes: '',
  qcSnagList: '',
  qcReportNotes: '',
  handoverClientConfirmation: '',
  handoverDocuments: '',
  warrantyNotes: '',
  finalHandoverNotes: '',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function toSafeString(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function hasText(value: string) {
  return value.trim().length > 0;
}

function formatINR(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function getNumericInputValue(value: string) {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.max(0, amount) : 0;
}

function calculateDesignEstimateRowTotal(row: DesignEstimateLineForm) {
  return getNumericInputValue(row.quantity) * getNumericInputValue(row.rate);
}

function getCompactDesignEstimateRows(rows: DesignEstimateLineForm[]) {
  return rows
    .map(row => ({
      id: row.id || createDesignEstimateLineId(),
      serviceName: row.serviceName.trim(),
      unit: DESIGN_ESTIMATE_UNITS.includes(row.unit) ? row.unit : 'view',
      quantity: String(getNumericInputValue(row.quantity) || 0),
      rate: String(getNumericInputValue(row.rate) || 0),
    }))
    .filter(row =>
      hasText(row.serviceName) ||
      getNumericInputValue(row.quantity) > 0 ||
      getNumericInputValue(row.rate) > 0
    );
}

function getValidDesignEstimateRows(rows: DesignEstimateLineForm[]) {
  return getCompactDesignEstimateRows(rows).filter(row =>
    hasText(row.serviceName) &&
    getNumericInputValue(row.quantity) > 0 &&
    getNumericInputValue(row.rate) > 0
  );
}

function calculateDesignEstimateTotal(rows: DesignEstimateLineForm[]) {
  return rows.reduce(
    (total, row) => total + calculateDesignEstimateRowTotal(row),
    0
  );
}

function getDesignEstimateRowsFromMetadata(
  metadata: Record<string, unknown>
): DesignEstimateLineForm[] {
  const storedRows = metadata.design_estimate_rows ?? metadata.designEstimateRows;

  if (Array.isArray(storedRows)) {
    const rows = storedRows
      .filter(isRecord)
      .map(row => {
        const unit = toSafeString(row.unit).toLowerCase();

        return createEmptyDesignEstimateLine({
          id: toSafeString(row.id) || createDesignEstimateLineId(),
          serviceName: toSafeString(row.serviceName ?? row.service_name ?? row.name),
          unit: unit === '360' ? '360' : 'view',
          quantity: toSafeString(row.quantity ?? row.qty) || '1',
          rate: toSafeString(row.rate ?? row.ratePerUnit ?? row.rate_per_unit),
        });
      });

    if (rows.length > 0) return rows;
  }

  const legacyScope = toSafeString(
    metadata.design_service_scope ?? metadata.designServiceScope
  );
  const legacyFee = toSafeString(
    metadata.design_fee_amount ?? metadata.designFeeAmount
  );

  if (hasText(legacyScope) || hasText(legacyFee)) {
    return [
      createEmptyDesignEstimateLine({
        serviceName: legacyScope,
        unit: 'view',
        quantity: '1',
        rate: legacyFee,
      }),
    ];
  }

  return [createEmptyDesignEstimateLine()];
}

function getCheckpointMetadata(checkpoint: ProjectCheckpoint) {
  return isRecord(checkpoint.metadata) ? checkpoint.metadata : {};
}

function getSafeDocumentUrl(value: string | null | undefined) {
  const trimmed = (value || '').trim();

  if (!trimmed) return '';

  try {
    const parsed = new URL(trimmed);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.toString() : '';
  } catch {
    return '';
  }
}

function getProjectDocumentTitle(document: ProjectDocument, index: number) {
  return document.name?.trim() || `Project Document ${index + 1}`;
}

function getProjectDocumentCategory(document: ProjectDocument) {
  return document.category?.trim() || 'Project Document';
}

function getProjectDocumentPreviewUrl(document: ProjectDocument) {
  if (document.drive_file_id) {
    return `https://drive.google.com/file/d/${document.drive_file_id}/preview`;
  }

  return document.document_url;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not read selected file.'));
    reader.readAsDataURL(file);
  });
}

function getBase64Payload(dataUrl: string) {
  return dataUrl.includes(',') ? dataUrl.split(',').pop() || '' : dataUrl;
}

function getDesignPhaseWorkflowStatus(
  checkpoint: ProjectCheckpoint,
  metadata: Record<string, unknown>
): DesignPhaseWorkflowStatus {
  const storedStatus = toSafeString(metadata.design_phase_status ?? metadata.designPhaseStatus);

  if (
    DESIGN_PHASE_WORKFLOW_STATUSES.includes(
      storedStatus as DesignPhaseWorkflowStatus
    )
  ) {
    return storedStatus as DesignPhaseWorkflowStatus;
  }

  if (checkpoint.status === 'skipped') return 'bypassed';
  if (checkpoint.status === 'completed') return 'approved';

  return 'waiting';
}

function getDesignPhaseStatusLabel(status: DesignPhaseWorkflowStatus) {
  switch (status) {
    case 'waiting':
      return 'Waiting';
    case 'in_progress':
      return 'In-Progress';
    case 'approved':
      return 'Approved';
    case 'bypassed':
      return 'Bypassed';
    default:
      return 'Waiting';
  }
}

const CLIENT_REQUIREMENT_SQFT_PER_SQM = 10.7639104167;
const CLIENT_REQUIREMENT_CM_PER_RFT = 30.48;
const DEFAULT_SITE_VISIT_UNITS = ['sqft', 'sqm', 'rft', 'set'];

const SITE_VISIT_QUICK_AREA_OPTIONS = [
  'Living Area',
  'Dining Area',
  'Kitchen',
  'Utility',
  'Balcony',
  'Prayer Room',
  'Patio',
  'Porch',
  'Deck',
] as const;

function normalizeSiteVisitAreaName(value: string) {
  const trimmedValue = value.trim();
  const normalizedValue = trimmedValue.toLowerCase();

  if (normalizedValue === 'living room') return 'Living Area';
  if (normalizedValue === 'dining room') return 'Dining Area';

  return trimmedValue;
}

function normalizeClientRequirementUnit(value: string) {
  const normalizedValue = value.trim().toLowerCase();

  if (!normalizedValue) return 'sqft';
  if (['sq ft', 'sq.ft', 'sft'].includes(normalizedValue)) return 'sqft';
  if (['sq m', 'sq.m', 'm2', 'm?'].includes(normalizedValue)) return 'sqm';
  if (['running feet', 'running foot', 'linear feet', 'linear foot'].includes(normalizedValue)) return 'rft';
  if (['nos', 'no', 'number', 'numbers', 'piece', 'pieces', 'pcs'].includes(normalizedValue)) return 'nos';
  if (['each', 'ea'].includes(normalizedValue)) return 'each';

  return normalizedValue;
}

function getClientRequirementOutputUnitFromLabel(value: string): ClientRequirementOutputUnit {
  return normalizeClientRequirementUnit(value);
}

function getClientRequirementUnitMode(unit: string) {
  const normalizedUnit = normalizeClientRequirementUnit(unit);

  if (['sqft', 'sqm'].includes(normalizedUnit)) return 'area';
  if (['rft', 'ft', 'feet', 'foot', 'm', 'meter', 'metre', 'cm', 'mm', 'inch', 'in'].includes(normalizedUnit)) {
    return 'linear';
  }

  return 'count';
}

function getMeasurementNumber(value: string) {
  const numericValue = Number(value);

  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : 0;
}

function roundSiteVisitMeasurement(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 0;

  return Math.round(value * 100) / 100;
}

function calculateMeasurementAreaSqm(measurement: ClientRequirementMeasurementForm) {
  const widthCm = getMeasurementNumber(measurement.widthCm);
  const heightCm = getMeasurementNumber(measurement.heightCm);

  if (widthCm <= 0 || heightCm <= 0) return 0;

  return (widthCm * heightCm) / 10000;
}

function calculateClientRequirementAreaSqm(row: ClientRequirementRowForm) {
  return row.measurements.reduce(
    (total, measurement) => total + calculateMeasurementAreaSqm(measurement),
    0
  );
}

function convertClientRequirementArea(
  areaSqm: number,
  outputUnit: ClientRequirementOutputUnit
) {
  return normalizeClientRequirementUnit(outputUnit) === 'sqm'
    ? areaSqm
    : areaSqm * CLIENT_REQUIREMENT_SQFT_PER_SQM;
}

function convertClientRequirementLength(
  lengthCm: number,
  outputUnit: ClientRequirementOutputUnit
) {
  const unit = normalizeClientRequirementUnit(outputUnit);

  if (unit === 'cm') return lengthCm;
  if (unit === 'mm') return lengthCm * 10;
  if (unit === 'm' || unit === 'meter' || unit === 'metre') return lengthCm / 100;
  if (unit === 'inch' || unit === 'in') return lengthCm / 2.54;

  return lengthCm / CLIENT_REQUIREMENT_CM_PER_RFT;
}

function calculateClientRequirementMeasurementQuantity(
  measurement: ClientRequirementMeasurementForm,
  outputUnit: ClientRequirementOutputUnit
) {
  const unitMode = getClientRequirementUnitMode(outputUnit);

  if (unitMode === 'area') {
    return convertClientRequirementArea(
      calculateMeasurementAreaSqm(measurement),
      outputUnit
    );
  }

  if (unitMode === 'linear') {
    return convertClientRequirementLength(
      getMeasurementNumber(measurement.lengthCm),
      outputUnit
    );
  }

  return getMeasurementNumber(measurement.quantity);
}

function getClientRequirementCalculatedQuantity(row: ClientRequirementRowForm) {
  const measuredQuantity = row.measurements.reduce(
    (total, measurement) =>
      total + calculateClientRequirementMeasurementQuantity(measurement, row.outputUnit),
    0
  );

  if (measuredQuantity > 0) return roundSiteVisitMeasurement(measuredQuantity);

  const legacyQuantity = Number(row.quantity);

  return Number.isFinite(legacyQuantity) && legacyQuantity > 0
    ? roundSiteVisitMeasurement(legacyQuantity)
    : 0;
}

function getClientRequirementMeasurementRows(rawRows: unknown) {
  if (!Array.isArray(rawRows)) return [];

  return rawRows
    .map(row => {
      const record =
        row && typeof row === 'object' ? (row as Record<string, unknown>) : {};

      return {
        id: toSafeString(record.id) || createWorkspaceLocalId('client-measurement'),
        widthCm: toSafeString(record.width_cm ?? record.widthCm),
        heightCm: toSafeString(record.height_cm ?? record.heightCm),
        lengthCm: toSafeString(record.length_cm ?? record.lengthCm),
        quantity: toSafeString(record.quantity) || '1',
      };
    })
    .filter(row => row.widthCm || row.heightCm || row.lengthCm || row.quantity);
}

function getCompactClientRequirementMeasurements(
  measurements: ClientRequirementMeasurementForm[]
): SavedClientRequirementMeasurementRow[] {
  return measurements
    .map(measurement => {
      const widthCm = getMeasurementNumber(measurement.widthCm);
      const heightCm = getMeasurementNumber(measurement.heightCm);
      const lengthCm = getMeasurementNumber(measurement.lengthCm);
      const quantity = getMeasurementNumber(measurement.quantity);
      const areaSqm = calculateMeasurementAreaSqm(measurement);

      return {
        id: measurement.id || createWorkspaceLocalId('client-measurement'),
        width_cm: widthCm > 0 ? widthCm : null,
        height_cm: heightCm > 0 ? heightCm : null,
        length_cm: lengthCm > 0 ? lengthCm : null,
        quantity: quantity > 0 ? quantity : null,
        area_sqm: roundSiteVisitMeasurement(areaSqm),
        area_sqft: roundSiteVisitMeasurement(areaSqm * CLIENT_REQUIREMENT_SQFT_PER_SQM),
        length_rft: roundSiteVisitMeasurement(lengthCm / CLIENT_REQUIREMENT_CM_PER_RFT),
      };
    })
    .filter(
      measurement =>
        measurement.width_cm !== null ||
        measurement.height_cm !== null ||
        measurement.length_cm !== null ||
        measurement.quantity !== null ||
        measurement.area_sqm > 0
    );
}

function getSiteVisitUnitLabelFromRecord(record: Record<string, unknown>) {
  return toSafeString(
    record.short_label ??
      record.shortLabel ??
      record.label ??
      record.name ??
      record.unit ??
      record.value
  ).trim();
}

function getStoredClientRequirementRows(metadata: Record<string, unknown>) {
  const rawRows =
    metadata.client_requirement_items ??
    metadata.clientRequirementItems ??
    metadata.client_requirements_items;

  if (!Array.isArray(rawRows)) return [];

  return rawRows
    .map(row => {
      const record =
        row && typeof row === 'object' ? (row as Record<string, unknown>) : {};

      const areaName = normalizeSiteVisitAreaName(toSafeString(record.area_name ?? record.areaName));
      const itemId = toSafeString(record.item_id ?? record.itemId);
      const itemName = toSafeString(record.item_name ?? record.itemName);
      const outputUnit = getClientRequirementOutputUnitFromLabel(
        toSafeString(record.output_unit ?? record.outputUnit ?? record.unit)
      );
      const quantityValue = record.quantity ?? record.calculated_quantity;
      const quantity =
        typeof quantityValue === 'number' && Number.isFinite(quantityValue)
          ? String(quantityValue)
          : toSafeString(quantityValue);
      const measurements = getClientRequirementMeasurementRows(
        record.measurement_rows ?? record.measurementRows ?? record.measurements
      );
      const notes = toSafeString(record.notes);

      return {
        id: toSafeString(record.id) || createWorkspaceLocalId('client-requirement'),
        areaName,
        itemId,
        itemName,
        outputUnit,
        measurements:
          measurements.length > 0 ? measurements : [createEmptyClientRequirementMeasurement()],
        notes,
        unit: outputUnit,
        quantity,
      };
    })
    .filter(row => row.areaName || row.itemName || row.notes);
}

function getCompactClientRequirementRows(
  rows: ClientRequirementRowForm[]
): SavedClientRequirementRow[] {
  return rows
    .map(row => {
      const areaName = row.areaName.trim();
      const itemName = row.itemName.trim();
      const notes = row.notes.trim();
      const measurementRows = getCompactClientRequirementMeasurements(
        row.measurements
      );
      const calculatedQuantity = getClientRequirementCalculatedQuantity(row);
      const outputUnit = row.outputUnit || 'sqft';

      return {
        id: row.id || createWorkspaceLocalId('client-requirement'),
        area_name: areaName,
        item_id: row.itemId.trim() || null,
        item_name: itemName,
        unit: outputUnit,
        output_unit: outputUnit,
        quantity: calculatedQuantity > 0 ? calculatedQuantity : null,
        calculated_quantity: calculatedQuantity > 0 ? calculatedQuantity : null,
        measurement_rows: measurementRows,
        notes,
      };
    })
    .filter(row => row.area_name || row.item_name || row.notes);
}

function getClientRequirementAreaKey(areaName: string) {
  return areaName.trim().toLowerCase() || 'new-area';
}

function getClientRequirementAreaGroups(rows: ClientRequirementRowForm[]) {
  const groups = new Map<
    string,
    {
      key: string;
      areaName: string;
      rows: ClientRequirementRowForm[];
    }
  >();

  rows.forEach(row => {
    const key = getClientRequirementAreaKey(row.areaName);

    if (!groups.has(key)) {
      groups.set(key, {
        key,
        areaName: row.areaName,
        rows: [],
      });
    }

    groups.get(key)?.rows.push(row);
  });

  return Array.from(groups.values());
}

function hasClientRequirementProgress(form: CheckpointDetailForm) {
  return (
    getCompactClientRequirementRows(form.clientRequirementRows).length > 0 ||
    hasText(form.clientRequirements)
  );
}

function getCheckpointDetailForm(checkpoint: ProjectCheckpoint): CheckpointDetailForm {
  const metadata = getCheckpointMetadata(checkpoint);
  const designPhaseStatus = getDesignPhaseWorkflowStatus(checkpoint, metadata);

  return {
    notes: checkpoint.notes || '',
    clientRequirements: toSafeString(metadata.client_requirements ?? metadata.clientRequirements),
    clientRequirementRows: getStoredClientRequirementRows(metadata),
    siteMeasurements: toSafeString(metadata.site_measurements ?? metadata.siteMeasurements),
    customRequirements: toSafeString(metadata.custom_requirements ?? metadata.customRequirements),
    designApprovalNotes: toSafeString(metadata.design_approval_notes ?? metadata.designApprovalNotes),
    designEstimateNotes: toSafeString(metadata.design_estimate_notes ?? metadata.designEstimateNotes),
    designBypassReason: toSafeString(metadata.design_bypass_reason ?? metadata.designBypassReason),
    designServiceScope: toSafeString(metadata.design_service_scope ?? metadata.designServiceScope),
    designFeeAmount: toSafeString(metadata.design_fee_amount ?? metadata.designFeeAmount),
    designServiceEstimateNotes: toSafeString(
      metadata.design_service_estimate_notes ?? metadata.designServiceEstimateNotes
    ),
    designEstimateRows: getDesignEstimateRowsFromMetadata(metadata),
    designEstimateApproved:
      metadata.design_estimate_approved === true ||
      metadata.designEstimateApproved === true ||
      designPhaseStatus === 'approved',
    designPhaseStatus,
    executionCompletionNotes: toSafeString(
      metadata.execution_completion_notes ?? metadata.executionCompletionNotes
    ),
    executionPendingWorks: toSafeString(
      metadata.execution_pending_works ?? metadata.executionPendingWorks
    ),
    executionHandoverReadiness: toSafeString(
      metadata.execution_handover_readiness ?? metadata.executionHandoverReadiness
    ),
    qcChecklistNotes: toSafeString(
      metadata.qc_checklist_notes ?? metadata.qcChecklistNotes
    ),
    qcSnagList: toSafeString(metadata.qc_snag_list ?? metadata.qcSnagList),
    qcReportNotes: toSafeString(
      metadata.qc_report_notes ?? metadata.qcReportNotes
    ),
    handoverClientConfirmation: toSafeString(
      metadata.handover_client_confirmation ?? metadata.handoverClientConfirmation
    ),
    handoverDocuments: toSafeString(
      metadata.handover_documents ?? metadata.handoverDocuments
    ),
    warrantyNotes: toSafeString(
      metadata.warranty_notes ?? metadata.warrantyNotes
    ),
    finalHandoverNotes: toSafeString(
      metadata.final_handover_notes ?? metadata.finalHandoverNotes
    ),
  };
}

function buildInitialSiteVisitChecklist(
  checkpoint: ProjectCheckpoint,
  form: CheckpointDetailForm
) {
  const completionByItemId: Record<string, boolean> = {
    'site-measurements': hasText(form.siteMeasurements),
    'client-requirements': hasClientRequirementProgress(form),
    'custom-requirements': hasText(form.customRequirements),
  };

  return getCheckpointChecklistItems(checkpoint).map(item => {
    const itemId = toSafeString(item.id);
    const shouldMarkComplete = completionByItemId[itemId];

    return shouldMarkComplete
      ? {
          ...item,
          is_completed: true,
          completed: true,
          status: 'completed',
        }
      : item;
  });
}

function buildDesignPhaseChecklist(
  checkpoint: ProjectCheckpoint,
  form: CheckpointDetailForm
) {
  const isApproved = form.designPhaseStatus === 'approved';
  const isBypassed = form.designPhaseStatus === 'bypassed';
  const isEstimateApproved = form.designEstimateApproved || isApproved;

  const completionByItemId: Record<string, boolean> = {
    'design-approval': isApproved || isBypassed,
    'design-estimate': isEstimateApproved || isBypassed,
  };

  return getCheckpointChecklistItems(checkpoint).map(item => {
    const itemId = toSafeString(item.id);
    const shouldMarkComplete = completionByItemId[itemId];

    return shouldMarkComplete
      ? {
          ...item,
          is_completed: true,
          completed: true,
          status: 'completed',
        }
      : item;
  });
}

function buildCheckpointChecklist(
  checkpoint: ProjectCheckpoint,
  form: CheckpointDetailForm
) {
  if (checkpoint.checkpoint_key === 'initial_site_visit') {
    return buildInitialSiteVisitChecklist(checkpoint, form);
  }

  if (checkpoint.checkpoint_key === 'design_phase') {
    return buildDesignPhaseChecklist(checkpoint, form);
  }

  return checkpoint.checklist;
}

function getCheckpointSaveStatus(
  checkpoint: ProjectCheckpoint,
  form: CheckpointDetailForm
): ProjectCheckpoint['status'] {
  if (checkpoint.status === 'completed' || checkpoint.status === 'skipped') {
    return checkpoint.status;
  }

  if (checkpoint.checkpoint_key === 'design_phase') {
    if (checkpoint.status === 'locked') return 'locked';

    return form.designPhaseStatus === 'in_progress'
      ? 'in_progress'
      : 'available';
  }

  const hasProgress =
    hasText(form.notes) ||
    hasClientRequirementProgress(form) ||
    hasText(form.siteMeasurements) ||
    hasText(form.customRequirements) ||
    hasText(form.designApprovalNotes) ||
    hasText(form.designEstimateNotes) ||
    hasText(form.designBypassReason) ||
    hasText(form.designServiceEstimateNotes) ||
    hasText(form.executionCompletionNotes) ||
    hasText(form.executionPendingWorks) ||
    hasText(form.executionHandoverReadiness) ||
    hasText(form.qcChecklistNotes) ||
    hasText(form.qcSnagList) ||
    hasText(form.qcReportNotes) ||
    hasText(form.handoverClientConfirmation) ||
    hasText(form.handoverDocuments) ||
    hasText(form.warrantyNotes) ||
    hasText(form.finalHandoverNotes) ||
    getValidDesignEstimateRows(form.designEstimateRows).length > 0 ||
    form.designEstimateApproved ||
    form.designPhaseStatus !== 'waiting';

  return hasProgress && checkpoint.status === 'available'
    ? 'in_progress'
    : checkpoint.status;
}

function getProjectStatusClass(status: string | null | undefined) {
  return STATUS_STYLES[status || ''] || 'border-border bg-muted text-muted-foreground';
}

const CHECKPOINT_STATUS_STYLES: Record<string, string> = {
  locked: 'border-border bg-muted text-muted-foreground',
  available: 'border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  in_progress: 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  completed: 'border-emerald-300/80 bg-emerald-500/35 text-emerald-950 dark:text-emerald-50',
  skipped: 'border-zinc-500/20 bg-zinc-500/10 text-zinc-600 dark:text-zinc-300',
};

function getCheckpointStatusClass(status: ProjectCheckpoint['status']) {
  return CHECKPOINT_STATUS_STYLES[status] || CHECKPOINT_STATUS_STYLES.locked;
}

function getCheckpointStatusLabel(status: ProjectCheckpoint['status']) {
  return status
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function getCheckpointCardClass(checkpoint: ProjectCheckpoint) {
  if (isCheckpointComplete(checkpoint)) {
    return 'border-emerald-500/25 bg-emerald-500/10 dark:border-[#00E676]/85 dark:bg-[#003D27] dark:shadow-[0_0_38px_rgba(0,230,118,0.36)] dark:ring-1 dark:ring-[#00E676]/35';
  }

  if (checkpoint.status === 'available' || checkpoint.status === 'in_progress') {
    return 'border-sky-500/25 bg-sky-500/10 dark:border-sky-400/70 dark:bg-sky-950/55 dark:shadow-[0_0_34px_rgba(14,165,233,0.30)] dark:ring-1 dark:ring-sky-400/25';
  }

  return 'border-border bg-card';
}

function getCheckpointChecklistItems(checkpoint: ProjectCheckpoint) {
  return Array.isArray(checkpoint.checklist)
    ? checkpoint.checklist.filter(
        item => item && typeof item === 'object'
      ) as Array<Record<string, unknown>>
    : [];
}

function getChecklistItemLabel(item: Record<string, unknown>, index: number) {
  const label = item.label ?? item.title ?? item.name;

  return typeof label === 'string' && label.trim()
    ? label
    : `Checklist item ${index + 1}`;
}

function isChecklistItemComplete(item: Record<string, unknown>) {
  return item.is_completed === true ||
    item.completed === true ||
    item.status === 'completed';
}

function isCheckpointChecklistComplete(checkpoint: ProjectCheckpoint | null | undefined) {
  if (!checkpoint) return false;

  const checklistItems = getCheckpointChecklistItems(checkpoint);

  return checklistItems.length > 0 && checklistItems.every(isChecklistItemComplete);
}

function getBooleanMetadataValue(
  metadata: Record<string, unknown>,
  snakeKey: string,
  camelKey: string
) {
  return metadata[snakeKey] === true || metadata[camelKey] === true;
}

function isQcReportGenerated(checkpoint: ProjectCheckpoint | null | undefined) {
  if (!checkpoint) return false;

  const metadata = getCheckpointMetadata(checkpoint);

  return getBooleanMetadataValue(metadata, 'qc_report_generated', 'qcReportGenerated');
}

function getProjectTimelineSummaryWorkPackages(value: unknown): ProjectTimelineWorkPackageSummary[] {
  if (!Array.isArray(value)) return [];

  return value
    .map(workPackage => {
      const record = isRecord(workPackage) ? workPackage : {};
      const id = toSafeString(record.id) || createWorkspaceLocalId('timeline-work-package');
      const title =
        toSafeString(record.title) ||
        toSafeString(record.name) ||
        'Untitled work package';

      return {
        id,
        title,
        status: toSafeString(record.status) || 'pending',
        actualEndDate:
          toSafeString(record.actualEndDate ?? record.actual_end_date) || null,
        estimatedEndDate:
          toSafeString(record.estimatedEndDate ?? record.estimated_end_date) || null,
      };
    })
    .filter(workPackage => workPackage.title.trim().length > 0);
}

function getTimelineWorkPackages(
  timeline: ProjectTimelineSummary | null | undefined
) {
  return timeline?.work_packages ?? [];
}

function getCompletedTimelineWorkPackages(
  timeline: ProjectTimelineSummary | null | undefined
) {
  return getTimelineWorkPackages(timeline).filter(
    workPackage => workPackage.status === 'completed'
  );
}

function getPendingTimelineWorkPackages(
  timeline: ProjectTimelineSummary | null | undefined
) {
  return getTimelineWorkPackages(timeline).filter(
    workPackage => workPackage.status !== 'completed'
  );
}

function getExecutionTransferReadiness({
  estimate,
  timeline,
  isEstimateLoading,
  isTimelineLoading,
}: {
  estimate: ProjectCostEstimateSummary | null | undefined;
  timeline: ProjectTimelineSummary | null | undefined;
  isEstimateLoading: boolean;
  isTimelineLoading: boolean;
}) {
  if (isEstimateLoading || isTimelineLoading) {
    return {
      canTransfer: false,
      label: 'Checking project readiness...',
      reason: 'Checking approved estimate and timeline completion.',
    };
  }

  if (!hasApprovedProjectEstimate(estimate)) {
    return {
      canTransfer: false,
      label: 'Waiting for approved estimate',
      reason: 'Approve the project Cost Estimate before transferring Execution for QC.',
    };
  }

  if (!timeline || !timeline.has_timeline) {
    return {
      canTransfer: false,
      label: 'Timeline not built',
      reason: 'Build the project Timeline from the approved Cost Estimate first.',
    };
  }

  if (!timeline.timeline_confirmed_at) {
    return {
      canTransfer: false,
      label: 'Timeline not confirmed',
      reason: 'Confirm the project Timeline before transferring Execution for QC.',
    };
  }

  const totalWorkPackages = getTimelineWorkPackages(timeline).length;
  const completedWorkPackages = getCompletedTimelineWorkPackages(timeline).length;

  if (totalWorkPackages === 0) {
    return {
      canTransfer: false,
      label: 'No work packages',
      reason: 'The confirmed Timeline has no work packages to verify.',
    };
  }

  if (completedWorkPackages < totalWorkPackages) {
    return {
      canTransfer: false,
      label: `${completedWorkPackages}/${totalWorkPackages} work packages completed`,
      reason: 'All Timeline work packages must be marked completed before QC transfer.',
    };
  }

  return {
    canTransfer: true,
    label: 'Ready to transfer for QC',
    reason: 'All Timeline work packages are completed and ready for QC inspection.',
  };
}

function getCheckpointDescription(checkpointKey: ProjectCheckpoint['checkpoint_key']) {
  switch (checkpointKey) {
    case 'initial_site_visit':
      return 'Measurements, images, requirements, and custom notes.';
    case 'design_phase':
      return 'Design approval and design estimate or bypass confirmation.';
    case 'execution':
      return 'Execution work completion and readiness for Quality Control.';
    case 'quality_control':
      return 'QC checklist and QC report before final handover payment.';
    case 'handover':
      return 'Final handover and closeout confirmation.';
    default:
      return 'Project checkpoint.';
  }
}

function getProjectFormFromRecord(project: Project): ProjectFormState {
  return {
    name: project.name || '',
    client: project.client || '',
    status: project.status || 'Active',
    description: project.description || '',
  };
}

function getProjectTimelineStatusLabel(
  timeline: ProjectTimelineSummary | null | undefined,
  isLoading = false
) {
  if (!timeline) {
    return isLoading ? 'Checking...' : 'Yet to Approve';
  }

  if (timeline.has_timeline) {
    return timeline.timeline_confirmed_at ? 'Approved' : 'Timeline Built';
  }

  return 'Yet to Approve';
}

function getProjectCostEstimateStatusLabel(
  estimate: ProjectCostEstimateSummary | null | undefined,
  isLoading = false
) {
  if (isLoading) return 'Checking...';
  if (!estimate) return 'Not Started';

  if (estimate.status === 'approved') return `Approved - v${estimate.version}`;
  if (estimate.status === 'revision') return `Revision Draft - v${estimate.version}`;

  return 'Draft';
}

function hasApprovedProjectEstimate(
  estimate: ProjectCostEstimateSummary | null | undefined
) {
  return estimate?.status === 'approved';
}

function getProjectActionTimelineStatusLabel(
  timeline: ProjectTimelineSummary | null | undefined,
  estimate: ProjectCostEstimateSummary | null | undefined,
  isLoading = false
) {
  if (isLoading) return 'Checking...';

  if (!hasApprovedProjectEstimate(estimate)) {
    return 'Waiting for Estimate';
  }

  if (!timeline || !timeline.has_timeline) {
    return 'Ready to Build';
  }

  return timeline.timeline_confirmed_at ? 'Confirmed' : 'Timeline Built';
}

function getProjectFinanceStatusLabel(
  finance: ProjectFinanceSummary | null | undefined,
  estimate: ProjectCostEstimateSummary | null | undefined,
  isLoading = false
) {
  if (!hasApprovedProjectEstimate(estimate)) {
    return 'Waiting for Estimate';
  }

  if (isLoading) return 'Checking...';

  if (!finance) return 'Ready to Sync';

  const estimateVersion = estimate?.version ?? null;

  if (
    estimateVersion &&
    finance.source_estimate_version &&
    finance.source_estimate_version !== estimateVersion
  ) {
    return 'Needs Sync';
  }

  return finance.source_estimate_version
    ? `Synced - v${finance.source_estimate_version}`
    : 'Synced';
}

function getRouteBase(mode: ProjectWorkspaceMode) {
  return mode === 'admin' ? '/admin' : '/portal';
}

function getCheckpointByKey(
  checkpoints: ProjectCheckpoint[],
  checkpointKey: ProjectCheckpoint['checkpoint_key']
) {
  return checkpoints.find(checkpoint => checkpoint.checkpoint_key === checkpointKey);
}


function isCheckpointComplete(checkpoint: ProjectCheckpoint | undefined) {
  return Boolean(
    checkpoint &&
      ['completed', 'skipped'].includes(checkpoint.status)
  );
}

function createProjectStageActions(
  mode: ProjectWorkspaceMode,
  projectId: string,
  checkpoints: ProjectCheckpoint[],
  timeline: ProjectTimelineSummary | null | undefined,
  isTimelineLoading = false,
  costEstimate?: ProjectCostEstimateSummary | null,
  isCostEstimateLoading = false,
  finance?: ProjectFinanceSummary | null,
  isFinanceLoading = false
): ProjectStageAction[] {
  const base = getRouteBase(mode);
  const query = `?projectId=${encodeURIComponent(projectId)}`;

  const designCheckpoint = getCheckpointByKey(checkpoints, 'design_phase');
  const isDesignComplete = isCheckpointComplete(designCheckpoint);
  const costEstimateStatusLabel = getProjectCostEstimateStatusLabel(
    costEstimate,
    isCostEstimateLoading
  );
  const timelineStatusLabel = getProjectActionTimelineStatusLabel(
    timeline,
    costEstimate,
    isTimelineLoading
  );
  const financeStatusLabel = getProjectFinanceStatusLabel(
    finance,
    costEstimate,
    isFinanceLoading
  );

  return [
    {
      label: 'Cost Estimate',
      description: "Open this project's linked estimate workspace. Site visit requirements can prefill the draft.",
      lockedReason: 'Complete Design Phase first.',
      isAvailable: isDesignComplete,
      to: `${base}/cost-estimates${query}`,
      statusLabel: isDesignComplete ? costEstimateStatusLabel : 'Locked',
    },
    {
      label: 'Timeline',
      description: "Open this project's linked timeline workspace after Design Phase is complete.",
      lockedReason: 'Complete Design Phase first.',
      isAvailable: isDesignComplete,
      to: `${base}/timeline${query}`,
      statusLabel: isDesignComplete ? timelineStatusLabel : 'Locked',
    },
    {
      label: 'Finance',
      description: "Open this project's finance workspace. Finance entries stay inside Finance; design fee recording comes next.",
      lockedReason: 'Complete Design Phase first.',
      isAvailable: isDesignComplete,
      to: `${base}/financials${query}`,
      statusLabel: isDesignComplete ? financeStatusLabel : 'Locked',
    },
  ];
}

type ProjectDeleteMutationResult = {
  error: { message: string } | null;
};

function throwProjectDeleteError(
  result: ProjectDeleteMutationResult,
  step: string
) {
  if (result.error) {
    throw new Error(`${step}: ${result.error.message}`);
  }
}

async function convertProjectCostEstimatesToUnassignedDraft(projectId: string) {
  throwProjectDeleteError(
    await supabase
      .from('cost_estimates')
      .update({
        project_id: null,
        project_name: 'Unassigned Draft',
        client_name: null,
        status: 'draft',
        approved_snapshot: null,
        updated_at: new Date().toISOString(),
      })
      .eq('project_id', projectId),
    'Could not convert linked cost estimates to unassigned drafts'
  );
}

async function deleteProjectFinanceDependents(projectId: string) {
  const { data: gateRows, error: gateFetchError } = await supabase
    .from('project_finance_payment_gates')
    .select('id')
    .eq('project_id', projectId);

  if (gateFetchError) {
    throw new Error(`Could not fetch project finance gates: ${gateFetchError.message}`);
  }

  const gateIds = (gateRows ?? [])
    .map(row => String(row.id))
    .filter(Boolean);

  if (gateIds.length > 0) {
    throwProjectDeleteError(
      await supabase
        .from('project_cash_receipt_allocations')
        .delete()
        .in('payment_gate_id', gateIds),
      'Could not delete cash receipt allocations linked to payment gates'
    );

    throwProjectDeleteError(
      await supabase
        .from('project_finance_payment_gates')
        .delete()
        .in('id', gateIds),
      'Could not delete project finance payment gates'
    );
  }

  throwProjectDeleteError(
    await supabase
      .from('project_cash_receipt_allocations')
      .delete()
      .eq('project_id', projectId),
    'Could not delete project cash receipt allocations'
  );

  throwProjectDeleteError(
    await supabase
      .from('project_cash_receipts')
      .delete()
      .eq('project_id', projectId),
    'Could not delete project cash receipts'
  );

  throwProjectDeleteError(
    await supabase
      .from('project_vendor_payments')
      .delete()
      .eq('project_id', projectId),
    'Could not delete project vendor payments'
  );

  throwProjectDeleteError(
    await supabase
      .from('project_cogs_entries')
      .delete()
      .eq('project_id', projectId),
    'Could not delete project COGS entries'
  );

  throwProjectDeleteError(
    await supabase
      .from('project_vendor_accounts')
      .delete()
      .eq('project_id', projectId),
    'Could not delete project vendor accounts'
  );

  throwProjectDeleteError(
    await supabase
      .from('project_finance_accounts')
      .delete()
      .eq('project_id', projectId),
    'Could not delete project finance account'
  );
}

async function deleteProjectTimelineDependents(projectId: string) {
  throwProjectDeleteError(
    await supabase
      .from('project_timelines')
      .delete()
      .eq('project_id', projectId),
    'Could not delete project timeline'
  );
}

async function deleteProjectDependentRecords(projectId: string) {
  await convertProjectCostEstimatesToUnassignedDraft(projectId);
  await deleteProjectFinanceDependents(projectId);
  await deleteProjectTimelineDependents(projectId);
}


export default function ProjectWorkspace({ mode }: ProjectWorkspaceProps) {
  const { profile, isAdmin } = useAuth();

  const [projects, setProjects] = useState<Project[]>([]);
  const [projectRequests, setProjectRequests] = useState<Lead[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProjectStatusFilter>('All Statuses');
  const [floatingMenu, setFloatingMenu] = useState<FloatingMenuState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [projectForm, setProjectForm] = useState<ProjectFormState>(EMPTY_PROJECT_FORM);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [pendingProjectRequest, setPendingProjectRequest] = useState<Lead | null>(null);
  const [modalError, setModalError] = useState('');
  const [isSavingProject, setIsSavingProject] = useState(false);
  const [projectCheckpoints, setProjectCheckpoints] = useState<ProjectCheckpoint[]>([]);
  const [projectCheckpointsLoading, setProjectCheckpointsLoading] = useState(false);
  const [projectCheckpointError, setProjectCheckpointError] = useState('');
  const [projectTimelineSummaries, setProjectTimelineSummaries] = useState<
    Record<string, ProjectTimelineSummary>
  >({});
  const [projectTimelineSummariesLoading, setProjectTimelineSummariesLoading] =
    useState(false);
  const [projectCostEstimateSummaries, setProjectCostEstimateSummaries] =
    useState<Record<string, ProjectCostEstimateSummary>>({});
  const [
    projectCostEstimateSummariesLoading,
    setProjectCostEstimateSummariesLoading,
  ] = useState(false);
  const [projectFinanceSummaries, setProjectFinanceSummaries] =
    useState<Record<string, ProjectFinanceSummary>>({});
  const [projectFinanceSummariesLoading, setProjectFinanceSummariesLoading] =
    useState(false);
  const [selectedCheckpoint, setSelectedCheckpoint] = useState<ProjectCheckpoint | null>(null);
  const [checkpointDetailForm, setCheckpointDetailForm] =
    useState<CheckpointDetailForm>(EMPTY_CHECKPOINT_DETAIL_FORM);
  const [checkpointDetailError, setCheckpointDetailError] = useState('');
  const [isSavingCheckpointDetail, setIsSavingCheckpointDetail] = useState(false);
  const [siteVisitItemOptions, setSiteVisitItemOptions] = useState<
    SiteVisitProcurementItemOption[]
  >([]);
  const [siteVisitUnitOptions, setSiteVisitUnitOptions] = useState<string[]>(
    DEFAULT_SITE_VISIT_UNITS
  );
  const [siteVisitItemError, setSiteVisitItemError] = useState('');
  const [siteVisitItemDropdownRowId, setSiteVisitItemDropdownRowId] =
    useState<string | null>(null);
  const [siteVisitUnitDropdownRowId, setSiteVisitUnitDropdownRowId] =
    useState<string | null>(null);
  const [siteVisitCustomAreaName, setSiteVisitCustomAreaName] = useState('');
  const projectDocumentFileInputRef = useRef<HTMLInputElement | null>(null);
  const [projectDocuments, setProjectDocuments] = useState<ProjectDocument[]>([]);
  const [projectDocumentsLoading, setProjectDocumentsLoading] = useState(false);
  const [projectDocumentError, setProjectDocumentError] = useState('');
  const [isUploadingProjectDocument, setIsUploadingProjectDocument] = useState(false);
  const [isDeletingProjectDocument, setIsDeletingProjectDocument] = useState(false);
  const [projectDocumentDeleteTarget, setProjectDocumentDeleteTarget] =
    useState<ProjectDocument | null>(null);
  const [isProjectDocumentModalOpen, setIsProjectDocumentModalOpen] = useState(false);
  const [projectDocumentForm, setProjectDocumentForm] =
    useState<ProjectDocumentForm>(EMPTY_PROJECT_DOCUMENT_FORM);
  const [projectDocumentModalError, setProjectDocumentModalError] = useState('');
  const [isSavingProjectDocument, setIsSavingProjectDocument] = useState(false);
  const [selectedProjectDocument, setSelectedProjectDocument] =
    useState<ProjectDocument | null>(null);
  const [projectDocumentWebviewTarget, setProjectDocumentWebviewTarget] =
    useState<ProjectDocument | null>(null);

  const isAdminMode = mode === 'admin';
  const canManageProjects = isAdminMode && isAdmin();
  const canManageProjectDocuments =
    canManageProjects || canManagePage(profile, 'portal.projects');

  useEffect(() => {
    let isMounted = true;

    const loadSiteVisitItemOptions = async () => {
      setSiteVisitItemError('');

      const { data, error } = await supabase
        .from('procurement_items')
        .select('id, name, default_unit_label, selling_rate_per_unit, default_description, status')
        .eq('status', 'active')
        .order('name', { ascending: true });

      if (!isMounted) return;

      if (error) {
        setSiteVisitItemOptions([]);
        setSiteVisitItemError(error.message);
        return;
      }

      setSiteVisitItemOptions(
        (data || []).map(item => ({
          id: toSafeString(item.id),
          name: toSafeString(item.name),
          defaultUnitLabel: toSafeString(item.default_unit_label) || 'sqft',
          sellingRatePerUnit:
            typeof item.selling_rate_per_unit === 'number'
              ? item.selling_rate_per_unit
              : 0,
          defaultDescription: toSafeString(item.default_description),
        }))
      );
    };

    void loadSiteVisitItemOptions();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadSiteVisitUnitOptions = async () => {
      const { data, error } = await supabase
        .from('procurement_units')
        .select('*');

      if (!isMounted) return;

      if (error) {
        console.error('Could not load procurement units for site visit.', error);
        setSiteVisitUnitOptions(DEFAULT_SITE_VISIT_UNITS);
        return;
      }

      const unitLabels = (data || [])
        .map(unit =>
          getSiteVisitUnitLabelFromRecord(
            unit && typeof unit === 'object'
              ? (unit as Record<string, unknown>)
              : {}
          )
        )
        .map(normalizeClientRequirementUnit)
        .filter(Boolean);

      setSiteVisitUnitOptions(
        Array.from(new Set([...unitLabels, ...DEFAULT_SITE_VISIT_UNITS]))
      );
    };

    void loadSiteVisitUnitOptions();

    return () => {
      isMounted = false;
    };
  }, []);



  useEffect(() => {
    let isMounted = true;

    const loadProjectTimelineSummaries = async () => {
      const projectIds = projects
        .map(project => project.id)
        .filter(Boolean);

      if (projectIds.length === 0) {
        setProjectTimelineSummaries({});
        setProjectTimelineSummariesLoading(false);
        return;
      }

      setProjectTimelineSummariesLoading(true);

      const { data, error } = await supabase
        .from('project_timelines')
        .select('project_id, has_timeline, timeline_confirmed_at, work_packages')
        .in('project_id', projectIds);

      if (!isMounted) return;

      if (error) {
        console.error('Could not load project timeline summaries.', error);
        setProjectTimelineSummaries({});
        setProjectTimelineSummariesLoading(false);
        return;
      }

      setProjectTimelineSummaries(
        (data || []).reduce<Record<string, ProjectTimelineSummary>>((summaryMap, timeline) => {
          const projectId = toSafeString(timeline.project_id);

          if (!projectId) return summaryMap;

          summaryMap[projectId] = {
            project_id: projectId,
            has_timeline: timeline.has_timeline === true,
            timeline_confirmed_at: toSafeString(timeline.timeline_confirmed_at) || null,
            work_packages: getProjectTimelineSummaryWorkPackages(timeline.work_packages),
          };

          return summaryMap;
        }, {})
      );
      setProjectTimelineSummariesLoading(false);
    };

    void loadProjectTimelineSummaries();

    return () => {
      isMounted = false;
    };
  }, [projects]);

  useEffect(() => {
    const loadProjectActionSummaries = async () => {
      const projectIds = projects
        .map(project => project.id)
        .filter((projectId): projectId is string => Boolean(projectId));

      if (projectIds.length === 0) {
        setProjectCostEstimateSummaries({});
        setProjectFinanceSummaries({});
        setProjectCostEstimateSummariesLoading(false);
        setProjectFinanceSummariesLoading(false);
        return;
      }

      setProjectCostEstimateSummariesLoading(true);
      setProjectFinanceSummariesLoading(true);

      const [estimatesResult, financeResult] = await Promise.all([
        supabase
          .from('cost_estimates')
          .select('project_id, status, version, updated_at')
          .in('project_id', projectIds)
          .order('updated_at', { ascending: false }),
        supabase
          .from('project_finance_accounts')
          .select('project_id, source_estimate_id, source_estimate_version, last_synced_at, updated_at')
          .in('project_id', projectIds)
          .order('updated_at', { ascending: false }),
      ]);

      if (estimatesResult.error) {
        console.error('Could not load project cost estimate summaries.', estimatesResult.error);
        setProjectCostEstimateSummaries({});
      } else {
        const nextCostEstimateSummaries = (estimatesResult.data || []).reduce<
          Record<string, ProjectCostEstimateSummary>
        >((summaryMap, estimate) => {
          const projectId = toSafeString(estimate.project_id);
          const status = toSafeString(estimate.status) as ProjectCostEstimateStatus;

          if (!projectId || !['draft', 'approved', 'revision'].includes(status)) {
            return summaryMap;
          }

          if (summaryMap[projectId]) return summaryMap;

          const version = Number(estimate.version);

          summaryMap[projectId] = {
            project_id: projectId,
            status,
            version: Number.isFinite(version) && version > 0 ? version : 1,
            updated_at: toSafeString(estimate.updated_at) || null,
          };

          return summaryMap;
        }, {});

        setProjectCostEstimateSummaries(nextCostEstimateSummaries);
      }

      if (financeResult.error) {
        console.error('Could not load project finance summaries.', financeResult.error);
        setProjectFinanceSummaries({});
      } else {
        const nextFinanceSummaries = (financeResult.data || []).reduce<
          Record<string, ProjectFinanceSummary>
        >((summaryMap, finance) => {
          const projectId = toSafeString(finance.project_id);

          if (!projectId || summaryMap[projectId]) return summaryMap;

          const sourceEstimateVersion = Number(finance.source_estimate_version);

          summaryMap[projectId] = {
            project_id: projectId,
            source_estimate_id: toSafeString(finance.source_estimate_id) || null,
            source_estimate_version:
              Number.isFinite(sourceEstimateVersion) && sourceEstimateVersion > 0
                ? sourceEstimateVersion
                : null,
            last_synced_at: toSafeString(finance.last_synced_at) || null,
            updated_at: toSafeString(finance.updated_at) || null,
          };

          return summaryMap;
        }, {});

        setProjectFinanceSummaries(nextFinanceSummaries);
      }

      setProjectCostEstimateSummariesLoading(false);
      setProjectFinanceSummariesLoading(false);
    };

    void loadProjectActionSummaries();
  }, [projects]);



  async function fetchProjects() {
    setLoading(true);
    setError('');

    const { data, error: fetchError } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
      setProjects([]);
    } else {
      setProjects((data || []) as Project[]);
    }

    setLoading(false);
  }

  async function fetchProjectRequests() {
    if (!canManageProjects) {
      setProjectRequests([]);
      return;
    }

    const { data, error: requestError } = await supabase
      .from('leads')
      .select('*')
      .eq('status', 'Converted')
      .is('converted_project_id', null)
      .order('updated_at', { ascending: false });

    if (requestError) {
      setError(requestError.message);
      setProjectRequests([]);
      return;
    }

    setProjectRequests((data || []) as Lead[]);
  }

  useEffect(() => {
    let isMounted = true;

    async function runFetchProjects() {
      setLoading(true);
      setError('');

      const { data, error: fetchError } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });

      if (!isMounted) return;

      if (fetchError) {
        setError(fetchError.message);
        setProjects([]);
      } else {
        setProjects((data || []) as Project[]);
      }

      if (canManageProjects) {
        const { data: requestData, error: requestError } = await supabase
          .from('leads')
          .select('*')
          .eq('status', 'Converted')
          .is('converted_project_id', null)
          .order('updated_at', { ascending: false });

        if (!requestError) {
          setProjectRequests((requestData || []) as Lead[]);
        }
      }

      setLoading(false);
    }

    void runFetchProjects();

    return () => {
      isMounted = false;
    };
  }, [canManageProjects]);

  useEffect(() => {
    let isMounted = true;

    async function loadSelectedProjectCheckpoints() {
      if (!selectedProject) {
        setProjectCheckpoints([]);
        setProjectCheckpointError('');
        setProjectCheckpointsLoading(false);
        return;
      }

      setProjectCheckpointsLoading(true);
      setProjectCheckpointError('');

      try {
        if (canManageProjects) {
          const checkpoints = await ensureProjectCheckpoints(
            selectedProject.id,
            profile?.id ?? null
          );

          if (!isMounted) return;
          setProjectCheckpoints(checkpoints);
          return;
        }

        const { data, error: checkpointFetchError } = await supabase
          .from('project_checkpoints')
          .select('*')
          .eq('project_id', selectedProject.id)
          .order('sort_order', { ascending: true });

        if (checkpointFetchError) throw checkpointFetchError;

        if (!isMounted) return;
        setProjectCheckpoints(sortProjectCheckpoints((data || []) as ProjectCheckpoint[]));
      } catch (checkpointError) {
        if (!isMounted) return;

        setProjectCheckpointError(
          checkpointError instanceof Error
            ? checkpointError.message
            : 'Could not load project checkpoints.'
        );
        setProjectCheckpoints([]);
      } finally {
        if (isMounted) {
          setProjectCheckpointsLoading(false);
        }
      }
    }

    void loadSelectedProjectCheckpoints();

    return () => {
      isMounted = false;
    };
  }, [selectedProject, canManageProjects, profile?.id]);

  useEffect(() => {
    let isMounted = true;

    async function loadProjectDocuments() {
      if (!selectedProject) {
        setProjectDocuments([]);
        setProjectDocumentError('');
        setProjectDocumentsLoading(false);
        return;
      }

      setProjectDocumentsLoading(true);
      setProjectDocumentError('');

      try {
        const { data, error: documentsError } = await supabase
          .from('project_documents')
          .select('*')
          .eq('project_id', selectedProject.id)
          .order('created_at', { ascending: false });

        if (documentsError) throw documentsError;

        if (!isMounted) return;
        setProjectDocuments((data || []) as ProjectDocument[]);
      } catch (documentsError) {
        if (!isMounted) return;

        setProjectDocumentError(
          documentsError instanceof Error
            ? documentsError.message
            : 'Could not load project documents.'
        );
        setProjectDocuments([]);
      } finally {
        if (isMounted) {
          setProjectDocumentsLoading(false);
        }
      }
    }

    void loadProjectDocuments();

    return () => {
      isMounted = false;
    };
  }, [selectedProject]);

  const filteredProjects = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return projects.filter(project => {
      const matchesStatus =
        statusFilter === 'All Statuses' || project.status === statusFilter;

      if (!matchesStatus) return false;

      if (!query) return true;

      const haystack = [
        project.name,
        project.client,
        project.status,
        project.description,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [projects, searchTerm, statusFilter]);

  const openStatusFilterMenu = (event: MouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();

    setFloatingMenu({
      type: 'status-filter',
      top: rect.bottom + 8,
      left: rect.left,
      width: rect.width,
    });
  };

  const openProjectStatusMenu = (event: MouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();

    setFloatingMenu({
      type: 'project-status',
      top: rect.bottom + 8,
      left: rect.left,
      width: rect.width,
    });
  };

  const openProjectActionsMenu = (
    event: MouseEvent<HTMLButtonElement>,
    project: Project
  ) => {
    const rect = event.currentTarget.getBoundingClientRect();

    setFloatingMenu({
      type: 'project-actions',
      top: rect.bottom + 8,
      right: Math.max(16, window.innerWidth - rect.right),
      project,
    });
  };

  const openProjectDocumentModal = () => {
    setProjectDocumentForm(EMPTY_PROJECT_DOCUMENT_FORM);
    setProjectDocumentModalError('');
    setIsProjectDocumentModalOpen(true);
  };

  const closeProjectDocumentModal = () => {
    setIsProjectDocumentModalOpen(false);
    setProjectDocumentForm(EMPTY_PROJECT_DOCUMENT_FORM);
    setProjectDocumentModalError('');
    setIsSavingProjectDocument(false);
  };

  const updateProjectDocumentField = (
    field: keyof ProjectDocumentForm,
    value: string
  ) => {
    setProjectDocumentForm(current => ({
      ...current,
      [field]: value,
    }));
  };

  const uploadProjectDocumentFile = async (file: File) => {
    if (!selectedProject) return;

    if (!canManageProjectDocuments) {
      setProjectDocumentError('Projects manage access is required to upload project documents.');
      return;
    }

    setIsUploadingProjectDocument(true);
    setProjectDocumentError('');

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error('Login session expired. Sign in again before uploading.');
      }

      const dataUrl = await readFileAsDataUrl(file);
      const response = await fetch('/api/project-documents/upload', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId: selectedProject.id,
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          base64Data: getBase64Payload(dataUrl),
          category: 'Project Document',
          notes: '',
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.error || 'Could not upload project document.');
      }

      const savedDocument = result.document as ProjectDocument;
      setProjectDocuments(current => [savedDocument, ...current]);
      setSelectedProjectDocument(savedDocument);
    } catch (uploadError) {
      setProjectDocumentError(
        uploadError instanceof Error
          ? uploadError.message
          : 'Could not upload project document.'
      );
    } finally {
      setIsUploadingProjectDocument(false);
    }
  };

  const handleProjectDocumentFileChange = (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) return;

    void uploadProjectDocumentFile(file);
  };

  const deleteProjectDocument = async (document: ProjectDocument) => {
    if (!canManageProjectDocuments) {
      setProjectDocumentError('Projects manage access is required to delete project documents.');
      return;
    }

    setIsDeletingProjectDocument(true);
    setProjectDocumentError('');

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error('Login session expired. Sign in again before deleting.');
      }

      const response = await fetch('/api/project-documents/delete', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          documentId: document.id,
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.error || 'Could not delete project document.');
      }

      setProjectDocuments(current =>
        current.filter(projectDocument => projectDocument.id !== document.id)
      );
      setSelectedProjectDocument(current =>
        current?.id === document.id ? null : current
      );
      setProjectDocumentWebviewTarget(current =>
        current?.id === document.id ? null : current
      );
      setProjectDocumentDeleteTarget(null);
    } catch (deleteError) {
      setProjectDocumentError(
        deleteError instanceof Error
          ? deleteError.message
          : 'Could not delete project document.'
      );
    } finally {
      setIsDeletingProjectDocument(false);
    }
  };

  const saveProjectDocument = async () => {
    if (!selectedProject) return;

    if (!canManageProjectDocuments) {
      setProjectDocumentModalError('Projects manage access is required to add project documents.');
      return;
    }

    const name = projectDocumentForm.name.trim();
    const documentUrl = projectDocumentForm.document_url.trim();
    const category = projectDocumentForm.category.trim() || 'Project Document';
    const notes = projectDocumentForm.notes.trim();

    if (!name) {
      setProjectDocumentModalError('Document name is required.');
      return;
    }

    if (!documentUrl) {
      setProjectDocumentModalError('Document link is required.');
      return;
    }

    if (!getSafeDocumentUrl(documentUrl)) {
      setProjectDocumentModalError('Use a valid http or https document link.');
      return;
    }

    setIsSavingProjectDocument(true);
    setProjectDocumentModalError('');

    try {
      const { data, error: documentError } = await supabase
        .from('project_documents')
        .insert({
          project_id: selectedProject.id,
          name,
          document_url: documentUrl,
          category,
          notes,
          created_by: profile?.id ?? null,
        })
        .select('*')
        .single();

      if (documentError) throw documentError;

      const savedDocument = data as ProjectDocument;
      setProjectDocuments(current => [savedDocument, ...current]);
      setSelectedProjectDocument(savedDocument);
      closeProjectDocumentModal();
    } catch (documentError) {
      setProjectDocumentModalError(
        documentError instanceof Error
          ? documentError.message
          : 'Could not save project document.'
      );
    } finally {
      setIsSavingProjectDocument(false);
    }
  };

  const openCheckpointDetail = (checkpoint: ProjectCheckpoint) => {
    setSelectedCheckpoint(checkpoint);
    setCheckpointDetailForm(getCheckpointDetailForm(checkpoint));
    setCheckpointDetailError('');
  };

  const closeCheckpointDetail = () => {
    setSelectedCheckpoint(null);
    setCheckpointDetailForm(EMPTY_CHECKPOINT_DETAIL_FORM);
    setCheckpointDetailError('');
    setIsSavingCheckpointDetail(false);
  };

  const updateCheckpointDetailField = (
    field:
      | CheckpointDetailTextField
      | 'executionCompletionNotes'
      | 'executionPendingWorks'
      | 'executionHandoverReadiness'
      | 'qcChecklistNotes'
      | 'qcSnagList'
      | 'qcReportNotes'
      | 'handoverClientConfirmation'
      | 'handoverDocuments'
      | 'warrantyNotes'
      | 'finalHandoverNotes',
    value: string
  ) => {
    setCheckpointDetailForm(current => ({
      ...current,
      [field]: value,
    }));
  };

  const addClientRequirementRow = () => {
    setCheckpointDetailForm(current => ({
      ...current,
      clientRequirementRows: [
        ...current.clientRequirementRows,
        createEmptyClientRequirementRow(),
      ],
    }));
  };

  const addClientRequirementItemToArea = (areaName: string) => {
    const normalizedAreaName = normalizeSiteVisitAreaName(areaName);

    setCheckpointDetailForm(current => ({
      ...current,
      clientRequirementRows: [
        ...current.clientRequirementRows,
        {
          ...createEmptyClientRequirementRow(),
          areaName: normalizedAreaName,
        },
      ],
    }));
  };

  const addClientRequirementArea = (areaName: string) => {
    const normalizedAreaName = normalizeSiteVisitAreaName(areaName);

    if (!normalizedAreaName) return;

    setCheckpointDetailForm(current => {
      const areaExists = current.clientRequirementRows.some(
        row =>
          normalizeSiteVisitAreaName(row.areaName).toLowerCase() ===
          normalizedAreaName.toLowerCase()
      );

      if (areaExists) {
        return {
          ...current,
          clientRequirementRows: [
            ...current.clientRequirementRows,
            {
              ...createEmptyClientRequirementRow(),
              areaName: normalizedAreaName,
            },
          ],
        };
      }

      return {
        ...current,
        clientRequirementRows: [
          ...current.clientRequirementRows,
          {
            ...createEmptyClientRequirementRow(),
            areaName: normalizedAreaName,
          },
        ],
      };
    });
  };

  const getRequirementAreaNames = () =>
    checkpointDetailForm.clientRequirementRows
      .map(row => normalizeSiteVisitAreaName(row.areaName))
      .filter(Boolean);

  const hasRequirementArea = (areaName: string) =>
    getRequirementAreaNames().some(
      currentAreaName => currentAreaName.toLowerCase() === areaName.toLowerCase()
    );

  const getNextNumberedRequirementAreaName = (
    baseName: string,
    masterName: string
  ) => {
    const currentAreaNames = getRequirementAreaNames();

    if (!currentAreaNames.some(areaName => areaName.toLowerCase() === masterName.toLowerCase())) {
      return masterName;
    }

    const escapedBaseName = baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const matcher = new RegExp(`^${escapedBaseName}\\s+(\\d+)$`, 'i');
    const existingNumbers = currentAreaNames
      .map(areaName => {
        const match = areaName.match(matcher);
        return match ? Number(match[1]) : 0;
      })
      .filter(number => Number.isFinite(number) && number > 0);

    const nextNumber = existingNumbers.length > 0
      ? Math.max(...existingNumbers) + 1
      : 2;

    return `${baseName} ${nextNumber}`;
  };

  const addRequirementBedroom = () => {
    addClientRequirementArea(
      getNextNumberedRequirementAreaName('Bedroom', 'Master Bedroom')
    );
  };

  const addRequirementAttachedBathroom = () => {
    addClientRequirementArea(
      getNextNumberedRequirementAreaName('Attached Bathroom', 'Master Bathroom')
    );
  };

  const addRequirementBedroomSet = () => {
    const bedroomName = getNextNumberedRequirementAreaName('Bedroom', 'Master Bedroom');
    const bathroomName = getNextNumberedRequirementAreaName(
      'Attached Bathroom',
      'Master Bathroom'
    );

    addClientRequirementArea(bedroomName);
    addClientRequirementArea(bathroomName);
  };

  const addRequirementCommonBathroom = () => {
    const baseName = 'Common Bathroom';

    if (!hasRequirementArea(baseName)) {
      addClientRequirementArea(baseName);
      return;
    }

    const currentAreaNames = getRequirementAreaNames();
    const existingNumbers = currentAreaNames
      .map(areaName => {
        const match = areaName.match(/^Common Bathroom\s+(\d+)$/i);
        return match ? Number(match[1]) : 0;
      })
      .filter(number => Number.isFinite(number) && number > 0);
    const nextNumber = existingNumbers.length > 0
      ? Math.max(...existingNumbers) + 1
      : 2;

    addClientRequirementArea(`${baseName} ${nextNumber}`);
  };

  const addRequirementCustomArea = () => {
    const normalizedAreaName = normalizeSiteVisitAreaName(siteVisitCustomAreaName);

    if (!normalizedAreaName) return;

    addClientRequirementArea(normalizedAreaName);
    setSiteVisitCustomAreaName('');
  };

  const updateClientRequirementRow = (
    rowId: string,
    field: keyof Omit<ClientRequirementRowForm, 'id'>,
    value: string
  ) => {
    setCheckpointDetailForm(current => ({
      ...current,
      clientRequirementRows: current.clientRequirementRows.map(row =>
        row.id === rowId ? { ...row, [field]: value } : row
      ),
    }));
  };

  const removeClientRequirementRow = (rowId: string) => {
    setCheckpointDetailForm(current => ({
      ...current,
      clientRequirementRows: current.clientRequirementRows.filter(row => row.id !== rowId),
    }));
  };

  const addClientRequirementMeasurement = (rowId: string) => {
    setCheckpointDetailForm(current => ({
      ...current,
      clientRequirementRows: current.clientRequirementRows.map(row =>
        row.id === rowId
          ? {
              ...row,
              measurements: [
                ...row.measurements,
                {
                  ...createEmptyClientRequirementMeasurement(),
                  heightCm:
                    row.measurements[row.measurements.length - 1]?.heightCm || '',
                  quantity:
                    row.measurements[row.measurements.length - 1]?.quantity || '1',
                },
              ],
            }
          : row
      ),
    }));
  };

  const updateClientRequirementMeasurement = (
    rowId: string,
    measurementId: string,
    field: keyof Omit<ClientRequirementMeasurementForm, 'id'>,
    value: string
  ) => {
    setCheckpointDetailForm(current => ({
      ...current,
      clientRequirementRows: current.clientRequirementRows.map(row =>
        row.id === rowId
          ? {
              ...row,
              measurements: row.measurements.map(measurement =>
                measurement.id === measurementId
                  ? { ...measurement, [field]: value }
                  : measurement
              ),
            }
          : row
      ),
    }));
  };

  const removeClientRequirementMeasurement = (
    rowId: string,
    measurementId: string
  ) => {
    setCheckpointDetailForm(current => ({
      ...current,
      clientRequirementRows: current.clientRequirementRows.map(row => {
        if (row.id !== rowId) return row;

        const nextMeasurements = row.measurements.filter(
          measurement => measurement.id !== measurementId
        );

        return {
          ...row,
          measurements:
            nextMeasurements.length > 0
              ? nextMeasurements
              : [createEmptyClientRequirementMeasurement()],
        };
      }),
    }));
  };

  const updateClientRequirementAreaGroup = (
    currentAreaName: string,
    nextAreaName: string
  ) => {
    const currentAreaKey = getClientRequirementAreaKey(currentAreaName);

    setCheckpointDetailForm(current => ({
      ...current,
      clientRequirementRows: current.clientRequirementRows.map(row =>
        getClientRequirementAreaKey(row.areaName) === currentAreaKey
          ? { ...row, areaName: nextAreaName }
          : row
      ),
    }));
  };

  const removeClientRequirementAreaGroup = (areaName: string) => {
    const areaKey = getClientRequirementAreaKey(areaName);

    setCheckpointDetailForm(current => ({
      ...current,
      clientRequirementRows: current.clientRequirementRows.filter(
        row => getClientRequirementAreaKey(row.areaName) !== areaKey
      ),
    }));
  };

  const handleSiteVisitItemNameChange = (rowId: string, itemName: string) => {
    setCheckpointDetailForm(current => ({
      ...current,
      clientRequirementRows: current.clientRequirementRows.map(row =>
        row.id === rowId ? { ...row, itemName, itemId: '' } : row
      ),
    }));
    setSiteVisitItemDropdownRowId(rowId);
  };

  const selectClientRequirementItem = (
    rowId: string,
    item: SiteVisitProcurementItemOption
  ) => {
    setCheckpointDetailForm(current => ({
      ...current,
      clientRequirementRows: current.clientRequirementRows.map(row =>
        row.id === rowId
          ? {
              ...row,
              itemId: item.id,
              itemName: item.name,
              outputUnit: getClientRequirementOutputUnitFromLabel(
                item.defaultUnitLabel || row.outputUnit || row.unit || 'sqft'
              ),
              measurements:
                row.measurements.length > 0
                  ? row.measurements
                  : [createEmptyClientRequirementMeasurement()],
              unit: getClientRequirementOutputUnitFromLabel(
                item.defaultUnitLabel || row.outputUnit || row.unit || 'sqft'
              ),
              notes: row.notes,
            }
          : row
      ),
    }));
    setSiteVisitItemDropdownRowId(null);
  };

  const saveCheckpointDetails = async (options?: {
    complete?: boolean;
    completeChecklist?: boolean;
    qcReportGenerated?: boolean;
    designPhaseStatus?: DesignPhaseWorkflowStatus;
    designEstimateApproved?: boolean;
    executionTransferredForQc?: boolean;
  }) => {
    if (!selectedCheckpoint) return;

    if (!canManageProjects) {
      setCheckpointDetailError('Only admins can update project checkpoint details.');
      return;
    }

    if (selectedCheckpoint.status === 'locked') {
      setCheckpointDetailError('This checkpoint is locked. Complete the previous stage first.');
      return;
    }

    setIsSavingCheckpointDetail(true);
    setCheckpointDetailError('');

    try {
      const metadata = getCheckpointMetadata(selectedCheckpoint);
      const effectiveForm: CheckpointDetailForm = {
        ...checkpointDetailForm,
        designPhaseStatus:
          options?.designPhaseStatus ?? checkpointDetailForm.designPhaseStatus,
        designEstimateApproved:
          options?.designEstimateApproved ?? checkpointDetailForm.designEstimateApproved,
      };

      const designEstimateRows = getCompactDesignEstimateRows(
        effectiveForm.designEstimateRows
      );
      const designEstimateTotal = calculateDesignEstimateTotal(designEstimateRows);

      const clientRequirementRows = getCompactClientRequirementRows(
        effectiveForm.clientRequirementRows
      );
      const shouldGenerateQcReport = options?.qcReportGenerated === true;
      const shouldTransferExecutionForQc =
        options?.executionTransferredForQc === true;
      const nextMetadata = {
        ...metadata,
        client_requirements: effectiveForm.clientRequirements.trim(),
        client_requirement_items: clientRequirementRows,
        site_measurements: effectiveForm.siteMeasurements.trim(),
        custom_requirements: effectiveForm.customRequirements.trim(),
        execution_completion_notes: effectiveForm.executionCompletionNotes.trim(),
        execution_pending_works: effectiveForm.executionPendingWorks.trim(),
        execution_handover_readiness: effectiveForm.executionHandoverReadiness.trim(),
        qc_checklist_notes: effectiveForm.qcChecklistNotes.trim(),
        qc_snag_list: effectiveForm.qcSnagList.trim(),
        qc_report_notes: effectiveForm.qcReportNotes.trim(),
        handover_client_confirmation: effectiveForm.handoverClientConfirmation.trim(),
        handover_documents: effectiveForm.handoverDocuments.trim(),
        warranty_notes: effectiveForm.warrantyNotes.trim(),
        final_handover_notes: effectiveForm.finalHandoverNotes.trim(),
        design_approval_notes: effectiveForm.designApprovalNotes.trim(),
        design_estimate_notes: effectiveForm.designEstimateNotes.trim(),
        design_bypass_reason: effectiveForm.designBypassReason.trim(),
        design_service_scope: designEstimateRows.map(row => row.serviceName).join(', '),
        design_fee_amount: String(designEstimateTotal),
        design_service_estimate_notes: effectiveForm.designServiceEstimateNotes.trim(),
        design_estimate_rows: designEstimateRows,
        design_estimate_approved: effectiveForm.designEstimateApproved,
        design_phase_status: effectiveForm.designPhaseStatus,
        execution_transferred_for_qc:
          shouldTransferExecutionForQc ||
          getBooleanMetadataValue(
            metadata,
            'execution_transferred_for_qc',
            'executionTransferredForQc'
          ),
        execution_transferred_for_qc_at: shouldTransferExecutionForQc
          ? new Date().toISOString()
          : metadata.execution_transferred_for_qc_at ??
            metadata.executionTransferredForQcAt ??
            null,
        execution_transferred_for_qc_by: shouldTransferExecutionForQc
          ? profile?.id ?? null
          : metadata.execution_transferred_for_qc_by ??
            metadata.executionTransferredForQcBy ??
            null,
        execution_transfer_summary: shouldTransferExecutionForQc
          ? `Execution transferred for QC after all Timeline work packages were completed for ${selectedProject?.name ?? 'project'}.`
          : metadata.execution_transfer_summary ??
            metadata.executionTransferSummary ??
            '',
        qc_report_generated:
          shouldGenerateQcReport ||
          getBooleanMetadataValue(metadata, 'qc_report_generated', 'qcReportGenerated'),
        qc_report_generated_at: shouldGenerateQcReport
          ? new Date().toISOString()
          : metadata.qc_report_generated_at ?? metadata.qcReportGeneratedAt ?? null,
        qc_report_generated_by: shouldGenerateQcReport
          ? profile?.id ?? null
          : metadata.qc_report_generated_by ?? metadata.qcReportGeneratedBy ?? null,
        qc_report_summary: shouldGenerateQcReport
          ? `QC report generated for ${selectedProject?.name ?? 'project'} after checklist verification.${effectiveForm.qcSnagList.trim() ? ` Snags: ${effectiveForm.qcSnagList.trim()}` : ''}${effectiveForm.qcReportNotes.trim() ? ` Notes: ${effectiveForm.qcReportNotes.trim()}` : ''}`
          : metadata.qc_report_summary ?? metadata.qcReportSummary ?? '',
      };

      const shouldCompleteChecklist = options?.complete || options?.completeChecklist;
      const updates = {
        notes: effectiveForm.notes.trim(),
        metadata: nextMetadata,
        checklist: shouldCompleteChecklist
          ? getCheckpointChecklistItems(selectedCheckpoint).map(item => ({
              ...item,
              is_completed: true,
              completed: true,
              status: 'completed',
            }))
          : buildCheckpointChecklist(selectedCheckpoint, effectiveForm),
        status: options?.complete
          ? effectiveForm.designPhaseStatus === 'bypassed'
            ? 'skipped'
            : 'completed'
          : options?.completeChecklist && selectedCheckpoint.status === 'available'
            ? 'in_progress'
            : getCheckpointSaveStatus(selectedCheckpoint, effectiveForm),
        completed_at: options?.complete
          ? new Date().toISOString()
          : selectedCheckpoint.completed_at,
        completed_by: options?.complete
          ? profile?.id ?? null
          : selectedCheckpoint.completed_by,
      } as Parameters<typeof updateProjectCheckpoint>[1];

      const savedCheckpoint = await updateProjectCheckpoint(selectedCheckpoint.id, updates);

      if (!savedCheckpoint) {
        throw new Error('Could not save checkpoint details.');
      }

      let unlockedCheckpoint: ProjectCheckpoint | null = null;

      if (options?.complete) {
        const sortedCheckpoints = sortProjectCheckpoints(projectCheckpoints);
        const currentIndex = sortedCheckpoints.findIndex(
          checkpoint => checkpoint.id === selectedCheckpoint.id
        );
        const nextCheckpoint = sortedCheckpoints[currentIndex + 1];

        if (nextCheckpoint?.status === 'locked') {
          unlockedCheckpoint = await updateProjectCheckpoint(nextCheckpoint.id, {
            status: 'available',
          });
        }
      }

      setProjectCheckpoints(current =>
        sortProjectCheckpoints(
          current.map(checkpoint => {
            if (checkpoint.id === savedCheckpoint.id) return savedCheckpoint;
            if (unlockedCheckpoint && checkpoint.id === unlockedCheckpoint.id) {
              return unlockedCheckpoint;
            }
            return checkpoint;
          })
        )
      );

      if (options?.complete) {
        closeCheckpointDetail();
        return;
      }

      setSelectedCheckpoint(savedCheckpoint);
      setCheckpointDetailForm(getCheckpointDetailForm(savedCheckpoint));
    } catch (checkpointError) {
      setCheckpointDetailError(
        checkpointError instanceof Error
          ? checkpointError.message
          : 'Could not save checkpoint details.'
      );
    } finally {
      setIsSavingCheckpointDetail(false);
    }
  };


  const approveDesignEstimate = async () => {
    if (!selectedCheckpoint || selectedCheckpoint.checkpoint_key !== 'design_phase') {
      return;
    }

    if (selectedCheckpoint.status === 'locked') {
      setCheckpointDetailError('Design Phase is locked. Complete Initial Site Visit first.');
      return;
    }

    const validRows = getValidDesignEstimateRows(checkpointDetailForm.designEstimateRows);

    if (validRows.length === 0) {
      setCheckpointDetailError(
        'Add at least one service row with service name, quantity, and rate before approving the estimate.'
      );
      return;
    }

    await saveCheckpointDetails({
      designPhaseStatus: 'in_progress',
      designEstimateApproved: true,
    });
  };

  const approveDesignPhase = async () => {
    if (!selectedCheckpoint || selectedCheckpoint.checkpoint_key !== 'design_phase') {
      return;
    }

    if (!checkpointDetailForm.designEstimateApproved) {
      setCheckpointDetailError('Approve the design estimate before approving Design Phase.');
      return;
    }

    await saveCheckpointDetails({
      complete: true,
      designPhaseStatus: 'approved',
      designEstimateApproved: true,
    });
  };

  const bypassDesignPhase = async () => {
    if (!selectedCheckpoint || selectedCheckpoint.checkpoint_key !== 'design_phase') {
      return;
    }

    if (selectedCheckpoint.status === 'locked') {
      setCheckpointDetailError('Design Phase is locked. Complete Initial Site Visit first.');
      return;
    }

    if (!hasText(checkpointDetailForm.designBypassReason)) {
      setCheckpointDetailError('Add a bypass reason before bypassing Design Phase.');
      return;
    }

    await saveCheckpointDetails({
      complete: true,
      designPhaseStatus: 'bypassed',
      designEstimateApproved: false,
    });
  };

  const transferExecutionForQc = async () => {
    if (!selectedCheckpoint || selectedCheckpoint.checkpoint_key !== 'execution') {
      return;
    }

    if (selectedCheckpoint.status === 'locked') {
      setCheckpointDetailError('Execution is locked. Complete the previous stages first.');
      return;
    }

    if (!selectedProject) {
      setCheckpointDetailError('Select a project before transferring Execution for QC.');
      return;
    }

    const readiness = getExecutionTransferReadiness({
      estimate: projectCostEstimateSummaries[selectedProject.id],
      timeline: projectTimelineSummaries[selectedProject.id],
      isEstimateLoading: projectCostEstimateSummariesLoading,
      isTimelineLoading: projectTimelineSummariesLoading,
    });

    if (!readiness.canTransfer) {
      setCheckpointDetailError(readiness.reason);
      return;
    }

    await saveCheckpointDetails({
      complete: true,
      executionTransferredForQc: true,
    });
  };

  const completeQcChecklist = async () => {
    if (!selectedCheckpoint || selectedCheckpoint.checkpoint_key !== 'quality_control') {
      return;
    }

    if (selectedCheckpoint.status === 'locked') {
      setCheckpointDetailError('Quality Control is locked. Complete Execution first.');
      return;
    }

    await saveCheckpointDetails({
      completeChecklist: true,
    });
  };

  const generateQcReport = async () => {
    if (!selectedCheckpoint || selectedCheckpoint.checkpoint_key !== 'quality_control') {
      return;
    }

    if (selectedCheckpoint.status === 'locked') {
      setCheckpointDetailError('Quality Control is locked. Complete Execution first.');
      return;
    }

    if (!isCheckpointChecklistComplete(selectedCheckpoint)) {
      setCheckpointDetailError('Complete the QC checklist before generating the QC Report.');
      return;
    }

    await saveCheckpointDetails({
      qcReportGenerated: true,
    });
  };

  const completeQcPhase = async () => {
    if (!selectedCheckpoint || selectedCheckpoint.checkpoint_key !== 'quality_control') {
      return;
    }

    if (!isCheckpointChecklistComplete(selectedCheckpoint)) {
      setCheckpointDetailError('Complete the QC checklist before completing Quality Control.');
      return;
    }

    if (!isQcReportGenerated(selectedCheckpoint)) {
      setCheckpointDetailError('Generate the QC Report before completing Quality Control.');
      return;
    }

    await saveCheckpointDetails({
      complete: true,
    });
  };

  const addDesignEstimateRow = () => {
    setCheckpointDetailForm(current => ({
      ...current,
      designEstimateRows: [
        ...current.designEstimateRows,
        createEmptyDesignEstimateLine(),
      ],
    }));
  };

  const updateDesignEstimateRow = (
    rowId: string,
    field: keyof Omit<DesignEstimateLineForm, 'id'>,
    value: string
  ) => {
    setCheckpointDetailForm(current => ({
      ...current,
      designEstimateRows: current.designEstimateRows.map(row =>
        row.id === rowId ? { ...row, [field]: value } : row
      ),
    }));
  };

  const removeDesignEstimateRow = (rowId: string) => {
    setCheckpointDetailForm(current => {
      const nextRows = current.designEstimateRows.filter(row => row.id !== rowId);

      return {
        ...current,
        designEstimateRows:
          nextRows.length > 0 ? nextRows : [createEmptyDesignEstimateLine()],
      };
    });
  };

  const handleExportDesignEstimatePdf = () => {
    if (!selectedProject || !selectedCheckpoint) return;

    const rows = getValidDesignEstimateRows(checkpointDetailForm.designEstimateRows);

    if (rows.length === 0) {
      setCheckpointDetailError('Add at least one valid service row before exporting PDF.');
      return;
    }

    void exportDesignEstimatePdf({
      projectName: selectedProject.name || 'Design Estimate',
      clientName: selectedProject.client || undefined,
      status: getDesignPhaseStatusLabel(checkpointDetailForm.designPhaseStatus),
      version: 1,
      rows: rows.map(row => ({
        id: row.id,
        serviceName: row.serviceName,
        unit: row.unit,
        quantity: getNumericInputValue(row.quantity),
        rate: getNumericInputValue(row.rate),
      })),
      total: calculateDesignEstimateTotal(rows),
      preparedAt: new Date().toISOString(),
    }).catch(error => {
      console.error('Design estimate PDF export failed.', error);
      setCheckpointDetailError('Could not export design estimate PDF.');
    });
  };


  const openCreateProjectModal = () => {
    if (!canManageProjects) return;

    setEditingProject(null);
    setPendingProjectRequest(null);
    setProjectForm(EMPTY_PROJECT_FORM);
    setModalError('');
    setIsProjectModalOpen(true);
  };

  const openEditProjectModal = (project: Project) => {
    if (!canManageProjects) return;

    setEditingProject(project);
    setPendingProjectRequest(null);
    setProjectForm(getProjectFormFromRecord(project));
    setModalError('');
    setFloatingMenu(null);
    setIsProjectModalOpen(true);
  };

  const closeProjectModal = () => {
    if (isSavingProject) return;

    setIsProjectModalOpen(false);
    setEditingProject(null);
    setPendingProjectRequest(null);
    setProjectForm(EMPTY_PROJECT_FORM);
    setModalError('');
  };

  const updateProjectForm = <Key extends keyof ProjectFormState>(
    key: Key,
    value: ProjectFormState[Key]
  ) => {
    setProjectForm(current => ({
      ...current,
      [key]: value,
    }));
  };

  const openApproveProjectRequestModal = (lead: Lead) => {
    if (!canManageProjects) return;

    setEditingProject(null);
    setPendingProjectRequest(lead);
    setProjectForm({
      ...EMPTY_PROJECT_FORM,
      name: '',
      client: lead.name || '',
      description: lead.notes || '',
    });
    setModalError('');
    setIsProjectModalOpen(true);
  };

  const handleSaveProject = async () => {
    if (!canManageProjects) return;

    const name = projectForm.name.trim();
    const client = projectForm.client.trim();
    const description = projectForm.description.trim();

    if (!name) {
      setModalError('Project name is required.');
      return;
    }

    if (!client) {
      setModalError('Client name is required.');
      return;
    }

    setIsSavingProject(true);
    setModalError('');

    const operationalPayload = {
      name,
      client,
      status: projectForm.status,
      description,
      updated_at: new Date().toISOString(),
    };

    if (pendingProjectRequest) {
      const { data, error: createError } = await supabase
        .from('projects')
        .insert({
          ...operationalPayload,
          start_date: null,
          end_date: null,
          revenue: 0,
          estimated_cogs: 0,
          design_fee_pct: 0,
          created_from_lead_id: pendingProjectRequest.id,
          created_by: profile?.id || null,
        })
        .select()
        .maybeSingle();

      setIsSavingProject(false);

      if (createError) {
        setModalError(createError.message);
        return;
      }

      const createdProject = data as Project | null;

      if (!createdProject) {
        setModalError('Project was not created. Please try again.');
        return;
      }

      const { error: leadUpdateError } = await supabase
        .from('leads')
        .update({
          converted_project_id: createdProject.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', pendingProjectRequest.id);

      if (leadUpdateError) {
        setModalError(leadUpdateError.message);
        return;
      }

      const notificationsDeleted = await deleteProjectRequestNotifications(pendingProjectRequest);

      if (!notificationsDeleted) return;

      const { data: persistedProject, error: persistedProjectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', createdProject.id)
        .maybeSingle();

      if (persistedProjectError) {
        setModalError(persistedProjectError.message);
        return;
      }

      await fetchProjects();
      await fetchProjectRequests();

      setProjectRequests(current =>
        current.filter(request => request.id !== pendingProjectRequest.id)
      );
      setSelectedProject((persistedProject as Project | null) || createdProject);
      closeProjectModal();
      return;
    }

    const { data, error: saveError } = editingProject
      ? await supabase
          .from('projects')
          .update(operationalPayload)
          .eq('id', editingProject.id)
          .select()
      : await supabase
          .from('projects')
          .insert({
            ...operationalPayload,
            start_date: null,
            end_date: null,
            revenue: 0,
            estimated_cogs: 0,
            design_fee_pct: 0,
            created_by: profile?.id || null,
          })
          .select();

    setIsSavingProject(false);

    if (saveError) {
      setModalError(saveError.message);
      return;
    }

    const savedProject = data?.[0] as Project | undefined;

    if (savedProject) {
      setProjects(current => {
        if (editingProject) {
          return current.map(project =>
            project.id === savedProject.id ? savedProject : project
          );
        }

        return [savedProject, ...current];
      });

      setSelectedProject(current =>
        current?.id === savedProject.id ? savedProject : current
      );
    } else {
      await fetchProjects();
    }

    closeProjectModal();
  };

  const handleDeleteProject = async () => {
    if (!canManageProjects || !deleteTarget) return;

    const targetId = deleteTarget.id;
    const linkedLeadId = deleteTarget.created_from_lead_id || null;

    setError('');

    let linkedLead: Lead | null = null;

    if (linkedLeadId) {
      const { data: leadData, error: leadFetchError } = await supabase
        .from('leads')
        .select('*')
        .eq('id', linkedLeadId)
        .maybeSingle();

      if (leadFetchError) {
        setError(leadFetchError.message);
        return;
      }

      linkedLead = (leadData as Lead | null) || null;
    }

    try {
      await deleteProjectDependentRecords(targetId);

      const { error: deleteError } = await supabase
        .from('projects')
        .delete()
        .eq('id', targetId);

      if (deleteError) {
        throw deleteError;
      }

      if (linkedLead) {
        const { error: leadUpdateError } = await supabase
          .from('leads')
          .update({
            status: 'Qualified',
            converted_project_id: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', linkedLead.id);

        if (leadUpdateError) {
          throw leadUpdateError;
        }

        await deleteProjectRequestNotifications(linkedLead);
      }

      setProjects(current => current.filter(project => project.id !== targetId));
      setSelectedProject(current => (current?.id === targetId ? null : current));
      setDeleteTarget(null);
      setFloatingMenu(null);

      await fetchProjects();
      await fetchProjectRequests();
    } catch (deleteLifecycleError) {
      setError(
        deleteLifecycleError instanceof Error
          ? deleteLifecycleError.message
          : 'Could not delete project and linked records.'
      );
      setDeleteTarget(null);
    }
  };

  const deleteProjectRequestNotifications = async (lead: Lead) => {
    const links = [
      `/admin/projects?requestId=${lead.id}`,
      '/admin/projects',
    ];

    const { error: exactDeleteError } = await supabase
      .from('notifications')
      .delete()
      .eq('type', 'project')
      .eq('title', 'Project Creation Request')
      .in('link', links);

    if (exactDeleteError) {
      setError(exactDeleteError.message);
      return false;
    }

    const { error: legacyDeleteError } = await supabase
      .from('notifications')
      .delete()
      .eq('type', 'project')
      .eq('title', 'Project Creation Request')
      .ilike('message', `%${lead.name}%`);

    if (legacyDeleteError) {
      setError(legacyDeleteError.message);
      return false;
    }

    return true;
  };

  const handleApproveProjectRequest = async (lead: Lead) => {
    openApproveProjectRequestModal(lead);
  };

  const handleDeclineProjectRequest = async (lead: Lead) => {
    if (!canManageProjects) return;

    setError('');

    const { error: leadUpdateError } = await supabase
      .from('leads')
      .update({
        status: 'Qualified',
        converted_project_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', lead.id);

    if (leadUpdateError) {
      setError(leadUpdateError.message);
      return;
    }

    const notificationsDeleted = await deleteProjectRequestNotifications(lead);

    if (!notificationsDeleted) return;

    setProjectRequests(current => current.filter(request => request.id !== lead.id));
  };

  const projectModal = isProjectModalOpen && (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/70 p-4 backdrop-blur-md">
      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-2xl">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border p-4 sm:p-6">
          <div>
            <p className="text-lg font-semibold text-foreground">
              {editingProject ? 'Edit Project' : pendingProjectRequest ? 'Approve Project Request' : 'Create Project'}
            </p>

            {pendingProjectRequest && (
              <p className="mt-1 text-sm text-muted-foreground">
                Client details are filled from the lead request. Fill the project name before creating this project.
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={closeProjectModal}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Close project modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          {modalError && (
            <div className="mb-4 rounded-2xl border border-destructive/20 bg-destructive/10 p-4">
              <p className="text-sm text-destructive">{modalError}</p>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Project Name
              </label>
              <input
                value={projectForm.name}
                onChange={event => updateProjectForm('name', event.target.value)}
                placeholder="Enter project name"
                className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
              />
            </div>

            <div className={editingProject ? '' : 'sm:col-span-2'}>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Client
              </label>
              <input
                value={projectForm.client}
                onChange={event => updateProjectForm('client', event.target.value)}
                placeholder="Client name"
                className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
              />
            </div>

            {editingProject && (
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Project Status
                </label>
                <button
                  type="button"
                  onClick={openProjectStatusMenu}
                  className="flex h-11 w-full items-center justify-between gap-3 rounded-2xl border border-border bg-background px-4 text-left text-sm text-foreground transition-colors hover:bg-muted/40"
                >
                  <span className="truncate">{projectForm.status}</span>
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              </div>
            )}

            <div className="sm:col-span-2">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Notes
              </label>
              <textarea
                value={projectForm.description}
                onChange={event => updateProjectForm('description', event.target.value)}
                placeholder="Optional project notes"
                rows={4}
                className="w-full resize-none rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
              />
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-col-reverse gap-3 border-t border-border p-4 sm:flex-row sm:justify-end sm:p-6">
          <Button type="button" variant="outline" onClick={closeProjectModal}>
            Cancel
          </Button>

          <Button type="button" onClick={handleSaveProject} disabled={isSavingProject}>
            {isSavingProject
              ? 'Saving...'
              : editingProject
                ? 'Save Changes'
                : 'Create Project'}
          </Button>
        </div>
      </div>
    </div>
  );

  const deleteDialog = deleteTarget && (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 backdrop-blur-sm sm:items-center sm:p-6">
      <div className="w-full max-w-md rounded-t-3xl border border-border bg-card p-5 text-card-foreground shadow-xl sm:rounded-3xl">
        <h2 className="text-lg font-semibold text-foreground">
          Delete project?
        </h2>

        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          This will remove the project, erase linked Timeline and Finance workspace data, and convert linked Cost Estimates back to Unassigned Drafts. Vendor and item masters will not be deleted.
        </p>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => setDeleteTarget(null)}
          >
            Cancel
          </Button>

          <Button
            type="button"
            variant="destructive"
            onClick={handleDeleteProject}
          >
            Delete Project
          </Button>
        </div>
      </div>
    </div>
  );


  const floatingMenuLayer = floatingMenu && (
    <div
      className="fixed inset-0 z-[80]"
      onClick={() => setFloatingMenu(null)}
    >
      {floatingMenu.type === 'status-filter' && (
        <div
          className="fixed max-h-72 overflow-y-auto rounded-2xl border border-border bg-popover p-1 text-popover-foreground shadow-2xl"
          style={{
            top: floatingMenu.top,
            left: floatingMenu.left,
            width: floatingMenu.width,
          }}
          onClick={event => event.stopPropagation()}
        >
          {PROJECT_STATUSES.map(status => (
            <button
              key={status}
              type="button"
              onClick={() => {
                setStatusFilter(status);
                setFloatingMenu(null);
              }}
              className={`flex w-full rounded-xl px-3 py-2 text-left text-sm transition-colors hover:bg-muted ${
                statusFilter === status ? 'bg-muted text-foreground' : 'text-muted-foreground'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      )}

      {floatingMenu.type === 'project-status' && (
        <div
          className="fixed max-h-72 overflow-y-auto rounded-2xl border border-border bg-popover p-1 text-popover-foreground shadow-2xl"
          style={{
            top: floatingMenu.top,
            left: floatingMenu.left,
            width: floatingMenu.width,
          }}
          onClick={event => event.stopPropagation()}
        >
          {PROJECT_FORM_STATUSES.map(status => (
            <button
              key={status}
              type="button"
              onClick={() => {
                updateProjectForm('status', status);
                setFloatingMenu(null);
              }}
              className={`flex w-full rounded-xl px-3 py-2 text-left text-sm transition-colors hover:bg-muted ${
                projectForm.status === status ? 'bg-muted text-foreground' : 'text-muted-foreground'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      )}

      {floatingMenu.type === 'project-actions' && (
        <div
          className="fixed w-40 overflow-hidden rounded-2xl border border-border bg-popover p-1 text-popover-foreground shadow-2xl"
          style={{
            top: floatingMenu.top,
            right: floatingMenu.right,
          }}
          onClick={event => event.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => openEditProjectModal(floatingMenu.project)}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Pencil className="h-4 w-4" />
            Edit
          </button>

          <button
            type="button"
            onClick={() => {
              setDeleteTarget(floatingMenu.project);
              setFloatingMenu(null);
            }}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-destructive transition-colors hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </button>
        </div>
      )}
    </div>
  );

  if (selectedProject) {
    const projectStageActions = createProjectStageActions(
                mode,
                selectedProject.id,
                projectCheckpoints,
                projectTimelineSummaries[selectedProject.id],
                projectTimelineSummariesLoading,
                projectCostEstimateSummaries[selectedProject.id],
                projectCostEstimateSummariesLoading,
                projectFinanceSummaries[selectedProject.id],
                projectFinanceSummariesLoading
              );
    const completedCheckpointCount = projectCheckpoints.filter(
      checkpoint => checkpoint.status === 'completed' || checkpoint.status === 'skipped'
    ).length;
    const checkpointProgressLabel = projectCheckpoints.length > 0
      ? `${completedCheckpointCount}/${projectCheckpoints.length} completed`
      : 'Not initialized';

    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Button
              type="button"
              variant="outline"
              onClick={() => setSelectedProject(null)}
              className="mb-3 gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Projects
            </Button>

            <h1 className="text-2xl font-semibold text-foreground">
              {selectedProject.name}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {selectedProject.client || 'Client not set'}
            </p>
          </div>

          {canManageProjects && (
            <Button
              type="button"
              variant="outline"
              onClick={() => openEditProjectModal(selectedProject)}
              className="w-fit gap-2"
            >
              <Pencil className="h-4 w-4" />
              Edit Project
            </Button>
          )}
        </div>

        <section className="rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex flex-col gap-4 border-b border-border p-5 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-lg font-semibold tracking-tight text-foreground">
                  Project Overview
                </h2>

                <span
                  className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${getProjectStatusClass(selectedProject.status)}`}
                >
                  {selectedProject.status || 'Not set'}
                </span>
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-border bg-background p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Client
                </p>
                <p className="mt-3 text-sm font-semibold text-foreground">
                  {selectedProject.client || 'Not set'}
                </p>
              </div>

              <div className="rounded-2xl border border-border bg-background p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Project Status
                </p>
                <p className="mt-3 text-sm font-semibold text-foreground">
                  {selectedProject.status || 'Not set'}
                </p>
              </div>

              <div className="rounded-2xl border border-border bg-background p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Timeline
                </p>
                <p className="mt-3 text-sm font-semibold text-foreground">
                  {getProjectTimelineStatusLabel(
                    projectTimelineSummaries[selectedProject.id],
                    projectTimelineSummariesLoading
                  )}
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-border bg-background p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Project Documents
                  </p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Store project-level files, Google Drive links, site images, PDFs, and client-shared documents here.
                  </p>
                </div>

                {canManageProjectDocuments && (
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      ref={projectDocumentFileInputRef}
                      type="file"
                      className="hidden"
                      onChange={handleProjectDocumentFileChange}
                    />

                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => projectDocumentFileInputRef.current?.click()}
                      disabled={isUploadingProjectDocument}
                      className="w-fit gap-2"
                    >
                      <UploadCloud className="h-4 w-4" />
                      {isUploadingProjectDocument ? 'Uploading...' : 'Upload File'}
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={openProjectDocumentModal}
                      className="w-fit gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Add Link
                    </Button>
                  </div>
                )}
              </div>

              {projectDocumentError ? (
                <div className="mt-4 rounded-2xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                  {projectDocumentError}
                </div>
              ) : projectDocumentsLoading ? (
                <div className="mt-4 rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                  Loading project documents...
                </div>
              ) : projectDocuments.length === 0 ? (
                <div className="mt-4 rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                  No project documents added yet.
                </div>
              ) : (
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {projectDocuments.map((document, index) => {
                    const documentUrl = getSafeDocumentUrl(document.document_url);
                    const title = getProjectDocumentTitle(document, index);

                    return (
                      <button
                        key={document.id}
                        type="button"
                        onClick={() => setSelectedProjectDocument(document)}
                        className="group min-h-36 rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:border-sky-500/30 hover:bg-sky-500/5"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <span className="rounded-full border border-border bg-background px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                            {getProjectDocumentCategory(document)}
                          </span>

                          <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
                        </div>

                        <p className="mt-5 min-h-10 text-sm font-semibold leading-5 text-foreground">
                          {title}
                        </p>

                        <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">
                          {document.notes || (documentUrl ? 'Click to preview this document.' : 'No preview link added.')}
                        </p>

                        <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                          Preview
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mt-5 rounded-2xl border border-border bg-background p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Project Checkpoints
                  </p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Stage-gated project flow from site visit to handover.
                  </p>
                </div>

                <span className="w-fit rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground">
                  {projectCheckpointsLoading ? 'Loading...' : checkpointProgressLabel}
                </span>
              </div>

              {projectCheckpointError ? (
                <div className="mt-4 rounded-2xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                  {projectCheckpointError}
                </div>
              ) : projectCheckpointsLoading ? (
                <div className="mt-4 rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                  Loading project checkpoints...
                </div>
              ) : projectCheckpoints.length === 0 ? (
                <div className="mt-4 rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                  No checkpoints found for this project yet.
                </div>
              ) : (
                <div className="mt-4 grid gap-3 lg:grid-cols-5">
                  {projectCheckpoints.map(checkpoint => {
                    const checklistItems = getCheckpointChecklistItems(checkpoint);
                    const isCheckpointOpenable = checkpoint.status !== 'locked';
                    const checkpointCardContent = (
                      <>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-background text-xs font-semibold text-muted-foreground">
                            {checkpoint.sort_order}
                          </div>

                          <span
                            className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${getCheckpointStatusClass(checkpoint.status)}`}
                          >
                            {checkpoint.checkpoint_key === 'design_phase' && checkpoint.status === 'skipped'
                              ? 'Bypassed'
                              : getCheckpointStatusLabel(checkpoint.status)}
                          </span>
                        </div>

                        <p className="mt-5 min-h-10 text-sm font-semibold leading-5 text-foreground">
                          {checkpoint.title}
                        </p>
                        <p className="mt-2 min-h-[3.75rem] text-xs leading-5 text-muted-foreground">
                          {getCheckpointDescription(checkpoint.checkpoint_key)}
                        </p>

                        <div className="mt-4 flex-1 space-y-2">
                          {checklistItems.length === 0 ? (
                            <p className="rounded-xl border border-dashed border-border bg-background/70 px-3 py-2 text-xs text-muted-foreground">
                              No checklist items configured.
                            </p>
                          ) : (
                            checklistItems.map((item, index) => (
                              <div
                                key={`${checkpoint.id}-${index}`}
                                className="flex items-start gap-2 rounded-xl border border-border bg-background/70 px-3 py-2"
                              >
                                <span
                                  className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[10px] ${
                                    isChecklistItemComplete(item)
                                      ? 'border-emerald-500 bg-emerald-500 text-white'
                                      : 'border-border bg-card text-muted-foreground'
                                  }`}
                                >
                                  {isChecklistItemComplete(item) ? (
                                      <Check className="h-2.5 w-2.5" />
                                    ) : null}
                                </span>

                                <span className="text-xs leading-5 text-muted-foreground">
                                  {getChecklistItemLabel(item, index)}
                                </span>
                              </div>
                            ))
                          )}
                        </div>

                        {checkpoint.completed_at && (
                          <p className="mt-auto pt-4 text-[11px] text-muted-foreground">
                            Completed {new Date(checkpoint.completed_at).toLocaleDateString('en-IN')}
                          </p>
                        )}
                      </>
                    );

                    if (!isCheckpointOpenable) {
                      return (
                        <motion.div
                          key={checkpoint.id}
                          className={`flex min-h-[28rem] flex-col rounded-2xl border p-4 ${getCheckpointCardClass(checkpoint)}`}
                        >
                          {checkpointCardContent}
                        </motion.div>
                      );
                    }

                    return (
                      <motion.button
                        key={checkpoint.id}
                        type="button"
                        onClick={() => openCheckpointDetail(checkpoint)}
                        whileHover={{ y: -3, scale: 1.015 }}
                        whileTap={{ scale: 0.985 }}
                        transition={{ type: 'spring', stiffness: 420, damping: 28 }}
                        className={`flex min-h-[28rem] w-full flex-col rounded-2xl border p-4 text-left outline-none transition-colors hover:border-sky-400/45 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${getCheckpointCardClass(checkpoint)}`}
                      >
                        {checkpointCardContent}
                      </motion.button>
                    );
                  })}
                </div>
              )}
            </div>

            {selectedProject.description && (
              <div className="mt-4 rounded-2xl border border-border bg-background p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Notes
                </p>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
                  {selectedProject.description}
                </p>
              </div>
            )}

            <div className="mt-5 border-t border-border pt-5">
              <div className="flex flex-col gap-1">
                <p className="text-sm font-semibold text-foreground">
                  Project Actions
                </p>
                <p className="text-xs leading-5 text-muted-foreground">
                  Project-linked modules unlock after Design Phase is complete.
                </p>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {projectStageActions.map(action => {
                  const inner = (
                    <>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-foreground">
                            {action.label}
                          </p>
                          <span
                            className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${
                              action.isAvailable
                                ? 'border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300'
                                : 'border-border bg-muted text-muted-foreground'
                            }`}
                          >
                            {action.statusLabel}
                          </span>
                        </div>

                        <p className="mt-2 min-h-[3.75rem] text-xs leading-5 text-muted-foreground">
                          {action.isAvailable ? action.description : action.lockedReason}
                        </p>
                      </div>

                      {action.isAvailable && action.to ? (
                        <ExternalLink
                          size={16}
                          className="shrink-0 text-muted-foreground transition-colors group-hover:text-foreground"
                        />
                      ) : (
                        <span className="shrink-0 rounded-full border border-border bg-background px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                          Stage
                        </span>
                      )}
                    </>
                  );

                  if (action.isAvailable && action.to) {
                    return (
                      <Link
                        key={action.label}
                        to={action.to}
                        className="group flex min-h-24 items-center justify-between gap-4 rounded-2xl border border-sky-500/25 bg-sky-500/10 px-4 py-3 transition-colors hover:bg-sky-500/15"
                      >
                        {inner}
                      </Link>
                    );
                  }

                  if (action.checkpointKey && action.isAvailable) {
                    const checkpoint = getCheckpointByKey(
                      projectCheckpoints,
                      action.checkpointKey
                    );

                    return (
                      <button
                        key={action.label}
                        type="button"
                        onClick={() => checkpoint && openCheckpointDetail(checkpoint)}
                        className="flex min-h-24 items-center justify-between gap-4 rounded-2xl border border-sky-500/25 bg-sky-500/10 px-4 py-3 text-left transition-colors hover:border-sky-400/45 hover:bg-sky-500/15"
                      >
                        {inner}
                      </button>
                    );
                  }

                  return (
                    <div
                      key={action.label}
                      aria-disabled={!action.isAvailable}
                      className={
                        action.isAvailable
                          ? 'flex min-h-24 items-center justify-between gap-4 rounded-2xl border border-sky-500/25 bg-sky-500/10 px-4 py-3'
                          : 'flex min-h-24 cursor-not-allowed items-center justify-between gap-4 rounded-2xl border border-border bg-muted/30 px-4 py-3 opacity-80'
                      }
                    >
                      {inner}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {floatingMenuLayer}
        {projectModal}
        {deleteDialog}

        {isProjectDocumentModalOpen && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-3 pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:items-center sm:p-4">
            <div className="w-full max-w-2xl rounded-3xl border border-border bg-card shadow-2xl">
              <div className="shrink-0 flex items-start justify-between gap-4 border-b border-border p-4 sm:p-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                    Project Documents
                  </p>
                  <h2 className="mt-2 text-lg font-semibold text-foreground">
                    Add Document
                  </h2>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Add a project-level link for drawings, site images, PDFs, approvals, or Google Drive files.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeProjectDocumentModal}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Close add document"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-4 p-5">
                {projectDocumentModalError && (
                  <div className="rounded-2xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                    {projectDocumentModalError}
                  </div>
                )}

                <label className="block text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Document Name
                  <input
                    type="text"
                    value={projectDocumentForm.name}
                    onChange={event => updateProjectDocumentField('name', event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm font-normal normal-case tracking-normal text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring"
                    placeholder="Site measurement sheet / approved design PDF"
                  />
                </label>

                <label className="block text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Document Link
                  <input
                    type="text"
                    value={projectDocumentForm.document_url}
                    onChange={event => updateProjectDocumentField('document_url', event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm font-normal normal-case tracking-normal text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring"
                    placeholder="https://drive.google.com/..."
                  />
                </label>

                <label className="block text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Category
                  <input
                    type="text"
                    value={projectDocumentForm.category}
                    onChange={event => updateProjectDocumentField('category', event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm font-normal normal-case tracking-normal text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring"
                    placeholder="Site Images / PDF / Approval / Measurement"
                  />
                </label>

                <label className="block text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Notes
                  <textarea
                    value={projectDocumentForm.notes}
                    onChange={event => updateProjectDocumentField('notes', event.target.value)}
                    rows={3}
                    className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm font-normal normal-case tracking-normal text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring"
                    placeholder="Add a short note about this document."
                  />
                </label>
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-border p-5 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeProjectDocumentModal}
                  disabled={isSavingProjectDocument}
                >
                  Cancel
                </Button>

                <Button
                  type="button"
                  onClick={saveProjectDocument}
                  disabled={isSavingProjectDocument}
                >
                  {isSavingProjectDocument ? 'Saving...' : 'Save Document'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {selectedProjectDocument && (() => {
          const documentUrl = getSafeDocumentUrl(selectedProjectDocument.document_url);
          const previewUrl = getSafeDocumentUrl(
            getProjectDocumentPreviewUrl(selectedProjectDocument)
          );

          return (
            <div className="fixed left-0 right-0 top-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-50 flex items-end justify-center bg-black/55 p-3 sm:inset-0 sm:items-center sm:p-4">
              <div className="flex h-full w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-2xl sm:h-auto sm:max-h-[90vh]">
                <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border p-4 sm:p-5">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                      {getProjectDocumentCategory(selectedProjectDocument)}
                    </p>
                    <h2 className="mt-2 text-lg font-semibold text-foreground">
                      {selectedProjectDocument.name}
                    </h2>
                    {selectedProjectDocument.notes && (
                      <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">
                        {selectedProjectDocument.notes}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedProjectDocument(null)}
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    aria-label="Close document preview"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="min-h-0 flex-1 p-4 sm:p-5">
                  {documentUrl ? (
                    <div className="h-full min-h-0 overflow-hidden rounded-2xl border border-border bg-background">
                      <iframe
                        title={selectedProjectDocument.name}
                        src={previewUrl || documentUrl}
                        className="h-full w-full bg-background sm:h-[58vh]"
                      />
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">
                      This document does not have a valid preview link.
                    </div>
                  )}
                </div>

                <div className="shrink-0 border-t border-border bg-card p-3 sm:p-5">
                  <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        setProjectDocumentWebviewTarget(selectedProjectDocument)
                      }
                      disabled={!documentUrl}
                      className="w-full gap-2 sm:w-fit"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Open Full View
                    </Button>

                    {canManageProjectDocuments && (
                      <Button
                        type="button"
                        variant="destructive"
                        onClick={() =>
                          setProjectDocumentDeleteTarget(selectedProjectDocument)
                        }
                        className="w-full gap-2 sm:w-fit"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete Document
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {projectDocumentWebviewTarget && (() => {
          const documentUrl = getSafeDocumentUrl(projectDocumentWebviewTarget.document_url);
          const previewUrl = getSafeDocumentUrl(
            getProjectDocumentPreviewUrl(projectDocumentWebviewTarget)
          );

          return (
            <div className="fixed inset-0 z-[90] flex flex-col bg-card text-card-foreground">
              <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border bg-card p-4 sm:p-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                    Full Document
                  </p>
                  <h2 className="mt-2 text-base font-semibold text-foreground sm:text-lg">
                    {projectDocumentWebviewTarget.name}
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={() => setProjectDocumentWebviewTarget(null)}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Close document web view"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="min-h-0 flex-1 bg-background">
                {documentUrl ? (
                  <iframe
                    title={projectDocumentWebviewTarget.name}
                    src={previewUrl || documentUrl}
                    className="h-full w-full bg-background"
                  />
                ) : (
                  <div className="m-4 rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">
                    This document does not have a valid preview link.
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {projectDocumentDeleteTarget && (
          <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/60 p-4 sm:items-center">
            <div className="w-full max-w-md rounded-3xl border border-border bg-card p-5 shadow-2xl">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-destructive/20 bg-destructive/10 text-destructive">
                  <Trash2 className="h-5 w-5" />
                </div>

                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Delete document?
                  </p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    This removes the project document record. Google Drive files uploaded through Gravium OS will also be deleted from Drive.
                  </p>
                  <p className="mt-3 text-xs font-semibold text-foreground">
                    {projectDocumentDeleteTarget.name}
                  </p>
                </div>
              </div>

              {projectDocumentError && (
                <div className="mt-4 rounded-2xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                  {projectDocumentError}
                </div>
              )}

              <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setProjectDocumentDeleteTarget(null)}
                  disabled={isDeletingProjectDocument}
                >
                  Cancel
                </Button>

                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => deleteProjectDocument(projectDocumentDeleteTarget)}
                  disabled={isDeletingProjectDocument}
                >
                  {isDeletingProjectDocument ? 'Deleting...' : 'Delete Document'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {selectedCheckpoint && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-4 sm:items-center">
            <div className="max-h-[90vh] w-full max-w-6xl overflow-y-auto rounded-3xl border border-border bg-card shadow-2xl">
              <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-border bg-card p-5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                        Checkpoint Details
                      </p>
                      <h2 className="mt-2 text-lg font-semibold text-foreground">
                        {selectedCheckpoint.title}
                      </h2>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        Save requirements, site notes, and checkpoint decisions without leaving this project.
                      </p>
                    </div>

                    {selectedCheckpoint.checkpoint_key === 'design_phase' && (
                      <span
                        className={`w-fit shrink-0 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${DESIGN_PHASE_STATUS_STYLES[checkpointDetailForm.designPhaseStatus]}`}
                      >
                        {getDesignPhaseStatusLabel(checkpointDetailForm.designPhaseStatus)}
                      </span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={closeCheckpointDetail}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Close checkpoint details"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-5 p-5">
                {checkpointDetailError && (
                  <div className="rounded-2xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                    {checkpointDetailError}
                  </div>
                )}

                {selectedCheckpoint.checkpoint_key === 'initial_site_visit' && (
                  <div className="rounded-2xl border border-border bg-background p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                          Client Requirements
                        </p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          Add room-wise requirement items from the Items master. This can be reused while creating the project cost estimate later.
                        </p>
                      </div>

                      <Button
                        type="button"
                        variant="outline"
                        onClick={addClientRequirementRow}
                        className="w-fit"
                      >
                        Add Area
                      </Button>
                    </div>

                    {siteVisitItemError && (
                      <p className="mt-3 rounded-xl border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-xs font-normal normal-case tracking-normal text-amber-700 dark:text-amber-200">
                        Item master could not be loaded: {siteVisitItemError}
                      </p>
                    )}

                    <div className="mt-4 rounded-2xl border border-border bg-muted/25 p-3">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            Add Area
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Use consistent area names here so Cost Estimate does not create duplicate room suggestions.
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={addRequirementBedroomSet}
                          className="justify-center gap-2"
                        >
                          <Plus className="h-4 w-4" />
                          Bedroom Set
                        </Button>

                        <Button
                          type="button"
                          variant="outline"
                          onClick={addRequirementBedroom}
                          className="justify-center gap-2"
                        >
                          <Plus className="h-4 w-4" />
                          Add Bedroom
                        </Button>

                        <Button
                          type="button"
                          variant="outline"
                          onClick={addRequirementAttachedBathroom}
                          className="justify-center gap-2"
                        >
                          <Plus className="h-4 w-4" />
                          Add Bathroom
                        </Button>

                        <Button
                          type="button"
                          variant="outline"
                          onClick={addRequirementCommonBathroom}
                          className="justify-center gap-2"
                        >
                          <Plus className="h-4 w-4" />
                          Common Bathroom
                        </Button>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {SITE_VISIT_QUICK_AREA_OPTIONS.map(areaName => (
                          <button
                            key={areaName}
                            type="button"
                            onClick={() => addClientRequirementArea(areaName)}
                            className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground"
                          >
                            + {areaName}
                          </button>
                        ))}
                      </div>

                      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                        <input
                          value={siteVisitCustomAreaName}
                          onChange={event => setSiteVisitCustomAreaName(event.target.value)}
                          placeholder="Custom area, e.g. Foyer"
                          className="min-h-10 flex-1 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-foreground"
                        />

                        <Button
                          type="button"
                          onClick={addRequirementCustomArea}
                          disabled={!siteVisitCustomAreaName.trim()}
                          className="gap-2"
                        >
                          <Plus className="h-4 w-4" />
                          Add Custom Area
                        </Button>
                      </div>
                    </div>

                    {checkpointDetailForm.clientRequirementRows.length === 0 ? (
                      <div className="mt-4 rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                        No client requirement items added yet.
                      </div>
                    ) : (
                      <div className="mt-4 space-y-4">
                        {getClientRequirementAreaGroups(
                          checkpointDetailForm.clientRequirementRows
                        ).map(areaGroup => {
                          return (
                            <div
                              key={areaGroup.key}
                              className="rounded-2xl border border-border bg-card p-4"
                            >
                              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                <label className="grid gap-2 lg:w-80">
                                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                                    Area
                                  </span>
                                  <input
                                    value={areaGroup.areaName}
                                    onChange={event =>
                                      updateClientRequirementAreaGroup(
                                        areaGroup.areaName,
                                        event.target.value
                                      )
                                    }
                                    placeholder="Living Room"
                                    className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-sm font-normal normal-case tracking-normal text-foreground outline-none transition placeholder:text-muted-foreground focus:border-foreground"
                                  />
                                </label>

                                <div className="flex flex-wrap gap-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => addClientRequirementItemToArea(areaGroup.areaName)}
                                    className="w-fit"
                                  >
                                    Add Item
                                  </Button>

                                  <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => removeClientRequirementAreaGroup(areaGroup.areaName)}
                                    className="w-fit"
                                  >
                                    Remove Area
                                  </Button>
                                </div>
                              </div>

                              <div className="mt-4 space-y-4">
                                {areaGroup.rows.map(row => {
                                  const itemSearch = row.itemName.trim().toLowerCase();
                                  const matchingSiteVisitItems = (
                                    itemSearch
                                      ? siteVisitItemOptions.filter(item =>
                                          item.name.toLowerCase().includes(itemSearch)
                                        )
                                      : siteVisitItemOptions
                                  ).slice(0, 8);
                                  const unitMode = getClientRequirementUnitMode(row.outputUnit);
                                  const areaSqm = calculateClientRequirementAreaSqm(row);
                                  const totalQuantity = getClientRequirementCalculatedQuantity(row);
                                  const alternateQuantity = row.outputUnit === 'sqft'
                                    ? roundSiteVisitMeasurement(areaSqm)
                                    : roundSiteVisitMeasurement(
                                        areaSqm * CLIENT_REQUIREMENT_SQFT_PER_SQM
                                      );

                                  return (
                                    <div
                                      key={row.id}
                                      className="rounded-2xl border border-border bg-background/70 p-3"
                                    >
                                      <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto] lg:items-start">
                                        <div className="grid gap-2">
                                          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                                            Item
                                          </span>
                                          <div className="relative">
                                            <input
                                              value={row.itemName}
                                              onFocus={() => setSiteVisitItemDropdownRowId(row.id)}
                                              onBlur={() => {
                                                window.setTimeout(() => {
                                                  setSiteVisitItemDropdownRowId(null);
                                                }, 120);
                                              }}
                                              onChange={event =>
                                                handleSiteVisitItemNameChange(row.id, event.target.value)
                                              }
                                              placeholder="Type item name or search preset"
                                              className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-foreground"
                                            />

                                            {siteVisitItemDropdownRowId === row.id && (
                                              <div className="absolute left-0 right-0 top-11 z-50 overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-lg">
                                                <div className="max-h-64 overflow-y-auto p-1">
                                                  {matchingSiteVisitItems.length > 0 ? (
                                                    matchingSiteVisitItems.map(item => (
                                                      <button
                                                        key={item.id}
                                                        type="button"
                                                        onMouseDown={event => event.preventDefault()}
                                                        onClick={() =>
                                                          selectClientRequirementItem(row.id, item)
                                                        }
                                                        className="w-full rounded-lg px-3 py-2 text-left transition hover:bg-muted"
                                                      >
                                                        <span className="block text-sm font-medium text-foreground">
                                                          {item.name}
                                                        </span>
                                                        <span className="mt-0.5 block text-xs text-muted-foreground">
                                                          {item.defaultUnitLabel || 'sqft'} @{' '}
                                                          {formatINR(item.sellingRatePerUnit)}
                                                        </span>
                                                      </button>
                                                    ))
                                                  ) : (
                                                    <p className="px-3 py-2 text-xs text-muted-foreground">
                                                      No matching preset. Keep typing to use a custom item.
                                                    </p>
                                                  )}
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        </div>

                                        <div className="grid gap-2">
                                          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                                            Unit
                                          </span>
                                          <div className="relative w-full min-w-40">
                                            <button
                                              type="button"
                                              onClick={() =>
                                                setSiteVisitUnitDropdownRowId(current =>
                                                  current === row.id ? null : row.id
                                                )
                                              }
                                              onBlur={() => {
                                                window.setTimeout(() => {
                                                  setSiteVisitUnitDropdownRowId(null);
                                                }, 120);
                                              }}
                                              className="flex min-h-10 w-full items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 text-left text-sm text-foreground outline-none transition focus:border-foreground"
                                            >
                                              <span className="truncate">
                                                {row.outputUnit || 'sqft'}
                                              </span>
                                              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                                            </button>

                                            {siteVisitUnitDropdownRowId === row.id && (
                                              <div className="absolute left-0 right-0 top-11 z-50 overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-lg">
                                                <div className="max-h-64 overflow-y-auto p-1">
                                                  {siteVisitUnitOptions.map(unit => {
                                                    const normalizedUnit = normalizeClientRequirementUnit(unit);
                                                    const isSelected =
                                                      normalizeClientRequirementUnit(row.outputUnit) === normalizedUnit;

                                                    return (
                                                      <button
                                                        key={unit}
                                                        type="button"
                                                        onMouseDown={event => event.preventDefault()}
                                                        onClick={() => {
                                                          updateClientRequirementRow(
                                                            row.id,
                                                            'outputUnit',
                                                            normalizedUnit
                                                          );
                                                          setSiteVisitUnitDropdownRowId(null);
                                                        }}
                                                        className={`w-full rounded-lg px-3 py-2 text-left transition ${
                                                          isSelected ? 'bg-muted text-foreground' : 'hover:bg-muted'
                                                        }`}
                                                      >
                                                        <span className="block text-sm font-medium text-foreground">
                                                          {unit}
                                                        </span>
                                                      </button>
                                                    );
                                                  })}
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        </div>

                                        <Button
                                          type="button"
                                          variant="outline"
                                          onClick={() => removeClientRequirementRow(row.id)}
                                          className="mt-6 w-fit lg:mt-[1.65rem]"
                                        >
                                          Remove Item
                                        </Button>
                                      </div>

                                      <div className="mt-4 rounded-xl border border-border bg-card/70 p-3">
                                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                          <div>
                                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                                              Measurements
                                            </p>
                                            <p className="mt-1 text-xs text-muted-foreground">
                                              Enter wall width and height in cm. Height inherits from the previous measurement when adding a new row.
                                            </p>
                                          </div>

                                          <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => addClientRequirementMeasurement(row.id)}
                                            className="w-fit gap-2"
                                          >
                                            <Plus className="h-4 w-4" />
                                            <span>Add Measurement</span>
                                          </Button>
                                        </div>

                                        <div className="mt-3 space-y-2">
                                          {row.measurements.map((measurement, index) => {

                                            return (
                                              <div
                                                key={measurement.id}
                                                className={`grid grid-cols-1 gap-3 rounded-lg border border-border/70 bg-background p-3 md:items-end ${
                                                  unitMode === 'area'
                                                    ? 'md:grid-cols-[2rem_minmax(8rem,1fr)_minmax(8rem,1fr)_8.5rem_2.75rem]'
                                                    : 'md:grid-cols-[2rem_minmax(10rem,1fr)_8.5rem_2.75rem]'
                                                }`}
                                              >
                                                <span className="pb-2 text-center text-xs font-semibold text-muted-foreground">
                                                  {index + 1}
                                                </span>

                                                {unitMode === 'area' ? (
                                                  <>
                                                    <label className="grid gap-1">
                                                      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                                                        Width cm
                                                      </span>
                                                      <input
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        value={measurement.widthCm}
                                                        onChange={event =>
                                                          updateClientRequirementMeasurement(
                                                            row.id,
                                                            measurement.id,
                                                            'widthCm',
                                                            event.target.value
                                                          )
                                                        }
                                                        className="min-h-9 w-full rounded-lg border border-border bg-background px-3 text-sm font-normal text-foreground outline-none transition placeholder:text-muted-foreground focus:border-foreground"
                                                        placeholder="0"
                                                      />
                                                    </label>

                                                    <label className="grid gap-1">
                                                      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                                                        Height cm
                                                      </span>
                                                      <input
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        value={measurement.heightCm}
                                                        onChange={event =>
                                                          updateClientRequirementMeasurement(
                                                            row.id,
                                                            measurement.id,
                                                            'heightCm',
                                                            event.target.value
                                                          )
                                                        }
                                                        className="min-h-9 w-full rounded-lg border border-border bg-background px-3 text-sm font-normal text-foreground outline-none transition placeholder:text-muted-foreground focus:border-foreground"
                                                        placeholder="0"
                                                      />
                                                    </label>
                                                  </>
                                                ) : unitMode === 'linear' ? (
                                                  <label className="grid gap-1">
                                                    <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                                                      Length cm
                                                    </span>
                                                    <input
                                                      type="number"
                                                      min="0"
                                                      step="0.01"
                                                      value={measurement.lengthCm}
                                                      onChange={event =>
                                                        updateClientRequirementMeasurement(
                                                          row.id,
                                                          measurement.id,
                                                          'lengthCm',
                                                          event.target.value
                                                        )
                                                      }
                                                      className="min-h-9 w-full rounded-lg border border-border bg-background px-3 text-sm font-normal text-foreground outline-none transition placeholder:text-muted-foreground focus:border-foreground"
                                                      placeholder="0"
                                                    />
                                                  </label>
                                                ) : (
                                                  <label className="grid gap-1">
                                                    <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                                                      Quantity
                                                    </span>
                                                    <input
                                                      type="number"
                                                      min="0"
                                                      step="0.01"
                                                      value={measurement.quantity}
                                                      onChange={event =>
                                                        updateClientRequirementMeasurement(
                                                          row.id,
                                                          measurement.id,
                                                          'quantity',
                                                          event.target.value
                                                        )
                                                      }
                                                      className="min-h-9 w-full rounded-lg border border-border bg-background px-3 text-sm font-normal text-foreground outline-none transition placeholder:text-muted-foreground focus:border-foreground"
                                                      placeholder="1"
                                                    />
                                                  </label>
                                                )}

                                                <div className="grid gap-1">
                                                  <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                                                    Total
                                                  </span>
                                                  <div className="flex min-h-9 items-center rounded-lg border border-border bg-background px-3 text-sm font-semibold text-foreground">
                                                    {roundSiteVisitMeasurement(
                                                      calculateClientRequirementMeasurementQuantity(
                                                        measurement,
                                                        row.outputUnit
                                                      )
                                                    )}{' '}
                                                    {row.outputUnit}
                                                  </div>
                                                </div>

                                                {row.measurements.length > 1 && (
                                                  <button
                                                    type="button"
                                                    disabled={row.measurements.length <= 1}
                                                    onClick={() =>
                                                      removeClientRequirementMeasurement(
                                                        row.id,
                                                        measurement.id
                                                      )
                                                    }
                                                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
                                                    aria-label="Remove measurement"
                                                  >
                                                    <Trash2 className="h-4 w-4" />
                                                  </button>
                                                )}
                                              </div>
                                            );
                                          })}
                                        </div>

                                        <div className="mt-3 flex flex-col gap-1 rounded-lg border border-border bg-background px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                                          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                                            Total
                                          </span>
                                          <span className="font-semibold text-foreground">
                                            {totalQuantity} {row.outputUnit}
                                            {unitMode === 'area' && alternateQuantity > 0 && (
                                              <span className="ml-2 text-xs font-normal text-muted-foreground">
                                                / {alternateQuantity}{' '}
                                                {row.outputUnit === 'sqft' ? 'sqm' : 'sqft'}
                                              </span>
                                            )}
                                          </span>
                                        </div>
                                      </div>

                                      <label className="mt-3 block text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                                        Notes
                                        <textarea
                                          value={row.notes}
                                          onChange={event =>
                                            updateClientRequirementRow(row.id, 'notes', event.target.value)
                                          }
                                          rows={2}
                                          className="mt-2 min-h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-normal normal-case tracking-normal text-foreground outline-none transition placeholder:font-normal placeholder:normal-case placeholder:tracking-normal placeholder:text-muted-foreground focus:border-foreground"
                                          placeholder="Client preference, material note, finish, or scope detail."
                                        />
                                      </label>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {selectedCheckpoint.checkpoint_key === 'initial_site_visit' && (
                  <div className="rounded-2xl border border-border bg-background p-4">
                    <label className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      Site Measurements
                    </label>
                    <textarea
                      value={checkpointDetailForm.siteMeasurements}
                      onChange={event =>
                        updateCheckpointDetailField('siteMeasurements', event.target.value)
                      }
                      rows={4}
                      className="mt-3 w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring"
                      placeholder="Add room-wise measurements, ceiling heights, openings, service points, and measurement caveats."
                    />
                  </div>
                )}

                {selectedCheckpoint.checkpoint_key === 'design_phase' && (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-border bg-background p-4">
                      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                            Design Service Estimator
                          </p>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">
                            Available during Waiting. Add service rows like Cost Estimate, then approve to move Design Phase to In-Progress.
                          </p>
                        </div>

                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                          <span
                            className={`w-fit rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${
                              checkpointDetailForm.designEstimateApproved
                                ? 'border-emerald-300/80 bg-emerald-500/35 text-emerald-950 dark:text-emerald-50'
                                : 'border-border bg-muted text-muted-foreground'
                            }`}
                          >
                            {checkpointDetailForm.designEstimateApproved ? 'Estimate Approved' : 'Estimate Draft'}
                          </span>

                          <Button
                            type="button"
                            variant="outline"
                            onClick={handleExportDesignEstimatePdf}
                            className="w-fit gap-2"
                          >
                            <FileText className="h-4 w-4" />
                            Export PDF
                          </Button>
                        </div>
                      </div>

                      <div className="mt-4 overflow-x-auto pb-2">
                        <div className="min-w-[940px] space-y-2">
                          <div
                            className="grid gap-3 px-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
                            style={{
                              gridTemplateColumns:
                                'minmax(260px, 2fr) minmax(160px, 1fr) minmax(110px, 0.7fr) minmax(140px, 0.8fr) minmax(150px, 0.8fr) 44px',
                            }}
                          >
                            <span>Service Name</span>
                            <span>Unit</span>
                            <span>Qty</span>
                            <span>Rate</span>
                            <span>Total Row Rate</span>
                            <span />
                          </div>

                          {checkpointDetailForm.designEstimateRows.map(row => {
                            const rowTotal = calculateDesignEstimateRowTotal(row);

                            return (
                              <div
                                key={row.id}
                                className="grid items-center gap-3 rounded-2xl border border-border bg-card p-3"
                                style={{
                                  gridTemplateColumns:
                                    'minmax(260px, 2fr) minmax(160px, 1fr) minmax(110px, 0.7fr) minmax(140px, 0.8fr) minmax(150px, 0.8fr) 44px',
                                }}
                              >
                                <input
                                  type="text"
                                  value={row.serviceName}
                                  onChange={event =>
                                    updateDesignEstimateRow(row.id, 'serviceName', event.target.value)
                                  }
                                  className="h-11 min-w-0 rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring"
                                  placeholder="Concept design / 3D view"
                                />

                                <div className="grid grid-cols-2 gap-2 rounded-xl border border-border bg-background p-1">
                                  {DESIGN_ESTIMATE_UNITS.map(unit => (
                                    <button
                                      key={unit}
                                      type="button"
                                      onClick={() =>
                                        updateDesignEstimateRow(row.id, 'unit', unit)
                                      }
                                      className={
                                        row.unit === unit
                                          ? 'rounded-lg bg-foreground px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-background'
                                          : 'rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'
                                      }
                                    >
                                      {unit}
                                    </button>
                                  ))}
                                </div>

                                <input
                                  type="number"
                                  min="0"
                                  value={row.quantity}
                                  onChange={event =>
                                    updateDesignEstimateRow(row.id, 'quantity', event.target.value)
                                  }
                                  className="h-11 min-w-0 rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring"
                                  placeholder="1"
                                />

                                <input
                                  type="number"
                                  min="0"
                                  value={row.rate}
                                  onChange={event =>
                                    updateDesignEstimateRow(row.id, 'rate', event.target.value)
                                  }
                                  className="h-11 min-w-0 rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring"
                                  placeholder="25000"
                                />

                                <div className="rounded-xl border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground">
                                  {formatINR(rowTotal)}
                                </div>

                                <button
                                  type="button"
                                  onClick={() => removeDesignEstimateRow(row.id)}
                                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                                  aria-label="Remove design estimate row"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4 lg:flex-row lg:items-center lg:justify-between">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={addDesignEstimateRow}
                          className="w-fit gap-2"
                        >
                          <Plus className="h-4 w-4" />
                          Add Row
                        </Button>

                        <div className="rounded-2xl border border-border bg-card px-4 py-3">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                            Estimate Total
                          </p>
                          <p className="mt-1 text-xl font-semibold text-foreground">
                            {formatINR(calculateDesignEstimateTotal(checkpointDetailForm.designEstimateRows))}
                          </p>
                        </div>
                      </div>

                      <label className="mt-4 block text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        Estimate Notes
                        <textarea
                          value={checkpointDetailForm.designServiceEstimateNotes}
                          onChange={event =>
                            updateCheckpointDetailField('designServiceEstimateNotes', event.target.value)
                          }
                          rows={3}
                          className="mt-2 w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm font-normal normal-case tracking-normal text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring"
                          placeholder="Add assumptions, exclusions, scope notes, or client-facing estimate notes."
                        />
                      </label>

                      {canManageProjects &&
                        selectedCheckpoint.status !== 'locked' &&
                        !isCheckpointComplete(selectedCheckpoint) &&
                        !checkpointDetailForm.designEstimateApproved && (
                          <Button
                            type="button"
                            onClick={approveDesignEstimate}
                            disabled={isSavingCheckpointDetail}
                            className="mt-4"
                          >
                            {isSavingCheckpointDetail ? 'Saving...' : 'Approve Design Estimate'}
                          </Button>
                        )}
                    </div>

                    {checkpointDetailForm.designEstimateApproved &&
                      checkpointDetailForm.designPhaseStatus !== 'approved' &&
                      checkpointDetailForm.designPhaseStatus !== 'bypassed' && (
                        <div className="rounded-2xl border border-emerald-300/80 bg-emerald-500/35 p-4">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-950 dark:text-emerald-50">
                                Ready For Design Approval
                              </p>
                              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                After the design is approved, approve this phase to unlock Execution.
                              </p>
                            </div>

                            {canManageProjects &&
                              selectedCheckpoint.status !== 'locked' &&
                              !isCheckpointComplete(selectedCheckpoint) && (
                                <Button
                                  type="button"
                                  onClick={approveDesignPhase}
                                  disabled={isSavingCheckpointDetail}
                                >
                                  {isSavingCheckpointDetail ? 'Saving...' : 'Approve Design Phase'}
                                </Button>
                              )}
                          </div>

                          <label className="mt-4 block text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                            Approval Notes
                            <textarea
                              value={checkpointDetailForm.designApprovalNotes}
                              onChange={event =>
                                updateCheckpointDetailField('designApprovalNotes', event.target.value)
                              }
                              rows={3}
                              className="mt-2 w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm font-normal normal-case tracking-normal text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring"
                              placeholder="Record approval status, approved concept/version, client comments, and pending revisions."
                            />
                          </label>
                        </div>
                      )}

                    {checkpointDetailForm.designPhaseStatus !== 'approved' &&
                      checkpointDetailForm.designPhaseStatus !== 'bypassed' && (
                        <div className="rounded-2xl border border-border bg-background p-4">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                Bypass Design Phase
                              </p>
                              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                Use bypass only when the design phase is intentionally skipped. A reason is required.
                              </p>
                            </div>

                            {canManageProjects &&
                              selectedCheckpoint.status !== 'locked' &&
                              !isCheckpointComplete(selectedCheckpoint) && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={bypassDesignPhase}
                                  disabled={isSavingCheckpointDetail}
                                >
                                  {isSavingCheckpointDetail ? 'Saving...' : 'Bypass Design Phase'}
                                </Button>
                              )}
                          </div>

                          <label className="mt-4 block text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                            Bypass Reason
                            <textarea
                              value={checkpointDetailForm.designBypassReason}
                              onChange={event =>
                                updateCheckpointDetailField('designBypassReason', event.target.value)
                              }
                              rows={3}
                              className="mt-2 w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm font-normal normal-case tracking-normal text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring"
                              placeholder="Explain why the design phase is being bypassed."
                            />
                          </label>
                        </div>
                      )}
                  </div>
                )}

                {selectedCheckpoint.checkpoint_key === 'quality_control' && (
                  <div className="rounded-2xl border border-border bg-background p-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                          QC Completion Gate
                        </p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          Final handover payment in Finance unlocks only after Execution is completed, QC checklist is completed, QC Report is generated, and QC Phase is completed.
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <span
                          className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${
                            isCheckpointChecklistComplete(selectedCheckpoint)
                              ? 'border-emerald-300/80 bg-emerald-500/35 text-emerald-950 dark:text-emerald-50'
                              : 'border-border bg-muted text-muted-foreground'
                          }`}
                        >
                          {isCheckpointChecklistComplete(selectedCheckpoint) ? 'Checklist Done' : 'Checklist Pending'}
                        </span>
                        <span
                          className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${
                            isQcReportGenerated(selectedCheckpoint)
                              ? 'border-emerald-300/80 bg-emerald-500/35 text-emerald-950 dark:text-emerald-50'
                              : 'border-border bg-muted text-muted-foreground'
                          }`}
                        >
                          {isQcReportGenerated(selectedCheckpoint) ? 'QC Report Generated' : 'QC Report Pending'}
                        </span>
                      </div>
                    </div>

                    {canManageProjects &&
                      selectedCheckpoint.status !== 'locked' &&
                      !isCheckpointComplete(selectedCheckpoint) && (
                        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={completeQcChecklist}
                            disabled={isSavingCheckpointDetail || isCheckpointChecklistComplete(selectedCheckpoint)}
                          >
                            {isCheckpointChecklistComplete(selectedCheckpoint) ? 'QC Checklist Completed' : 'Complete QC Checklist'}
                          </Button>

                          <Button
                            type="button"
                            variant="outline"
                            onClick={generateQcReport}
                            disabled={
                              isSavingCheckpointDetail ||
                              !isCheckpointChecklistComplete(selectedCheckpoint) ||
                              isQcReportGenerated(selectedCheckpoint)
                            }
                          >
                            {isQcReportGenerated(selectedCheckpoint) ? 'QC Report Generated' : 'Generate QC Report'}
                          </Button>
                        </div>
                      )}
                  </div>
                )}

                {false &&
                  selectedProject &&
                  (() => {
                    const timeline = projectTimelineSummaries[selectedProject!.id];
                    const estimate = projectCostEstimateSummaries[selectedProject!.id];
                    const workPackages = getTimelineWorkPackages(timeline);
                    const completedWorkPackages =
                      getCompletedTimelineWorkPackages(timeline);
                    const pendingWorkPackages =
                      getPendingTimelineWorkPackages(timeline);
                    const readiness = getExecutionTransferReadiness({
                      estimate,
                      timeline,
                      isEstimateLoading: projectCostEstimateSummariesLoading,
                      isTimelineLoading: projectTimelineSummariesLoading,
                    });

                    return (
                      <div className="rounded-2xl border border-border bg-background p-4">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                              Execution Transfer Gate
                            </p>
                            <p className="mt-1 text-xs leading-5 text-muted-foreground">
                              Execution can move to Quality Control only after the linked Cost Estimate is approved, Timeline is confirmed, and every Timeline work package is completed.
                            </p>
                          </div>

                          <span
                            className={`w-fit rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${
                              readiness.canTransfer
                                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
                                : 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-300'
                            }`}
                          >
                            {readiness.label}
                          </span>
                        </div>

                        <div className="mt-4 grid gap-3 lg:grid-cols-3">
                          <div className="rounded-2xl border border-border bg-card p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                              Cost Estimate
                            </p>
                            <p className="mt-2 text-sm font-semibold text-foreground">
                              {getProjectCostEstimateStatusLabel(
                                estimate,
                                projectCostEstimateSummariesLoading
                              )}
                            </p>
                            <p className="mt-1 text-xs leading-5 text-muted-foreground">
                              Approved estimate is required before QC transfer.
                            </p>
                          </div>

                          <div className="rounded-2xl border border-border bg-card p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                              Timeline
                            </p>
                            <p className="mt-2 text-sm font-semibold text-foreground">
                              {timeline?.has_timeline
                                ? timeline.timeline_confirmed_at
                                  ? 'Confirmed'
                                  : 'Timeline Built'
                                : projectTimelineSummariesLoading
                                  ? 'Checking...'
                                  : 'Not Built'}
                            </p>
                            <p className="mt-1 text-xs leading-5 text-muted-foreground">
                              Timeline must be confirmed before QC transfer.
                            </p>
                          </div>

                          <div className="rounded-2xl border border-border bg-card p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                              Work Packages
                            </p>
                            <p className="mt-2 text-sm font-semibold text-foreground">
                              {completedWorkPackages.length}/{workPackages.length} completed
                            </p>
                            <p className="mt-1 text-xs leading-5 text-muted-foreground">
                              Every work package must be marked completed in Timeline.
                            </p>
                          </div>
                        </div>

                        {pendingWorkPackages.length > 0 && (
                          <div className="mt-4 rounded-2xl border border-border bg-card p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                              Pending Work Packages
                            </p>
                            <div className="mt-3 grid gap-2 md:grid-cols-2">
                              {pendingWorkPackages.slice(0, 8).map(workPackage => (
                                <div
                                  key={workPackage.id}
                                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background px-3 py-2"
                                >
                                  <span className="min-w-0 truncate text-sm font-medium text-foreground">
                                    {workPackage.title}
                                  </span>
                                  <span className="shrink-0 rounded-full border border-border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                                    {workPackage.status.replaceAll('_', ' ')}
                                  </span>
                                </div>
                              ))}
                            </div>

                            {pendingWorkPackages.length > 8 && (
                              <p className="mt-3 text-xs text-muted-foreground">
                                + {pendingWorkPackages.length - 8} more pending work package(s).
                              </p>
                            )}
                          </div>
                        )}

                        <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
                          <p className="text-xs leading-5 text-muted-foreground">
                            {readiness.reason}
                          </p>

                          <Button
                            type="button"
                            onClick={transferExecutionForQc}
                            disabled={!readiness.canTransfer || isSavingCheckpointDetail}
                            className="gap-2"
                          >
                            <Check className="h-4 w-4" />
                            {isSavingCheckpointDetail ? 'Saving...' : 'Transfer for QC'}
                          </Button>
                        </div>
                      </div>
                    );
                  })()}

                {selectedCheckpoint.checkpoint_key === 'quality_control' && (
                  <div className="rounded-2xl border border-border bg-background p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      Quality Control Details
                    </p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      Capture QC observations before generating the QC Report.
                    </p>

                    <div className="mt-4 grid gap-4 lg:grid-cols-3">
                      <label className="grid gap-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                          QC Checklist Notes
                        </span>
                        <textarea
                          value={checkpointDetailForm.qcChecklistNotes}
                          onChange={event =>
                            updateCheckpointDetailField('qcChecklistNotes', event.target.value)
                          }
                          rows={4}
                          className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring"
                          placeholder="Record what was checked and verified."
                        />
                      </label>

                      <label className="grid gap-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                          Snag List
                        </span>
                        <textarea
                          value={checkpointDetailForm.qcSnagList}
                          onChange={event =>
                            updateCheckpointDetailField('qcSnagList', event.target.value)
                          }
                          rows={4}
                          className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring"
                          placeholder="List snags, corrections, or open quality issues."
                        />
                      </label>

                      <label className="grid gap-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                          QC Report Notes
                        </span>
                        <textarea
                          value={checkpointDetailForm.qcReportNotes}
                          onChange={event =>
                            updateCheckpointDetailField('qcReportNotes', event.target.value)
                          }
                          rows={4}
                          className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring"
                          placeholder="Add report summary or final QC remarks."
                        />
                      </label>
                    </div>
                  </div>
                )}

                {selectedCheckpoint.checkpoint_key === 'handover' && (
                  <div className="rounded-2xl border border-border bg-background p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      Final Handover Details
                    </p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      Record closeout confirmation, final documents, and warranty notes.
                    </p>

                    <div className="mt-4 grid gap-4 lg:grid-cols-2">
                      <label className="grid gap-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                          Client Confirmation
                        </span>
                        <textarea
                          value={checkpointDetailForm.handoverClientConfirmation}
                          onChange={event =>
                            updateCheckpointDetailField('handoverClientConfirmation', event.target.value)
                          }
                          rows={4}
                          className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring"
                          placeholder="Record client confirmation or sign-off notes."
                        />
                      </label>

                      <label className="grid gap-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                          Final Documents
                        </span>
                        <textarea
                          value={checkpointDetailForm.handoverDocuments}
                          onChange={event =>
                            updateCheckpointDetailField('handoverDocuments', event.target.value)
                          }
                          rows={4}
                          className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring"
                          placeholder="List final drawings, invoices, warranty cards, manuals, or documents handed over."
                        />
                      </label>

                      <label className="grid gap-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                          Warranty / Maintenance Notes
                        </span>
                        <textarea
                          value={checkpointDetailForm.warrantyNotes}
                          onChange={event =>
                            updateCheckpointDetailField('warrantyNotes', event.target.value)
                          }
                          rows={4}
                          className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring"
                          placeholder="Mention warranty periods, maintenance instructions, or service conditions."
                        />
                      </label>

                      <label className="grid gap-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                          Final Remarks
                        </span>
                        <textarea
                          value={checkpointDetailForm.finalHandoverNotes}
                          onChange={event =>
                            updateCheckpointDetailField('finalHandoverNotes', event.target.value)
                          }
                          rows={4}
                          className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring"
                          placeholder="Add any final closeout notes."
                        />
                      </label>
                    </div>
                  </div>
                )}

                <div className="rounded-2xl border border-border bg-background p-4">
                  <label className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Checkpoint Notes
                  </label>
                  <textarea
                    value={checkpointDetailForm.notes}
                    onChange={event =>
                      updateCheckpointDetailField('notes', event.target.value)
                    }
                    rows={3}
                    className="mt-3 w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring"
                    placeholder="Add internal notes for this checkpoint."
                  />
                </div>

                {selectedCheckpoint.checkpoint_key === 'initial_site_visit' && (
                  <div className="rounded-2xl border border-border bg-background p-4">
                    <label className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      Custom Requirements
                    </label>
                    <textarea
                      value={checkpointDetailForm.customRequirements}
                      onChange={event =>
                        updateCheckpointDetailField('customRequirements', event.target.value)
                      }
                      rows={4}
                      className="mt-3 w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring"
                      placeholder="Add unusual site constraints, client-specific instructions, execution warnings, or custom scope notes."
                    />
                  </div>
                )}
              </div>

              <div className="sticky bottom-0 flex flex-col-reverse gap-3 border-t border-border bg-card p-5 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeCheckpointDetail}
                  disabled={isSavingCheckpointDetail}
                >
                  Cancel
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => saveCheckpointDetails()}
                  disabled={isSavingCheckpointDetail || selectedCheckpoint.status === 'locked'}
                >
                  {isSavingCheckpointDetail ? 'Saving...' : 'Save Details'}
                </Button>

                {canManageProjects &&
                  selectedCheckpoint.checkpoint_key === 'quality_control' &&
                  selectedCheckpoint.status !== 'locked' &&
                  !isCheckpointComplete(selectedCheckpoint) && (
                    <Button
                      type="button"
                      onClick={completeQcPhase}
                      disabled={
                        isSavingCheckpointDetail ||
                        !isCheckpointChecklistComplete(selectedCheckpoint) ||
                        !isQcReportGenerated(selectedCheckpoint)
                      }
                    >
                      {isSavingCheckpointDetail ? 'Saving...' : 'Complete QC Phase'}
                    </Button>
                  )}

                {canManageProjects &&
                  selectedCheckpoint.checkpoint_key !== 'design_phase' &&
                  selectedCheckpoint.checkpoint_key !== 'quality_control' &&
                  selectedCheckpoint.checkpoint_key !== 'execution' &&
                  selectedCheckpoint.status !== 'locked' &&
                  !isCheckpointComplete(selectedCheckpoint) && (
                    <Button
                      type="button"
                      onClick={() => saveCheckpointDetails({ complete: true })}
                      disabled={isSavingCheckpointDetail}
                    >
                      {isSavingCheckpointDetail
                        ? 'Saving...'
                        : 'Mark Complete & Unlock Next'}
                    </Button>
                  )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-7 border-b border-border pb-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.32em] text-muted-foreground">
              {isAdminMode ? 'Admin Operations' : 'Portal Operations'}
            </p>

            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              Projects
            </h1>

            <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
              Open project-linked workspaces across tasks, estimates, timeline, and finance.
            </p>
          </div>

          {canManageProjects && (
            <Button type="button" onClick={openCreateProjectModal} className="gap-2">
              <Plus className="h-4 w-4" />
              Create Project
            </Button>
          )}
        </div>
      </div>

      {canManageProjects && projectRequests.length > 0 && (
        <section className="mb-5 overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-sm">
          <div className="border-b border-border px-4 py-3 sm:px-5">
            <p className="text-sm font-semibold text-foreground">
              Project Creation Requests
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Converted leads waiting for Admin approval.
            </p>
          </div>

          <div className="divide-y divide-border">
            {projectRequests.map(request => (
              <div
                key={request.id}
                className="grid gap-3 bg-background px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {request.name}
                  </p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {request.contact_phone || request.contact_email || 'No contact saved'}
                  </p>
                  {request.notes && (
                    <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">
                      {request.notes}
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleDeclineProjectRequest(request)}
                    className="h-10 justify-center whitespace-nowrap"
                  >
                    Decline
                  </Button>

                  <Button
                    type="button"
                    onClick={() => handleApproveProjectRequest(request)}
                    className="h-10 justify-center whitespace-nowrap"
                  >
                    Approve and Create
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b border-border p-4 md:flex-row md:items-center md:p-5">
          <div className="relative w-full md:max-w-sm">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              value={searchTerm}
              onChange={event => setSearchTerm(event.target.value)}
              placeholder="Search projects..."
              className="h-11 w-full rounded-2xl border border-border bg-background pl-10 pr-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
            />
          </div>

          <div className="relative w-full md:w-64">
            <button
              type="button"
              onClick={openStatusFilterMenu}
              className="flex h-11 w-full items-center justify-between gap-3 rounded-2xl border border-border bg-background px-4 text-left text-sm text-foreground transition-colors hover:bg-muted/40"
            >
              <span className="truncate">{statusFilter}</span>
              <ChevronDown size={16} className="shrink-0 text-muted-foreground" />
            </button>
          </div>

          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground md:ml-auto">
            {filteredProjects.length} Projects
          </div>
        </div>

        {error && (
          <div className="border-b border-destructive/20 bg-destructive/10 p-4">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="flex min-h-56 items-center justify-center p-6">
            <p className="text-sm text-muted-foreground">Loading projects...</p>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="flex min-h-56 items-center justify-center p-6">
            <div className="max-w-sm text-center">
              <p className="text-sm font-medium text-foreground">No projects found</p>
            </div>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Project
                    </th>
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Client
                    </th>
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Status
                    </th>
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Timeline
                    </th>
                    {canManageProjects && (
                      <th className="w-14 px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        More
                      </th>
                    )}
                  </tr>
                </thead>

                <tbody>
                  {filteredProjects.map(project => (
                    <tr
                      key={project.id}
                      onClick={() => setSelectedProject(project)}
                      className="cursor-pointer border-b border-border transition-colors last:border-b-0 hover:bg-muted/30"
                    >
                      <td className="px-5 py-4">
                        <div className="text-left">
                          <p className="font-semibold text-foreground">{project.name}</p>
                          {project.description && (
                            <p className="mt-1 line-clamp-1 max-w-md text-xs text-muted-foreground">
                              {project.description}
                            </p>
                          )}
                        </div>
                      </td>

                      <td className="px-5 py-4 text-muted-foreground">
                        {project.client || 'Not set'}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${getProjectStatusClass(project.status)}`}
                        >
                          {project.status || 'Not set'}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-muted-foreground">
                        {getProjectTimelineStatusLabel(
                          projectTimelineSummaries[project.id],
                          projectTimelineSummariesLoading
                        )}
                      </td>

                      {canManageProjects && (
                        <td className="relative px-5 py-4 text-right">
                          <button
                            type="button"
                            onClick={event => {
                              event.stopPropagation();
                              openProjectActionsMenu(event, project);
                            }}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            aria-label="Project menu"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-border md:hidden">
              {filteredProjects.map(project => (
                <div key={project.id} className="relative">
                  <button
                    type="button"
                    onClick={() => setSelectedProject(project)}
                    className="w-full p-4 text-left transition-colors active:bg-muted/50"
                  >
                    <div className="flex items-start justify-between gap-3 pr-12">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {project.name}
                        </p>
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          {project.client || 'Client not set'}
                        </p>
                      </div>

                      <span
                        className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${getProjectStatusClass(project.status)}`}
                      >
                        {project.status || 'Not set'}
                      </span>
                    </div>

                    <div className="mt-3 text-xs text-muted-foreground">
                      Timeline: {getProjectTimelineStatusLabel(
                        projectTimelineSummaries[project.id],
                        projectTimelineSummariesLoading
                      )}
                    </div>
                  </button>

                  {canManageProjects && (
                    <div className="absolute right-4 top-4">
                      <button
                        type="button"
                        onClick={event => {
                          event.stopPropagation();
                          openProjectActionsMenu(event, project);
                        }}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        aria-label="Project menu"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      {floatingMenuLayer}
        {projectModal}
      {deleteDialog}
    </div>
  );
}
