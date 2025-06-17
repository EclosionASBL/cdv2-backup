/*
  # Add counterparty name column to bank_transactions table
  
  1. Changes
    - Add counterparty_name column to bank_transactions table
    - This allows storing the extracted name of the counterparty from the transaction details
    
  2. Security
    - No changes to RLS policies needed
*/

-- Add counterparty_name column to bank_transactions table
ALTER TABLE bank_transactions
ADD COLUMN IF NOT EXISTS counterparty_name text;