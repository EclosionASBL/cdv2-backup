/*
  # Create bank transactions table for CODA file imports
  
  1. New Tables
    - `bank_transactions` - Store bank transaction data from CODA files
      - Tracks payment details from bank statements
      - Links to invoices for reconciliation
      - Includes status tracking for matching process
      
  2. Security
    - Enable RLS
    - Add policies for admin access
*/

-- Create bank_transactions table
CREATE TABLE IF NOT EXISTS bank_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  transaction_date DATE NOT NULL,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  communication TEXT,
  account_number TEXT,
  account_name TEXT,
  bank_reference TEXT,
  status TEXT NOT NULL DEFAULT 'unmatched',
  invoice_id UUID REFERENCES invoices(id),
  raw_coda_file_path TEXT,
  import_batch_id TEXT,
  notes TEXT,
  
  -- Validate status values
  CONSTRAINT valid_status CHECK (status IN ('unmatched', 'matched', 'partially_matched', 'overpaid', 'ignored'))
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS bank_transactions_date_idx ON bank_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS bank_transactions_status_idx ON bank_transactions(status);
CREATE INDEX IF NOT EXISTS bank_transactions_invoice_idx ON bank_transactions(invoice_id);
CREATE INDEX IF NOT EXISTS bank_transactions_communication_idx ON bank_transactions(communication);
CREATE INDEX IF NOT EXISTS bank_transactions_import_batch_idx ON bank_transactions(import_batch_id);

-- Enable RLS
ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for admins
CREATE POLICY "Admins can manage bank transactions"
  ON bank_transactions
  FOR ALL
  TO authenticated
  USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin')
  WITH CHECK ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

-- Create function to match transactions with invoices
CREATE OR REPLACE FUNCTION match_transaction_to_invoice(transaction_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_transaction bank_transactions;
  v_invoice_id UUID;
  v_invoice_amount NUMERIC;
  v_match_status TEXT;
BEGIN
  -- Get the transaction
  SELECT * INTO v_transaction
  FROM bank_transactions
  WHERE id = transaction_id;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Try to find a matching invoice by communication
  SELECT id, amount INTO v_invoice_id, v_invoice_amount
  FROM invoices
  WHERE 
    (communication = v_transaction.communication OR invoice_number = v_transaction.communication)
    AND status = 'pending';
  
  -- If no match found, return false
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
  
  -- Update the transaction
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
    WHERE invoice_id = v_invoice_id::text;
  END IF;
  
  RETURN TRUE;
END;
$$;

-- Grant execute permission to authenticated users (admins)
GRANT EXECUTE ON FUNCTION match_transaction_to_invoice(UUID) TO authenticated;

-- Create function to match all unmatched transactions
CREATE OR REPLACE FUNCTION match_all_unmatched_transactions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_transaction_id UUID;
  v_matched_count INTEGER := 0;
BEGIN
  -- Loop through all unmatched transactions
  FOR v_transaction_id IN 
    SELECT id FROM bank_transactions WHERE status = 'unmatched'
  LOOP
    -- Try to match each transaction
    IF match_transaction_to_invoice(v_transaction_id) THEN
      v_matched_count := v_matched_count + 1;
    END IF;
  END LOOP;
  
  RETURN v_matched_count;
END;
$$;

-- Grant execute permission to authenticated users (admins)
GRANT EXECUTE ON FUNCTION match_all_unmatched_transactions() TO authenticated;