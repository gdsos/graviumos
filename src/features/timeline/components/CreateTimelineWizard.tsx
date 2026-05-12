import { useMemo, useState } from 'react';
import { CheckCircle2, Layers3, Play, Sparkles } from 'lucide-react';

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

export function CreateTimelineWizard({ onClose }: CreateTimelineWizardProps) {
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

  const vendorRequiredCount = selectedScopeItems.filter(
    scopeItem => scopeItem.vendorRequired
  ).length;

  const customAreaCount = selectedAreas.filter(area => area.isCustom).length;

  return (
    <section className="min-w-0 rounded-2xl border border-border bg-card text-card-foreground shadow-sm">
      <div className="border-b border-border px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Timeline Creation
            </p>
            <h2 className="mt-1 text-xl font-semibold text-foreground">
              Create Timeline Wizard Preview
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
              Select a scope-driven template and preview generated payment gates,
              areas, scope items, and work packages.
            </p>
          </div>

          {onClose && (
            <Button type="button" variant="outline" onClick={onClose}>
              Close
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-5 p-4 sm:p-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="min-w-0 space-y-4">
          <SectionCard title="Select Template" className="shadow-none">
            <div className="grid gap-3">
              {timelineTemplates.map(template => {
                const isSelected = selectedTemplateId === template.id;

                return (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => setSelectedTemplateId(template.id)}
                    className={`rounded-2xl border p-4 text-left transition ${
                      isSelected
                        ? 'border-foreground bg-primary text-primary-foreground'
                        : 'border-border bg-background text-foreground hover:bg-muted'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{template.name}</p>
                        <p
                          className={`mt-1 text-xs leading-5 ${
                            isSelected
                              ? 'text-primary-foreground/75'
                              : 'text-muted-foreground'
                          }`}
                        >
                          {formatTemplateCategories(template.id)}
                        </p>
                      </div>

                      {isSelected && <CheckCircle2 className="h-4 w-4" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </SectionCard>
        </div>

        <div className="min-w-0 space-y-5">
          {selectedTemplate && (
            <SectionCard
              title={selectedTemplate.name}
              description={selectedTemplate.description}
              actions={
                <StatusBadge variant="outline">
                  {timelineModeLabels[selectedTemplate.defaultTimelineMode]}
                </StatusBadge>
              }
            >
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
                    Vendor Required
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">
                    {vendorRequiredCount}
                  </p>
                </div>

                <div className="rounded-2xl border border-border bg-background p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Custom Areas
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">
                    {customAreaCount}
                  </p>
                </div>
              </div>
            </SectionCard>
          )}

          <SectionCard
            title="Generated Preview"
            description="This preview is generated from selected areas, default scope items, and payment templates."
            actions={
              <Button type="button" className="gap-2">
                <Play className="h-4 w-4" />
                Use This Draft
              </Button>
            }
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-border bg-background p-4">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <Layers3 className="h-5 w-5" />
                </div>
                <p className="text-sm text-muted-foreground">Payment Gates</p>
                <p className="mt-1 text-2xl font-semibold text-foreground">
                  {generatedTimeline?.paymentGates.length ?? 0}
                </p>
              </div>

              <div className="rounded-2xl border border-border bg-background p-4">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <Sparkles className="h-5 w-5" />
                </div>
                <p className="text-sm text-muted-foreground">Work Packages</p>
                <p className="mt-1 text-2xl font-semibold text-foreground">
                  {generatedTimeline?.workPackages.length ?? 0}
                </p>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Selected Areas"
            description="Default areas included by this template. Custom rooms will be added in the next wizard step."
          >
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
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
                    <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">
                      {area.notes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard
            title="Scope Item Preview"
            description="Default scope items generated from selected areas."
          >
            <div className="grid gap-3">
              {selectedScopeItems.slice(0, 12).map(scopeItem => (
                <div
                  key={scopeItem.id}
                  className="flex flex-col gap-3 rounded-2xl border border-border bg-background p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">{scopeItem.name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {scopeItem.durationDays} day(s) · {scopeItem.department.replaceAll('_', ' ')}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <StatusBadge variant={scopeItem.vendorRequired ? 'warning' : 'muted'}>
                      {scopeItem.vendorRequired ? 'Vendor Required' : 'No Vendor'}
                    </StatusBadge>

                    <StatusBadge variant="outline">{scopeItem.phase}</StatusBadge>
                  </div>
                </div>
              ))}

              {selectedScopeItems.length > 12 && (
                <p className="rounded-xl border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                  +{selectedScopeItems.length - 12} more scope item(s)
                </p>
              )}
            </div>
          </SectionCard>
        </div>
      </div>
    </section>
  );
}
