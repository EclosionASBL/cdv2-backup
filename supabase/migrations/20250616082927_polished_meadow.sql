-- Add payment tracking columns to invoices table if they don't exist
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS total_payments numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS transaction_ids uuid[] DEFAULT '{}';

-- First drop the trigger that depends on the function
DROP TRIGGER IF EXISTS trg_update_invoice_payment_status ON public.bank_transactions;

-- Now we can safely drop the functions
DROP FUNCTION IF EXISTS public.trigger_update_invoice_payment_status();
DROP FUNCTION IF EXISTS public.update_invoice_payment_status(uuid);
DROP FUNCTION IF EXISTS public.handle_invoice_overpayment(uuid, numeric);

-- Create function to directly update invoice payment status with credit note consideration
CREATE OR REPLACE FUNCTION public.update_invoice_payment_status(p_invoice_id uuid)
RETURNS void AS $$
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
    SELECT COALESCE(SUM(amount), 0) INTO v_total_credit_notes
    FROM credit_notes
    WHERE (invoice_id = p_invoice_id OR invoice_number = v_invoice_number)
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
$$ LANGUAGE plpgsql;

-- Create a separate function to handle overpayments
CREATE OR REPLACE FUNCTION public.handle_invoice_overpayment(p_invoice_id uuid, p_overpayment_amount numeric)
RETURNS void AS $$
DECLARE
    v_user_id uuid;
    v_invoice_number text;
    v_credit_note_number text;
    v_latest_transaction_id uuid;
    v_registration_id uuid;
BEGIN
    -- Skip if no overpayment
    IF p_overpayment_amount <= 0 THEN
        RETURN;
    END IF;
    
    -- Get invoice details
    SELECT 
        user_id, 
        invoice_number,
        (SELECT id FROM bank_transactions WHERE invoice_id = i.id ORDER BY created_at DESC LIMIT 1) AS latest_transaction_id,
        (SELECT id FROM registrations WHERE invoice_id = i.invoice_number LIMIT 1) AS registration_id
    INTO 
        v_user_id,
        v_invoice_number,
        v_latest_transaction_id,
        v_registration_id
    FROM invoices i
    WHERE id = p_invoice_id;
    
    -- Generate credit note number
    SELECT public.get_next_credit_note_sequence(EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER)
    INTO v_credit_note_number;
    
    -- Create credit note for overpayment
    INSERT INTO public.credit_notes (
        user_id,
        registration_id,
        credit_note_number,
        amount,
        status,
        invoice_id,
        invoice_number,
        type,
        source_transaction_id
    ) VALUES (
        v_user_id,
        v_registration_id,
        v_credit_note_number,
        p_overpayment_amount,
        'issued',
        p_invoice_id,
        v_invoice_number,
        'overpayment',
        v_latest_transaction_id
    );
    
    -- Update the transaction status to overpaid
    IF v_latest_transaction_id IS NOT NULL THEN
        UPDATE public.bank_transactions
        SET status = 'overpaid'
        WHERE id = v_latest_transaction_id;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Create a simplified trigger function
CREATE OR REPLACE FUNCTION public.trigger_update_invoice_payment_status()
RETURNS TRIGGER AS $$
BEGIN
    -- Only process if invoice_id is set and status is relevant
    IF NEW.invoice_id IS NOT NULL AND 
       NEW.status IN ('matched', 'partially_matched', 'overpaid') THEN
        
        -- Call the function to update invoice payment status
        PERFORM public.update_invoice_payment_status(NEW.invoice_id);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger with a simpler condition
CREATE TRIGGER trg_update_invoice_payment_status
AFTER INSERT OR UPDATE OF amount, invoice_id, status
ON public.bank_transactions
FOR EACH ROW
EXECUTE FUNCTION public.trigger_update_invoice_payment_status();

-- Create a function to reconcile all pending invoices
CREATE OR REPLACE FUNCTION public.reconcile_all_pending_invoices()
RETURNS jsonb AS $$
DECLARE
    v_count int := 0;
    v_success_count int := 0;
    v_error_count int := 0;
    v_invoice record;
BEGIN
    -- Get all pending invoices
    FOR v_invoice IN 
        SELECT id, invoice_number 
        FROM public.invoices 
        WHERE status = 'pending'
    LOOP
        v_count := v_count + 1;
        
        -- Try to reconcile each invoice
        BEGIN
            PERFORM public.update_invoice_payment_status(v_invoice.id);
            v_success_count := v_success_count + 1;
        EXCEPTION
            WHEN OTHERS THEN
                v_error_count := v_error_count + 1;
                RAISE NOTICE 'Error reconciling invoice %: %', v_invoice.invoice_number, SQLERRM;
        END;
    END LOOP;
    
    RETURN jsonb_build_object(
        'success', true,
        'total_invoices', v_count,
        'success_count', v_success_count,
        'error_count', v_error_count
    );
END;
$$ LANGUAGE plpgsql;

-- Add additional indexes for better performance
CREATE INDEX IF NOT EXISTS idx_bank_transactions_status_invoice_id ON bank_transactions(status, invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status_communication ON invoices(status, communication);
CREATE INDEX IF NOT EXISTS idx_invoices_status_invoice_number ON invoices(status, invoice_number);
CREATE INDEX IF NOT EXISTS idx_credit_notes_invoice_id ON credit_notes(invoice_id);
CREATE INDEX IF NOT EXISTS idx_credit_notes_invoice_number ON credit_notes(invoice_number);