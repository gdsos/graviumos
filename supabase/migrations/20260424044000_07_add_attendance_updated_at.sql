/*
  # Add updated_at column to attendance table

  1. Changes
    - Add `updated_at` column (timestamptz, nullable) to the `attendance` table
    - This column is referenced in the frontend checkout code but was missing from the schema

  2. Security
    - No RLS changes needed
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'attendance' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE attendance ADD COLUMN updated_at timestamptz;
  END IF;
END $$;
