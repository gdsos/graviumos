import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Layers3,
  Plus,
  Play,
  Sparkles,
  Store,
  Trash2,
} from 'lucide-react';

import { SectionCard } from '@/components/common/SectionCard';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';

import { CostEstimateStep } from './CostEstimateStep';

import {
  demoVendors,
  vendorCategoryLabels,
} from '@/features/vendors/data';

import {
  areaTemplates,
  getDefaultScopeItemsForArea,
  projectCategoryLabels,
  timelineModeLabels,
  timelineTemplates,
} from '../scopeTemplates';

import { generateTimelineFromDraft } from '../generator';
import type { CostEstimateSummary } from '../estimate';

import type {
  AreaType,
  SelectedArea,
  SelectedScopeItem,
  TimelineCreationDraft,
} from '../scopeTypes';

import type { PaymentGate, WorkPackage } from '../types';

interface CreateTimelineWizardProps {
  onClose?: () => void;
  onUseDraft?: (generatedTimeline: {
    paymentGates: PaymentGate[];
    workPackages: WorkPackage[];
  }) => void;
}

type WizardStep =
  | 'template'
  | 'basics'
  | 'areas'
  | 'scope'
  | 'vendors'
  | 'estimate'
  | 'review';

const wizardSteps: Array<{ id: WizardStep; label: string; description: string }> = [
  {
    id: 'template',
    label: 'Strategy',
    description: 'Choose timeline generation strategy',
  },
  {
    id: 'basics',
    label: 'Basics',
    description: 'Set project details',
  },
  {
    id: 'areas',
    label: 'Areas',
    description: 'Temporary room setup',
  },
  {
    id: 'scope',
    label: 'Scope',
    description: 'Temporary scope review',
  },
  {
    id: 'vendors',
    label: 'Vendors',
    description: 'Assign vendor teams',
  },
  {
    id: 'estimate',
    label: 'Estimate',
    description: 'Validate project revenue',
  },
  {
    id: 'review',
    label: 'Review',
    description: 'Preview generated timeline',
  },
];

const customAreaExamples = [
  'Prayer Room',
  'Majlis',
  'Pooja Room',
  'Home Office',
  'Library',
  'Kids Play Area',
];

const customScopeExamples = [
  'CNC Arabesque Wall Panel',
  'Islamic Arch Feature',
  'Floor Mat / Carpet Zone',
  'Custom Storage Cabinet',
  'Decorative Niche Lighting',
  'Custom Wall Cladding',
];

type RepeatedAreaType = 'bedroom' | 'bathroom';

const repeatedAreaOptions: Array<{
  value: RepeatedAreaType;
  label: string;
  areaTemplateId: string;
}> = [
  {
    value: 'bedroom',
    label: 'Bedroom',
    areaTemplateId: 'area-bedroom',
  },
  {
    value: 'bathroom',
    label: 'Bathroom',
    areaTemplateId: 'area-bathroom',
  },
];

const paymentGateOptions: Array<{
  value: NonNullable<SelectedScopeItem['paymentGateType']>;
  label: string;
}> = [
  { value: 'procurement_start', label: 'Procurement Start' },
  { value: 'major_site_execution', label: 'Major Site Execution' },
  { value: 'final_installation', label: 'Final Installation' },
  { value: 'handover', label: 'Handover' },
];

type CustomScopeForm = {
  areaId: string;
  name: string;
  durationDays: string;
  vendorRequired: boolean;
  vendorCategory: NonNullable<SelectedScopeItem['vendorCategory']>;
  paymentGateType: NonNullable<SelectedScopeItem['paymentGateType']>;
};

type TimelineDraftInput = {
  projectName: string;
  clientName: string;
  startDate: string;
  designValue: string;
  executionValue: string;
};

function createId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}`;
}

function getInitialTemplateId() {
  return timelineTemplates[0]?.id ?? '';
}

function getTemplateAreaIds(templateId: string) {
  const template = timelineTemplates.find(item => item.id === templateId);
  return template?.areaTemplateIds ?? [];
}

function formatTemplateCategories(templateId: string) {
  const template = timelineTemplates.find(item => item.id === templateId);

  if (!template) return '';

  return template.projectCategories
    .map(category => projectCategoryLabels[category])
    .join(', ');
}

function getStepIndex(step: WizardStep) {
  return wizardSteps.findIndex(item => item.id === step);
}

function createStandardScopeItems(selectedAreas: SelectedArea[]): SelectedScopeItem[] {
  return selectedAreas.flatMap(area => {
    if (!area.areaTemplateId) return [];

    const scopeItems = getDefaultScopeItemsForArea(area.areaTemplateId);

    return scopeItems.map(scopeItem => ({
      id: `scope-${area.id}-${scopeItem.id}`,
      areaId: area.id,
      scopeItemTemplateId: scopeItem.id,
      name: scopeItem.name,
      description: scopeItem.description,
      isCustom: false,
      phase: scopeItem.defaultPhase,
      department: scopeItem.defaultDepartment,
      durationDays: scopeItem.defaultDurationDays,
      priority: scopeItem.defaultPriority,
      vendorRequired: scopeItem.vendorRequired,
      vendorCategory: scopeItem.vendorCategory,
      paymentGateType: scopeItem.defaultPaymentGateType,
      dependencyRules: scopeItem.dependencyRules,
    }));
  });
}

function createCustomArea(name: string): SelectedArea {
  return {
    id: createId('custom-area'),
    type: 'custom' as AreaType,
    name,
    isCustom: true,
    notes: 'Custom room or area added manually during timeline creation.',
  };
}

function createRepeatedArea({
  name,
  areaType,
  areaTemplateId,
}: {
  name: string;
  areaType: RepeatedAreaType;
  areaTemplateId: string;
}): SelectedArea {
  return {
    id: createId(`repeated-${areaType}`),
    areaTemplateId,
    type: areaType,
    name,
    isCustom: true,
    notes: 'Repeated room generated during timeline creation.',
  };
}

function getAreaName(selectedAreas: SelectedArea[], areaId: string) {
  return selectedAreas.find(area => area.id === areaId)?.name ?? 'Selected Area';
}

function formatINR(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function getMatchingVendors(scopeItem: SelectedScopeItem) {
  if (!scopeItem.vendorCategory) return [];

  return demoVendors.filter(
    vendor =>
      vendor.category === scopeItem.vendorCategory &&
      vendor.status === 'active'
  );
}

export function CreateTimelineWizard({
  onClose,
  onUseDraft,
}: CreateTimelineWizardProps) {
  const wizardTopRef = useRef<HTMLElement | null>(null);
  const stepButtonRefs = useRef<Partial<Record<WizardStep, HTMLButtonElement | null>>>({});
  const initialTemplateId = getInitialTemplateId();

  const [activeStep, setActiveStep] = useState<WizardStep>('template');
  const [maxUnlockedStepIndex, setMaxUnlockedStepIndex] = useState(0);
  const [selectedTemplateId, setSelectedTemplateId] = useState(initialTemplateId);
  const [selectedAreaTemplateIds, setSelectedAreaTemplateIds] = useState<string[]>(
    () => getTemplateAreaIds(initialTemplateId)
  );
  const [customAreas, setCustomAreas] = useState<SelectedArea[]>([]);
  const [customAreaName, setCustomAreaName] = useState('');
  const [repeatedAreaType, setRepeatedAreaType] =
    useState<RepeatedAreaType>('bedroom');
  const [repeatedAreaCount, setRepeatedAreaCount] = useState('2');
  const [customScopeItems, setCustomScopeItems] = useState<SelectedScopeItem[]>([]);
  const [vendorAssignments, setVendorAssignments] = useState<Record<string, string>>({});
  const [costEstimateSummary, setCostEstimateSummary] =
    useState<CostEstimateSummary | null>(null);
  const [isCostEstimateApproved, setIsCostEstimateApproved] = useState(false);
  const [isRevenueMismatchModalOpen, setIsRevenueMismatchModalOpen] =
    useState(false);
  const [isRevenueOverwriteWarningVisible, setIsRevenueOverwriteWarningVisible] =
    useState(false);
  const [timelineDraftInput, setTimelineDraftInput] = useState<TimelineDraftInput>({
    projectName: 'Villa, Athani',
    clientName: 'Rafeek Muhammed Ali',
    startDate: new Date().toISOString().slice(0, 10),
    designValue: '150000',
    executionValue: '3145473',
  });
  const [customScopeForm, setCustomScopeForm] = useState<CustomScopeForm>({
    areaId: '',
    name: '',
    durationDays: '4',
    vendorRequired: true,
    vendorCategory: 'carpentry',
    paymentGateType: 'major_site_execution',
  });

  const selectedTemplate = useMemo(
    () => timelineTemplates.find(template => template.id === selectedTemplateId),
    [selectedTemplateId]
  );

  const availableAreaTemplates = useMemo(() => {
    if (!selectedTemplate) return [];

    return selectedTemplate.areaTemplateIds
      .map(areaTemplateId => areaTemplates.find(area => area.id === areaTemplateId))
      .filter(Boolean);
  }, [selectedTemplate]);

  const selectedAreas = useMemo<SelectedArea[]>(() => {
    const standardAreas = selectedAreaTemplateIds
      .map(areaTemplateId => areaTemplates.find(area => area.id === areaTemplateId))
      .filter(Boolean)
      .map(areaTemplate => ({
        id: `area-${areaTemplate!.id}`,
        areaTemplateId: areaTemplate!.id,
        type: areaTemplate!.type,
        name: areaTemplate!.name,
        isCustom: areaTemplate!.isCustom,
        notes: areaTemplate!.description,
      }));

    return [...standardAreas, ...customAreas];
  }, [customAreas, selectedAreaTemplateIds]);

  const resolvedCustomScopeAreaId = selectedAreas.some(
    area => area.id === customScopeForm.areaId
  )
    ? customScopeForm.areaId
    : selectedAreas[0]?.id ?? '';

  const standardScopeItems = useMemo(
    () => createStandardScopeItems(selectedAreas),
    [selectedAreas]
  );

  const selectedScopeItems = useMemo(
    () =>
      [...standardScopeItems, ...customScopeItems].map(scopeItem => ({
        ...scopeItem,
        selectedVendorId: vendorAssignments[scopeItem.id],
      })),
    [customScopeItems, standardScopeItems, vendorAssignments]
  );

  const vendorRequiredScopeItems = selectedScopeItems.filter(
    scopeItem => scopeItem.vendorRequired
  );

  const assignedVendorCount = vendorRequiredScopeItems.filter(
    scopeItem => Boolean(scopeItem.selectedVendorId)
  ).length;

  const unassignedVendorCount =
    vendorRequiredScopeItems.length - assignedVendorCount;

  const draft: TimelineCreationDraft | null = useMemo(() => {
    if (!selectedTemplate) return null;

    const manualDesignValue = Number(timelineDraftInput.designValue) || 0;
    const manualExecutionValue = Number(timelineDraftInput.executionValue) || 0;

    return {
      id: createId('timeline-draft'),
      projectName: timelineDraftInput.projectName.trim() || 'Untitled Project',
      clientName: timelineDraftInput.clientName.trim() || 'Client',
      projectCategory: selectedTemplate.projectCategories[0],
      timelineMode: selectedTemplate.defaultTimelineMode,
      conversionStatus: selectedTemplate.supportsConversionToExecution
        ? 'awaiting_execution_decision'
        : 'not_applicable',
      selectedTemplateId: selectedTemplate.id,
      selectedAreas,
      selectedScopeItems,
      designValue: manualDesignValue,
      executionValue:
        costEstimateSummary?.estimatedGrossRevenue ?? manualExecutionValue,
      startDate:
        timelineDraftInput.startDate || new Date().toISOString().slice(0, 10),
      notes:
        'Preview draft generated from scope template. Timeline basics are currently editable manually and can later be fetched from approved Cost Estimate data.',
    };
  }, [
    costEstimateSummary?.estimatedGrossRevenue,
    selectedAreas,
    selectedScopeItems,
    selectedTemplate,
    timelineDraftInput.clientName,
    timelineDraftInput.designValue,
    timelineDraftInput.executionValue,
    timelineDraftInput.projectName,
    timelineDraftInput.startDate,
  ]);

  const generatedTimeline = useMemo(() => {
    if (!draft) return null;

    return generateTimelineFromDraft(draft);
  }, [draft]);

  const currentStepIndex = getStepIndex(activeStep);
  const customAreaCount = selectedAreas.filter(area => area.isCustom).length;
  const customScopeCount = selectedScopeItems.filter(scopeItem => scopeItem.isCustom).length;
  const requiresApprovedCostEstimate =
    selectedTemplate?.defaultTimelineMode !== 'design_only';
  const shouldHideManualExecutionValue = requiresApprovedCostEstimate;
  const canUseDraft =
    Boolean(generatedTimeline) &&
    (!requiresApprovedCostEstimate || isCostEstimateApproved);
  const isEstimateAwaitingSummary =
    activeStep === 'estimate' &&
    requiresApprovedCostEstimate &&
    !costEstimateSummary;
  const isEstimateMatchedButNotApproved =
    activeStep === 'estimate' &&
    requiresApprovedCostEstimate &&
    Boolean(costEstimateSummary?.isRevenueMatched) &&
    !isCostEstimateApproved;
  const isContinueDisabled =
    isEstimateAwaitingSummary || isEstimateMatchedButNotApproved;
  const shouldShowEstimateApprovalNotice =
    requiresApprovedCostEstimate &&
    !isCostEstimateApproved &&
    (activeStep === 'estimate' || activeStep === 'review');

  const handleSelectTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    setSelectedAreaTemplateIds(getTemplateAreaIds(templateId));
    setCustomAreas([]);
    setCustomAreaName('');
    setRepeatedAreaType('bedroom');
    setRepeatedAreaCount('2');
    setCustomScopeItems([]);
    setVendorAssignments({});
    setCostEstimateSummary(null);
    setIsCostEstimateApproved(false);
    setIsRevenueMismatchModalOpen(false);
    setIsRevenueOverwriteWarningVisible(false);
    setCustomScopeForm(current => ({ ...current, areaId: '', name: '' }));
    setMaxUnlockedStepIndex(1);
    setActiveStep('basics');
  };

  const handleToggleArea = (areaTemplateId: string) => {
    const generatedAreaId = `area-${areaTemplateId}`;

    setSelectedAreaTemplateIds(current => {
      if (current.includes(areaTemplateId)) {
        setCustomScopeItems(scopeItems =>
          scopeItems.filter(scopeItem => scopeItem.areaId !== generatedAreaId)
        );

        return current.filter(id => id !== areaTemplateId);
      }

      return [...current, areaTemplateId];
    });
  };

  const handleAddCustomArea = () => {
    const trimmedName = customAreaName.trim();

    if (!trimmedName) return;

    setCustomAreas(current => [...current, createCustomArea(trimmedName)]);
    setCustomAreaName('');
  };

  const handleAddRepeatedAreas = () => {
    const count = Math.max(1, Math.min(10, Number(repeatedAreaCount) || 1));
    const selectedOption = repeatedAreaOptions.find(
      option => option.value === repeatedAreaType
    );

    if (!selectedOption) return;

    const newAreas = Array.from({ length: count }, (_, index) =>
      createRepeatedArea({
        name: `${selectedOption.label} ${index + 1}`,
        areaType: selectedOption.value,
        areaTemplateId: selectedOption.areaTemplateId,
      })
    );

    setCustomAreas(current => [...current, ...newAreas]);
  };

  const handleRemoveCustomArea = (areaId: string) => {
    setCustomAreas(current => current.filter(area => area.id !== areaId));
    setCustomScopeItems(current =>
      current.filter(scopeItem => scopeItem.areaId !== areaId)
    );
  };

  const handleAddCustomScopeItem = () => {
    const trimmedName = customScopeForm.name.trim();

    if (!trimmedName || !resolvedCustomScopeAreaId) return;

    const durationDays = Math.max(1, Number(customScopeForm.durationDays) || 1);

    const customScopeItem: SelectedScopeItem = {
      id: createId('custom-scope'),
      areaId: resolvedCustomScopeAreaId,
      name: trimmedName,
      description: `Custom scope item for ${getAreaName(
        selectedAreas,
        resolvedCustomScopeAreaId
      )}.`,
      isCustom: true,
      phase: 'execution',
      department: customScopeForm.vendorRequired
        ? 'procurement_logistics'
        : 'design_execution',
      durationDays,
      priority: 'medium',
      vendorRequired: customScopeForm.vendorRequired,
      vendorCategory: customScopeForm.vendorRequired
        ? customScopeForm.vendorCategory
        : undefined,
      paymentGateType: customScopeForm.paymentGateType,
      dependencyRules: ['custom'],
      notes: 'Added manually in timeline creation wizard.',
    };

    setCustomScopeItems(current => [...current, customScopeItem]);
    setCustomScopeForm(current => ({
      ...current,
      name: '',
      durationDays: '4',
    }));
  };

  const handleRemoveCustomScopeItem = (scopeItemId: string) => {
    setCustomScopeItems(current =>
      current.filter(scopeItem => scopeItem.id !== scopeItemId)
    );

    setVendorAssignments(current => {
      const nextAssignments = { ...current };
      delete nextAssignments[scopeItemId];
      return nextAssignments;
    });
  };

  const handleTimelineDraftInputChange = (
    field: keyof TimelineDraftInput,
    value: string
  ) => {
    setTimelineDraftInput(current => ({
      ...current,
      [field]: value,
    }));

    if (field === 'executionValue') {
      setIsCostEstimateApproved(false);
    }
  };

  const handleCostEstimateRevenueChange = (revenue: number) => {
    setTimelineDraftInput(current => ({
      ...current,
      executionValue: String(revenue),
    }));
  };

  const handleConfirmRevenueUpdate = () => {
    if (!costEstimateSummary) return;

    handleCostEstimateRevenueChange(costEstimateSummary.estimatedGrossRevenue);
    setIsRevenueMismatchModalOpen(false);
    setIsRevenueOverwriteWarningVisible(false);
  };

  const handleAssignVendor = (scopeItemId: string, vendorId: string) => {
    setVendorAssignments(current => {
      if (!vendorId) {
        const nextAssignments = { ...current };
        delete nextAssignments[scopeItemId];
        return nextAssignments;
      }

      return {
        ...current,
        [scopeItemId]: vendorId,
      };
    });
  };

  const handleUseDraft = () => {
    if (!generatedTimeline) return;

    onUseDraft?.(generatedTimeline);
    onClose?.();
  };

  useEffect(() => {
    wizardTopRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });

    stepButtonRefs.current[activeStep]?.scrollIntoView({
      behavior: 'smooth',
      inline: 'center',
      block: 'nearest',
    });
  }, [activeStep]);

  const goNext = () => {
    if (activeStep === 'estimate' && !canLeaveEstimateStep()) {
      return;
    }

    const nextStep = wizardSteps[currentStepIndex + 1];

    if (!nextStep) return;

    const nextStepIndex = currentStepIndex + 1;

    setMaxUnlockedStepIndex(current => Math.max(current, nextStepIndex));
    setActiveStep(nextStep.id);
  };

  const goBack = () => {
    const previousStep = wizardSteps[currentStepIndex - 1];

    if (previousStep) setActiveStep(previousStep.id);
  };

  const canLeaveEstimateStep = () => {
    if (!requiresApprovedCostEstimate || isCostEstimateApproved) return true;

    if (!costEstimateSummary) return false;

    if (!costEstimateSummary.isRevenueMatched) {
      setIsRevenueMismatchModalOpen(true);
      setIsRevenueOverwriteWarningVisible(false);
      return false;
    }

    return false;
  };

  const handleStepClick = (step: WizardStep, stepIndex: number) => {
    if (stepIndex > maxUnlockedStepIndex) return;

    const estimateStepIndex = getStepIndex('estimate');

    if (
      currentStepIndex <= estimateStepIndex &&
      stepIndex > estimateStepIndex &&
      !canLeaveEstimateStep()
    ) {
      return;
    }

    setActiveStep(step);
  };

  const renderTemplateStep = () => (
    <div className="grid gap-4">
      <div className="rounded-2xl border border-border bg-muted/30 p-3 sm:p-4">
        <p className="text-sm font-medium text-foreground">
          Choose timeline strategy
        </p>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          For now, this still uses existing templates to generate temporary
          planning data. Later, this step will decide how to convert an approved
          Cost Estimate into a timeline.
        </p>
      </div>

      <div className="-mx-3 flex snap-x gap-3 overflow-x-auto px-3 pb-1 [scrollbar-width:none] lg:mx-0 lg:grid lg:grid-cols-2 lg:overflow-visible lg:px-0 lg:pb-0 [&::-webkit-scrollbar]:hidden">
      {timelineTemplates.map(template => {
        const isSelected = selectedTemplateId === template.id;

        return (
          <button
            key={template.id}
            type="button"
            onClick={() => handleSelectTemplate(template.id)}
            className={`min-w-[280px] snap-start rounded-2xl border p-3 text-left text-sm transition sm:min-w-0 sm:p-4 ${
              isSelected
                ? 'border-foreground bg-primary text-primary-foreground'
                : 'border-border bg-background text-foreground hover:bg-muted'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium">{template.name}</p>
                <p
                  className={`mt-1 text-sm leading-6 ${
                    isSelected
                      ? 'text-primary-foreground/75'
                      : 'text-muted-foreground'
                  }`}
                >
                  {template.description}
                </p>

                <p
                  className={`mt-3 text-xs ${
                    isSelected
                      ? 'text-primary-foreground/70'
                      : 'text-muted-foreground'
                  }`}
                >
                  {formatTemplateCategories(template.id)}
                </p>
              </div>

              {isSelected && <CheckCircle2 className="h-5 w-5 shrink-0" />}
            </div>
          </button>
        );
      })}
      </div>
    </div>
  );

  const renderAreasStep = () => (
    <div className="grid gap-4 sm:gap-5">
      <div className="rounded-2xl border border-border bg-muted/30 p-3 sm:p-4">
        <p className="text-sm font-medium text-foreground">
Temporary areas / rooms
        </p>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          Temporary room setup for timeline testing. In the final workflow,
          execution areas should come from the approved Cost Estimate.
        </p>
      </div>

      <div className="-mx-3 flex snap-x gap-3 overflow-x-auto px-3 pb-1 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 xl:grid-cols-3 [&::-webkit-scrollbar]:hidden">
        {availableAreaTemplates.map(area => {
          if (!area) return null;

          const isSelected = selectedAreaTemplateIds.includes(area.id);

          return (
            <button
              key={area.id}
              type="button"
              onClick={() => handleToggleArea(area.id)}
              className={`min-w-[190px] snap-start rounded-2xl border p-3 text-left transition sm:min-w-0 sm:p-4 ${
                isSelected
                  ? 'border-foreground bg-primary text-primary-foreground'
                  : 'border-border bg-background text-foreground hover:bg-muted'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">{area.name}</p>
                  {area.description && (
                    <p
                      className={`mt-1 line-clamp-3 text-sm leading-6 ${
                        isSelected
                          ? 'text-primary-foreground/75'
                          : 'text-muted-foreground'
                      }`}
                    >
                      {area.description}
                    </p>
                  )}
                </div>

                {isSelected && <CheckCircle2 className="h-5 w-5 shrink-0" />}
              </div>
            </button>
          );
        })}
      </div>

      <div className="min-w-0 overflow-hidden rounded-2xl border border-border bg-background p-3 sm:p-4">
        <p className="text-sm font-medium text-foreground">Add custom area</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Use this for custom rooms like Prayer Room, Majlis, Pooja Room, Library,
          Gym, or any special client requirement.
        </p>

        <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]">
          <input
            value={customAreaName}
            onChange={event => setCustomAreaName(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter') {
                event.preventDefault();
                handleAddCustomArea();
              }
            }}
            placeholder="e.g. Prayer Room"
            className="min-h-10 flex-1 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-foreground"
          />

          <Button
            type="button"
            onClick={handleAddCustomArea}
            className="w-full gap-2 sm:w-auto"
            disabled={!customAreaName.trim()}
          >
            <Plus className="h-4 w-4" />
            Add Area
          </Button>
        </div>

        <div className="mt-4 rounded-2xl border border-border bg-muted/20 p-3 sm:p-4">
          <p className="text-sm font-medium text-foreground">
            Add repeated rooms
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Use this for projects with multiple bedrooms or bathrooms. Each generated
            room can later have its own scope.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_120px_auto]">
            <select
              value={repeatedAreaType}
              onChange={event =>
                setRepeatedAreaType(event.target.value as RepeatedAreaType)
              }
              className="min-h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-foreground"
            >
              {repeatedAreaOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <input
              type="number"
              min="1"
              max="10"
              value={repeatedAreaCount}
              onChange={event => setRepeatedAreaCount(event.target.value)}
              className="min-h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-foreground"
            />

            <Button
              type="button"
              onClick={handleAddRepeatedAreas}
              className="w-full gap-2 sm:w-auto"
            >
              <Plus className="h-4 w-4" />
              Add Rooms
            </Button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {customAreaExamples.map(example => (
            <button
              key={example}
              type="button"
              onClick={() => setCustomAreaName(example)}
              className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              {example}
            </button>
          ))}
        </div>
      </div>

      {selectedAreas.length > 0 && (
        <div className="-mx-3 flex snap-x gap-3 overflow-x-auto px-3 pb-1 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 xl:grid-cols-3 [&::-webkit-scrollbar]:hidden">
          {selectedAreas.map(area => (
            <div
              key={area.id}
              className="min-w-[220px] snap-start overflow-hidden rounded-2xl border border-border bg-background p-3 sm:min-w-0 sm:p-4"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="font-medium text-foreground">{area.name}</p>

                {area.isCustom ? (
                  <button
                    type="button"
                    onClick={() => handleRemoveCustomArea(area.id)}
                    className="rounded-full border border-destructive/30 p-1.5 text-destructive transition hover:bg-destructive/10"
                    aria-label="Remove custom area"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <StatusBadge variant="outline">Selected</StatusBadge>
                )}
              </div>

              {area.notes && (
                <p className="line-clamp-3 text-sm leading-6 text-muted-foreground">
                  {area.notes}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderScopeStep = () => (
    <div className="grid gap-4 sm:gap-5">
      <div className="rounded-2xl border border-border bg-muted/30 p-3 sm:p-4">
        <p className="text-sm font-medium text-foreground">
Temporary scope generated from selected areas
        </p>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          Standard scope is generated for timeline testing. In the final
          workflow, execution scope differences should be finalized inside Cost
          Estimate and then converted into work packages.
        </p>
      </div>

      <div className="min-w-0 overflow-hidden rounded-2xl border border-border bg-background p-3 sm:p-4">
        <p className="text-sm font-medium text-foreground">Add custom scope item</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Add special work items under any selected area.
        </p>

        <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1.2fr_120px]">
          <select
            value={resolvedCustomScopeAreaId}
            onChange={event =>
              setCustomScopeForm(current => ({
                ...current,
                areaId: event.target.value,
              }))
            }
            className="min-h-10 w-full min-w-0 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-foreground"
          >
            {selectedAreas.map(area => (
              <option key={area.id} value={area.id}>
                {area.name}
              </option>
            ))}
          </select>

          <input
            value={customScopeForm.name}
            onChange={event =>
              setCustomScopeForm(current => ({
                ...current,
                name: event.target.value,
              }))
            }
            onKeyDown={event => {
              if (event.key === 'Enter') {
                event.preventDefault();
                handleAddCustomScopeItem();
              }
            }}
            placeholder="e.g. CNC Arabesque Wall Panel"
            className="min-h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-foreground"
          />

          <input
            type="number"
            min="1"
            value={customScopeForm.durationDays}
            onChange={event =>
              setCustomScopeForm(current => ({
                ...current,
                durationDays: event.target.value,
              }))
            }
            className="min-h-10 w-full min-w-0 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-foreground"
            placeholder="Days"
          />
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto]">
          <select
            value={customScopeForm.vendorCategory}
            onChange={event =>
              setCustomScopeForm(current => ({
                ...current,
                vendorCategory: event.target.value as CustomScopeForm['vendorCategory'],
              }))
            }
            disabled={!customScopeForm.vendorRequired}
            className="min-h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition disabled:opacity-50"
          >
            {Object.entries(vendorCategoryLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>

          <select
            value={customScopeForm.paymentGateType}
            onChange={event =>
              setCustomScopeForm(current => ({
                ...current,
                paymentGateType: event.target.value as CustomScopeForm['paymentGateType'],
              }))
            }
            className="min-h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition"
          >
            {paymentGateOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <label className="flex min-h-10 items-center gap-2 rounded-lg border border-border px-3 text-sm text-foreground">
            <input
              type="checkbox"
              checked={customScopeForm.vendorRequired}
              onChange={event =>
                setCustomScopeForm(current => ({
                  ...current,
                  vendorRequired: event.target.checked,
                }))
              }
            />
            Vendor required
          </label>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {customScopeExamples.map(example => (
            <button
              key={example}
              type="button"
              onClick={() =>
                setCustomScopeForm(current => ({ ...current, name: example }))
              }
              className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              {example}
            </button>
          ))}
        </div>

        <Button
          type="button"
          onClick={handleAddCustomScopeItem}
          disabled={!customScopeForm.name.trim() || !resolvedCustomScopeAreaId}
          className="mt-4 w-full gap-2 sm:w-auto"
        >
          <Plus className="h-4 w-4" />
          Add Custom Scope
        </Button>
      </div>

      {selectedScopeItems.length > 0 ? (
        <div className="-mx-3 flex snap-x gap-3 overflow-x-auto px-3 pb-1 [scrollbar-width:none] sm:mx-0 sm:grid sm:overflow-visible sm:px-0 sm:pb-0 [&::-webkit-scrollbar]:hidden">
          {selectedScopeItems.map(scopeItem => (
            <div
              key={scopeItem.id}
              className="flex min-w-[280px] snap-start flex-col gap-3 rounded-2xl border border-border bg-background p-3 sm:min-w-0 sm:flex-row sm:items-center sm:justify-between sm:p-4"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-foreground">{scopeItem.name}</p>
                  {scopeItem.isCustom && <StatusBadge variant="info">Custom</StatusBadge>}
                </div>

                <p className="mt-1 text-sm text-muted-foreground">
                  {getAreaName(selectedAreas, scopeItem.areaId)} ·{' '}
                  {scopeItem.durationDays} day(s) ·{' '}
                  {scopeItem.department.replaceAll('_', ' ')}
                </p>

                {scopeItem.vendorCategory && (
                  <p className="mt-1 break-words text-xs text-muted-foreground">
                    Vendor category: {scopeItem.vendorCategory.replaceAll('_', ' ')}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge variant={scopeItem.vendorRequired ? 'warning' : 'muted'}>
                  {scopeItem.vendorRequired ? 'Vendor Required' : 'No Vendor'}
                </StatusBadge>

                <StatusBadge variant="outline">{scopeItem.phase}</StatusBadge>

                {scopeItem.isCustom && (
                  <button
                    type="button"
                    onClick={() => handleRemoveCustomScopeItem(scopeItem.id)}
                    className="rounded-full border border-destructive/30 p-1.5 text-destructive transition hover:bg-destructive/10"
                    aria-label="Remove custom scope item"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-6 text-center">
          <p className="text-sm font-medium text-foreground">
            No scope items yet
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Select at least one standard area or add custom scope items.
          </p>
        </div>
      )}
    </div>
  );

  const renderVendorsStep = () => (
    <div className="grid gap-4 sm:gap-5">
      <div className="rounded-2xl border border-border bg-muted/30 p-3 sm:p-4">
        <p className="text-sm font-medium text-foreground">
          Assign vendors to required scope items
        </p>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          Assign now or leave pending while drafting. Required vendors should be assigned before publishing.
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          <StatusBadge variant="outline">
            {vendorRequiredScopeItems.length} vendor-required
          </StatusBadge>
          <StatusBadge variant={unassignedVendorCount > 0 ? 'warning' : 'success'}>
            {unassignedVendorCount} unassigned
          </StatusBadge>
        </div>
      </div>

      {vendorRequiredScopeItems.length > 0 ? (
        <div className="-mx-3 flex snap-x gap-3 overflow-x-auto px-3 pb-1 [scrollbar-width:none] sm:mx-0 sm:grid sm:overflow-visible sm:px-0 sm:pb-0 [&::-webkit-scrollbar]:hidden">
          {vendorRequiredScopeItems.map(scopeItem => {
            const matchingVendors = getMatchingVendors(scopeItem);
            const assignedVendor = demoVendors.find(
              vendor => vendor.id === scopeItem.selectedVendorId
            );

            return (
              <div
                key={scopeItem.id}
                className="min-w-[300px] snap-start overflow-hidden rounded-2xl border border-border bg-background p-3 sm:min-w-0 sm:p-4"
              >
                <div className="mb-3 flex flex-col gap-3 lg:mb-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-foreground">{scopeItem.name}</p>
                      {scopeItem.isCustom && <StatusBadge variant="info">Custom</StatusBadge>}
                    </div>

                    <p className="mt-1 text-sm text-muted-foreground">
                      {getAreaName(selectedAreas, scopeItem.areaId)} ·{' '}
                      {scopeItem.durationDays} day(s)
                    </p>

                    {scopeItem.vendorCategory && (
                      <p className="mt-1 break-words text-xs text-muted-foreground">
                        Required category:{' '}
                        {vendorCategoryLabels[scopeItem.vendorCategory]}
                      </p>
                    )}
                  </div>

                  <StatusBadge variant={assignedVendor ? 'success' : 'warning'}>
                    {assignedVendor ? 'Assigned' : 'Unassigned'}
                  </StatusBadge>
                </div>

                <div className="grid min-w-0 gap-3">
                  <select
                    value={scopeItem.selectedVendorId ?? ''}
                    onChange={event =>
                      handleAssignVendor(scopeItem.id, event.target.value)
                    }
                    className="min-h-10 w-full min-w-0 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-foreground"
                  >
                    <option value="">Assign later</option>
                    {matchingVendors.map(vendor => (
                      <option key={vendor.id} value={vendor.id}>
                        {vendor.name} · {vendor.location} · {vendor.rating.toFixed(1)}
                      </option>
                    ))}
                  </select>

                  <div className="flex w-full min-w-0 items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground">
                    <Store className="h-4 w-4" />
                    {matchingVendors.length} match
                    {matchingVendors.length === 1 ? '' : 'es'}
                  </div>
                </div>

                {assignedVendor && (
                  <div className="mt-3 min-w-0 overflow-hidden rounded-xl border border-border bg-muted/30 p-3">
                    <p className="text-sm font-medium text-foreground">
                      {assignedVendor.name}
                    </p>
                    <p className="mt-1 break-words text-xs text-muted-foreground">
                      {assignedVendor.contactPerson} · {assignedVendor.phone} ·{' '}
                      {assignedVendor.location}
                    </p>
                  </div>
                )}

                {matchingVendors.length === 0 && (
                  <p className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-muted-foreground">
                    No active vendor found for this category. Add a matching vendor
                    in the Vendors page or assign later.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-6 text-center">
          <Store className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium text-foreground">
            No vendor-required scope items
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add vendor-required scope items in the Scope step to assign vendors.
          </p>
        </div>
      )}
    </div>
  );

  const renderTimelineBasicsCard = () => (
    <SectionCard
      title="Timeline Basics"
      description="Manual timeline inputs for now. Execution revenue will be sourced from the approved Cost Estimate."
      className="rounded-none border-x-0 shadow-none sm:rounded-2xl sm:border-x"
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div className="min-w-0 xl:col-span-2">
          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Project Name
          </label>
          <input
            value={timelineDraftInput.projectName}
            onChange={event =>
              handleTimelineDraftInputChange('projectName', event.target.value)
            }
            className="mt-2 min-h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-foreground"
            placeholder="Project name"
          />
        </div>

        <div className="min-w-0 xl:col-span-2">
          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Client Name
          </label>
          <input
            value={timelineDraftInput.clientName}
            onChange={event =>
              handleTimelineDraftInputChange('clientName', event.target.value)
            }
            className="mt-2 min-h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-foreground"
            placeholder="Client name"
          />
        </div>

        <div className="min-w-0">
          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Start Date
          </label>
          <input
            type="date"
            value={timelineDraftInput.startDate}
            onChange={event =>
              handleTimelineDraftInputChange('startDate', event.target.value)
            }
            className="mt-2 min-h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-foreground"
          />
        </div>

        <div className="min-w-0">
          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Design Value
          </label>
          <input
            type="number"
            min="0"
            value={timelineDraftInput.designValue}
            onChange={event =>
              handleTimelineDraftInputChange('designValue', event.target.value)
            }
            className="mt-2 min-h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-foreground"
            placeholder="0"
          />
        </div>

        {shouldHideManualExecutionValue ? (
          <div className="min-w-0 rounded-2xl border border-border bg-muted/30 p-3 xl:col-span-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Execution Value
            </p>
            <p className="mt-1 text-sm font-medium text-foreground">
              Locked until Cost Estimate approval
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Execution revenue should come from the approved Cost Estimate, not
              from manual timeline input.
            </p>
            {costEstimateSummary?.estimatedGrossRevenue && (
              <p className="mt-2 text-sm font-semibold text-foreground">
                {formatINR(costEstimateSummary.estimatedGrossRevenue)}
              </p>
            )}
          </div>
        ) : (
          <div className="min-w-0">
            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Execution Value
            </label>
            <input
              type="number"
              min="0"
              value={
                costEstimateSummary?.estimatedGrossRevenue
                  ? String(costEstimateSummary.estimatedGrossRevenue)
                  : timelineDraftInput.executionValue
              }
              onChange={event =>
                handleTimelineDraftInputChange('executionValue', event.target.value)
              }
              disabled={Boolean(costEstimateSummary?.estimatedGrossRevenue)}
              className="mt-2 min-h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition disabled:cursor-not-allowed disabled:opacity-60 focus:border-foreground"
              placeholder="0"
            />
            {costEstimateSummary?.estimatedGrossRevenue && (
              <p className="mt-1 text-xs text-muted-foreground">
                Using estimated gross revenue from Cost Estimate.
              </p>
            )}
          </div>
        )}
      </div>
    </SectionCard>
  );

  const renderBasicsStep = () => (
    <div className="grid gap-4 sm:gap-5">
      <div className="rounded-2xl border border-border bg-muted/30 p-3 sm:p-4">
        <p className="text-sm font-medium text-foreground">
          Set timeline basics
        </p>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          These values are manually editable for now. Execution revenue is locked
          for execution-related timelines because it should come from the approved
          Cost Estimate.
        </p>
      </div>

      {renderTimelineBasicsCard()}
    </div>
  );

  const renderEstimateReviewCard = () => {
    if (!costEstimateSummary) return null;

    return (
      <SectionCard
        title="Cost Estimate Validation"
        description="Commercial summary generated from scope pricing, service charge, misc charge, and GST."
        className="shadow-none"
      >
        <div className="mb-4 rounded-2xl border border-border bg-background p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">
                Approval Status
              </p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Execution timeline creation is available only after the Cost
                Estimate is approved.
              </p>
            </div>

            <StatusBadge
              variant={isCostEstimateApproved ? 'success' : 'warning'}
            >
              {isCostEstimateApproved
                ? 'Cost Estimate Approved'
                : 'Approval Required'}
            </StatusBadge>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="min-w-0 overflow-hidden rounded-2xl border border-border bg-background p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              COGS Subtotal
            </p>
            <p className="mt-2 text-xl font-semibold text-foreground">
              {formatINR(costEstimateSummary.cogsSubtotal)}
            </p>
          </div>

          <div className="min-w-0 overflow-hidden rounded-2xl border border-border bg-background p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Gross Revenue
            </p>
            <p className="mt-2 text-xl font-semibold text-foreground">
              {formatINR(costEstimateSummary.estimatedGrossRevenue)}
            </p>
          </div>

          <div className="min-w-0 overflow-hidden rounded-2xl border border-border bg-background p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Current Revenue
            </p>
            <p className="mt-2 text-xl font-semibold text-foreground">
              {formatINR(costEstimateSummary.targetProjectRevenue)}
            </p>
          </div>

          <div className="min-w-0 overflow-hidden rounded-2xl border border-border bg-background p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Revenue Status
            </p>
            <div className="mt-2">
              <StatusBadge
                variant={
                  costEstimateSummary.isRevenueMatched ? 'success' : 'warning'
                }
              >
                {costEstimateSummary.isRevenueMatched
                  ? 'Matched'
                  : `${formatINR(Math.abs(costEstimateSummary.revenueDifference))} difference`}
              </StatusBadge>
            </div>
          </div>
        </div>
      </SectionCard>
    );
  };
  const renderReviewStep = () => (
    <div className="grid gap-5">
      {renderEstimateReviewCard()}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="min-w-0 overflow-hidden rounded-2xl border border-border bg-background p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Areas
          </p>
          <p className="mt-2 text-2xl font-semibold text-foreground">
            {selectedAreas.length}
          </p>
          <p className="mt-1 break-words text-xs text-muted-foreground">
            {customAreaCount} custom
          </p>
        </div>

        <div className="min-w-0 overflow-hidden rounded-2xl border border-border bg-background p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Scope Items
          </p>
          <p className="mt-2 text-2xl font-semibold text-foreground">
            {selectedScopeItems.length}
          </p>
          <p className="mt-1 break-words text-xs text-muted-foreground">
            {customScopeCount} custom
          </p>
        </div>

        <div className="min-w-0 overflow-hidden rounded-2xl border border-border bg-background p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Payment Gates
          </p>
          <p className="mt-2 text-2xl font-semibold text-foreground">
            {generatedTimeline?.paymentGates.length ?? 0}
          </p>
        </div>

        <div className="min-w-0 overflow-hidden rounded-2xl border border-border bg-background p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Work Packages
          </p>
          <p className="mt-2 text-2xl font-semibold text-foreground">
            {generatedTimeline?.workPackages.length ?? 0}
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="min-w-0 overflow-hidden rounded-2xl border border-border bg-background p-4">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Layers3 className="h-5 w-5" />
          </div>
          <p className="text-sm text-muted-foreground">Timeline Mode</p>
          <p className="mt-1 text-base font-semibold text-foreground">
            {selectedTemplate
              ? timelineModeLabels[selectedTemplate.defaultTimelineMode]
              : '—'}
          </p>
        </div>

        <div className="min-w-0 overflow-hidden rounded-2xl border border-border bg-background p-4">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Sparkles className="h-5 w-5" />
          </div>
          <p className="text-sm text-muted-foreground">Vendor Assignments</p>
          <p className="mt-1 text-base font-semibold text-foreground">
            {assignedVendorCount} assigned · {unassignedVendorCount} pending
          </p>
        </div>
      </div>
    </div>
  );

  const renderActiveStep = () => {
    if (activeStep === 'template') return renderTemplateStep();
    if (activeStep === 'basics') return renderBasicsStep();
    if (activeStep === 'areas') return renderAreasStep();
    if (activeStep === 'scope') return renderScopeStep();
    if (activeStep === 'vendors') return renderVendorsStep();
    if (activeStep === 'estimate') {
      return (
        <CostEstimateStep
          selectedAreas={selectedAreas}
          selectedScopeItems={selectedScopeItems}
          targetProjectRevenue={Number(timelineDraftInput.executionValue) || 0}
          onSummaryChange={setCostEstimateSummary}
          onTargetProjectRevenueChange={handleCostEstimateRevenueChange}
          onApprovalChange={setIsCostEstimateApproved}
        />
      );
    }
    return renderReviewStep();
  };

  return (
    <section
      ref={wizardTopRef}
      className="-mx-4 min-w-0 overflow-hidden rounded-none border-y border-border bg-card text-card-foreground shadow-sm sm:mx-0 sm:rounded-2xl sm:border"
    >
      <div className="border-b border-border px-3 py-3 sm:px-5 sm:py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Timeline Creation
            </p>
            <h2 className="mt-1 text-lg font-semibold text-foreground sm:text-xl">
              Create Timeline Wizard
            </h2>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground sm:text-sm sm:leading-6">
              Set up the timeline strategy and temporary planning inputs. Execution
              scope and revenue will later come from the approved Cost Estimate.
            </p>
          </div>

          {onClose && (
            <Button type="button" variant="outline" onClick={onClose} className="w-full sm:w-auto">
              Close
            </Button>
          )}
        </div>
      </div>

      <div className="border-b border-border px-3 py-2 sm:p-4">
        <div className="-mx-3 flex snap-x gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-7 sm:overflow-visible sm:px-0 sm:pb-0 [&::-webkit-scrollbar]:hidden">
          {wizardSteps.map((step, index) => {
            const isActive = activeStep === step.id;
            const isCompleted = index < currentStepIndex;

            return (
              <button
                key={step.id}
                ref={element => {
                  stepButtonRefs.current[step.id] = element;
                }}
                type="button"
                onClick={() => handleStepClick(step.id, index)}
                disabled={index > maxUnlockedStepIndex}
                className={`min-w-[104px] snap-start rounded-full border px-3 py-2 text-center transition disabled:cursor-not-allowed disabled:opacity-50 sm:min-w-0 sm:rounded-2xl sm:px-2 sm:py-3 ${
                  isActive
                    ? 'border-foreground bg-primary text-primary-foreground'
                    : isCompleted
                      ? 'border-border bg-muted text-foreground'
                      : 'border-border bg-background text-muted-foreground hover:bg-muted'
                }`}
              >
                <span className="block text-[11px] font-medium sm:text-sm">
                  {step.label}
                </span>
                <span className="mt-1 hidden text-xs opacity-75 lg:block">
                  {step.description}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {selectedTemplate && (
        <div className="border-b border-border px-3 py-2.5 sm:px-5 sm:py-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">
                {selectedTemplate.name}
              </p>
              <p className="line-clamp-2 text-xs text-muted-foreground sm:line-clamp-none">
                {selectedTemplate.description}
              </p>
            </div>

            <StatusBadge variant="outline">
              {timelineModeLabels[selectedTemplate.defaultTimelineMode]}
            </StatusBadge>
          </div>
        </div>
      )}

      <div className="p-0 sm:p-5">
        <SectionCard
          title={wizardSteps[currentStepIndex]?.label ?? 'Step'}
          description={wizardSteps[currentStepIndex]?.description}
          className="rounded-none border-x-0 shadow-none sm:rounded-2xl sm:border-x"
        >
          {renderActiveStep()}
        </SectionCard>
      </div>

      {isRevenueMismatchModalOpen && costEstimateSummary && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 px-4 py-4 sm:items-center">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-xl sm:p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-600">
                <AlertTriangle className="h-5 w-5" />
              </div>

              <div className="min-w-0">
                <p className="text-base font-semibold text-foreground">
                  Revenue mismatch detected
                </p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  The estimated gross revenue does not match the current project
                  revenue. Resolve this before moving to Review.
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 rounded-2xl border border-border bg-background p-3 sm:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Current Revenue
                </p>
                <p className="mt-1 text-lg font-semibold text-foreground">
                  {formatINR(costEstimateSummary.targetProjectRevenue)}
                </p>
              </div>

              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Estimate Revenue
                </p>
                <p className="mt-1 text-lg font-semibold text-foreground">
                  {formatINR(costEstimateSummary.estimatedGrossRevenue)}
                </p>
              </div>
            </div>

            {isRevenueOverwriteWarningVisible && (
              <p className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs leading-5 text-muted-foreground">
                This will overwrite the current project revenue. Payment gates,
                project financials, execution timeline value, and reports may
                be affected.
              </p>
            )}

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsRevenueMismatchModalOpen(false);
                  setIsRevenueOverwriteWarningVisible(false);
                }}
                className="w-full sm:w-auto"
              >
                Continue Editing
              </Button>

              {isRevenueOverwriteWarningVisible ? (
                <Button
                  type="button"
                  onClick={handleConfirmRevenueUpdate}
                  className="w-full gap-2 sm:w-auto"
                >
                  Confirm Update Revenue
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={() => setIsRevenueOverwriteWarningVisible(true)}
                  className="w-full gap-2 sm:w-auto"
                >
                  Update Revenue
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="sticky bottom-0 z-10 border-t border-border bg-card/95 px-3 py-3 backdrop-blur sm:px-5 sm:py-4">
        {shouldShowEstimateApprovalNotice && (
          <div className="mb-3 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs leading-5 text-muted-foreground">
            Approve the Cost Estimate before creating an execution timeline. If
            the estimate revenue does not match the project revenue, update the
            revenue or continue editing the estimate first.
          </div>
        )}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={goBack}
            disabled={currentStepIndex === 0}
            className="w-full gap-2 sm:w-auto"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>

          {activeStep === 'review' ? (
            <Button
              type="button"
              onClick={handleUseDraft}
              disabled={!canUseDraft}
              className="w-full gap-2 sm:w-auto"
            >
              <Play className="h-4 w-4" />
              Use This Draft
            </Button>
          ) : (
            <Button
              type="button"
              onClick={goNext}
              disabled={isContinueDisabled}
              className="w-full gap-2 sm:w-auto"
            >
              Continue
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}





