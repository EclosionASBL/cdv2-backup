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
        SELECT DISTINCT i.invoice_number
        FROM public.invoices i
        JOIN public.bank_transactions bt ON bt.invoice_id = i.id
        WHERE bt.status IN ('matched', 'partially_matched', 'overpaid')
    LOOP
        -- Call the update function for each invoice
        PERFORM public.update_invoice_payment_status(v_invoice.invoice_number);
        v_count := v_count + 1;
    END LOOP;
    
    RAISE NOTICE 'Reconciled % invoices', v_count;
END;
$$ LANGUAGE plpgsql;

-- Execute the reconciliation function
SELECT public.reconcile_existing_transactions();

-- Drop the temporary function
DROP FUNCTION IF EXISTS public.reconcile_existing_transactions();