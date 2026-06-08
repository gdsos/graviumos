/*
  # GRAVIUM OS - Procurement Masters

  Creates Supabase-backed master data tables for:
  - procurement_categories
  - procurement_units
  - procurement_items
  - vendors

  Notes:
  - IDs are text to preserve existing localStorage IDs such as item-* and vendor-* during migration.
  - Demo/localStorage keys should be treated as one-time migration sources only after this.
  - Projects are intentionally excluded from this migration pass.
*/

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- PROCUREMENT CATEGORIES
CREATE TABLE IF NOT EXISTS procurement_categories (
  id text PRIMARY KEY DEFAULT ('category-' || gen_random_uuid()::text),
  value text NOT NULL UNIQUE,
  label text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE procurement_categories ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_procurement_categories_updated_at ON procurement_categories;
CREATE TRIGGER set_procurement_categories_updated_at
  BEFORE UPDATE ON procurement_categories
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP POLICY IF EXISTS "Authenticated users can view procurement categories" ON procurement_categories;
CREATE POLICY "Authenticated users can view procurement categories"
  ON procurement_categories FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Procurement managers can insert procurement categories" ON procurement_categories;
CREATE POLICY "Procurement managers can insert procurement categories"
  ON procurement_categories FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'super_admin'
    )
    OR EXISTS (
      SELECT 1 FROM profiles p
      JOIN departments d ON d.id = ANY(p.department_ids)
      WHERE p.id = auth.uid()
        AND p.role = 'department_head'
        AND d.code = 'PL'
    )
  );

DROP POLICY IF EXISTS "Procurement managers can update procurement categories" ON procurement_categories;
CREATE POLICY "Procurement managers can update procurement categories"
  ON procurement_categories FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'super_admin'
    )
    OR EXISTS (
      SELECT 1 FROM profiles p
      JOIN departments d ON d.id = ANY(p.department_ids)
      WHERE p.id = auth.uid()
        AND p.role = 'department_head'
        AND d.code = 'PL'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'super_admin'
    )
    OR EXISTS (
      SELECT 1 FROM profiles p
      JOIN departments d ON d.id = ANY(p.department_ids)
      WHERE p.id = auth.uid()
        AND p.role = 'department_head'
        AND d.code = 'PL'
    )
  );

DROP POLICY IF EXISTS "Procurement managers can delete procurement categories" ON procurement_categories;
CREATE POLICY "Procurement managers can delete procurement categories"
  ON procurement_categories FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'super_admin'
    )
    OR EXISTS (
      SELECT 1 FROM profiles p
      JOIN departments d ON d.id = ANY(p.department_ids)
      WHERE p.id = auth.uid()
        AND p.role = 'department_head'
        AND d.code = 'PL'
    )
  );

-- PROCUREMENT UNITS
CREATE TABLE IF NOT EXISTS procurement_units (
  id text PRIMARY KEY DEFAULT ('unit-' || gen_random_uuid()::text),
  value text NOT NULL UNIQUE,
  label text NOT NULL,
  short_label text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE procurement_units ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_procurement_units_updated_at ON procurement_units;
CREATE TRIGGER set_procurement_units_updated_at
  BEFORE UPDATE ON procurement_units
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP POLICY IF EXISTS "Authenticated users can view procurement units" ON procurement_units;
CREATE POLICY "Authenticated users can view procurement units"
  ON procurement_units FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Procurement managers can insert procurement units" ON procurement_units;
CREATE POLICY "Procurement managers can insert procurement units"
  ON procurement_units FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'super_admin'
    )
    OR EXISTS (
      SELECT 1 FROM profiles p
      JOIN departments d ON d.id = ANY(p.department_ids)
      WHERE p.id = auth.uid()
        AND p.role = 'department_head'
        AND d.code = 'PL'
    )
  );

DROP POLICY IF EXISTS "Procurement managers can update procurement units" ON procurement_units;
CREATE POLICY "Procurement managers can update procurement units"
  ON procurement_units FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'super_admin'
    )
    OR EXISTS (
      SELECT 1 FROM profiles p
      JOIN departments d ON d.id = ANY(p.department_ids)
      WHERE p.id = auth.uid()
        AND p.role = 'department_head'
        AND d.code = 'PL'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'super_admin'
    )
    OR EXISTS (
      SELECT 1 FROM profiles p
      JOIN departments d ON d.id = ANY(p.department_ids)
      WHERE p.id = auth.uid()
        AND p.role = 'department_head'
        AND d.code = 'PL'
    )
  );

DROP POLICY IF EXISTS "Procurement managers can delete procurement units" ON procurement_units;
CREATE POLICY "Procurement managers can delete procurement units"
  ON procurement_units FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'super_admin'
    )
    OR EXISTS (
      SELECT 1 FROM profiles p
      JOIN departments d ON d.id = ANY(p.department_ids)
      WHERE p.id = auth.uid()
        AND p.role = 'department_head'
        AND d.code = 'PL'
    )
  );

-- PROCUREMENT ITEMS
CREATE TABLE IF NOT EXISTS procurement_items (
  id text PRIMARY KEY DEFAULT ('item-' || gen_random_uuid()::text),
  name text NOT NULL,
  category text NOT NULL DEFAULT 'other',
  default_unit_label text NOT NULL DEFAULT 'sqft',
  purchase_rate_per_unit numeric NOT NULL DEFAULT 0,
  markup_percent numeric NOT NULL DEFAULT 0,
  selling_rate_per_unit numeric NOT NULL DEFAULT 0,
  default_description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE procurement_items ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_procurement_items_category ON procurement_items(category);
CREATE INDEX IF NOT EXISTS idx_procurement_items_status ON procurement_items(status);
CREATE INDEX IF NOT EXISTS idx_procurement_items_name_normalized ON procurement_items(LOWER(TRIM(name)));

DROP TRIGGER IF EXISTS set_procurement_items_updated_at ON procurement_items;
CREATE TRIGGER set_procurement_items_updated_at
  BEFORE UPDATE ON procurement_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP POLICY IF EXISTS "Authenticated users can view procurement items" ON procurement_items;
CREATE POLICY "Authenticated users can view procurement items"
  ON procurement_items FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Procurement managers can insert procurement items" ON procurement_items;
CREATE POLICY "Procurement managers can insert procurement items"
  ON procurement_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'super_admin'
    )
    OR EXISTS (
      SELECT 1 FROM profiles p
      JOIN departments d ON d.id = ANY(p.department_ids)
      WHERE p.id = auth.uid()
        AND p.role = 'department_head'
        AND d.code = 'PL'
    )
  );

DROP POLICY IF EXISTS "Procurement managers can update procurement items" ON procurement_items;
CREATE POLICY "Procurement managers can update procurement items"
  ON procurement_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'super_admin'
    )
    OR EXISTS (
      SELECT 1 FROM profiles p
      JOIN departments d ON d.id = ANY(p.department_ids)
      WHERE p.id = auth.uid()
        AND p.role = 'department_head'
        AND d.code = 'PL'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'super_admin'
    )
    OR EXISTS (
      SELECT 1 FROM profiles p
      JOIN departments d ON d.id = ANY(p.department_ids)
      WHERE p.id = auth.uid()
        AND p.role = 'department_head'
        AND d.code = 'PL'
    )
  );

DROP POLICY IF EXISTS "Procurement managers can delete procurement items" ON procurement_items;
CREATE POLICY "Procurement managers can delete procurement items"
  ON procurement_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'super_admin'
    )
    OR EXISTS (
      SELECT 1 FROM profiles p
      JOIN departments d ON d.id = ANY(p.department_ids)
      WHERE p.id = auth.uid()
        AND p.role = 'department_head'
        AND d.code = 'PL'
    )
  );

-- VENDORS
CREATE TABLE IF NOT EXISTS vendors (
  id text PRIMARY KEY DEFAULT ('vendor-' || gen_random_uuid()::text),
  name text NOT NULL,
  category text NOT NULL DEFAULT 'other',
  scope_of_work text NOT NULL DEFAULT '',
  contact_person text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  email text DEFAULT '',
  location text NOT NULL DEFAULT '',
  rating numeric NOT NULL DEFAULT 3,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'blacklisted')),
  availability text NOT NULL DEFAULT 'available' CHECK (availability IN ('available', 'busy', 'on_hold')),
  assigned_project_count integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_vendors_category ON vendors(category);
CREATE INDEX IF NOT EXISTS idx_vendors_status ON vendors(status);
CREATE INDEX IF NOT EXISTS idx_vendors_availability ON vendors(availability);
CREATE INDEX IF NOT EXISTS idx_vendors_name_normalized ON vendors(LOWER(TRIM(name)));

DROP TRIGGER IF EXISTS set_vendors_updated_at ON vendors;
CREATE TRIGGER set_vendors_updated_at
  BEFORE UPDATE ON vendors
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP POLICY IF EXISTS "Authenticated users can view vendors" ON vendors;
CREATE POLICY "Authenticated users can view vendors"
  ON vendors FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Procurement managers can insert vendors" ON vendors;
CREATE POLICY "Procurement managers can insert vendors"
  ON vendors FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'super_admin'
    )
    OR EXISTS (
      SELECT 1 FROM profiles p
      JOIN departments d ON d.id = ANY(p.department_ids)
      WHERE p.id = auth.uid()
        AND p.role = 'department_head'
        AND d.code = 'PL'
    )
  );

DROP POLICY IF EXISTS "Procurement managers can update vendors" ON vendors;
CREATE POLICY "Procurement managers can update vendors"
  ON vendors FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'super_admin'
    )
    OR EXISTS (
      SELECT 1 FROM profiles p
      JOIN departments d ON d.id = ANY(p.department_ids)
      WHERE p.id = auth.uid()
        AND p.role = 'department_head'
        AND d.code = 'PL'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'super_admin'
    )
    OR EXISTS (
      SELECT 1 FROM profiles p
      JOIN departments d ON d.id = ANY(p.department_ids)
      WHERE p.id = auth.uid()
        AND p.role = 'department_head'
        AND d.code = 'PL'
    )
  );

DROP POLICY IF EXISTS "Procurement managers can delete vendors" ON vendors;
CREATE POLICY "Procurement managers can delete vendors"
  ON vendors FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'super_admin'
    )
    OR EXISTS (
      SELECT 1 FROM profiles p
      JOIN departments d ON d.id = ANY(p.department_ids)
      WHERE p.id = auth.uid()
        AND p.role = 'department_head'
        AND d.code = 'PL'
    )
  );
