export type ItemStatus = 'active' | 'inactive';

export type ItemCategory = string;

export interface ProcurementItem {
  id: string;
  name: string;
  category: ItemCategory;
  defaultUnitLabel: string;
  purchaseRatePerUnit: number;
  markupPercent: number;
  sellingRatePerUnit: number;
  defaultDescription: string;
  status: ItemStatus;
  updatedAt: string;
}
