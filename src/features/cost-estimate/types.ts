export type CostEstimateStatus = 'draft' | 'approved';

export interface CostEstimateArea {
  id: string;
  name: string;
  type: 'living_room' | 'kitchen' | 'bedroom' | 'bathroom' | 'custom';
}

export interface CostEstimateLineItem {
  id: string;
  areaId: string;
  name: string;
  cogsAmount: number;
  quantity: number;
  unitLabel: string;
  vendorName?: string;
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
