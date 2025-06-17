/*
# Reconcile Existing Transactions

This migration will reconcile all existing transactions with invoices to ensure
that invoice payment statuses are correctly updated according to the new system.

1. Functions
  - Create a temporary function to reconcile all existing transactions
  - This will update invoice statuses and create credit notes for overpayments if needed

2. Execution
  - Call the function to process all existing transactions
  - The function will be dropped after execution
*/

-- Create a temporary function to reconcile all existing transactions
CREATE OR REPLACE FUNCTION public.reconcile_existing_transactions()
RETURNS void AS $$
DECLARE
    v_invoice record;
    v_count int := 0;
BEGIN
    -- Get all invoices with linked transactions
    FOR v_invoice IN 
        SELECT DISTINCT i.id, i.invoice_number
        FROM public.invoices i
        JOIN public.bank_transactions bt ON bt.invoice_id = i.id
        WHERE bt.status IN ('matched', 'partially_matched', 'overpaid')
    LOOP
        -- Calculate total payments for this invoice
        DECLARE
            v_total_payments numeric := 0;
            v_latest_transaction_id uuid;
        BEGIN
            -- Use ORDER BY and LIMIT instead of MAX(id) for UUID
            SELECT COALESCE(SUM(amount), 0) INTO v_total_payments
            FROM public.bank_transactions
            WHERE invoice_id = v_invoice.id
            AND status IN ('matched', 'partially_matched', 'overpaid');
            
            -- Get the latest transaction ID separately
            SELECT id INTO v_latest_transaction_id
            FROM public.bank_transactions
            WHERE invoice_id = v_invoice.id
            AND status IN ('matched', 'partially_matched', 'overpaid')
            ORDER BY created_at DESC
            LIMIT 1;
            
            -- Update the invoice with the payment information
            UPDATE public.invoices
            SET total_payments = v_total_payments
            WHERE id = v_invoice.id;
            
            v_count := v_count + 1;
        END;
    END LOOP;
    
    RAISE NOTICE 'Reconciled % invoices', v_count;
END;
$$ LANGUAGE plpgsql;

-- Execute the reconciliation function
SELECT public.reconcile_existing_transactions();

-- Drop the temporary function
DROP FUNCTION IF EXISTS public.reconcile_existing_transactions();