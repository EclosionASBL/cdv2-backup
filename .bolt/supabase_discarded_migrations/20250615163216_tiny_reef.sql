/*
  # Rename coda_file_imports table to csv_file_imports
  
  1. Changes
    - Create a new csv_file_imports table with the same structure as coda_file_imports
    - Copy all data from coda_file_imports to csv_file_imports
    - Update functions to use the new table name
    - Drop the old table
    
  2. Security
    - Maintain existing RLS policies
*/

-- Create the new table
CREATE TABLE IF NOT EXISTS csv_file_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_path TEXT NOT NULL UNIQUE,
  imported_at TIMESTAMPTZ DEFAULT now(),
  imported_by UUID REFERENCES auth.users(id),
  batch_id TEXT,
  transaction_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'success',
  error_message TEXT
);

-- Copy data from the old table to the new one
INSERT INTO csv_file_imports (
  id, file_path, imported_at, imported_by, batch_id, transaction_count, status, error_message
)
SELECT 
  id, file_path, imported_at, imported_by, batch_id, transaction_count, status, error_message
FROM coda_file_imports
ON CONFLICT (file_path) DO NOTHING;

-- Enable RLS on the new table
ALTER TABLE csv_file_imports ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for admins
CREATE POLICY "Admins can manage csv_file_imports"
  ON csv_file_imports
  FOR ALL
  TO authenticated
  USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin')
  WITH CHECK ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

-- Update the register_file_import function to use the new table
CREATE OR REPLACE FUNCTION public.register_file_import(
  file_path TEXT,
  batch_id TEXT,
  transaction_count INTEGER,
  user_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  import_id UUID;
BEGIN
  INSERT INTO csv_file_imports (
    file_path,
    batch_id,
    transaction_count,
    imported_by,
    status
  ) VALUES (
    file_path,
    batch_id,
    transaction_count,
    user_id,
    'success'
  )
  RETURNING id INTO import_id;
  
  RETURN import_id;
END;
$$;

-- Update the check_file_import function to use the new table
CREATE OR REPLACE FUNCTION public.check_file_import(file_path TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM csv_file_imports 
    WHERE file_path = check_file_import.file_path
  );
END;
$$;

-- Update the register_failed_file_import function to use the new table
CREATE OR REPLACE FUNCTION public.register_failed_file_import(
  file_path TEXT,
  error_message TEXT,
  user_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  import_id UUID;
BEGIN
  INSERT INTO csv_file_imports (
    file_path,
    imported_by,
    status,
    error_message
  ) VALUES (
    file_path,
    user_id,
    'error',
    error_message
  )
  RETURNING id INTO import_id;
  
  RETURN import_id;
END;
$$;

-- Drop the old table if it exists
DROP TABLE IF EXISTS coda_file_imports;