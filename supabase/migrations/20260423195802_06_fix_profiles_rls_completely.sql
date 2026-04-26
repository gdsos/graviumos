/*
  # Complete fix for profiles RLS - eliminate ALL self-referencing policies
  
  The "Department heads can view department profiles" policy still queries
  profiles within a profiles policy causing infinite recursion.
  Replace it with a get_user_dept_ids helper function.
*/

-- Helper: get department IDs for a user (security definer, bypasses RLS)
CREATE OR REPLACE FUNCTION get_user_dept_ids(user_id uuid)
RETURNS uuid[]
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(department_ids, '{}') FROM profiles WHERE id = user_id;
$$;

GRANT EXECUTE ON FUNCTION get_user_dept_ids(uuid) TO authenticated;

-- Drop the problematic department head policy
DROP POLICY IF EXISTS "Department heads can view department profiles" ON profiles;

-- Recreate without self-join
CREATE POLICY "Department heads can view department profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    get_user_role(auth.uid()) = 'department_head'
    AND (get_user_dept_ids(auth.uid()) && profiles.department_ids)
  );
