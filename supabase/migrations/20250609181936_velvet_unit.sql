/*
  # Fix match_transaction_to_invoice function
  
  1. Changes
    - Update the function to require manual confirmation before marking invoices as paid
    - Fix amount parsing issues in the process-coda-file function
    
  2. Security
    - Maintain existing RLS policies
*/

-- Drop and recreate the match_transaction_to_invoice function
CREATE OR REPLACE FUNCTION match_transaction_to_invoice(transaction_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_transaction RECORD;
  v_invoice_id UUID;
  v_invoice_amount NUMERIC;
  v_match_status TEXT;
  v_extracted_invoice_number TEXT;
BEGIN
  -- Get the transaction
  SELECT 
    id, 
    communication, 
    amount, 
    extracted_invoice_number
  INTO v_transaction
  FROM bank_transactions
  WHERE id = transaction_id;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- First try to match using extracted_invoice_number if available
  IF v_transaction.extracted_invoice_number IS NOT NULL THEN
    SELECT id, amount INTO v_invoice_id, v_invoice_amount
    FROM invoices
    WHERE 
      invoice_number = v_transaction.extracted_invoice_number
      AND status = 'pending';
  END IF;
  
  -- If no match found with extracted_invoice_number, try with communication
  IF v_invoice_id IS NULL THEN
    SELECT id, amount INTO v_invoice_id, v_invoice_amount
    FROM invoices
    WHERE 
      (communication = v_transaction.communication OR invoice_number = v_transaction.communication)
      AND status = 'pending';
  END IF;
  
  -- If still no match found, return false
  IF v_invoice_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Determine match status based on amount comparison
  IF v_transaction.amount = v_invoice_amount THEN
    v_match_status := 'matched';
  ELSIF v_transaction.amount > v_invoice_amount THEN
    v_match_status := 'overpaid';
  ELSE
    v_match_status := 'partially_matched';
  END IF;
  
  -- Update the transaction with the invoice link, but don't mark the invoice as paid yet
  UPDATE bank_transactions
  SET 
    status = v_match_status,
    invoice_id = v_invoice_id
  WHERE id = transaction_id;
  
  -- We no longer automatically mark invoices as paid
  -- This will now be done through the UI with manual confirmation
  
  RETURN TRUE;
END;
$$;