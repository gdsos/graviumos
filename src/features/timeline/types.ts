export type ProjectPhase = 'design' | 'execution';

export type TimelineDepartment =
  | 'admin'
  | 'design_execution'
  | 'procurement_logistics'
  | 'finance'
  | 'marketing_sales';

export type WorkPackageStatus =
  | 'not_started'
  | 'ready'
  | 'in_progress'
  | 'paused'
  | 'blocked_by_payment'
  | 'blocked_by_dependency'
  | 'completed'
  | 'delayed';

export type WorkPackagePriority = 'low' | 'medium' | 'high' | 'critical';

export type PaymentGateStatus = 'pending' | 'received' | 'overdue';

export type PaymentGateType =
  | 'design_advance'
  | 'design_balance'
  | 'execution_booking'
  | 'procurement_start'
  | 'major_site_execution'
  | 'final_installation'
  | 'handover';

export type TimelineAlertType =
  | 'payment_blocker'
  | 'dependency_conflict'
  | 'vendor_conflict'
  | 'delay'
  | 'pause'
  | 'critical_path';

export type TimelineAlertSeverity = 'info' | 'warning' | 'danger';

export interface TimelineProject {
  id: string;
  name: string;
  clientName: string;
  projectType: string;
  status: 'active' | 'on_hold' | 'completed' | 'cancelled';
  startDate: string;
  expectedHandoverDate: string;
  currentProjectedHandoverDate: string;
  revenue: number;
  location?: string;
}

export interface PaymentGate {
  id: string;
  projectId: string;
  type: PaymentGateType;
  title: string;
  description?: string;
  percentage: number;
  amount: number;
  dueDate: string;
  receivedDate?: string;
  status: PaymentGateStatus;
  blocksWorkPackageIds: string[];
}

export interface PausePeriod {
  id: string;
  pauseStart: string;
  pauseEnd?: string;
  reason: string;
  createdBy: string;
}

export interface WorkPackage {
  id: string;
  projectId: string;
  phase: ProjectPhase;
  title: string;
  description?: string;
  vendorId?: string;
  assigneeName: string;
  department: TimelineDepartment;

  estimatedStartDate: string;
  estimatedEndDate: string;
  estimatedDurationDays: number;

  actualStartDate?: string;
  actualEndDate?: string;
  actualDurationDays?: number;

  status: WorkPackageStatus;
  priority: WorkPackagePriority;

  paymentGateId?: string;
  dependsOnWorkPackageIds: string[];
  pausePeriods: PausePeriod[];

  manualOverrideEnabled: boolean;
  overrideReason?: string;
  notes?: string;
}

export interface TimelineAlert {
  id: string;
  projectId: string;
  type: TimelineAlertType;
  severity: TimelineAlertSeverity;
  title: string;
  description: string;
  relatedWorkPackageIds?: string[];
  relatedPaymentGateIds?: string[];
  suggestedShiftDays?: number;
  canApplySuggestion: boolean;
}

export interface TimelineSummary {
  totalWorkPackages: number;
  completedWorkPackages: number;
  delayedWorkPackages: number;
  blockedWorkPackages: number;
  pausedWorkPackages: number;
  pendingPaymentGates: number;
  receivedPaymentGates: number;
  projectedDelayDays: number;
}