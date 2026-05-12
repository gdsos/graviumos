import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Layers3,
  Play,
  Sparkles,
} from 'lucide-react';

import { SectionCard } from '@/components/common/SectionCard';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';

import {
  areaTemplates,
  getDefaultScopeItemsForArea,
  projectCategoryLabels,
  timelineModeLabels,
  timelineTemplates,
} from '../scopeTemplates';

import { generateTimelineFromDraft } from '../generator';

import type {
  SelectedArea,
  SelectedScopeItem,
  TimelineCreationDraft,
} from '../scopeTypes';

interface CreateTimelineWizardProps {
  onClose?: () => void;
}

type WizardStep = 'template' | 'areas' | 'scope' | 'review';

const wizardSteps: Array<{ id: WizardStep; label: string; description: string }> = [
  {
    id: 'template',
    label: 'Template',
    description: 'Choose project timeline type',
  },
  {
    id: 'areas',
    label: 'Areas',
    description: 'Review rooms and zones',
  },
  {
    id: 'scope',
    label: 'Scope',
    description: 'Review scope items',
  },
  {
    id: 'review',
    label: 'Review',
    description: 'Preview generated timeline',
  },
];

function createId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}`;
}

function createSelectedAreas(templateId: string): SelectedArea[] {
  const template = timelineTemplates.find(item => item.id === templateId);

  if (!template) return [];

  return template.areaTemplateIds
    .map(areaTemplateId => areaTemplates.find(area => area.id === areaTemplateId))
    .filter(Boolean)
    .map(areaTemplate => ({
      id: createId('area'),
      areaTemplateId: areaTemplate!.id,
      type: areaTemplate!.type,
      name: areaTemplate!.name,
      isCustom: areaTemplate!.isCustom,
      notes: areaTemplate!.description,
    }));
}

function createSelectedScopeItems(selectedAreas: SelectedArea[]): SelectedScopeItem[] {
  return selectedAreas.flatMap(area => {
    if (!area.areaTemplateId) return [];

    const scopeItems = getDefaultScopeItemsForArea(area.areaTemplateId);

    return scopeItems.map(scopeItem => ({
      id: createId('scope'),
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

export function CreateTimelineWizard({ onClose }: CreateTimelineWizardProps) {
  const [activeStep, setActiveStep] = useState<WizardStep>('template');
  const [selectedTemplateId, setSelectedTemplateId] = useState(
    timelineTemplates[0]?.id ?? ''
  );

  const selectedTemplate = useMemo(
    () => timelineTemplates.find(template => template.id === selectedTemplateId),
    [selectedTemplateId]
  );

  const selectedAreas = useMemo(
    () => createSelectedAreas(selectedTemplateId),
    [selectedTemplateId]
  );

  const selectedScopeItems = useMemo(
    () => createSelectedScopeItems(selectedAreas),
    [selectedAreas]
  );

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
  const vendorRequiredCount = selectedScopeItems.filter(
    scopeItem => scopeItem.vendorRequired
  ).length;

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
            onClick={() => {
              setSelectedTemplateId(template.id);
              setActiveStep('areas');
            }}
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
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {selectedAreas.map(area => (
        <div
          key={area.id}
          className="rounded-2xl border border-border bg-background p-4"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="font-medium text-foreground">{area.name}</p>
            {area.isCustom && <StatusBadge variant="info">Custom</StatusBadge>}
          </div>

          {area.notes && (
            <p className="line-clamp-3 text-sm leading-6 text-muted-foreground">
              {area.notes}
            </p>
          )}
        </div>
      ))}
    </div>
  );

  const renderScopeStep = () => (
    <div className="grid gap-3">
      {selectedScopeItems.map(scopeItem => (
        <div
          key={scopeItem.id}
          className="flex flex-col gap-3 rounded-2xl border border-border bg-background p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0">
            <p className="font-medium text-foreground">{scopeItem.name}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {scopeItem.durationDays} day(s) ·{' '}
              {scopeItem.department.replaceAll('_', ' ')}
            </p>

            {scopeItem.vendorCategory && (
              <p className="mt-1 text-xs text-muted-foreground">
                Vendor category: {scopeItem.vendorCategory.replaceAll('_', ' ')}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <StatusBadge variant={scopeItem.vendorRequired ? 'warning' : 'muted'}>
              {scopeItem.vendorRequired ? 'Vendor Required' : 'No Vendor'}
            </StatusBadge>

            <StatusBadge variant="outline">{scopeItem.phase}</StatusBadge>
          </div>
        </div>
      ))}
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
        </div>

        <div className="rounded-2xl border border-border bg-background p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Scope Items
          </p>
          <p className="mt-2 text-2xl font-semibold text-foreground">
            {selectedScopeItems.length}
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
            {vendorRequiredCount} required later
          </p>
        </div>
      </div>
    </div>
  );

  const renderActiveStep = () => {
    if (activeStep === 'template') return renderTemplateStep();
    if (activeStep === 'areas') return renderAreasStep();
    if (activeStep === 'scope') return renderScopeStep();
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
              and generated work packages.
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
        <div className="grid grid-cols-4 gap-2">
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
                <span className="block text-xs font-medium sm:text-sm">
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
