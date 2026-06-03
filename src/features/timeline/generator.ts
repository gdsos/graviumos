import type { PaymentGate, WorkPackage } from './types';
import type {
  PaymentTemplateItem,
  SelectedScopeItem,
  TimelineCreationDraft,
} from './scopeTypes';
import { getTimelineTemplateById } from './scopeTemplates';

interface GeneratedTimeline {
  paymentGates: PaymentGate[];
  workPackages: WorkPackage[];
}

type ApprovedEstimateArea = {
  id: string;
  name: string;
};

type ApprovedEstimateLineItem = {
  id: string;
  areaId: string;
  name: string;
  description: string;
  quantity: number;
  unitLabel: string;
  ratePerUnit: number;
  vendorName?: string;
  remarks?: string;
};

export type ApprovedEstimateTimelineSource = {
  id: string;
  projectId?: string;
  projectName: string;
  clientName?: string;
  version: number;
  grandTotal: number;
  areas: ApprovedEstimateArea[];
  lineItems: ApprovedEstimateLineItem[];
};

function getAreaNameFromEstimate(
  areas: ApprovedEstimateArea[],
  areaId: string
) {
  return areas.find(area => area.id === areaId)?.name ?? 'Selected Area';
}

function getEstimateWorkDuration(lineItem: ApprovedEstimateLineItem) {
  const quantity = Number(lineItem.quantity) || 1;

  if (lineItem.unitLabel.toLowerCase().includes('set')) return 4;
  if (quantity >= 250) return 7;
  if (quantity >= 100) return 5;
  if (quantity >= 25) return 3;

  return 2;
}

function createPaymentGateFromEstimate({
  source,
  index,
  type,
  title,
  description,
  percentage,
  dueDate,
}: {
  source: ApprovedEstimateTimelineSource;
  index: number;
  type: PaymentGate['type'];
  title: string;
  description: string;
  percentage: number;
  dueDate: string;
}): PaymentGate {
  return {
    id: `gate-approved-estimate-${index + 1}`,
    projectId: source.projectId ?? source.id,
    type,
    title,
    description,
    percentage,
    amount: Math.round((source.grandTotal * percentage) / 100),
    dueDate,
    status: 'pending',
    blocksWorkPackageIds: [],
  };
}

export function generateTimelineFromApprovedEstimate({
  source,
  startDate,
  paymentPercentages,
}: {
  source: ApprovedEstimateTimelineSource;
  startDate: string;
  paymentPercentages?: {
    booking: number;
    stageOne: number;
    stageTwo: number;
    handover: number;
  };
}): GeneratedTimeline {
  const resolvedPaymentPercentages = paymentPercentages ?? {
    booking: 35,
    stageOne: 30,
    stageTwo: 25,
    handover: 10,
  };
  const projectId = source.projectId ?? source.id;
  const generatedWorkPackages: WorkPackage[] = [];

  let cursorDate = startDate;

  source.lineItems.forEach((lineItem, index) => {
    const durationDays = getEstimateWorkDuration(lineItem);
    const estimatedStartDate = cursorDate;
    const estimatedEndDate = addDays(estimatedStartDate, durationDays - 1);
    const areaName = getAreaNameFromEstimate(source.areas, lineItem.areaId);
    const paymentGateId =
      index === 0
        ? 'gate-approved-estimate-1'
        : index < Math.ceil(source.lineItems.length * 0.5)
          ? 'gate-approved-estimate-2'
          : index < Math.ceil(source.lineItems.length * 0.85)
            ? 'gate-approved-estimate-3'
            : 'gate-approved-estimate-4';

    generatedWorkPackages.push({
      id: `wp-approved-estimate-${lineItem.id}`,
      projectId,
      phase: 'execution',
      title: `${areaName} - ${lineItem.name}`,
      description: lineItem.description,
      assigneeName: lineItem.vendorName ?? 'Assign Vendor',
      department: lineItem.vendorName ? 'procurement_logistics' : 'design_execution',
      estimatedStartDate,
      estimatedEndDate,
      estimatedDurationDays: durationDays,
      status: 'blocked_by_payment',
      priority: index === 0 ? 'critical' : 'medium',
      paymentGateId,
      dependsOnWorkPackageIds:
        generatedWorkPackages.length > 0
          ? [generatedWorkPackages[generatedWorkPackages.length - 1].id]
          : [],
      pausePeriods: [],
      manualOverrideEnabled: false,
      notes: lineItem.remarks,
    });

    cursorDate = addDays(estimatedEndDate, 1);
  });

  const gate1Date = startDate;
  const gate2Date =
    generatedWorkPackages[Math.max(0, Math.floor(generatedWorkPackages.length * 0.25))]
      ?.estimatedStartDate ?? startDate;
  const gate3Date =
    generatedWorkPackages[Math.max(0, Math.floor(generatedWorkPackages.length * 0.6))]
      ?.estimatedStartDate ?? gate2Date;
  const gate4Date =
    generatedWorkPackages[generatedWorkPackages.length - 1]?.estimatedEndDate ??
    gate3Date;

  const paymentGates = attachPaymentGateBlockers(
    [
      createPaymentGateFromEstimate({
        source,
        index: 0,
        type: 'execution_booking',
        title: 'Booking Payment',
        description: 'Collect on contract signing before timeline confirmation.',
        percentage: resolvedPaymentPercentages.booking,
        dueDate: gate1Date,
      }),
      createPaymentGateFromEstimate({
        source,
        index: 1,
        type: 'procurement_start',
        title: 'Stage 1 Completion',
        description: 'Collect after the first execution stage is completed.',
        percentage: resolvedPaymentPercentages.stageOne,
        dueDate: gate2Date,
      }),
      createPaymentGateFromEstimate({
        source,
        index: 2,
        type: 'final_installation',
        title: 'Stage 2 Completion',
        description: 'Collect before the final execution stage begins.',
        percentage: resolvedPaymentPercentages.stageTwo,
        dueDate: gate3Date,
      }),
      createPaymentGateFromEstimate({
        source,
        index: 3,
        type: 'handover',
        title: 'Final Handover',
        description: 'Collect at final completion and handover.',
        percentage: resolvedPaymentPercentages.handover,
        dueDate: gate4Date,
      }),
    ],
    generatedWorkPackages
  );

  return {
    paymentGates,
    workPackages: generatedWorkPackages,
  };
}


function createId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function toDate(dateString: string) {
  return new Date(`${dateString}T00:00:00`);
}

function toDateString(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(dateString: string, days: number) {
  const date = toDate(dateString);
  date.setDate(date.getDate() + days);
  return toDateString(date);
}

function getProjectValueForPayment(
  draft: TimelineCreationDraft,
  paymentTemplate: PaymentTemplateItem
) {
  if (paymentTemplate.phase === 'design') {
    return draft.designValue ?? 0;
  }

  return draft.executionValue ?? 0;
}

function getPaymentGateId(paymentType: string) {
  return `gate-${paymentType}`;
}

function getScopeItemPaymentGateId(scopeItem: SelectedScopeItem) {
  if (!scopeItem.paymentGateType) return undefined;

  return getPaymentGateId(scopeItem.paymentGateType);
}

function shouldStartReady(scopeItem: SelectedScopeItem) {
  return scopeItem.phase === 'design';
}

function generatePaymentGatesFromTemplate(
  draft: TimelineCreationDraft,
  paymentTemplate: PaymentTemplateItem[]
): PaymentGate[] {
  return paymentTemplate.map((payment, index) => {
    const projectValue = getProjectValueForPayment(draft, payment);

    return {
      id: getPaymentGateId(payment.type),
      projectId: draft.projectId ?? draft.id,
      type: payment.type,
      title: payment.title,
      description: payment.description,
      percentage: payment.percentage,
      amount: Math.round((projectValue * payment.percentage) / 100),
      dueDate: addDays(draft.startDate, index * 7),
      status: index === 0 ? 'pending' : 'pending',
      blocksWorkPackageIds: [],
    };
  });
}

function getPreviousWorkPackageId(
  generatedWorkPackages: WorkPackage[],
  scopeItem: SelectedScopeItem
) {
  const previousInSamePhase = [...generatedWorkPackages]
    .reverse()
    .find(workPackage => workPackage.phase === scopeItem.phase);

  return previousInSamePhase?.id;
}

function generateWorkPackageFromScopeItem({
  draft,
  scopeItem,
  index,
  generatedWorkPackages,
}: {
  draft: TimelineCreationDraft;
  scopeItem: SelectedScopeItem;
  index: number;
  generatedWorkPackages: WorkPackage[];
}): WorkPackage {
  const previousWorkPackageId = getPreviousWorkPackageId(
    generatedWorkPackages,
    scopeItem
  );

  const estimatedStartDate =
    previousWorkPackageId && generatedWorkPackages.length > 0
      ? addDays(
          generatedWorkPackages[generatedWorkPackages.length - 1]
            .estimatedEndDate,
          1
        )
      : addDays(draft.startDate, index === 0 ? 0 : index);

  const estimatedEndDate = addDays(
    estimatedStartDate,
    Math.max(0, scopeItem.durationDays - 1)
  );

  const paymentGateId = getScopeItemPaymentGateId(scopeItem);

  return {
    id: `wp-${scopeItem.id}`,
    projectId: draft.projectId ?? draft.id,
    phase: scopeItem.phase,
    title: scopeItem.name,
    description: scopeItem.description,
    vendorId: scopeItem.selectedVendorId,
    assigneeName:
      scopeItem.department === 'procurement_logistics'
        ? 'Procurement Lead'
        : scopeItem.department === 'finance'
          ? 'Finance Lead'
          : 'Execution Lead',
    department: scopeItem.department,
    estimatedStartDate,
    estimatedEndDate,
    estimatedDurationDays: scopeItem.durationDays,
    status: paymentGateId
      ? 'blocked_by_payment'
      : shouldStartReady(scopeItem)
        ? 'ready'
        : 'not_started',
    priority: scopeItem.priority,
    paymentGateId,
    dependsOnWorkPackageIds: previousWorkPackageId ? [previousWorkPackageId] : [],
    pausePeriods: [],
    manualOverrideEnabled: false,
    notes: scopeItem.notes,
  };
}

function attachPaymentGateBlockers(
  paymentGates: PaymentGate[],
  workPackages: WorkPackage[]
) {
  return paymentGates.map(paymentGate => ({
    ...paymentGate,
    blocksWorkPackageIds: workPackages
      .filter(workPackage => workPackage.paymentGateId === paymentGate.id)
      .map(workPackage => workPackage.id),
  }));
}

export function generateTimelineFromDraft(
  draft: TimelineCreationDraft
): GeneratedTimeline {
  const template = getTimelineTemplateById(draft.selectedTemplateId);

  const paymentTemplate = template?.paymentTemplate ?? [];

  const generatedWorkPackages: WorkPackage[] = [];

  draft.selectedScopeItems.forEach((scopeItem, index) => {
    generatedWorkPackages.push(
      generateWorkPackageFromScopeItem({
        draft,
        scopeItem,
        index,
        generatedWorkPackages,
      })
    );
  });

  const paymentGates = attachPaymentGateBlockers(
    generatePaymentGatesFromTemplate(draft, paymentTemplate),
    generatedWorkPackages
  );

  return {
    paymentGates,
    workPackages: generatedWorkPackages,
  };
}

export function createSelectedScopeItemFromTemplate({
  areaId,
  scopeItemTemplateId,
  name,
  description,
  phase,
  department,
  durationDays,
  priority,
  vendorRequired,
  vendorCategory,
  paymentGateType,
  dependencyRules,
}: {
  areaId: string;
  scopeItemTemplateId?: string;
  name: string;
  description?: string;
  phase: SelectedScopeItem['phase'];
  department: SelectedScopeItem['department'];
  durationDays: number;
  priority: SelectedScopeItem['priority'];
  vendorRequired: boolean;
  vendorCategory?: SelectedScopeItem['vendorCategory'];
  paymentGateType?: SelectedScopeItem['paymentGateType'];
  dependencyRules: SelectedScopeItem['dependencyRules'];
}): SelectedScopeItem {
  return {
    id: createId('scope-item'),
    areaId,
    scopeItemTemplateId,
    name,
    description,
    isCustom: !scopeItemTemplateId,
    phase,
    department,
    durationDays,
    priority,
    vendorRequired,
    vendorCategory,
    paymentGateType,
    dependencyRules,
  };
}

export function createCustomScopeItem({
  areaId,
  name,
  description,
  durationDays,
  vendorCategory,
  paymentGateType,
}: {
  areaId: string;
  name: string;
  description?: string;
  durationDays: number;
  vendorCategory?: SelectedScopeItem['vendorCategory'];
  paymentGateType?: SelectedScopeItem['paymentGateType'];
}): SelectedScopeItem {
  return {
    id: createId('custom-scope-item'),
    areaId,
    name,
    description,
    isCustom: true,
    phase: 'execution',
    department: vendorCategory ? 'procurement_logistics' : 'design_execution',
    durationDays,
    priority: 'medium',
    vendorRequired: Boolean(vendorCategory),
    vendorCategory,
    paymentGateType,
    dependencyRules: ['custom'],
  };
}
