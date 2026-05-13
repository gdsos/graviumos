export type CostEstimateStatus = 'draft' | 'approved';

export interface CostEstimateArea {
  id: string;
  name: string;
  type: 'living_room' | 'kitchen' | 'bedroom' | 'bathroom' | 'custom';
}

export interface CostEstimateUnit {
  id: string;
  label: string;
  shortLabel: string;
  isCustom?: boolean;
}

export interface CostEstimateProject {
  id: string;
  name: string;
  clientName: string;
  location?: string;
  hasCostEstimate?: boolean;
}

export interface CostEstimateItemPreset {
  id: string;
  name: string;
  category: 'carpentry' | 'civil' | 'electrical' | 'plumbing' | 'painting' | 'decor' | 'custom';
  defaultUnitLabel: string;
  purchaseRatePerUnit: number;
  markupPercent: number;
  sellingRatePerUnit: number;
  defaultDescription: string;
}

export interface CostEstimateLineItem {
  id: string;
  areaId: string;
  name: string;
  description: string;
  quantity: number;
  unitLabel: string;
  ratePerUnit: number;
  vendorName?: string;
  remarks?: string;
}

export interface CostEstimateSummary {
  cogsSubtotal: number;
  serviceChargePercent: number;
  serviceChargeAmount: number;
  miscChargePercent: number;
  miscChargeAmount: number;
  taxableSubtotal: number;
  gstPercent: number;
  gstAmount: number;
  estimatedGrossRevenue: number;
  targetProjectRevenue: number;
  revenueDifference: number;
  isRevenueMatched: boolean;
}
