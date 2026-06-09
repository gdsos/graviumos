/*
  # Project Finance Accounts Foundation

  Finance becomes the source of truth for:
  - Project revenue from approved Cost Estimate data
  - Estimated COGS from estimate/item margin data
  - Payment gate collections and receipt allocations
  - Vendor / In-House COGS ledgers
  - Vendor payable, advance, paid, outstanding balances

  Legacy tables are intentionally preserved:
  - projects.revenue
  - projects.estimated_cogs
  - projects.design_fee_pct
  - project_expenses
  - project_cash_received
*/

CREATE OR REPLACE FUNCTION public.is_finance_or_super_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'super_admin'
    )
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      JOIN public.departments d ON d.id = ANY(p.department_ids)
      WHERE p.id = auth.uid()
        AND d.code = 'FI'
    );
$$;

CREATE OR REPLACE FUNCTION public.set_project_finance_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- PROJECT FINANCE ACCOUNTS
CREATE TABLE IF NOT EXISTS public.project_finance_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  source_estimate_id text REFERENCES public.cost_estimates(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'closed', 'archived')),

  revenue_amount numeric NOT NULL DEFAULT 0,
  estimated_cogs_amount numeric NOT NULL DEFAULT 0,
  estimated_margin_amount numeric NOT NULL DEFAULT 0,
  service_charge_amount numeric NOT NULL DEFAULT 0,
  misc_charge_amount numeric NOT NULL DEFAULT 0,
  gst_amount numeric NOT NULL DEFAULT 0,

  source_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_synced_at timestamptz,

  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE(project_id)
);

ALTER TABLE public.project_finance_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Finance and super admin can manage project finance accounts"
  ON public.project_finance_accounts
  FOR ALL
  TO authenticated
  USING (public.is_finance_or_super_admin())
  WITH CHECK (public.is_finance_or_super_admin());

CREATE INDEX IF NOT EXISTS idx_project_finance_accounts_project_id
  ON public.project_finance_accounts(project_id);

CREATE INDEX IF NOT EXISTS idx_project_finance_accounts_source_estimate_id
  ON public.project_finance_accounts(source_estimate_id);

DROP TRIGGER IF EXISTS trg_project_finance_accounts_updated_at ON public.project_finance_accounts;
CREATE TRIGGER trg_project_finance_accounts_updated_at
  BEFORE UPDATE ON public.project_finance_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_project_finance_updated_at();

-- FINANCE PAYMENT GATES
CREATE TABLE IF NOT EXISTS public.project_finance_payment_gates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finance_account_id uuid NOT NULL REFERENCES public.project_finance_accounts(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  timeline_id uuid REFERENCES public.project_timelines(id) ON DELETE SET NULL,

  timeline_gate_id text,
  gate_order integer NOT NULL DEFAULT 1,
  title text NOT NULL DEFAULT '',
  trigger_label text NOT NULL DEFAULT '',

  required_amount numeric NOT NULL DEFAULT 0,
  collected_amount numeric NOT NULL DEFAULT 0,
  carry_forward_in_amount numeric NOT NULL DEFAULT 0,
  carry_forward_out_amount numeric NOT NULL DEFAULT 0,
  outstanding_amount numeric NOT NULL DEFAULT 0,

  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'paid', 'overpaid', 'cancelled')),
  marked_paid_at timestamptz,
  marked_paid_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,

  source_gate_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE(finance_account_id, gate_order)
);

ALTER TABLE public.project_finance_payment_gates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Finance and super admin can manage finance payment gates"
  ON public.project_finance_payment_gates
  FOR ALL
  TO authenticated
  USING (public.is_finance_or_super_admin())
  WITH CHECK (public.is_finance_or_super_admin());

CREATE INDEX IF NOT EXISTS idx_project_finance_payment_gates_account_id
  ON public.project_finance_payment_gates(finance_account_id);

CREATE INDEX IF NOT EXISTS idx_project_finance_payment_gates_project_id
  ON public.project_finance_payment_gates(project_id);

CREATE INDEX IF NOT EXISTS idx_project_finance_payment_gates_timeline_id
  ON public.project_finance_payment_gates(timeline_id);

DROP TRIGGER IF EXISTS trg_project_finance_payment_gates_updated_at ON public.project_finance_payment_gates;
CREATE TRIGGER trg_project_finance_payment_gates_updated_at
  BEFORE UPDATE ON public.project_finance_payment_gates
  FOR EACH ROW
  EXECUTE FUNCTION public.set_project_finance_updated_at();

-- CASH RECEIPTS
CREATE TABLE IF NOT EXISTS public.project_cash_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finance_account_id uuid NOT NULL REFERENCES public.project_finance_accounts(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,

  receipt_date date NOT NULL DEFAULT CURRENT_DATE,
  received_from text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  amount numeric NOT NULL DEFAULT 0,
  gst_treatment text NOT NULL DEFAULT 'GST' CHECK (gst_treatment IN ('GST', 'NO_GST')),
  payment_mode text NOT NULL DEFAULT '',
  reference_number text NOT NULL DEFAULT '',

  unallocated_amount numeric NOT NULL DEFAULT 0,
  overpayment_amount numeric NOT NULL DEFAULT 0,
  carry_forward_confirmed boolean NOT NULL DEFAULT false,
  carry_forward_notes text NOT NULL DEFAULT '',

  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.project_cash_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Finance and super admin can manage project cash receipts"
  ON public.project_cash_receipts
  FOR ALL
  TO authenticated
  USING (public.is_finance_or_super_admin())
  WITH CHECK (public.is_finance_or_super_admin());

CREATE INDEX IF NOT EXISTS idx_project_cash_receipts_account_id
  ON public.project_cash_receipts(finance_account_id);

CREATE INDEX IF NOT EXISTS idx_project_cash_receipts_project_id
  ON public.project_cash_receipts(project_id);

CREATE INDEX IF NOT EXISTS idx_project_cash_receipts_receipt_date
  ON public.project_cash_receipts(receipt_date);

DROP TRIGGER IF EXISTS trg_project_cash_receipts_updated_at ON public.project_cash_receipts;
CREATE TRIGGER trg_project_cash_receipts_updated_at
  BEFORE UPDATE ON public.project_cash_receipts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_project_finance_updated_at();

-- CASH RECEIPT ALLOCATIONS
CREATE TABLE IF NOT EXISTS public.project_cash_receipt_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id uuid NOT NULL REFERENCES public.project_cash_receipts(id) ON DELETE CASCADE,
  finance_account_id uuid NOT NULL REFERENCES public.project_finance_accounts(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,

  payment_gate_id uuid REFERENCES public.project_finance_payment_gates(id) ON DELETE SET NULL,
  source_payment_gate_id uuid REFERENCES public.project_finance_payment_gates(id) ON DELETE SET NULL,
  allocation_type text NOT NULL DEFAULT 'gate' CHECK (allocation_type IN ('gate', 'carry_forward', 'adjustment')),

  allocated_amount numeric NOT NULL DEFAULT 0,
  allocation_order integer NOT NULL DEFAULT 1,
  notes text NOT NULL DEFAULT '',

  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.project_cash_receipt_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Finance and super admin can manage cash receipt allocations"
  ON public.project_cash_receipt_allocations
  FOR ALL
  TO authenticated
  USING (public.is_finance_or_super_admin())
  WITH CHECK (public.is_finance_or_super_admin());

CREATE INDEX IF NOT EXISTS idx_project_cash_receipt_allocations_receipt_id
  ON public.project_cash_receipt_allocations(receipt_id);

CREATE INDEX IF NOT EXISTS idx_project_cash_receipt_allocations_gate_id
  ON public.project_cash_receipt_allocations(payment_gate_id);

CREATE INDEX IF NOT EXISTS idx_project_cash_receipt_allocations_account_id
  ON public.project_cash_receipt_allocations(finance_account_id);

-- PROJECT VENDOR ACCOUNTS
CREATE TABLE IF NOT EXISTS public.project_vendor_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finance_account_id uuid NOT NULL REFERENCES public.project_finance_accounts(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,

  account_key text NOT NULL,
  account_type text NOT NULL DEFAULT 'in_house' CHECK (account_type IN ('in_house', 'vendor')),
  vendor_id text REFERENCES public.vendors(id) ON DELETE SET NULL,
  vendor_name text NOT NULL DEFAULT 'In-House',

  payable_amount numeric NOT NULL DEFAULT 0,
  advance_paid_amount numeric NOT NULL DEFAULT 0,
  total_paid_amount numeric NOT NULL DEFAULT 0,
  outstanding_amount numeric NOT NULL DEFAULT 0,

  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'settled', 'on_hold', 'closed')),
  notes text NOT NULL DEFAULT '',

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE(finance_account_id, account_key)
);

ALTER TABLE public.project_vendor_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Finance and super admin can manage project vendor accounts"
  ON public.project_vendor_accounts
  FOR ALL
  TO authenticated
  USING (public.is_finance_or_super_admin())
  WITH CHECK (public.is_finance_or_super_admin());

CREATE INDEX IF NOT EXISTS idx_project_vendor_accounts_account_id
  ON public.project_vendor_accounts(finance_account_id);

CREATE INDEX IF NOT EXISTS idx_project_vendor_accounts_project_id
  ON public.project_vendor_accounts(project_id);

CREATE INDEX IF NOT EXISTS idx_project_vendor_accounts_vendor_id
  ON public.project_vendor_accounts(vendor_id);

DROP TRIGGER IF EXISTS trg_project_vendor_accounts_updated_at ON public.project_vendor_accounts;
CREATE TRIGGER trg_project_vendor_accounts_updated_at
  BEFORE UPDATE ON public.project_vendor_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_project_finance_updated_at();

-- PROJECT COGS ENTRIES
CREATE TABLE IF NOT EXISTS public.project_cogs_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finance_account_id uuid NOT NULL REFERENCES public.project_finance_accounts(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  vendor_account_id uuid REFERENCES public.project_vendor_accounts(id) ON DELETE SET NULL,

  source_type text NOT NULL DEFAULT 'in_house' CHECK (source_type IN ('in_house', 'vendor')),
  vendor_id text REFERENCES public.vendors(id) ON DELETE SET NULL,
  vendor_name text NOT NULL DEFAULT 'In-House',

  category text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  estimated_amount numeric NOT NULL DEFAULT 0,
  payable_amount numeric NOT NULL DEFAULT 0,
  paid_amount numeric NOT NULL DEFAULT 0,
  outstanding_amount numeric NOT NULL DEFAULT 0,

  payment_status text NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'partial', 'paid', 'overpaid', 'cancelled')),
  entry_date date NOT NULL DEFAULT CURRENT_DATE,

  source_estimate_line_id text,
  source_work_package_id text,
  source_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  remarks text NOT NULL DEFAULT '',

  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.project_cogs_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Finance and super admin can manage project COGS entries"
  ON public.project_cogs_entries
  FOR ALL
  TO authenticated
  USING (public.is_finance_or_super_admin())
  WITH CHECK (public.is_finance_or_super_admin());

CREATE INDEX IF NOT EXISTS idx_project_cogs_entries_account_id
  ON public.project_cogs_entries(finance_account_id);

CREATE INDEX IF NOT EXISTS idx_project_cogs_entries_project_id
  ON public.project_cogs_entries(project_id);

CREATE INDEX IF NOT EXISTS idx_project_cogs_entries_vendor_account_id
  ON public.project_cogs_entries(vendor_account_id);

CREATE INDEX IF NOT EXISTS idx_project_cogs_entries_vendor_id
  ON public.project_cogs_entries(vendor_id);

DROP TRIGGER IF EXISTS trg_project_cogs_entries_updated_at ON public.project_cogs_entries;
CREATE TRIGGER trg_project_cogs_entries_updated_at
  BEFORE UPDATE ON public.project_cogs_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.set_project_finance_updated_at();

-- VENDOR PAYMENTS
CREATE TABLE IF NOT EXISTS public.project_vendor_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_account_id uuid NOT NULL REFERENCES public.project_vendor_accounts(id) ON DELETE CASCADE,
  finance_account_id uuid NOT NULL REFERENCES public.project_finance_accounts(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  vendor_id text REFERENCES public.vendors(id) ON DELETE SET NULL,
  cogs_entry_id uuid REFERENCES public.project_cogs_entries(id) ON DELETE SET NULL,

  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric NOT NULL DEFAULT 0,
  payment_type text NOT NULL DEFAULT 'bill_payment' CHECK (payment_type IN ('advance', 'bill_payment', 'adjustment', 'refund')),
  payment_mode text NOT NULL DEFAULT '',
  reference_number text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',

  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.project_vendor_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Finance and super admin can manage project vendor payments"
  ON public.project_vendor_payments
  FOR ALL
  TO authenticated
  USING (public.is_finance_or_super_admin())
  WITH CHECK (public.is_finance_or_super_admin());

CREATE INDEX IF NOT EXISTS idx_project_vendor_payments_vendor_account_id
  ON public.project_vendor_payments(vendor_account_id);

CREATE INDEX IF NOT EXISTS idx_project_vendor_payments_account_id
  ON public.project_vendor_payments(finance_account_id);

CREATE INDEX IF NOT EXISTS idx_project_vendor_payments_project_id
  ON public.project_vendor_payments(project_id);

CREATE INDEX IF NOT EXISTS idx_project_vendor_payments_vendor_id
  ON public.project_vendor_payments(vendor_id);

DROP TRIGGER IF EXISTS trg_project_vendor_payments_updated_at ON public.project_vendor_payments;
CREATE TRIGGER trg_project_vendor_payments_updated_at
  BEFORE UPDATE ON public.project_vendor_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_project_finance_updated_at();
