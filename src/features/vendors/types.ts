export type VendorStatus = 'active' | 'inactive' | 'blacklisted';
export type VendorAvailability = 'available' | 'busy' | 'on_hold';

export type VendorCategory = string;

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
  createdAt: string;
  updatedAt: string;
}
