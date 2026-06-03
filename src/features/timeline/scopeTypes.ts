import type {
  PaymentGateType,
  ProjectPhase,
  TimelineDepartment,
  WorkPackagePriority,
} from './types';

import type { VendorCategory } from '@/features/vendors/types';

export type ProjectCategory =
  | 'new_home_interior'
  | 'renovation'
  | 'exterior'
  | 'room_specific'
  | 'design_only'
  | 'execution_only';

export type ProjectTimelineMode =
  | 'design_only'
  | 'execution_only'
  | 'design_execution';

export type TimelineConversionStatus =
  | 'not_applicable'
  | 'awaiting_execution_decision'
  | 'converted_to_execution'
  | 'closed_design_only';

export type AreaType =
  | 'living_room'
  | 'kitchen'
  | 'bedroom'
  | 'bathroom'
  | 'dining'
  | 'balcony'
  | 'foyer'
  | 'prayer_room'
  | 'pooja_room'
  | 'home_office'
  | 'kids_room'
  | 'exterior'
  | 'full_house'
  | 'custom';

export type ScopeItemComplexity = 'simple' | 'standard' | 'premium' | 'custom';

export type ScopeItemDependencyRule =
  | 'after_design_approval'
  | 'after_site_measurement'
  | 'after_material_procurement'
  | 'after_civil_readiness'
  | 'after_electrical_rough_in'
  | 'after_false_ceiling'
  | 'after_window_fixing'
  | 'after_painting'
  | 'before_painting'
  | 'before_final_fixtures'
  | 'custom';

export interface AreaTemplate {
  id: string;
  type: AreaType;
  name: string;
  description?: string;
  isCustom: boolean;
  defaultScopeItemIds: string[];
}

export interface ScopeItemTemplate {
  id: string;
  name: string;
  description?: string;
  allowedAreaTypes: AreaType[];
  defaultPhase: ProjectPhase;
  defaultDepartment: TimelineDepartment;
  defaultDurationDays: number;
  defaultPriority: WorkPackagePriority;
  vendorRequired: boolean;
  vendorCategory?: VendorCategory;
  defaultPaymentGateType?: PaymentGateType;
  dependencyRules: ScopeItemDependencyRule[];
  complexity: ScopeItemComplexity;
  createsWorkPackage: boolean;
}

export interface SelectedArea {
  id: string;
  areaTemplateId?: string;
  type: AreaType;
  name: string;
  isCustom: boolean;
  notes?: string;
}

export interface SelectedScopeItem {
  id: string;
  areaId: string;
  scopeItemTemplateId?: string;
  name: string;
  description?: string;
  isCustom: boolean;
  phase: ProjectPhase;
  department: TimelineDepartment;
  durationDays: number;
  priority: WorkPackagePriority;
  vendorRequired: boolean;
  vendorCategory?: VendorCategory;
  selectedVendorId?: string;
  paymentGateType?: PaymentGateType;
  dependencyRules: ScopeItemDependencyRule[];
  notes?: string;
}

export interface PaymentTemplateItem {
  id: string;
  type: PaymentGateType;
  title: string;
  description?: string;
  phase: ProjectPhase;
  percentage: number;
  blocksScopeItemTemplateIds: string[];
}

export interface TimelineTemplate {
  id: string;
  name: string;
  description: string;
  projectCategories: ProjectCategory[];
  defaultTimelineMode: ProjectTimelineMode;
  supportsConversionToExecution: boolean;
  areaTemplateIds: string[];
  paymentTemplate: PaymentTemplateItem[];
}

export interface TimelineCreationDraft {
  id: string;
  projectId?: string;
  projectName: string;
  clientName?: string;
  projectCategory: ProjectCategory;
  timelineMode: ProjectTimelineMode;
  conversionStatus: TimelineConversionStatus;
  selectedTemplateId?: string;
  selectedAreas: SelectedArea[];
  selectedScopeItems: SelectedScopeItem[];
  designValue?: number;
  executionValue?: number;
  startDate: string;
  expectedHandoverDate?: string;
  notes?: string;
}

export interface DesignToExecutionConversionDraft {
  projectId: string;
  originalTimelineId?: string;
  conversionStatus: 'awaiting_execution_decision' | 'converted_to_execution';
  executionValue: number;
  executionStartDate: string;
  selectedTemplateId?: string;
  selectedAreas: SelectedArea[];
  selectedScopeItems: SelectedScopeItem[];
  notes?: string;
}
