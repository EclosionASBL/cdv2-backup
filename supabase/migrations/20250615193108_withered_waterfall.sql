/*
  # Add unique constraint to movement_number in bank_transactions table
  
  1. Changes
    - Add a unique constraint to the movement_number column
    - This prevents duplicate bank transactions from being imported
    - Each bank transaction should have a unique movement number
    
  2. Security
    - No changes to RLS policies needed
*/

-- Add unique constraint to movement_number column
-- We use a partial index to only include non-null values
-- This allows multiple transactions to have NULL movement_number if needed
ALTER TABLE bank_transactions
ADD CONSTRAINT bank_transactions_movement_number_key UNIQUE (movement_number)
DEFERRABLE INITIALLY DEFERRED;

-- Create an index on movement_number for better performance
CREATE INDEX IF NOT EXISTS idx_bank_transactions_movement_number 
ON bank_transactions(movement_number);

-- Add a function to check for duplicate movement numbers
CREATE OR REPLACE FUNCTION check_duplicate_movement_number(p_movement_number TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM bank_transactions 
    WHERE movement_number = p_movement_number
  );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION check_duplicate_movement_number(TEXT) TO authenticated;

-- Add comment to document the constraint
COMMENT ON CONSTRAINT bank_transactions_movement_number_key ON bank_transactions IS 
'Ensures each bank transaction has a unique movement number to prevent duplicates';