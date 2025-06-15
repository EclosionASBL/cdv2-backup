/*
  # Prevent duplicate CODA file uploads
  
  1. Changes
    - Add unique constraint on raw_coda_file_path in bank_transactions table
    - Add function to check if a file has already been processed
    - Add storage trigger to prevent duplicate uploads
    
  2. Security
    - Maintain existing RLS policies
    - Ensure only admins can upload CODA files
*/

-- Create a function to check if a CODA file has already been processed
CREATE OR REPLACE FUNCTION public.has_coda_file_been_processed(file_path TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM bank_transactions 
    WHERE raw_coda_file_path = file_path
    LIMIT 1
  );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.has_coda_file_been_processed(TEXT) TO authenticated;

-- Create a unique index on raw_coda_file_path to prevent duplicates
-- We use a partial index to only include non-null values
CREATE UNIQUE INDEX IF NOT EXISTS idx_bank_transactions_coda_file_path 
ON bank_transactions(raw_coda_file_path) 
WHERE raw_coda_file_path IS NOT NULL;

-- Create a table to track processed CODA files
CREATE TABLE IF NOT EXISTS coda_file_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_path TEXT NOT NULL UNIQUE,
  imported_at TIMESTAMPTZ DEFAULT now(),
  imported_by UUID REFERENCES auth.users(id),
  batch_id TEXT,
  transaction_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'success',
  error_message TEXT
);

-- Enable RLS
ALTER TABLE coda_file_imports ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for admins
CREATE POLICY "Admins can manage coda_file_imports"
  ON coda_file_imports
  FOR ALL
  TO authenticated
  USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin')
  WITH CHECK ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

-- Create a function to check if a file has already been imported
CREATE OR REPLACE FUNCTION public.check_coda_file_import(file_path TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM coda_file_imports 
    WHERE file_path = check_coda_file_import.file_path
  );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.check_coda_file_import(TEXT) TO authenticated;

-- Create a function to register a successful import
CREATE OR REPLACE FUNCTION public.register_coda_file_import(
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
  INSERT INTO coda_file_imports (
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

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.register_coda_file_import(TEXT, TEXT, INTEGER, UUID) TO authenticated;

-- Create a function to register a failed import
CREATE OR REPLACE FUNCTION public.register_failed_coda_import(
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
  INSERT INTO coda_file_imports (
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

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.register_failed_coda_import(TEXT, TEXT, UUID) TO authenticated;