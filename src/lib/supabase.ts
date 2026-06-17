import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'gravium-os-auth-session',
      storage: window.localStorage,
    },
  }
);

export type UserRole = 'super_admin' | 'department_head' | 'employee';
export type DeptCode = 'MS' | 'DE' | 'OQ' | 'PL' | 'FI';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  department_ids: string[];
  page_permissions: Record<string, 'view' | 'manage'>;
  employee_code: string | null;
  phone: string;
  address: string;
  profile_picture_url: string;
  social_links: Record<string, string>;
  base_salary: number;
  tds_enabled: boolean;
  pf_enabled: boolean;
  esi_enabled: boolean;
  professional_tax_enabled: boolean;
  kpi_score: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Department {
  id: string;
  name: string;
  code: DeptCode;
  created_at: string;
}

export interface Lead {
  id: string;
  name: string;
  contact_email: string;
  contact_phone: string;
  lead_source: string;
  lead_source_custom: string;
  status: 'Open' | 'Qualified' | 'Converted' | 'Rejected' | 'Ghosted';
  assigned_to: string | null;
  notes: string;
  created_by: string | null;
  converted_project_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  name: string;
  client: string;
  status: 'Active' | 'Completed' | 'On Hold' | 'Cancelled';
  revenue: number;
  estimated_cogs: number;
  design_fee_pct: number;
  description: string;
  start_date: string | null;
  end_date: string | null;
  created_from_lead_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type ProjectCheckpointKey =
  | 'initial_site_visit'
  | 'design_phase'
  | 'execution'
  | 'quality_control'
  | 'handover';

export type ProjectCheckpointStatus =
  | 'locked'
  | 'available'
  | 'in_progress'
  | 'completed'
  | 'skipped';

export interface ProjectCheckpoint {
  id: string;
  project_id: string;
  checkpoint_key: ProjectCheckpointKey;
  title: string;
  status: ProjectCheckpointStatus;
  sort_order: number;
  is_required: boolean;
  notes: string;
  checklist: Array<Record<string, unknown>>;
  attachments: Array<Record<string, unknown>>;
  metadata: Record<string, unknown>;
  completed_at: string | null;
  completed_by: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectDocument {
  id: string;
  project_id: string;
  name: string;
  document_url: string;
  category: string;
  notes: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectExpense {
  id: string;
  project_id: string;
  description: string;
  amount: number;
  expense_date: string;
  created_by: string | null;
  created_at: string;
}

export interface ProjectCashReceived {
  id: string;
  project_id: string;
  description: string;
  amount: number;
  gst_treatment: 'GST' | 'NO_GST';
  received_date: string;
  created_by: string | null;
  created_at: string;
}


export type ProjectFinanceAccountStatus = 'draft' | 'active' | 'closed' | 'archived';

export interface ProjectFinanceAccount {
  id: string;
  project_id: string;
  source_estimate_id: string | null;
  status: ProjectFinanceAccountStatus;
  revenue_amount: number;
  estimated_cogs_amount: number;
  estimated_margin_amount: number;
  service_charge_amount: number;
  misc_charge_amount: number;
  gst_amount: number;
  source_snapshot: Record<string, unknown>;
  last_synced_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type ProjectFinancePaymentGateStatus = 'pending' | 'partial' | 'paid' | 'overpaid' | 'cancelled';

export interface ProjectFinancePaymentGate {
  id: string;
  finance_account_id: string;
  project_id: string;
  timeline_id: string | null;
  timeline_gate_id: string | null;
  gate_order: number;
  title: string;
  trigger_label: string;
  required_amount: number;
  collected_amount: number;
  carry_forward_in_amount: number;
  carry_forward_out_amount: number;
  outstanding_amount: number;
  status: ProjectFinancePaymentGateStatus;
  marked_paid_at: string | null;
  marked_paid_by: string | null;
  source_gate_snapshot: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ProjectCashReceipt {
  id: string;
  finance_account_id: string;
  project_id: string;
  receipt_date: string;
  received_from: string;
  description: string;
  amount: number;
  gst_treatment: 'GST' | 'NO_GST';
  payment_mode: string;
  reference_number: string;
  unallocated_amount: number;
  overpayment_amount: number;
  carry_forward_confirmed: boolean;
  carry_forward_notes: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type ProjectCashReceiptAllocationType = 'gate' | 'carry_forward' | 'adjustment';

export interface ProjectCashReceiptAllocation {
  id: string;
  receipt_id: string;
  finance_account_id: string;
  project_id: string;
  payment_gate_id: string | null;
  source_payment_gate_id: string | null;
  allocation_type: ProjectCashReceiptAllocationType;
  allocated_amount: number;
  allocation_order: number;
  notes: string;
  created_at: string;
}

export type ProjectVendorAccountType = 'in_house' | 'vendor';
export type ProjectVendorAccountStatus = 'open' | 'settled' | 'on_hold' | 'closed';

export interface ProjectVendorAccount {
  id: string;
  finance_account_id: string;
  project_id: string;
  account_key: string;
  account_type: ProjectVendorAccountType;
  vendor_id: string | null;
  vendor_name: string;
  payable_amount: number;
  advance_paid_amount: number;
  total_paid_amount: number;
  outstanding_amount: number;
  status: ProjectVendorAccountStatus;
  notes: string;
  created_at: string;
  updated_at: string;
}

export type ProjectCogsSourceType = 'in_house' | 'vendor';
export type ProjectCogsPaymentStatus = 'unpaid' | 'partial' | 'paid' | 'overpaid' | 'cancelled';

export interface ProjectCogsEntry {
  id: string;
  finance_account_id: string;
  project_id: string;
  vendor_account_id: string | null;
  source_type: ProjectCogsSourceType;
  vendor_id: string | null;
  vendor_name: string;
  category: string;
  description: string;
  estimated_amount: number;
  payable_amount: number;
  paid_amount: number;
  outstanding_amount: number;
  payment_status: ProjectCogsPaymentStatus;
  entry_date: string;
  source_estimate_line_id: string | null;
  source_work_package_id: string | null;
  source_snapshot: Record<string, unknown>;
  remarks: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type ProjectVendorPaymentType = 'advance' | 'bill_payment' | 'adjustment' | 'refund';

export interface ProjectVendorPayment {
  id: string;
  vendor_account_id: string;
  finance_account_id: string;
  project_id: string;
  vendor_id: string | null;
  cogs_entry_id: string | null;
  payment_date: string;
  amount: number;
  payment_type: ProjectVendorPaymentType;
  payment_mode: string;
  reference_number: string;
  notes: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  project_id: string | null;
  assigned_to: string | null;
  department_id: string | null;
  deadline: string | null;
  progress: number;
  status: 'Not Started' | 'Ongoing' | 'Overdue' | 'Completed';
  completed_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Subtask {
  id: string;
  task_id: string;
  title: string;
  is_completed: boolean;
  created_at: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  target_type: 'company' | 'department';
  target_department_id: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'info' | 'task' | 'announcement' | 'approval' | 'project';
  is_read: boolean;
  link: string;
  created_at: string;
}

export interface Attendance {
  id: string;
  employee_id: string;
  date: string;
  check_in: string | null;
  check_out: string | null;
  status: 'Present' | 'Absent' | 'Weekend' | 'Public Holiday' | 'On Approved-Leave';
  location_stamp: string;
  admin_override: boolean;
  notes: string;
}

export interface Payroll {
  id: string;
  employee_id: string;
  month: number;
  year: number;
  base_salary: number;
  kpi_incentive: number;
  tds_deduction: number;
  pf_deduction: number;
  esi_deduction: number;
  professional_tax_deduction: number;
  net_salary: number;
  days_present: number;
  days_absent: number;
  status: 'Draft' | 'Processed' | 'Paid';
  payslip_generated: boolean;
  created_at: string;
}

export interface OrgSettings {
  id: string;
  org_name: string;
  admin_key: string;
  design_fee_pct: number;
  incentive_pct: number;
  commission_pct: number;
  profit_first_profit_pct: number;
  profit_first_opex_pct: number;
  profit_first_tax_pct: number;
  profit_first_owner_pay_pct: number;
  updated_at: string;
}

export interface ApprovalRequest {
  id: string;
  user_id: string;
  type: string;
  payload: Record<string, unknown>;
  status: 'Pending' | 'Approved' | 'Rejected';
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface ProcurementCategoryRecord {
  id: string;
  value: string;
  label: string;
  is_default: boolean;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProcurementUnitRecord {
  id: string;
  value: string;
  label: string;
  short_label: string;
  is_default: boolean;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProcurementItemRecord {
  id: string;
  name: string;
  category: string;
  default_unit_label: string;
  purchase_rate_per_unit: number;
  markup_percent: number;
  selling_rate_per_unit: number;
  default_description: string;
  status: 'active' | 'inactive';
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface VendorRecord {
  id: string;
  name: string;
  category: string;
  scope_of_work: string;
  contact_person: string;
  phone: string;
  email: string;
  location: string;
  rating: number;
  status: 'active' | 'inactive' | 'blacklisted';
  availability: 'available' | 'busy' | 'on_hold';
  assigned_project_count: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export const formatINR = (amount: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
};

export const DEPARTMENTS = [
  { name: 'Marketing & Sales', code: 'MS' },
  { name: 'Designing & Execution', code: 'DE' },
  { name: 'Ops. & Quality Control', code: 'OQ' },
  { name: 'Procurement & Logistics', code: 'PL' },
  { name: 'Finance', code: 'FI' },
] as const;

export const LEAD_SOURCES = ['Instagram', 'Facebook', 'WhatsApp', 'Call', 'Website', 'Email', 'Referral', 'Other'] as const;
