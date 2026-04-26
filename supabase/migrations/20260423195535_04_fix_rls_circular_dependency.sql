/*
  # Fix RLS Circular Dependency

  The profiles SELECT policies that check "is super_admin" by querying profiles
  create an infinite recursion. Fix by using a security definer function that
  bypasses RLS to check the user's role.
*/

-- Create a security definer function to get user role (bypasses RLS)
CREATE OR REPLACE FUNCTION get_user_role(user_id uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role FROM profiles WHERE id = user_id;
$$;

-- Drop all problematic circular policies on profiles
DROP POLICY IF EXISTS "Super admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Department heads can view department profiles" ON profiles;
DROP POLICY IF EXISTS "Super admins can update all profiles" ON profiles;
DROP POLICY IF EXISTS "Super admins can insert profiles" ON profiles;
DROP POLICY IF EXISTS "Allow profile insert for own user" ON profiles;
DROP POLICY IF EXISTS "Super admins can delete profiles" ON profiles;

-- Recreate non-circular policies using get_user_role()
CREATE POLICY "Super admins can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (get_user_role(auth.uid()) = 'super_admin');

CREATE POLICY "Department heads can view department profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    get_user_role(auth.uid()) = 'department_head'
    AND EXISTS (
      SELECT 1 FROM profiles p2
      WHERE p2.id = auth.uid()
        AND p2.department_ids && profiles.department_ids
    )
  );

CREATE POLICY "Super admins can update all profiles"
  ON profiles FOR UPDATE
  TO authenticated
  USING (get_user_role(auth.uid()) = 'super_admin')
  WITH CHECK (get_user_role(auth.uid()) = 'super_admin');

CREATE POLICY "Allow profile insert for own user or admin"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id OR get_user_role(auth.uid()) = 'super_admin');

CREATE POLICY "Super admins can delete profiles"
  ON profiles FOR DELETE
  TO authenticated
  USING (get_user_role(auth.uid()) = 'super_admin');

-- Fix other tables' policies that had the same circular issue
-- employee_code_sequences
DROP POLICY IF EXISTS "Super admins can manage sequences select" ON employee_code_sequences;
DROP POLICY IF EXISTS "Super admins can manage sequences insert" ON employee_code_sequences;
DROP POLICY IF EXISTS "Super admins can manage sequences update" ON employee_code_sequences;

CREATE POLICY "Super admins can view sequences"
  ON employee_code_sequences FOR SELECT
  TO authenticated
  USING (get_user_role(auth.uid()) = 'super_admin');

CREATE POLICY "Super admins can insert sequences"
  ON employee_code_sequences FOR INSERT
  TO authenticated
  WITH CHECK (get_user_role(auth.uid()) = 'super_admin');

CREATE POLICY "Super admins can update sequences"
  ON employee_code_sequences FOR UPDATE
  TO authenticated
  USING (get_user_role(auth.uid()) = 'super_admin')
  WITH CHECK (get_user_role(auth.uid()) = 'super_admin');

-- Fix announcements policies
DROP POLICY IF EXISTS "Super admins can insert announcements" ON announcements;
DROP POLICY IF EXISTS "Super admins can update announcements" ON announcements;
DROP POLICY IF EXISTS "Super admins can delete announcements" ON announcements;

CREATE POLICY "Super admins can insert announcements"
  ON announcements FOR INSERT
  TO authenticated
  WITH CHECK (get_user_role(auth.uid()) = 'super_admin');

CREATE POLICY "Super admins can update announcements"
  ON announcements FOR UPDATE
  TO authenticated
  USING (get_user_role(auth.uid()) = 'super_admin')
  WITH CHECK (get_user_role(auth.uid()) = 'super_admin');

CREATE POLICY "Super admins can delete announcements"
  ON announcements FOR DELETE
  TO authenticated
  USING (get_user_role(auth.uid()) = 'super_admin');

-- Fix org_settings policies
DROP POLICY IF EXISTS "Super admins can insert settings" ON org_settings;
DROP POLICY IF EXISTS "Super admins can update settings" ON org_settings;

CREATE POLICY "Super admins can insert settings"
  ON org_settings FOR INSERT
  TO authenticated
  WITH CHECK (get_user_role(auth.uid()) = 'super_admin');

CREATE POLICY "Super admins can update settings"
  ON org_settings FOR UPDATE
  TO authenticated
  USING (get_user_role(auth.uid()) = 'super_admin')
  WITH CHECK (get_user_role(auth.uid()) = 'super_admin');

-- Fix approval_requests policies
DROP POLICY IF EXISTS "Super admins can view all approval requests" ON approval_requests;
DROP POLICY IF EXISTS "Super admins can update approval requests" ON approval_requests;

CREATE POLICY "Super admins can view all approval requests"
  ON approval_requests FOR SELECT
  TO authenticated
  USING (get_user_role(auth.uid()) = 'super_admin');

CREATE POLICY "Super admins can update approval requests"
  ON approval_requests FOR UPDATE
  TO authenticated
  USING (get_user_role(auth.uid()) = 'super_admin')
  WITH CHECK (get_user_role(auth.uid()) = 'super_admin');

-- Fix tasks policies
DROP POLICY IF EXISTS "Super admins and dept heads can insert tasks" ON tasks;
DROP POLICY IF EXISTS "Assignee dept head super admin can update tasks" ON tasks;
DROP POLICY IF EXISTS "Super admins and dept heads can delete tasks" ON tasks;

CREATE POLICY "Super admins and dept heads can insert tasks"
  ON tasks FOR INSERT
  TO authenticated
  WITH CHECK (get_user_role(auth.uid()) IN ('super_admin', 'department_head'));

CREATE POLICY "Assignee dept head super admin can update tasks"
  ON tasks FOR UPDATE
  TO authenticated
  USING (
    assigned_to = auth.uid()
    OR get_user_role(auth.uid()) IN ('super_admin', 'department_head')
  )
  WITH CHECK (
    assigned_to = auth.uid()
    OR get_user_role(auth.uid()) IN ('super_admin', 'department_head')
  );

CREATE POLICY "Super admins and dept heads can delete tasks"
  ON tasks FOR DELETE
  TO authenticated
  USING (get_user_role(auth.uid()) IN ('super_admin', 'department_head'));

-- Fix subtasks policies
DROP POLICY IF EXISTS "Super admins and dept heads can insert subtasks" ON subtasks;
DROP POLICY IF EXISTS "Super admins and dept heads can delete subtasks" ON subtasks;

CREATE POLICY "Super admins and dept heads can insert subtasks"
  ON subtasks FOR INSERT
  TO authenticated
  WITH CHECK (get_user_role(auth.uid()) IN ('super_admin', 'department_head'));

CREATE POLICY "Super admins and dept heads can delete subtasks"
  ON subtasks FOR DELETE
  TO authenticated
  USING (get_user_role(auth.uid()) IN ('super_admin', 'department_head'));

-- Fix projects policies
DROP POLICY IF EXISTS "Super admins and dept heads can insert projects" ON projects;
DROP POLICY IF EXISTS "Super admins and dept heads can update projects" ON projects;
DROP POLICY IF EXISTS "Super admins can delete projects" ON projects;

CREATE POLICY "Super admins and dept heads can insert projects"
  ON projects FOR INSERT
  TO authenticated
  WITH CHECK (get_user_role(auth.uid()) IN ('super_admin', 'department_head'));

CREATE POLICY "Super admins and dept heads can update projects"
  ON projects FOR UPDATE
  TO authenticated
  USING (get_user_role(auth.uid()) IN ('super_admin', 'department_head'))
  WITH CHECK (get_user_role(auth.uid()) IN ('super_admin', 'department_head'));

CREATE POLICY "Super admins can delete projects"
  ON projects FOR DELETE
  TO authenticated
  USING (get_user_role(auth.uid()) = 'super_admin');

-- Fix attendance policies
DROP POLICY IF EXISTS "Employees and super admin can update attendance" ON attendance;

CREATE POLICY "Employees and super admin can update attendance"
  ON attendance FOR UPDATE
  TO authenticated
  USING (
    employee_id = auth.uid()
    OR get_user_role(auth.uid()) = 'super_admin'
  )
  WITH CHECK (
    employee_id = auth.uid()
    OR get_user_role(auth.uid()) = 'super_admin'
  );

-- Grant execute on the function
GRANT EXECUTE ON FUNCTION get_user_role(uuid) TO authenticated;
