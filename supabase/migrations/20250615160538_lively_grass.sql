/*
  # Drop unique index on bank_transactions.raw_file_path

  This migration removes the unique constraint on the raw_file_path column in the bank_transactions table.
  The constraint was preventing multiple transactions from being imported from the same CSV file.

  1. Changes
    - Drop the unique index idx_bank_transactions_coda_file_path
    - Ensure a regular non-unique index exists for performance
*/

-- Drop the unique index if it exists
DROP INDEX IF EXISTS public.idx_bank_transactions_coda_file_path;

-- Make sure we have a regular (non-unique) index for performance
CREATE INDEX IF NOT EXISTS idx_bank_transactions_raw_file_path 
ON public.bank_transactions(raw_file_path);