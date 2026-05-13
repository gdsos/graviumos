import type { CostEstimateArea, CostEstimateLineItem } from './types';

export const demoCostEstimateAreas: CostEstimateArea[] = [
  { id: 'estimate-area-living', name: 'Living Room', type: 'living_room' },
  { id: 'estimate-area-kitchen', name: 'Kitchen', type: 'kitchen' },
  { id: 'estimate-area-bedroom-1', name: 'Bedroom 1', type: 'bedroom' },
  { id: 'estimate-area-bedroom-2', name: 'Bedroom 2', type: 'bedroom' },
];

export const demoCostEstimateLineItems: CostEstimateLineItem[] = [
  {
    id: 'estimate-line-living-tv',
    areaId: 'estimate-area-living',
    name: 'TV Unit + Wall Panel',
    cogsAmount: 125000,
    quantity: 1,
    unitLabel: 'scope',
    vendorName: 'Carpentry Vendor',
  },
  {
    id: 'estimate-line-kitchen-cabinets',
    areaId: 'estimate-area-kitchen',
    name: 'Kitchen Cabinets',
    cogsAmount: 280000,
    quantity: 1,
    unitLabel: 'scope',
    vendorName: 'Modular Kitchen Vendor',
  },
  {
    id: 'estimate-line-bedroom-1-wardrobe',
    areaId: 'estimate-area-bedroom-1',
    name: 'Wardrobe',
    cogsAmount: 155000,
    quantity: 1,
    unitLabel: 'scope',
    vendorName: 'Carpentry Vendor',
  },
];
