import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  FilePlus2,
  Plus,
  Trash2,
} from 'lucide-react';

import { PageHeader } from '@/components/common/PageHeader';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';
import { CostEstimateSection } from '@/features/cost-estimate/components/CostEstimateSection';
import {
  DEFAULT_MISC_CHARGE_PERCENT,
  DEFAULT_SERVICE_CHARGE_PERCENT,
} from '@/features/cost-estimate/calculator';
import {
  demoCostEstimateAreas,
  demoCostEstimateProjects,
  demoCostEstimateLineItems,
} from '@/features/cost-estimate/data';
import type {
  CostEstimateArea,
  CostEstimateLineItem,
} from '@/features/cost-estimate/types';

type EstimateCardStatus = 'draft' | 'approved' | 'revision';

interface EstimateCardRecord {
  id: string;
  projectId?: string;
  projectName: string;
  clientName?: string;
  status: EstimateCardStatus;
  version: number;
  grandTotal: number;
  updatedAt: string;
  areas: CostEstimateArea[];
  lineItems: CostEstimateLineItem[];
  serviceChargePercent: number;
  miscChargePercent: number;
  targetProjectRevenue: number;
  approvedSnapshot?: EstimateEditorPayload;
}

interface EstimateEditorPayload {
  grandTotal: number;
  status: EstimateCardStatus;
  version: number;
  areas: CostEstimateArea[];
  lineItems: CostEstimateLineItem[];
  serviceChargePercent: number;
  miscChargePercent: number;
  targetProjectRevenue: number;
  approvedSnapshot?: EstimateEditorPayload;
}

const UNASSIGNED_PROJECT_ID = 'unassigned-draft';

const customAreaSuggestions = [
  'Patio',
  'Porch',
  'Prayer Room',
  'Balcony Sit-out',
  'Deck',
  'Courtyard',
  'Work Area',
  'Upper Living',
  'Store Room',
];

function nowTimestamp() {
  return new Date().toISOString();
}

function formatUpdatedAt(value: string) {
  const updatedAt = new Date(value);

  if (Number.isNaN(updatedAt.getTime())) return value;

  const diffMs = Date.now() - updatedAt.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes} min ago`;
  if (diffHours < 24) return `${diffHours} hr ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;

  return updatedAt.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

const initialEstimateCards: EstimateCardRecord[] = [
  {
    id: 'estimate-unassigned-draft',
    projectName: 'Unassigned Draft',
    status: 'draft',
    version: 1,
    grandTotal: 0,
    updatedAt: nowTimestamp(),
    areas: demoCostEstimateAreas,
    lineItems: [],
    serviceChargePercent: DEFAULT_SERVICE_CHARGE_PERCENT,
    miscChargePercent: DEFAULT_MISC_CHARGE_PERCENT,
    targetProjectRevenue: 950000,
  },
  {
    id: 'estimate-villa-athani',
    projectId: 'project-villa-athani',
    projectName: 'Villa, Athani',
    clientName: 'Rafeek Muhammed Ali',
    status: 'approved',
    version: 1,
    grandTotal: 1870215,
    updatedAt: nowTimestamp(),
    areas: demoCostEstimateAreas,
    lineItems: demoCostEstimateLineItems,
    serviceChargePercent: DEFAULT_SERVICE_CHARGE_PERCENT,
    miscChargePercent: DEFAULT_MISC_CHARGE_PERCENT,
    targetProjectRevenue: 1870215,
  },
];

function formatINR(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function getEstimateStatusLabel(record: EstimateCardRecord) {
  if (record.status === 'approved') return `Approved - v${record.version} Active`;
  if (record.status === 'revision') return `Revision Draft - v${record.version}`;

  return 'Draft';
}

function getEstimateStatusVariant(status: EstimateCardStatus) {
  if (status === 'approved') return 'success';

  return 'warning';
}

function toTitleCase(value: string) {
  return value
    .replaceAll('_', ' ')
    .replace(/\b\w/g, letter => letter.toUpperCase());
}

function getAreaTypeLabel(areaName: string, areaType: string) {
  const typeLabel = toTitleCase(areaType);

  if (areaType === 'custom') return 'Custom Area';

  if (areaName.trim().toLowerCase() === typeLabel.toLowerCase()) {
    return 'Default Area';
  }

  return typeLabel;
}

function createId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}`;
}

const COST_ESTIMATE_STORAGE_KEY = 'gravium-os-cost-estimates-demo';

function getStoredEstimateCards() {
  if (typeof window === 'undefined') return initialEstimateCards;

  try {
    const storedRecords = localStorage.getItem(COST_ESTIMATE_STORAGE_KEY);

    if (!storedRecords) return initialEstimateCards;

    const parsedRecords = JSON.parse(storedRecords);

    if (!Array.isArray(parsedRecords)) return initialEstimateCards;

    return parsedRecords.filter(record => {
      return (
        record &&
        typeof record.id === 'string' &&
        typeof record.projectName === 'string' &&
        ['draft', 'approved', 'revision'].includes(record.status) &&
        typeof record.version === 'number' &&
        typeof record.grandTotal === 'number' &&
        typeof record.updatedAt === 'string' &&
        Array.isArray(record.areas) &&
        Array.isArray(record.lineItems) &&
        typeof record.serviceChargePercent === 'number' &&
        typeof record.miscChargePercent === 'number' &&
        typeof record.targetProjectRevenue === 'number'
      );
    }) as EstimateCardRecord[];
  } catch {
    return initialEstimateCards;
  }
}

export default function CostEstimatesPage() {
  const [records, setRecords] = useState<EstimateCardRecord[]>(() =>
    getStoredEstimateCards()
  );
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [isViewingApprovedSnapshot, setIsViewingApprovedSnapshot] = useState(false);
  const [approvedSnapshotReturnTarget, setApprovedSnapshotReturnTarget] =
    useState<'list' | 'revision'>('revision');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [deleteRecordId, setDeleteRecordId] = useState<string | null>(null);
  const [createStep, setCreateStep] = useState<'project' | 'areas'>('project');
  const [selectedProjectId, setSelectedProjectId] = useState(
    UNASSIGNED_PROJECT_ID
  );
  const [projectSearch, setProjectSearch] = useState('Unassigned Draft');
  const [isProjectSuggestionOpen, setIsProjectSuggestionOpen] = useState(false);
  const [modalAreas, setModalAreas] =
    useState<CostEstimateArea[]>(demoCostEstimateAreas);
  const [selectedAreaIds, setSelectedAreaIds] = useState(
    demoCostEstimateAreas.map(area => area.id)
  );
  const [newAreaName, setNewAreaName] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    localStorage.setItem(COST_ESTIMATE_STORAGE_KEY, JSON.stringify(records));
  }, [records]);

  const selectedRecord = records.find(record => record.id === selectedRecordId);
  const selectedApprovedSnapshot =
    selectedRecord?.status === 'revision' && selectedRecord.approvedSnapshot
      ? {
          ...selectedRecord,
          grandTotal: selectedRecord.approvedSnapshot.grandTotal,
          status: 'approved' as const,
          version: selectedRecord.approvedSnapshot.version,
          areas: selectedRecord.approvedSnapshot.areas,
          lineItems: selectedRecord.approvedSnapshot.lineItems,
          serviceChargePercent:
            selectedRecord.approvedSnapshot.serviceChargePercent,
          miscChargePercent: selectedRecord.approvedSnapshot.miscChargePercent,
          targetProjectRevenue:
            selectedRecord.approvedSnapshot.targetProjectRevenue,
        }
      : undefined;
  const activeSelectedRecord =
    isViewingApprovedSnapshot && selectedApprovedSnapshot
      ? selectedApprovedSnapshot
      : selectedRecord;
  const usedProjectIds = new Set(
    records
      .map(record => record.projectId)
      .filter((projectId): projectId is string => Boolean(projectId))
  );

  const availableProjects = demoCostEstimateProjects.filter(
    project => !usedProjectIds.has(project.id)
  );

  const matchingProjects = availableProjects.filter(project => {
    const query = projectSearch.trim().toLowerCase();

    if (!query || query === 'unassigned draft') return true;

    return `${project.name} ${project.clientName} ${project.location ?? ''}`
      .toLowerCase()
      .includes(query);
  });

  const selectedProject = demoCostEstimateProjects.find(
    project => project.id === selectedProjectId
  );

  const selectedAreas = useMemo(
    () => modalAreas.filter(area => selectedAreaIds.includes(area.id)),
    [modalAreas, selectedAreaIds]
  );

  const handleSelectUnassignedDraft = () => {
    setSelectedProjectId(UNASSIGNED_PROJECT_ID);
    setProjectSearch('Unassigned Draft');
    setIsProjectSuggestionOpen(false);
  };

  const handleSelectProject = (projectId: string) => {
    const project = demoCostEstimateProjects.find(
      currentProject => currentProject.id === projectId
    );

    if (!project) return;

    setSelectedProjectId(project.id);
    setProjectSearch(`${project.name} - ${project.clientName}`);
    setIsProjectSuggestionOpen(false);
  };

  const handleProjectSearchChange = (value: string) => {
    setProjectSearch(value);
    setSelectedProjectId(UNASSIGNED_PROJECT_ID);
    setIsProjectSuggestionOpen(true);
  };

  const handleToggleArea = (areaId: string) => {
    setSelectedAreaIds(current =>
      current.includes(areaId)
        ? current.filter(currentAreaId => currentAreaId !== areaId)
        : [...current, areaId]
    );
  };

  const handleAddModalArea = () => {
    const trimmedName = newAreaName.trim();

    if (!trimmedName) return;

    const newArea: CostEstimateArea = {
      id: createId('estimate-area'),
      name: trimmedName,
      type: 'custom',
    };

    setModalAreas(current => [...current, newArea]);
    setSelectedAreaIds(current => [...current, newArea.id]);
    setNewAreaName('');
  };

  const handleAddBedroomSet = () => {
    const hasPlainBedroom = modalAreas.some(area => area.name === 'Bedroom');
    const hasPlainAttachedBathroom = modalAreas.some(
      area => area.name === 'Attached Bathroom'
    );

    const normalizedAreas = modalAreas.map(area => {
      if (hasPlainBedroom && area.name === 'Bedroom') {
        return { ...area, name: 'Master Bedroom' };
      }

      if (hasPlainAttachedBathroom && area.name === 'Attached Bathroom') {
        return { ...area, name: 'Master Bathroom' };
      }

      return area;
    });

    const numberedBedroomCount = normalizedAreas.filter(area =>
      /^Bedroom \d+$/.test(area.name)
    ).length;

    const nextBedroomNumber = numberedBedroomCount + 1;

    const bedroomArea: CostEstimateArea = {
      id: createId('estimate-bedroom'),
      name: `Bedroom ${nextBedroomNumber}`,
      type: 'bedroom',
    };

    const attachedBathroomArea: CostEstimateArea = {
      id: createId('estimate-attached-bathroom'),
      name: `Attached Bathroom ${nextBedroomNumber}`,
      type: 'bathroom',
    };

    setModalAreas([...normalizedAreas, bedroomArea, attachedBathroomArea]);
    setSelectedAreaIds(current => [
      ...current,
      bedroomArea.id,
      attachedBathroomArea.id,
    ]);
  };

  const handleAddCommonBathroom = () => {
    const commonBathroomCount =
      modalAreas.filter(area =>
        area.name.toLowerCase().includes('common bathroom')
      ).length + 1;

    const newArea: CostEstimateArea = {
      id: createId('estimate-common-bathroom'),
      name:
        commonBathroomCount === 1
          ? 'Common Bathroom'
          : `Common Bathroom ${commonBathroomCount}`,
      type: 'bathroom',
    };

    setModalAreas(current => [...current, newArea]);
    setSelectedAreaIds(current => [...current, newArea.id]);
  };

  const handleAddSuggestedArea = (areaName: string) => {
    const alreadyExists = modalAreas.some(
      area => area.name.toLowerCase() === areaName.toLowerCase()
    );

    if (alreadyExists) return;

    const newArea: CostEstimateArea = {
      id: createId('estimate-custom-area'),
      name: areaName,
      type: 'custom',
    };

    setModalAreas(current => [...current, newArea]);
    setSelectedAreaIds(current => [...current, newArea.id]);
  };

  const handleOpenCreateModal = () => {
    setSelectedProjectId(UNASSIGNED_PROJECT_ID);
    setProjectSearch('Unassigned Draft');
    setIsProjectSuggestionOpen(false);
    setModalAreas(demoCostEstimateAreas);
    setSelectedAreaIds(demoCostEstimateAreas.map(area => area.id));
    setNewAreaName('');
    setCreateStep('project');
    setIsCreateModalOpen(true);
  };

  const handleStartEstimation = () => {
    const nextRecord: EstimateCardRecord = {
      id: createId('estimate'),
      projectId:
        selectedProjectId === UNASSIGNED_PROJECT_ID ? undefined : selectedProjectId,
      projectName: selectedProject?.name ?? 'Unassigned Draft',
      clientName: selectedProject?.clientName,
      status: 'draft',
      version: 1,
      grandTotal: 0,
      updatedAt: nowTimestamp(),
      areas: selectedAreas,
      lineItems: [],
      serviceChargePercent: DEFAULT_SERVICE_CHARGE_PERCENT,
      miscChargePercent: DEFAULT_MISC_CHARGE_PERCENT,
      targetProjectRevenue: 950000,
    };

    setRecords(current => [nextRecord, ...current]);
    setSelectedRecordId(nextRecord.id);
    setIsViewingApprovedSnapshot(false);
    setIsCreateModalOpen(false);
  };

  const handleSaveEstimate = (payload: EstimateEditorPayload) => {
    if (!selectedRecordId) return;

    setRecords(current =>
      current.map(record =>
        record.id === selectedRecordId
          ? {
              ...record,
              grandTotal: payload.grandTotal,
              status: payload.status,
              version: payload.version,
              updatedAt: nowTimestamp(),
              areas: payload.areas,
              lineItems: payload.lineItems,
              serviceChargePercent: payload.serviceChargePercent,
              miscChargePercent: payload.miscChargePercent,
              targetProjectRevenue: payload.targetProjectRevenue,
            }
          : record
      )
    );
  };

  const handleApproveEstimate = (payload: EstimateEditorPayload) => {
    if (!selectedRecordId) return;

    setRecords(current =>
      current.map(record =>
        record.id === selectedRecordId
          ? {
              ...record,
              grandTotal: payload.grandTotal,
              status: 'approved',
              version: payload.version,
              updatedAt: nowTimestamp(),
              areas: payload.areas,
              lineItems: payload.lineItems,
              serviceChargePercent: payload.serviceChargePercent,
              miscChargePercent: payload.miscChargePercent,
              targetProjectRevenue: payload.targetProjectRevenue,
              approvedSnapshot: undefined,
            }
          : record
      )
    );
  };

  const handleCreateRevisionFromEditor = (payload: EstimateEditorPayload) => {
    if (!selectedRecordId || !selectedRecord) return;

    const approvedSnapshot: EstimateEditorPayload = {
      grandTotal: selectedRecord.grandTotal,
      status: 'approved',
      version: selectedRecord.version,
      areas: selectedRecord.areas,
      lineItems: selectedRecord.lineItems,
      serviceChargePercent: selectedRecord.serviceChargePercent,
      miscChargePercent: selectedRecord.miscChargePercent,
      targetProjectRevenue: selectedRecord.targetProjectRevenue,
    };

    setRecords(current =>
      current.map(record =>
        record.id === selectedRecordId
          ? {
              ...record,
              grandTotal: payload.grandTotal,
              status: 'revision',
              version: payload.version,
              updatedAt: nowTimestamp(),
              areas: payload.areas,
              lineItems: payload.lineItems,
              serviceChargePercent: payload.serviceChargePercent,
              miscChargePercent: payload.miscChargePercent,
              targetProjectRevenue: payload.targetProjectRevenue,
              approvedSnapshot,
            }
          : record
      )
    );
  };

  const handleSaveAndCloseEstimate = (payload: EstimateEditorPayload) => {
    handleSaveEstimate(payload);
    setSelectedRecordId(null);
  };

  const handleDeleteRecord = (recordId: string) => {
    setRecords(current => current.filter(record => record.id !== recordId));

    if (selectedRecordId === recordId) {
      setIsViewingApprovedSnapshot(false);
      setSelectedRecordId(null);
    }
  };

  const handleDeleteSelectedEstimate = () => {
    if (!selectedRecordId) return;

    const currentRecord = records.find(record => record.id === selectedRecordId);

    if (currentRecord?.status === 'revision' && currentRecord.approvedSnapshot) {
      const snapshot = currentRecord.approvedSnapshot;

      setRecords(current =>
        current.map(record =>
          record.id === selectedRecordId
            ? {
                ...record,
                grandTotal: snapshot.grandTotal,
                status: 'approved',
                version: snapshot.version,
                updatedAt: nowTimestamp(),
                areas: snapshot.areas,
                lineItems: snapshot.lineItems,
                serviceChargePercent: snapshot.serviceChargePercent,
                miscChargePercent: snapshot.miscChargePercent,
                targetProjectRevenue: snapshot.targetProjectRevenue,
                approvedSnapshot: undefined,
              }
            : record
        )
      );
      setIsViewingApprovedSnapshot(false);
      setSelectedRecordId(null);
      return;
    }

    setRecords(current => current.filter(record => record.id !== selectedRecordId));
    setIsViewingApprovedSnapshot(false);
    setSelectedRecordId(null);
  };

  const handleCreateRevision = (record: EstimateCardRecord) => {
    const approvedSnapshot: EstimateEditorPayload = {
      grandTotal: record.grandTotal,
      status: 'approved',
      version: record.version,
      areas: record.areas,
      lineItems: record.lineItems,
      serviceChargePercent: record.serviceChargePercent,
      miscChargePercent: record.miscChargePercent,
      targetProjectRevenue: record.targetProjectRevenue,
      approvedSnapshot: undefined,
    };

    setRecords(current =>
      current.map(currentRecord =>
        currentRecord.id === record.id
          ? {
              ...currentRecord,
              status: 'revision',
              version: record.version + 1,
              updatedAt: nowTimestamp(),
              approvedSnapshot,
            }
          : currentRecord
      )
    );

    setIsViewingApprovedSnapshot(false);
    setSelectedRecordId(record.id);
  };

  if (activeSelectedRecord) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsViewingApprovedSnapshot(false);
                setSelectedRecordId(null);
              }}
              className="mb-3 gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Cost Estimates
            </Button>

            <h1 className="text-2xl font-semibold text-foreground">
              {activeSelectedRecord.projectName}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {isViewingApprovedSnapshot
                ? `Viewing Approved - v${activeSelectedRecord.version}`
                : getEstimateStatusLabel(activeSelectedRecord)}
              {activeSelectedRecord.clientName
                ? ` - ${activeSelectedRecord.clientName}`
                : ''}
            </p>
          </div>
        </div>

        {isViewingApprovedSnapshot &&
          selectedRecord?.status === 'revision' &&
          approvedSnapshotReturnTarget === 'revision' && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsViewingApprovedSnapshot(false)}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Revision
            </Button>
          )}

        <CostEstimateSection
          key={`${activeSelectedRecord.id}-${activeSelectedRecord.status}-${activeSelectedRecord.version}-${isViewingApprovedSnapshot ? 'approved-snapshot' : 'active'}`}
          initialAreas={activeSelectedRecord.areas}
          initialLineItems={activeSelectedRecord.lineItems}
          initialProjectId={activeSelectedRecord.projectId}
          initialStatus={activeSelectedRecord.status}
          initialVersion={activeSelectedRecord.version}
          initialServiceChargePercent={activeSelectedRecord.serviceChargePercent}
          initialMiscChargePercent={activeSelectedRecord.miscChargePercent}
          initialTargetProjectRevenue={activeSelectedRecord.targetProjectRevenue}
          isHistoricalView={isViewingApprovedSnapshot}
          onViewApprovedVersion={
            selectedRecord?.status === 'revision' && selectedRecord.approvedSnapshot
              ? () => {
                  setApprovedSnapshotReturnTarget('revision');
                  setIsViewingApprovedSnapshot(true);
                }
              : undefined
          }
          onSaveDraft={handleSaveEstimate}
          onApproveEstimate={handleApproveEstimate}
          onCreateRevision={handleCreateRevisionFromEditor}
          onDeleteDraft={handleDeleteSelectedEstimate}
          onSaveAndClose={handleSaveAndCloseEstimate}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Gravium OS"
        title="Cost Estimates"
        description="Create, review, approve, and revise project cost estimates before execution timelines are generated."
        actions={
          <Button type="button" onClick={handleOpenCreateModal} className="gap-2">
            <Plus className="h-4 w-4" />
            Create Estimate
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {records.map(record => (
            <div
              key={record.id}
              className="rounded-2xl border border-border bg-background p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-foreground">
                    {record.projectName}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {record.clientName ?? 'No project assigned'}
                  </p>
                </div>

                <StatusBadge variant={getEstimateStatusVariant(record.status)}>
                  {getEstimateStatusLabel(record)}
                </StatusBadge>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl border border-border bg-muted/30 p-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Grand Total
                  </p>
                  <p className="mt-1 font-semibold text-foreground">
                    {record.grandTotal ? formatINR(record.grandTotal) : 'Not set'}
                  </p>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Updated
                  </p>
                  <p className="mt-1 font-semibold text-foreground">
                    {formatUpdatedAt(record.updatedAt)}
                  </p>
                </div>
              </div>

              <div
                className={`mt-4 grid grid-cols-1 gap-2 ${
                  record.status === 'approved' ||
                  (record.status === 'revision' && record.approvedSnapshot)
                    ? 'sm:grid-cols-[repeat(3,minmax(0,1fr))]'
                    : 'sm:grid-cols-[repeat(2,minmax(0,1fr))]'
                }`}
              >
                <Button
                  type="button"
                  onClick={() => {
                    setIsViewingApprovedSnapshot(false);
                    setApprovedSnapshotReturnTarget('revision');
                    setSelectedRecordId(record.id);
                  }}
                  className="h-10 min-w-0 w-full justify-center overflow-hidden px-2 text-sm sm:px-3"
                >
                  {record.status === 'revision' ? 'Open Revision' : 'Open Estimate'}
                </Button>

                {record.status === 'approved' && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleCreateRevision(record)}
                    className="h-10 min-w-0 w-full justify-center gap-1.5 overflow-hidden px-2 text-sm sm:gap-2 sm:px-3"
                  >
                    <FilePlus2 className="h-4 w-4 shrink-0" />
                    <span className="whitespace-nowrap">Revision</span>
                  </Button>
                )}

                {record.status === 'revision' && record.approvedSnapshot && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setSelectedRecordId(record.id);
                      setApprovedSnapshotReturnTarget('list');
                      setIsViewingApprovedSnapshot(true);
                    }}
                    className="h-10 min-w-0 w-full justify-center gap-1.5 overflow-hidden px-2 text-sm sm:gap-2 sm:px-3"
                  >
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span className="whitespace-nowrap">View Approved</span>
                  </Button>
                )}

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDeleteRecordId(record.id)}
                  className="h-10 w-full justify-center gap-2 px-4 text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4 shrink-0" />
                  <span className="whitespace-nowrap">Delete</span>
                </Button>
              </div>
            </div>
        ))}
      </div>

      {deleteRecordId && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 backdrop-blur-sm sm:items-center sm:p-6">
          <div className="w-full max-w-md rounded-t-3xl border border-border bg-card p-5 text-card-foreground shadow-xl sm:rounded-3xl">
            <h2 className="text-lg font-semibold text-foreground">
              Delete cost estimate?
            </h2>

            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              This will remove this cost estimate card and its saved local data.
              This action cannot be undone.
            </p>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDeleteRecordId(null)}
              >
                Cancel
              </Button>

              <Button
                type="button"
                variant="destructive"
                onClick={() => {
                  handleDeleteRecord(deleteRecordId);
                  setDeleteRecordId(null);
                }}
              >
                Delete Estimate
              </Button>
            </div>
          </div>
        </div>
      )}

      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-background/70 p-4 backdrop-blur-md">
          <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-visible rounded-3xl border border-border bg-card shadow-2xl">
            {createStep === 'project' ? (
              <div className="space-y-4 overflow-visible p-4 sm:p-6">
                <div>
                  <p className="text-lg font-semibold text-foreground">
                    Create Cost Estimate
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Start as an unassigned draft or attach this estimate to a project
                    that does not already have one.
                  </p>
                </div>

                <div className="relative">
                  <input
                    value={projectSearch}
                    onFocus={() => setIsProjectSuggestionOpen(true)}
                    onBlur={() => {
                      window.setTimeout(() => {
                        setIsProjectSuggestionOpen(false);
                      }, 120);
                    }}
                    onChange={event => handleProjectSearchChange(event.target.value)}
                    placeholder="Type project name or choose Unassigned Draft"
                    className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-foreground"
                  />

                  {isProjectSuggestionOpen && (
                    <div className="absolute left-0 right-0 top-12 z-[100] overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-lg">
                      <div className="max-h-[min(18rem,50vh)] overflow-y-auto p-1">
                        <button
                          type="button"
                          onMouseDown={event => event.preventDefault()}
                          onClick={handleSelectUnassignedDraft}
                          className="w-full rounded-lg px-3 py-2 text-left transition hover:bg-muted"
                        >
                          <span className="block text-sm font-medium text-foreground">
                            Unassigned Draft
                          </span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            Create now and assign to a project later
                          </span>
                        </button>

                        {matchingProjects.map(project => (
                          <button
                            key={project.id}
                            type="button"
                            onMouseDown={event => event.preventDefault()}
                            onClick={() => handleSelectProject(project.id)}
                            className="w-full rounded-lg px-3 py-2 text-left transition hover:bg-muted"
                          >
                            <span className="block text-sm font-medium text-foreground">
                              {project.name}
                            </span>
                            <span className="mt-0.5 block text-xs text-muted-foreground">
                              {project.clientName}
                              {project.location ? ` - ${project.location}` : ''}
                            </span>
                          </button>
                        ))}

                        {matchingProjects.length === 0 && (
                          <p className="px-3 py-2 text-xs text-muted-foreground">
                            No available project found. Projects with existing cost
                            estimates are hidden.
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreateModalOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="button" onClick={() => setCreateStep('areas')}>
                    Continue
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="shrink-0 border-b border-border p-4 pb-3 sm:p-6 sm:pb-4">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setCreateStep('project')}
                    className="-ml-2 mb-3 h-9 gap-2 px-2"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back
                  </Button>

                  <p className="text-lg font-semibold text-foreground">
                    Select Areas
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Choose the rooms/areas included in this estimate. You can refine
                    these after starting estimation.
                  </p>
                </div>

                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-4 sm:px-6">
                  <div className="max-h-[320px] overflow-y-auto rounded-2xl border border-border bg-muted/25 p-2">
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {modalAreas.map(area => {
                      const isSelected = selectedAreaIds.includes(area.id);

                      return (
                        <button
                          key={area.id}
                          type="button"
                          onClick={() => handleToggleArea(area.id)}
                          className={`min-h-[86px] rounded-xl border p-3 text-left transition ${
                            isSelected
                              ? 'border-emerald-500/35 bg-emerald-500/10 text-foreground shadow-sm dark:border-emerald-400/35 dark:bg-emerald-400/10'
                              : 'border-border bg-card text-foreground hover:border-foreground/30 hover:bg-muted'
                          }`}
                        >
                          <div className="flex h-full flex-col justify-between gap-3">
                            <div className="min-w-0">
                              <span className="block truncate text-sm font-medium">
                                {area.name}
                              </span>
                              <span className="mt-1 block text-xs text-muted-foreground">
                                {getAreaTypeLabel(area.name, area.type)}
                              </span>
                            </div>

                            <span
                              className={`w-fit rounded-full border px-2 py-0.5 text-xs ${
                                isSelected
                                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/40 dark:bg-emerald-400/10 dark:text-emerald-300'
                                  : 'border-border text-muted-foreground'
                              }`}
                            >
                              {isSelected ? 'Selected' : 'Add'}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-muted/30 p-3">
                  <p className="text-sm font-medium text-foreground">
                    Add area
                  </p>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <input
                      value={newAreaName}
                      onChange={event => setNewAreaName(event.target.value)}
                      placeholder="e.g. Prayer Room"
                      className="min-h-10 flex-1 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-foreground"
                    />
                    <Button
                      type="button"
                      onClick={handleAddModalArea}
                      disabled={!newAreaName.trim()}
                      className="gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Add Custom Area
                    </Button>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleAddBedroomSet}
                      className="gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Add Bedroom Set
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleAddCommonBathroom}
                      className="gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Add Common Bathroom
                    </Button>
                  </div>

                  <div className="mt-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Quick custom suggestions
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {customAreaSuggestions.map(areaName => (
                        <button
                          key={areaName}
                          type="button"
                          onClick={() => handleAddSuggestedArea(areaName)}
                          className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground"
                        >
                          + {areaName}
                        </button>
                      ))}
                    </div>
                  </div>

                  <p className="mt-3 text-sm text-muted-foreground">
                    Selected areas: {selectedAreas.length}
                  </p>
                </div>

                </div>

                <div className="shrink-0 rounded-b-3xl border-t border-border bg-card px-4 py-3 shadow-[0_-12px_24px_rgba(0,0,0,0.35)] sm:px-6">
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsCreateModalOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      onClick={handleStartEstimation}
                      disabled={selectedAreaIds.length === 0}
                    >
                      Start Estimation
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
