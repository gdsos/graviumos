/*
  # GRAVIUM OS - Departments and Profiles

  Creates the core departments and profiles tables.

  ## New Tables
  - departments: 5 fixed departments with codes
  - profiles: Extended user data linked to auth.users
  - employee_code_sequences: Track auto-increment codes per dept/year
*/

CREATE TABLE IF NOT EXISTS departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  code text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE departments ENABLE ROW LEVEL SECURITY;

INSERT INTO departments (name, code) VALUES
  ('Marketing & Sales', 'MS'),
  ('Designing & Execution', 'DE'),
  ('Ops. & Quality Control', 'OQ'),
  ('Procurement & Logistics', 'PL'),
  ('Finance', 'FI')
ON CONFLICT (code) DO NOTHING;

CREATE POLICY "Authenticated users can view departments"
  ON departments FOR SELECT
  TO authenticated
  USING (true);

-- PROFILES
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'employee' CHECK (role IN ('super_admin', 'department_head', 'employee')),
  department_ids uuid[] DEFAULT '{}',
  employee_code text UNIQUE,
  phone text DEFAULT '',
  address text DEFAULT '',
  profile_picture_url text DEFAULT '',
  social_links jsonb DEFAULT '{}',
  base_salary numeric DEFAULT 0,
  tds_enabled boolean DEFAULT false,
  pf_enabled boolean DEFAULT false,
  esi_enabled boolean DEFAULT false,
  professional_tax_enabled boolean DEFAULT false,
  kpi_score numeric DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Super admins can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p2
      WHERE p2.id = auth.uid() AND p2.role = 'super_admin'
    )
  );

CREATE POLICY "Department heads can view department profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p2
      WHERE p2.id = auth.uid()
        AND p2.role = 'department_head'
        AND p2.department_ids && profiles.department_ids
    )
  );

CREATE POLICY "Users can update own non-sensitive profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Super admins can update all profiles"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p2
      WHERE p2.id = auth.uid() AND p2.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p2
      WHERE p2.id = auth.uid() AND p2.role = 'super_admin'
    )
  );

CREATE POLICY "Allow profile insert for own user"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Super admins can delete profiles"
  ON profiles FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p2
      WHERE p2.id = auth.uid() AND p2.role = 'super_admin'
    )
  );

-- EMPLOYEE CODE SEQUENCES
CREATE TABLE IF NOT EXISTS employee_code_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dept_code text NOT NULL,
  year int NOT NULL,
  last_number int NOT NULL DEFAULT 0,
  UNIQUE(dept_code, year)
);

ALTER TABLE employee_code_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage sequences select"
  ON employee_code_sequences FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p2
      WHERE p2.id = auth.uid() AND p2.role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can manage sequences insert"
  ON employee_code_sequences FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p2
      WHERE p2.id = auth.uid() AND p2.role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can manage sequences update"
  ON employee_code_sequences FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p2
      WHERE p2.id = auth.uid() AND p2.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p2
      WHERE p2.id = auth.uid() AND p2.role = 'super_admin'
    )
  );

-- Auto-create profile trigger
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'employee')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
