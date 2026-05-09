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
