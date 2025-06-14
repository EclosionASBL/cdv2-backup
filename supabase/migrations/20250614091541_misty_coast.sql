/*
  # Improve payment verification system
  
  1. Changes
    - Update match_transaction_to_invoice function to automatically mark invoices as paid
    - Add extracted_invoice_number field to improve matching accuracy
    - Ensure proper status updates for both invoices and registrations
    
  2. Security
    - Maintain existing RLS policies
*/

-- Update the match_transaction_to_invoice function to automatically mark invoices as paid
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
  
  -- Update the transaction with the invoice link
  UPDATE bank_transactions
  SET 
    status = v_match_status,
    invoice_id = v_invoice_id
  WHERE id = transaction_id;
  
  -- If fully matched or overpaid, mark the invoice as paid
  IF v_match_status IN ('matched', 'overpaid') THEN
    UPDATE invoices
    SET 
      status = 'paid',
      paid_at = NOW()
    WHERE id = v_invoice_id;
    
    -- Also update the associated registrations
    UPDATE registrations
    SET payment_status = 'paid'
    WHERE invoice_id = (SELECT invoice_number FROM invoices WHERE id = v_invoice_id);
  END IF;
  
  RETURN TRUE;
END;
$$;