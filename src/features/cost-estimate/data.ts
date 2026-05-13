import type {
  CostEstimateArea,
  CostEstimateLineItem,
  CostEstimateUnit,
} from './types';

export const defaultCostEstimateUnits: CostEstimateUnit[] = [
  { id: 'sqft', label: 'Square Feet', shortLabel: 'sqft' },
  { id: 'sqm', label: 'Square Meter', shortLabel: 'sqm' },
  { id: 'rft', label: 'Running Feet', shortLabel: 'rft' },
  { id: 'nos', label: 'Number', shortLabel: 'nos' },
  { id: 'bags', label: 'Bags', shortLabel: 'bags' },
  { id: 'box', label: 'Box', shortLabel: 'box' },
  { id: 'set', label: 'Set', shortLabel: 'set' },
  { id: 'lump-sum', label: 'Lump Sum', shortLabel: 'lump sum' },
];

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
    description:
      'Design, supply, and installation of TV unit and wall panel in Living Room, including required fittings, finishing, and site installation.',
    quantity: 280,
    unitLabel: 'sqft',
    ratePerUnit: 320,
    vendorName: 'Carpentry Vendor',
  },
  {
    id: 'estimate-line-kitchen-cabinets',
    areaId: 'estimate-area-kitchen',
    name: 'Kitchen Cabinets',
    description:
      'Design, supply, and installation of kitchen cabinets with required hardware, shutters, internal partitions, finishing, and site installation.',
    quantity: 1,
    unitLabel: 'set',
    ratePerUnit: 280000,
    vendorName: 'Modular Kitchen Vendor',
  },
  {
    id: 'estimate-line-bedroom-1-wardrobe',
    areaId: 'estimate-area-bedroom-1',
    name: 'Wardrobe',
    description:
      'Design, supply, and installation of wardrobe in Bedroom 1 with internal partitions, shutters, hardware, finishing, and site installation.',
    quantity: 1,
    unitLabel: 'set',
    ratePerUnit: 155000,
    vendorName: 'Carpentry Vendor',
  },
];
