import type {
  CostEstimateArea,
  CostEstimateItemPreset,
  CostEstimateLineItem,
  CostEstimateProject,
  CostEstimateUnit,
} from './types';

export const demoCostEstimateProjects: CostEstimateProject[] = [
  {
    id: 'project-villa-athani',
    name: 'Villa, Athani',
    clientName: 'Rafeek Muhammed Ali',
    location: 'Athani',
    hasCostEstimate: true,
  },
  {
    id: 'project-apartment-kakkanad',
    name: 'Apartment, Kakkanad',
    clientName: 'Muhammed Rafeeq',
    location: 'Kakkanad',
    hasCostEstimate: false,
  },
  {
    id: 'project-office-edappally',
    name: 'Office, Edappally',
    clientName: 'Gravium Workspace',
    location: 'Edappally',
    hasCostEstimate: false,
  },
];

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

export const demoCostEstimateItemPresets: CostEstimateItemPreset[] = [
  {
    id: 'preset-tv-unit',
    name: 'TV Unit',
    category: 'carpentry',
    defaultUnitLabel: 'sqft',
    purchaseRatePerUnit: 520,
    markupPercent: 35,
    sellingRatePerUnit: 700,
    defaultDescription:
      'Design, supply, and installation of TV unit using approved board, laminate, fittings, finishing, and site installation.',
  },
  {
    id: 'preset-wall-panel',
    name: 'Wall Panel',
    category: 'carpentry',
    defaultUnitLabel: 'sqft',
    purchaseRatePerUnit: 420,
    markupPercent: 30,
    sellingRatePerUnit: 550,
    defaultDescription:
      'Design, supply, and installation of decorative wall panel with approved finish, required backing, fittings, and site installation.',
  },
  {
    id: 'preset-wardrobe',
    name: 'Wardrobe',
    category: 'carpentry',
    defaultUnitLabel: 'sqft',
    purchaseRatePerUnit: 680,
    markupPercent: 35,
    sellingRatePerUnit: 920,
    defaultDescription:
      'Design, supply, and installation of wardrobe with internal partitions, shutters, hardware, finishing, and site installation.',
  },
  {
    id: 'preset-kitchen-cabinets',
    name: 'Kitchen Cabinets',
    category: 'carpentry',
    defaultUnitLabel: 'set',
    purchaseRatePerUnit: 220000,
    markupPercent: 27,
    sellingRatePerUnit: 280000,
    defaultDescription:
      'Design, supply, and installation of kitchen cabinets with required hardware, shutters, internal partitions, finishing, and site installation.',
  },
  {
    id: 'preset-false-ceiling',
    name: 'False Ceiling',
    category: 'civil',
    defaultUnitLabel: 'sqft',
    purchaseRatePerUnit: 95,
    markupPercent: 35,
    sellingRatePerUnit: 130,
    defaultDescription:
      'Supply and installation of false ceiling work including framework, boards, finishing, and site execution as per approved design.',
  },
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
