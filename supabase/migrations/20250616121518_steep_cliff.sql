/*
  # Fix Type Mismatch in update_invoice_payment_status Function

  1. Changes
     - Fix the type mismatch in the update_invoice_payment_status function
     - Add explicit type cast from UUID to text when comparing with credit_notes.invoice_id
     - This resolves the "operator does not exist: text = uuid" error

  2. Background
     - The credit_notes table has invoice_id as text type
     - The function parameter p_invoice_id is UUID type
     - Without explicit casting, PostgreSQL cannot compare these different types
*/

-- Drop the existing function
DROP FUNCTION IF EXISTS public.update_invoice_payment_status(uuid);

-- Recreate the function with the fixed type casting
CREATE OR REPLACE FUNCTION public.update_invoice_payment_status(p_invoice_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    v_invoice_amount numeric;
    v_total_payments numeric := 0;
    v_total_credit_notes numeric := 0;
    v_net_amount_due numeric;
    v_transaction_ids uuid[] := '{}';
    v_new_status text;
    v_invoice_number text;
BEGIN
    -- Get invoice amount and number
    SELECT amount, invoice_number INTO v_invoice_amount, v_invoice_number
    FROM invoices
    WHERE id = p_invoice_id;
    
    IF NOT FOUND THEN
        RETURN; -- Invoice not found, exit
    END IF;
    
    -- Calculate total credit notes for this invoice
    -- Add explicit type cast from UUID to text for comparison
    SELECT COALESCE(SUM(amount), 0) INTO v_total_credit_notes
    FROM credit_notes
    WHERE (invoice_id = p_invoice_id::text OR invoice_number = v_invoice_number)
    AND type IN ('cancellation', 'overpayment');
    
    -- Calculate net amount due (invoice amount minus credit notes)
    v_net_amount_due := GREATEST(v_invoice_amount - v_total_credit_notes, 0);
    
    -- Calculate total payments and collect transaction IDs
    SELECT 
        COALESCE(SUM(amount), 0),
        ARRAY_AGG(id)
    INTO 
        v_total_payments,
        v_transaction_ids
    FROM bank_transactions
    WHERE invoice_id = p_invoice_id
    AND status IN ('matched', 'partially_matched', 'overpaid');
    
    -- Determine new status based on net amount due
    IF v_total_payments >= v_net_amount_due THEN
        v_new_status := 'paid';
    ELSE
        v_new_status := 'pending';
    END IF;
    
    -- Update invoice with payment information
    UPDATE invoices
    SET 
        status = v_new_status,
        paid_at = CASE WHEN v_new_status = 'paid' THEN NOW() ELSE NULL END,
        total_payments = v_total_payments,
        transaction_ids = v_transaction_ids
    WHERE id = p_invoice_id;
    
    -- Update registrations status if paid
    IF v_new_status = 'paid' THEN
        UPDATE registrations
        SET payment_status = 'paid'
        WHERE invoice_id = v_invoice_number;
    END IF;
    
    -- Handle overpayment in a separate function call if needed
    -- This prevents deep recursion
    IF v_total_payments > v_net_amount_due THEN
        PERFORM handle_invoice_overpayment(p_invoice_id, v_total_payments - v_net_amount_due);
    END IF;
END;
$$;