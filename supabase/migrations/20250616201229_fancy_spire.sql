/*
  # Fix Payment Calculation

  1. Changes
     - Update trigger_update_invoice_payment_status function to correctly calculate total_payments
     - Create a temporary function to update all existing invoices
     - Run the update function to fix existing data
     - Drop the temporary function

  2. Purpose
     - Fix the issue where overpayments are not included in the total_payments calculation
     - Ensure the user_financial_summary view displays the correct "Total paid" amount
*/

-- Redefine the trigger_update_invoice_payment_status function to include all payment statuses
CREATE OR REPLACE FUNCTION trigger_update_invoice_payment_status()
RETURNS TRIGGER AS $$
DECLARE
  v_invoice_id UUID;
  v_invoice_number TEXT;
  v_total_payments NUMERIC;
  v_invoice_amount NUMERIC;
BEGIN
  -- Determine which invoice to update based on the operation
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    v_invoice_id := NEW.invoice_id;
  ELSIF TG_OP = 'DELETE' THEN
    v_invoice_id := OLD.invoice_id;
  END IF;

  -- Skip if no invoice_id
  IF v_invoice_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Get the invoice number
  SELECT invoice_number, amount INTO v_invoice_number, v_invoice_amount
  FROM invoices
  WHERE id = v_invoice_id;

  -- Calculate total payments for this invoice
  -- Include all payment statuses: matched, partially_matched, and overpaid
  SELECT COALESCE(SUM(amount), 0) INTO v_total_payments
  FROM bank_transactions
  WHERE invoice_id = v_invoice_id
  AND status IN ('matched', 'partially_matched', 'overpaid');

  -- Update the invoice with the total payments
  UPDATE invoices
  SET total_payments = v_total_payments
  WHERE id = v_invoice_id;

  -- Update the invoice status based on payment amount
  IF v_total_payments >= v_invoice_amount THEN
    UPDATE invoices
    SET status = 'paid',
        paid_at = NOW()
    WHERE id = v_invoice_id
    AND status = 'pending';
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create a temporary function to update all existing invoices
CREATE OR REPLACE FUNCTION update_all_invoice_payments()
RETURNS VOID AS $$
DECLARE
  v_invoice RECORD;
  v_total_payments NUMERIC;
BEGIN
  -- Loop through all invoices
  FOR v_invoice IN SELECT id, invoice_number, amount FROM invoices LOOP
    -- Calculate total payments for this invoice
    SELECT COALESCE(SUM(amount), 0) INTO v_total_payments
    FROM bank_transactions
    WHERE invoice_id = v_invoice.id
    AND status IN ('matched', 'partially_matched', 'overpaid');

    -- Update the invoice with the total payments
    UPDATE invoices
    SET total_payments = v_total_payments
    WHERE id = v_invoice.id;

    -- Update the invoice status based on payment amount
    IF v_total_payments >= v_invoice.amount THEN
      UPDATE invoices
      SET status = 'paid',
          paid_at = NOW()
      WHERE id = v_invoice.id
      AND status = 'pending';
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Run the update function to fix existing data
SELECT update_all_invoice_payments();

-- Drop the temporary function
DROP FUNCTION update_all_invoice_payments();