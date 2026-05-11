export type VendorStatus = 'active' | 'inactive' | 'blacklisted';
export type VendorAvailability = 'available' | 'busy' | 'on_hold';

export type VendorCategory =
  | 'civil'
  | 'electrical'
  | 'plumbing'
  | 'painting'
  | 'false_ceiling'
  | 'glass_windows'
  | 'carpentry'
  | 'modular_kitchen'
  | 'wardrobe'
  | 'flooring'
  | 'stone'
  | 'metal'
  | 'fabrication'
  | 'lighting'
  | 'other';

export interface Vendor {
  id: string;
  name: string;
  category: VendorCategory;
  scopeOfWork: string;
  contactPerson: string;
  phone: string;
  email?: string;
  location: string;
  rating: number;
  status: VendorStatus;
  availability: VendorAvailability;
  assignedProjectCount: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}
