/*
  # Fix remaining RLS policies using get_user_role()

  Update leads, project_expenses, project_cash_received, attendance,
  payroll, and finance-specific policies to use get_user_role() 
  instead of self-referencing profiles table joins.
*/

-- LEADS - fix policies
DROP POLICY IF EXISTS "MS dept and super admin can view leads" ON leads;
DROP POLICY IF EXISTS "MS dept and super admin can insert leads" ON leads;
DROP POLICY IF EXISTS "MS dept and super admin can update leads" ON leads;
DROP POLICY IF EXISTS "MS dept heads and super admin can delete leads" ON leads;

CREATE POLICY "MS dept and super admin can view leads"
  ON leads FOR SELECT
  TO authenticated
  USING (
    get_user_role(auth.uid()) = 'super_admin'
    OR EXISTS (
      SELECT 1 FROM profiles p
      JOIN departments d ON d.id = ANY(p.department_ids)
      WHERE p.id = auth.uid() AND d.code = 'MS'
    )
  );

CREATE POLICY "MS dept and super admin can insert leads"
  ON leads FOR INSERT
  TO authenticated
  WITH CHECK (
    get_user_role(auth.uid()) = 'super_admin'
    OR EXISTS (
      SELECT 1 FROM profiles p
      JOIN departments d ON d.id = ANY(p.department_ids)
      WHERE p.id = auth.uid() AND d.code = 'MS'
    )
  );

CREATE POLICY "MS dept and super admin can update leads"
  ON leads FOR UPDATE
  TO authenticated
  USING (
    get_user_role(auth.uid()) = 'super_admin'
    OR EXISTS (
      SELECT 1 FROM profiles p
      JOIN departments d ON d.id = ANY(p.department_ids)
      WHERE p.id = auth.uid() AND d.code = 'MS'
    )
  )
  WITH CHECK (
    get_user_role(auth.uid()) = 'super_admin'
    OR EXISTS (
      SELECT 1 FROM profiles p
      JOIN departments d ON d.id = ANY(p.department_ids)
      WHERE p.id = auth.uid() AND d.code = 'MS'
    )
  );

CREATE POLICY "MS dept heads and super admin can delete leads"
  ON leads FOR DELETE
  TO authenticated
  USING (
    get_user_role(auth.uid()) = 'super_admin'
    OR (
      get_user_role(auth.uid()) = 'department_head'
      AND EXISTS (
        SELECT 1 FROM profiles p
        JOIN departments d ON d.id = ANY(p.department_ids)
        WHERE p.id = auth.uid() AND d.code = 'MS'
      )
    )
  );

-- PROJECT EXPENSES - fix policies
DROP POLICY IF EXISTS "Finance and super admin can view project expenses" ON project_expenses;
DROP POLICY IF EXISTS "Finance and super admin can insert project expenses" ON project_expenses;
DROP POLICY IF EXISTS "Finance and super admin can update project expenses" ON project_expenses;
DROP POLICY IF EXISTS "Finance and super admin can delete project expenses" ON project_expenses;

CREATE POLICY "Finance and super admin can view project expenses"
  ON project_expenses FOR SELECT
  TO authenticated
  USING (
    get_user_role(auth.uid()) = 'super_admin'
    OR EXISTS (
      SELECT 1 FROM profiles p
      JOIN departments d ON d.id = ANY(p.department_ids)
      WHERE p.id = auth.uid() AND d.code = 'FI'
    )
  );

CREATE POLICY "Finance and super admin can insert project expenses"
  ON project_expenses FOR INSERT
  TO authenticated
  WITH CHECK (
    get_user_role(auth.uid()) = 'super_admin'
    OR EXISTS (
      SELECT 1 FROM profiles p
      JOIN departments d ON d.id = ANY(p.department_ids)
      WHERE p.id = auth.uid() AND d.code = 'FI'
    )
  );

CREATE POLICY "Finance and super admin can update project expenses"
  ON project_expenses FOR UPDATE
  TO authenticated
  USING (
    get_user_role(auth.uid()) = 'super_admin'
    OR EXISTS (
      SELECT 1 FROM profiles p
      JOIN departments d ON d.id = ANY(p.department_ids)
      WHERE p.id = auth.uid() AND d.code = 'FI'
    )
  )
  WITH CHECK (
    get_user_role(auth.uid()) = 'super_admin'
    OR EXISTS (
      SELECT 1 FROM profiles p
      JOIN departments d ON d.id = ANY(p.department_ids)
      WHERE p.id = auth.uid() AND d.code = 'FI'
    )
  );

CREATE POLICY "Finance and super admin can delete project expenses"
  ON project_expenses FOR DELETE
  TO authenticated
  USING (
    get_user_role(auth.uid()) = 'super_admin'
    OR EXISTS (
      SELECT 1 FROM profiles p
      JOIN departments d ON d.id = ANY(p.department_ids)
      WHERE p.id = auth.uid() AND d.code = 'FI'
    )
  );

-- PROJECT CASH RECEIVED - fix policies
DROP POLICY IF EXISTS "Finance and super admin can view cash received" ON project_cash_received;
DROP POLICY IF EXISTS "Finance and super admin can insert cash received" ON project_cash_received;
DROP POLICY IF EXISTS "Finance and super admin can update cash received" ON project_cash_received;
DROP POLICY IF EXISTS "Finance and super admin can delete cash received" ON project_cash_received;

CREATE POLICY "Finance and super admin can view cash received"
  ON project_cash_received FOR SELECT
  TO authenticated
  USING (
    get_user_role(auth.uid()) = 'super_admin'
    OR EXISTS (
      SELECT 1 FROM profiles p
      JOIN departments d ON d.id = ANY(p.department_ids)
      WHERE p.id = auth.uid() AND d.code = 'FI'
    )
  );

CREATE POLICY "Finance and super admin can insert cash received"
  ON project_cash_received FOR INSERT
  TO authenticated
  WITH CHECK (
    get_user_role(auth.uid()) = 'super_admin'
    OR EXISTS (
      SELECT 1 FROM profiles p
      JOIN departments d ON d.id = ANY(p.department_ids)
      WHERE p.id = auth.uid() AND d.code = 'FI'
    )
  );

CREATE POLICY "Finance and super admin can update cash received"
  ON project_cash_received FOR UPDATE
  TO authenticated
  USING (
    get_user_role(auth.uid()) = 'super_admin'
    OR EXISTS (
      SELECT 1 FROM profiles p
      JOIN departments d ON d.id = ANY(p.department_ids)
      WHERE p.id = auth.uid() AND d.code = 'FI'
    )
  )
  WITH CHECK (
    get_user_role(auth.uid()) = 'super_admin'
    OR EXISTS (
      SELECT 1 FROM profiles p
      JOIN departments d ON d.id = ANY(p.department_ids)
      WHERE p.id = auth.uid() AND d.code = 'FI'
    )
  );

CREATE POLICY "Finance and super admin can delete cash received"
  ON project_cash_received FOR DELETE
  TO authenticated
  USING (
    get_user_role(auth.uid()) = 'super_admin'
    OR EXISTS (
      SELECT 1 FROM profiles p
      JOIN departments d ON d.id = ANY(p.department_ids)
      WHERE p.id = auth.uid() AND d.code = 'FI'
    )
  );

-- ATTENDANCE - fix finance/admin view policy
DROP POLICY IF EXISTS "Finance and super admin can view all attendance" ON attendance;

CREATE POLICY "Finance and super admin can view all attendance"
  ON attendance FOR SELECT
  TO authenticated
  USING (
    employee_id = auth.uid()
    OR get_user_role(auth.uid()) = 'super_admin'
    OR EXISTS (
      SELECT 1 FROM profiles p
      JOIN departments d ON d.id = ANY(p.department_ids)
      WHERE p.id = auth.uid() AND d.code = 'FI'
    )
  );

-- PAYROLL - fix policies
DROP POLICY IF EXISTS "Finance and super admin can view all payroll" ON payroll;
DROP POLICY IF EXISTS "Finance and super admin can insert payroll" ON payroll;
DROP POLICY IF EXISTS "Finance and super admin can update payroll" ON payroll;

CREATE POLICY "Finance and super admin can view all payroll"
  ON payroll FOR SELECT
  TO authenticated
  USING (
    employee_id = auth.uid()
    OR get_user_role(auth.uid()) = 'super_admin'
    OR EXISTS (
      SELECT 1 FROM profiles p
      JOIN departments d ON d.id = ANY(p.department_ids)
      WHERE p.id = auth.uid() AND d.code = 'FI'
    )
  );

CREATE POLICY "Finance and super admin can insert payroll"
  ON payroll FOR INSERT
  TO authenticated
  WITH CHECK (
    get_user_role(auth.uid()) = 'super_admin'
    OR EXISTS (
      SELECT 1 FROM profiles p
      JOIN departments d ON d.id = ANY(p.department_ids)
      WHERE p.id = auth.uid() AND d.code = 'FI'
    )
  );

CREATE POLICY "Finance and super admin can update payroll"
  ON payroll FOR UPDATE
  TO authenticated
  USING (
    get_user_role(auth.uid()) = 'super_admin'
    OR EXISTS (
      SELECT 1 FROM profiles p
      JOIN departments d ON d.id = ANY(p.department_ids)
      WHERE p.id = auth.uid() AND d.code = 'FI'
    )
  )
  WITH CHECK (
    get_user_role(auth.uid()) = 'super_admin'
    OR EXISTS (
      SELECT 1 FROM profiles p
      JOIN departments d ON d.id = ANY(p.department_ids)
      WHERE p.id = auth.uid() AND d.code = 'FI'
    )
  );
