/*
  # GRAVIUM OS - Leads and Projects

  Creates leads (CRM) and projects with financial tables.
*/

-- LEADS
CREATE TABLE IF NOT EXISTS leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact_email text DEFAULT '',
  contact_phone text DEFAULT '',
  lead_source text NOT NULL DEFAULT 'Other',
  lead_source_custom text DEFAULT '',
  status text NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'Qualified', 'Converted', 'Rejected', 'Ghosted')),
  assigned_to uuid REFERENCES profiles(id) ON DELETE SET NULL,
  notes text DEFAULT '',
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  converted_project_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "MS dept and super admin can view leads"
  ON leads FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN departments d ON d.id = ANY(p.department_ids)
      WHERE p.id = auth.uid() AND d.code = 'MS'
    )
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  );

CREATE POLICY "MS dept and super admin can insert leads"
  ON leads FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN departments d ON d.id = ANY(p.department_ids)
      WHERE p.id = auth.uid() AND d.code = 'MS'
    )
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  );

CREATE POLICY "MS dept and super admin can update leads"
  ON leads FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN departments d ON d.id = ANY(p.department_ids)
      WHERE p.id = auth.uid() AND d.code = 'MS'
    )
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN departments d ON d.id = ANY(p.department_ids)
      WHERE p.id = auth.uid() AND d.code = 'MS'
    )
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  );

CREATE POLICY "MS dept heads and super admin can delete leads"
  ON leads FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN departments d ON d.id = ANY(p.department_ids)
      WHERE p.id = auth.uid() AND d.code = 'MS'
        AND p.role IN ('super_admin', 'department_head')
    )
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  );

CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON leads(assigned_to);

-- PROJECTS
CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  client text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Completed', 'On Hold', 'Cancelled')),
  revenue numeric DEFAULT 0,
  estimated_cogs numeric DEFAULT 0,
  design_fee_pct numeric DEFAULT 15,
  description text DEFAULT '',
  start_date date,
  end_date date,
  created_from_lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view projects"
  ON projects FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Super admins and dept heads can insert projects"
  ON projects FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid()
        AND p.role IN ('super_admin', 'department_head')
    )
  );

CREATE POLICY "Super admins and dept heads can update projects"
  ON projects FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid()
        AND p.role IN ('super_admin', 'department_head')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid()
        AND p.role IN ('super_admin', 'department_head')
    )
  );

CREATE POLICY "Super admins can delete projects"
  ON projects FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin'
    )
  );

-- PROJECT EXPENSES
CREATE TABLE IF NOT EXISTS project_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  description text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE project_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Finance and super admin can view project expenses"
  ON project_expenses FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN departments d ON d.id = ANY(p.department_ids)
      WHERE p.id = auth.uid() AND d.code = 'FI'
    )
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  );

CREATE POLICY "Finance and super admin can insert project expenses"
  ON project_expenses FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN departments d ON d.id = ANY(p.department_ids)
      WHERE p.id = auth.uid() AND d.code = 'FI'
    )
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  );

CREATE POLICY "Finance and super admin can update project expenses"
  ON project_expenses FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN departments d ON d.id = ANY(p.department_ids)
      WHERE p.id = auth.uid() AND d.code = 'FI'
    )
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN departments d ON d.id = ANY(p.department_ids)
      WHERE p.id = auth.uid() AND d.code = 'FI'
    )
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  );

CREATE POLICY "Finance and super admin can delete project expenses"
  ON project_expenses FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN departments d ON d.id = ANY(p.department_ids)
      WHERE p.id = auth.uid() AND d.code = 'FI'
    )
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  );

-- PROJECT CASH RECEIVED
CREATE TABLE IF NOT EXISTS project_cash_received (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  description text NOT NULL DEFAULT '',
  amount numeric NOT NULL DEFAULT 0,
  received_date date NOT NULL DEFAULT CURRENT_DATE,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE project_cash_received ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Finance and super admin can view cash received"
  ON project_cash_received FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN departments d ON d.id = ANY(p.department_ids)
      WHERE p.id = auth.uid() AND d.code = 'FI'
    )
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  );

CREATE POLICY "Finance and super admin can insert cash received"
  ON project_cash_received FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN departments d ON d.id = ANY(p.department_ids)
      WHERE p.id = auth.uid() AND d.code = 'FI'
    )
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  );

CREATE POLICY "Finance and super admin can update cash received"
  ON project_cash_received FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN departments d ON d.id = ANY(p.department_ids)
      WHERE p.id = auth.uid() AND d.code = 'FI'
    )
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN departments d ON d.id = ANY(p.department_ids)
      WHERE p.id = auth.uid() AND d.code = 'FI'
    )
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  );

CREATE POLICY "Finance and super admin can delete cash received"
  ON project_cash_received FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN departments d ON d.id = ANY(p.department_ids)
      WHERE p.id = auth.uid() AND d.code = 'FI'
    )
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  );
