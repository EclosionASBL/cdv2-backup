/*
  # Add raw transaction data fields

  1. New Columns
    - Add `raw_libelles` and `raw_details_mouvement` columns to the `bank_transactions` table
    
  2. Purpose
    - Store the raw data from CSV imports to provide more context for transactions
    - Help with debugging and manual review of transaction data
*/

-- Add raw transaction data columns to bank_transactions table
ALTER TABLE IF EXISTS public.bank_transactions 
ADD COLUMN IF NOT EXISTS raw_libelles text,
ADD COLUMN IF NOT EXISTS raw_details_mouvement text;

-- Add comment to explain the purpose of these columns
COMMENT ON COLUMN public.bank_transactions.raw_libelles IS 'Raw "Libellés" field from the CSV import';
COMMENT ON COLUMN public.bank_transactions.raw_details_mouvement IS 'Raw "Détails du mouvement" field from the CSV import';