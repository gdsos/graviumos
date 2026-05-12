import { useMemo, useState } from 'react';
import {
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

import type {
  AreaType,
  SelectedArea,
  SelectedScopeItem,
  TimelineCreationDraft,
} from '../scopeTypes';

interface CreateTimelineWizardProps {
  onClose?: () => void;
}

type WizardStep = 'template' | 'areas' | 'scope' | 'vendors' | 'review';

const wizardSteps: Array<{ id: WizardStep; label: string; description: string }> = [
  {
    id: 'template',
    label: 'Template',
    description: 'Choose project timeline type',
  },
  {
    id: 'areas',
    label: 'Areas',
    description: 'Select rooms and zones',
  },
  {
    id: 'scope',
    label: 'Scope',
    description: 'Review scope items',
  },
  {
    id: 'vendors',
    label: 'Vendors',
    description: 'Assign vendor teams',
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

function getAreaName(selectedAreas: SelectedArea[], areaId: string) {
  return selectedAreas.find(area => area.id === areaId)?.name ?? 'Selected Area';
}

function getMatchingVendors(scopeItem: SelectedScopeItem) {
  if (!scopeItem.vendorCategory) return [];

  return demoVendors.filter(
    vendor =>
      vendor.category === scopeItem.vendorCategory &&
      vendor.status === 'active'
  );
}

export function CreateTimelineWizard({ onClose }: CreateTimelineWizardProps) {
  const initialTemplateId = getInitialTemplateId();

  const [activeStep, setActiveStep] = useState<WizardStep>('template');
  const [selectedTemplateId, setSelectedTemplateId] = useState(initialTemplateId);
  const [selectedAreaTemplateIds, setSelectedAreaTemplateIds] = useState<string[]>(
    () => getTemplateAreaIds(initialTemplateId)
  );
  const [customAreas, setCustomAreas] = useState<SelectedArea[]>([]);
  const [customAreaName, setCustomAreaName] = useState('');
  const [customScopeItems, setCustomScopeItems] = useState<SelectedScopeItem[]>([]);
  const [vendorAssignments, setVendorAssignments] = useState<Record<string, string>>({});
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

    return {
      id: createId('timeline-draft'),
      projectName: 'Villa, Athani',
      clientName: 'Rafeek Muhammed Ali',
      projectCategory: selectedTemplate.projectCategories[0],
      timelineMode: selectedTemplate.defaultTimelineMode,
      conversionStatus: selectedTemplate.supportsConversionToExecution
        ? 'awaiting_execution_decision'
        : 'not_applicable',
      selectedTemplateId: selectedTemplate.id,
      selectedAreas,
      selectedScopeItems,
      designValue: 150000,
      executionValue: 3145473,
      startDate: new Date().toISOString().slice(0, 10),
      notes: 'Preview draft generated from scope template.',
    };
  }, [selectedAreas, selectedScopeItems, selectedTemplate]);

  const generatedTimeline = useMemo(() => {
    if (!draft) return null;

    return generateTimelineFromDraft(draft);
  }, [draft]);

  const currentStepIndex = getStepIndex(activeStep);
  const customAreaCount = selectedAreas.filter(area => area.isCustom).length;
  const customScopeCount = selectedScopeItems.filter(scopeItem => scopeItem.isCustom).length;

  const handleSelectTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    setSelectedAreaTemplateIds(getTemplateAreaIds(templateId));
    setCustomAreas([]);
    setCustomAreaName('');
    setCustomScopeItems([]);
    setVendorAssignments({});
    setCustomScopeForm(current => ({ ...current, areaId: '', name: '' }));
    setActiveStep('areas');
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

  const goNext = () => {
    const nextStep = wizardSteps[currentStepIndex + 1];
    if (nextStep) setActiveStep(nextStep.id);
  };

  const goBack = () => {
    const previousStep = wizardSteps[currentStepIndex - 1];
    if (previousStep) setActiveStep(previousStep.id);
  };

  const renderTemplateStep = () => (
    <div className="grid gap-4 lg:grid-cols-2">
      {timelineTemplates.map(template => {
        const isSelected = selectedTemplateId === template.id;

        return (
          <button
            key={template.id}
            type="button"
            onClick={() => handleSelectTemplate(template.id)}
            className={`rounded-2xl border p-4 text-left transition ${
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
  );

  const renderAreasStep = () => (
    <div className="grid gap-5">
      <div className="rounded-2xl border border-border bg-muted/30 p-4">
        <p className="text-sm font-medium text-foreground">
          Select areas / rooms
        </p>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          Choose only the rooms or zones included in this project. Custom rooms
          like Prayer Room, Majlis, Home Office, or special-purpose areas can be
          added below.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {availableAreaTemplates.map(area => {
          if (!area) return null;

          const isSelected = selectedAreaTemplateIds.includes(area.id);

          return (
            <button
              key={area.id}
              type="button"
              onClick={() => handleToggleArea(area.id)}
              className={`rounded-2xl border p-4 text-left transition ${
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

      <div className="rounded-2xl border border-border bg-background p-4">
        <p className="text-sm font-medium text-foreground">Add custom area</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Use this for custom rooms like Prayer Room, Majlis, Pooja Room, Library,
          Gym, or any special client requirement.
        </p>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
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
            className="gap-2"
            disabled={!customAreaName.trim()}
          >
            <Plus className="h-4 w-4" />
            Add Area
          </Button>
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
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {selectedAreas.map(area => (
            <div
              key={area.id}
              className="rounded-2xl border border-border bg-background p-4"
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
    <div className="grid gap-5">
      <div className="rounded-2xl border border-border bg-muted/30 p-4">
        <p className="text-sm font-medium text-foreground">
          Scope generated from selected areas
        </p>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          Standard scope items are generated automatically. Add custom items for
          special rooms, client-specific details, CNC work, custom panels, mats,
          or unique execution requirements.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-background p-4">
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
            className="min-h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-foreground"
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
            className="min-h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-foreground"
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
          className="mt-4 gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Custom Scope
        </Button>
      </div>

      {selectedScopeItems.length > 0 ? (
        <div className="grid gap-3">
          {selectedScopeItems.map(scopeItem => (
            <div
              key={scopeItem.id}
              className="flex flex-col gap-3 rounded-2xl border border-border bg-background p-4 sm:flex-row sm:items-center sm:justify-between"
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
                  <p className="mt-1 text-xs text-muted-foreground">
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
    <div className="grid gap-5">
      <div className="rounded-2xl border border-border bg-muted/30 p-4">
        <p className="text-sm font-medium text-foreground">
          Assign vendors to required scope items
        </p>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          Vendor assignment is optional while drafting, but vendor-required scope
          items should be assigned before publishing an execution timeline.
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
        <div className="grid gap-3">
          {vendorRequiredScopeItems.map(scopeItem => {
            const matchingVendors = getMatchingVendors(scopeItem);
            const assignedVendor = demoVendors.find(
              vendor => vendor.id === scopeItem.selectedVendorId
            );

            return (
              <div
                key={scopeItem.id}
                className="rounded-2xl border border-border bg-background p-4"
              >
                <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
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
                      <p className="mt-1 text-xs text-muted-foreground">
                        Required category:{' '}
                        {vendorCategoryLabels[scopeItem.vendorCategory]}
                      </p>
                    )}
                  </div>

                  <StatusBadge variant={assignedVendor ? 'success' : 'warning'}>
                    {assignedVendor ? 'Assigned' : 'Unassigned'}
                  </StatusBadge>
                </div>

                <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
                  <select
                    value={scopeItem.selectedVendorId ?? ''}
                    onChange={event =>
                      handleAssignVendor(scopeItem.id, event.target.value)
                    }
                    className="min-h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-foreground"
                  >
                    <option value="">Assign later</option>
                    {matchingVendors.map(vendor => (
                      <option key={vendor.id} value={vendor.id}>
                        {vendor.name} · {vendor.location} · {vendor.rating.toFixed(1)}
                      </option>
                    ))}
                  </select>

                  <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground">
                    <Store className="h-4 w-4" />
                    {matchingVendors.length} match
                    {matchingVendors.length === 1 ? '' : 'es'}
                  </div>
                </div>

                {assignedVendor && (
                  <div className="mt-3 rounded-xl border border-border bg-muted/30 p-3">
                    <p className="text-sm font-medium text-foreground">
                      {assignedVendor.name}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
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

  const renderReviewStep = () => (
    <div className="grid gap-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-border bg-background p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Areas
          </p>
          <p className="mt-2 text-2xl font-semibold text-foreground">
            {selectedAreas.length}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {customAreaCount} custom
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-background p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Scope Items
          </p>
          <p className="mt-2 text-2xl font-semibold text-foreground">
            {selectedScopeItems.length}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {customScopeCount} custom
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-background p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Payment Gates
          </p>
          <p className="mt-2 text-2xl font-semibold text-foreground">
            {generatedTimeline?.paymentGates.length ?? 0}
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-background p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Work Packages
          </p>
          <p className="mt-2 text-2xl font-semibold text-foreground">
            {generatedTimeline?.workPackages.length ?? 0}
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-background p-4">
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

        <div className="rounded-2xl border border-border bg-background p-4">
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
    if (activeStep === 'areas') return renderAreasStep();
    if (activeStep === 'scope') return renderScopeStep();
    if (activeStep === 'vendors') return renderVendorsStep();
    return renderReviewStep();
  };

  return (
    <section className="min-w-0 rounded-2xl border border-border bg-card text-card-foreground shadow-sm">
      <div className="border-b border-border px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Timeline Creation
            </p>
            <h2 className="mt-1 text-xl font-semibold text-foreground">
              Create Timeline Wizard
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
              Build a timeline from project type, areas, scope items, payment gates,
              vendors, and generated work packages.
            </p>
          </div>

          {onClose && (
            <Button type="button" variant="outline" onClick={onClose}>
              Close
            </Button>
          )}
        </div>
      </div>

      <div className="border-b border-border p-3 sm:p-4">
        <div className="grid grid-cols-5 gap-2">
          {wizardSteps.map((step, index) => {
            const isActive = activeStep === step.id;
            const isCompleted = index < currentStepIndex;

            return (
              <button
                key={step.id}
                type="button"
                onClick={() => setActiveStep(step.id)}
                className={`rounded-2xl border px-2 py-3 text-center transition ${
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
        <div className="border-b border-border px-4 py-3 sm:px-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">
                {selectedTemplate.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {selectedTemplate.description}
              </p>
            </div>

            <StatusBadge variant="outline">
              {timelineModeLabels[selectedTemplate.defaultTimelineMode]}
            </StatusBadge>
          </div>
        </div>
      )}

      <div className="p-4 sm:p-5">
        <SectionCard
          title={wizardSteps[currentStepIndex]?.label ?? 'Step'}
          description={wizardSteps[currentStepIndex]?.description}
          className="shadow-none"
        >
          {renderActiveStep()}
        </SectionCard>
      </div>

      <div className="flex flex-col-reverse gap-3 border-t border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <Button
          type="button"
          variant="outline"
          onClick={goBack}
          disabled={currentStepIndex === 0}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>

        {activeStep === 'review' ? (
          <Button type="button" className="gap-2">
            <Play className="h-4 w-4" />
            Use This Draft
          </Button>
        ) : (
          <Button type="button" onClick={goNext} className="gap-2">
            Continue
            <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </section>
  );
}

