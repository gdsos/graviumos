import type { ProcurementItem } from './types';

export const demoProcurementItems: ProcurementItem[] = [
  {
    id: 'item-tv-unit',
    name: 'TV Unit',
    category: 'carpentry',
    defaultUnitLabel: 'sqft',
    purchaseRatePerUnit: 520,
    markupPercent: 35,
    sellingRatePerUnit: 700,
    defaultDescription:
      'Design, supply, and installation of TV unit using approved board, laminate, fittings, hardware, finishing, and site installation.',
    status: 'active',
    updatedAt: '2026-05-10',
  },
  {
    id: 'item-wall-panel',
    name: 'Wall Panel',
    category: 'carpentry',
    defaultUnitLabel: 'sqft',
    purchaseRatePerUnit: 420,
    markupPercent: 30,
    sellingRatePerUnit: 550,
    defaultDescription:
      'Design, supply, and installation of wall panel work with approved material, finishing, and site installation.',
    status: 'active',
    updatedAt: '2026-05-10',
  },
  {
    id: 'item-kitchen-cabinets',
    name: 'Kitchen Cabinets',
    category: 'carpentry',
    defaultUnitLabel: 'set',
    purchaseRatePerUnit: 65000,
    markupPercent: 25,
    sellingRatePerUnit: 81250,
    defaultDescription:
      'Design, supply, and installation of kitchen cabinets with required hardware, shutters, internal partitions, finishing, and site installation.',
    status: 'active',
    updatedAt: '2026-05-10',
  },
  {
    id: 'item-false-ceiling',
    name: 'False Ceiling',
    category: 'false_ceiling',
    defaultUnitLabel: 'sqft',
    purchaseRatePerUnit: 95,
    markupPercent: 35,
    sellingRatePerUnit: 130,
    defaultDescription:
      'Supply and installation of false ceiling work including framework, boards, finishing, and site execution as per approved design.',
    status: 'active',
    updatedAt: '2026-05-10',
  },
];
