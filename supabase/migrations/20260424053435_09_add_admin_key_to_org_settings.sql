/*
  # Add Admin Key to Org Settings

  1. Modified Tables
    - `org_settings`
      - `admin_key` (text, default 'gravium2024') — key required to create new admin accounts

  2. Security
    - No RLS changes needed (org_settings already has restrictive policies)
    - The admin_key is stored in org_settings which is only accessible to authenticated users with appropriate RLS policies

  3. Important Notes
    - Default key is set to 'gravium2024' for existing installations
    - Super admin can change the key from Settings page
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'org_settings' AND column_name = 'admin_key'
  ) THEN
    ALTER TABLE org_settings ADD COLUMN admin_key text NOT NULL DEFAULT 'gravium2024';
  END IF;
END $$;
