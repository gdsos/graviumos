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
