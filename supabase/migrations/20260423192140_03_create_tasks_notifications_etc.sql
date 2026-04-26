/*
  # GRAVIUM OS - Tasks, Notifications, Attendance, Payroll, Settings

  Creates all remaining tables for task management, notifications,
  attendance tracking, payroll, whiteboard, and settings.
*/

-- TASKS
CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text DEFAULT '',
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  assigned_to uuid REFERENCES profiles(id) ON DELETE SET NULL,
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  deadline timestamptz,
  progress int DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  status text NOT NULL DEFAULT 'Not Started' CHECK (status IN ('Not Started', 'Ongoing', 'Overdue', 'Completed')),
  completed_at timestamptz,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view tasks"
  ON tasks FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Super admins and dept heads can insert tasks"
  ON tasks FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid()
        AND p.role IN ('super_admin', 'department_head')
    )
  );

CREATE POLICY "Assignee dept head super admin can update tasks"
  ON tasks FOR UPDATE
  TO authenticated
  USING (
    assigned_to = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid()
        AND p.role IN ('super_admin', 'department_head')
    )
  )
  WITH CHECK (
    assigned_to = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid()
        AND p.role IN ('super_admin', 'department_head')
    )
  );

CREATE POLICY "Super admins and dept heads can delete tasks"
  ON tasks FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid()
        AND p.role IN ('super_admin', 'department_head')
    )
  );

CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_department_id ON tasks(department_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);

-- SUBTASKS
CREATE TABLE IF NOT EXISTS subtasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  title text NOT NULL,
  is_completed boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE subtasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view subtasks"
  ON subtasks FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Super admins and dept heads can insert subtasks"
  ON subtasks FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid()
        AND p.role IN ('super_admin', 'department_head')
    )
  );

CREATE POLICY "Authenticated users can update subtasks"
  ON subtasks FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Super admins and dept heads can delete subtasks"
  ON subtasks FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid()
        AND p.role IN ('super_admin', 'department_head')
    )
  );

-- ANNOUNCEMENTS
CREATE TABLE IF NOT EXISTS announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  target_type text NOT NULL DEFAULT 'company' CHECK (target_type IN ('company', 'department')),
  target_department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view announcements"
  ON announcements FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Super admins can insert announcements"
  ON announcements FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can update announcements"
  ON announcements FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can delete announcements"
  ON announcements FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin'
    )
  );

-- NOTIFICATIONS
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'task', 'announcement', 'approval', 'project')),
  is_read boolean DEFAULT false,
  link text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Authenticated users can insert notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own notifications"
  ON notifications FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);

-- ATTENDANCE
CREATE TABLE IF NOT EXISTS attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  check_in timestamptz,
  check_out timestamptz,
  status text NOT NULL DEFAULT 'Present' CHECK (status IN ('Present', 'Absent', 'Weekend', 'Public Holiday', 'On Approved-Leave')),
  location_stamp text DEFAULT '',
  admin_override boolean DEFAULT false,
  notes text DEFAULT '',
  UNIQUE(employee_id, date)
);

ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees can view own attendance"
  ON attendance FOR SELECT
  TO authenticated
  USING (employee_id = auth.uid());

CREATE POLICY "Finance and super admin can view all attendance"
  ON attendance FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN departments d ON d.id = ANY(p.department_ids)
      WHERE p.id = auth.uid() AND d.code = 'FI'
    )
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  );

CREATE POLICY "Employees can insert own attendance"
  ON attendance FOR INSERT
  TO authenticated
  WITH CHECK (employee_id = auth.uid());

CREATE POLICY "Employees and super admin can update attendance"
  ON attendance FOR UPDATE
  TO authenticated
  USING (
    employee_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  )
  WITH CHECK (
    employee_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  );

CREATE INDEX IF NOT EXISTS idx_attendance_employee_date ON attendance(employee_id, date);

-- PAYROLL
CREATE TABLE IF NOT EXISTS payroll (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  month int NOT NULL CHECK (month >= 1 AND month <= 12),
  year int NOT NULL,
  base_salary numeric NOT NULL DEFAULT 0,
  kpi_incentive numeric DEFAULT 0,
  tds_deduction numeric DEFAULT 0,
  pf_deduction numeric DEFAULT 0,
  esi_deduction numeric DEFAULT 0,
  professional_tax_deduction numeric DEFAULT 0,
  net_salary numeric DEFAULT 0,
  days_present int DEFAULT 0,
  days_absent int DEFAULT 0,
  status text NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Processed', 'Paid')),
  payslip_generated boolean DEFAULT false,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(employee_id, month, year)
);

ALTER TABLE payroll ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees can view own payroll"
  ON payroll FOR SELECT
  TO authenticated
  USING (employee_id = auth.uid());

CREATE POLICY "Finance and super admin can view all payroll"
  ON payroll FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN departments d ON d.id = ANY(p.department_ids)
      WHERE p.id = auth.uid() AND d.code = 'FI'
    )
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  );

CREATE POLICY "Finance and super admin can insert payroll"
  ON payroll FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN departments d ON d.id = ANY(p.department_ids)
      WHERE p.id = auth.uid() AND d.code = 'FI'
    )
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  );

CREATE POLICY "Finance and super admin can update payroll"
  ON payroll FOR UPDATE
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

CREATE INDEX IF NOT EXISTS idx_payroll_employee_month_year ON payroll(employee_id, month, year);

-- WHITEBOARD NOTES
CREATE TABLE IF NOT EXISTS whiteboard_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL DEFAULT '',
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE whiteboard_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own whiteboard"
  ON whiteboard_notes FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own whiteboard"
  ON whiteboard_notes FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own whiteboard"
  ON whiteboard_notes FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own whiteboard"
  ON whiteboard_notes FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ORG SETTINGS
CREATE TABLE IF NOT EXISTS org_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_name text DEFAULT 'GRAVIUM',
  design_fee_pct numeric DEFAULT 15,
  incentive_pct numeric DEFAULT 20,
  commission_pct numeric DEFAULT 1.5,
  profit_first_profit_pct numeric DEFAULT 20,
  profit_first_opex_pct numeric DEFAULT 30,
  profit_first_tax_pct numeric DEFAULT 15,
  profit_first_owner_pay_pct numeric DEFAULT 35,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE org_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view settings"
  ON org_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Super admins can insert settings"
  ON org_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can update settings"
  ON org_settings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin'
    )
  );

INSERT INTO org_settings (org_name) VALUES ('GRAVIUM') ON CONFLICT DO NOTHING;

-- APPROVAL REQUESTS
CREATE TABLE IF NOT EXISTS approval_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'name_change',
  payload jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected')),
  reviewed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE approval_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own approval requests"
  ON approval_requests FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Super admins can view all approval requests"
  ON approval_requests FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin'
    )
  );

CREATE POLICY "Users can insert own approval requests"
  ON approval_requests FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Super admins can update approval requests"
  ON approval_requests FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin'
    )
  );
