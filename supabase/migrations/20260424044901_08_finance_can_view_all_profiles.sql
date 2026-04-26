/*
  # Allow Finance department members to view all profiles

  1. Changes
    - Add a SELECT policy on `profiles` that allows any user belonging to the Finance department
      to view all profiles. This is needed for the Payroll module in the employee portal,
      where Finance employees need to see all employees to process payroll.

  2. Security
    - Uses the `get_user_dept_ids()` SECURITY DEFINER function to check Finance membership
    - Only grants SELECT access, no modifications
    - Finance employees still cannot modify other users' profiles
*/

CREATE POLICY "Finance department can view all profiles for payroll"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM departments
      WHERE departments.code = 'FI'
      AND departments.id = ANY(get_user_dept_ids(auth.uid()))
    )
  );
