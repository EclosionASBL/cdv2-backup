/*
  # Update bank transactions for CSV import

  1. Schema Changes
    - Rename `raw_coda_file_path` to `raw_file_path` for more generic file handling
    - Add `movement_number` column to store transaction reference numbers
    - Add `counterparty_address` column to store counterparty details
  
  2. Function Updates
    - Rename `check_coda_file_import` to `check_file_import`
    - Rename `has_coda_file_been_processed` to `has_file_been_processed`
    - Rename `register_coda_file_import` to `register_file_import`
    - Rename `register_failed_coda_import` to `register_failed_file_import`
    - Update all functions to use the new column names
*/

-- 1. Update bank_transactions table
ALTER TABLE public.bank_transactions 
  ADD COLUMN IF NOT EXISTS movement_number text,
  ADD COLUMN IF NOT EXISTS counterparty_address text;

-- Rename raw_coda_file_path to raw_file_path
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bank_transactions' 
    AND column_name = 'raw_coda_file_path'
  ) THEN
    ALTER TABLE public.bank_transactions 
      RENAME COLUMN raw_coda_file_path TO raw_file_path;
  END IF;
END $$;

-- 2. Update coda_file_imports table to file_imports
-- We'll keep the table name for backward compatibility but update the functions

-- 3. Update functions
-- Replace check_coda_file_import with check_file_import
CREATE OR REPLACE FUNCTION public.check_file_import(file_path text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM coda_file_imports 
    WHERE file_path = check_file_import.file_path
  );
END;
$$;

-- Replace has_coda_file_been_processed with has_file_been_processed
CREATE OR REPLACE FUNCTION public.has_file_been_processed(file_path text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM bank_transactions 
    WHERE raw_file_path = file_path
    LIMIT 1
  );
END;
$$;

-- Replace register_coda_file_import with register_file_import
CREATE OR REPLACE FUNCTION public.register_file_import(
  file_path text,
  batch_id text,
  transaction_count integer,
  user_id uuid
)
RETURNS uuid
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

-- Replace register_failed_coda_import with register_failed_file_import
CREATE OR REPLACE FUNCTION public.register_failed_file_import(
  file_path text,
  user_id uuid,
  error_message text
)
RETURNS uuid
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

-- Create index on raw_file_path
CREATE INDEX IF NOT EXISTS idx_bank_transactions_raw_file_path 
ON public.bank_transactions(raw_file_path);

-- Create index on movement_number
CREATE INDEX IF NOT EXISTS idx_bank_transactions_movement_number 
ON public.bank_transactions(movement_number);