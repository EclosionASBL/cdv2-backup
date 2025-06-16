-- Create a trigger function to update invoice payment status when credit notes change
CREATE OR REPLACE FUNCTION public.trigger_update_invoice_status_on_credit_note_change()
RETURNS TRIGGER AS $$
DECLARE
    v_invoice_id uuid;
    v_invoice_number text;
BEGIN
    -- Determine which record to use based on operation type
    IF TG_OP = 'DELETE' THEN
        -- For DELETE operations, use OLD record
        v_invoice_id := OLD.invoice_id;
        v_invoice_number := OLD.invoice_number;
    ELSE
        -- For INSERT and UPDATE operations, use NEW record
        v_invoice_id := NEW.invoice_id;
        v_invoice_number := NEW.invoice_number;
    END IF;
    
    -- If we have an invoice_id, get the invoice record and update its payment status
    IF v_invoice_id IS NOT NULL THEN
        -- Get the invoice_number from the invoice record
        SELECT invoice_number INTO v_invoice_number
        FROM invoices
        WHERE id = v_invoice_id;
    END IF;
    
    -- If we have an invoice_number, update its payment status
    IF v_invoice_number IS NOT NULL THEN
        -- The function expects a UUID parameter, so get the invoice_id first
        SELECT id INTO v_invoice_id
        FROM invoices
        WHERE invoice_number = v_invoice_number;
        
        IF FOUND THEN
            -- Call the function with the UUID parameter
            PERFORM public.update_invoice_payment_status(v_invoice_number);
        END IF;
    END IF;
    
    -- Return the appropriate record based on operation type
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger on credit_notes table
DROP TRIGGER IF EXISTS trg_update_invoice_status_on_credit_note_change ON public.credit_notes;
CREATE TRIGGER trg_update_invoice_status_on_credit_note_change
AFTER INSERT OR UPDATE OR DELETE ON public.credit_notes
FOR EACH ROW
EXECUTE FUNCTION public.trigger_update_invoice_status_on_credit_note_change();

-- Create or replace the update_invoice_payment_status function to accept text parameter
CREATE OR REPLACE FUNCTION public.update_invoice_payment_status(p_invoice_number text)
RETURNS void AS $$
DECLARE
    v_invoice_id uuid;
    v_invoice_amount numeric;
    v_invoice_status text;
    v_user_id uuid;
    v_total_payments numeric := 0;
    v_overpayment_amount numeric := 0;
    v_credit_note_number text;
    v_credit_note_id uuid;
    v_current_year int;
    v_latest_transaction_id uuid;
BEGIN
    -- Get invoice details
    SELECT id, amount, status, user_id
    INTO v_invoice_id, v_invoice_amount, v_invoice_status, v_user_id
    FROM public.invoices
    WHERE invoice_number = p_invoice_number;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invoice % not found', p_invoice_number;
    END IF;
    
    -- Calculate total payments for this invoice
    SELECT COALESCE(SUM(amount), 0), MAX(id)
    INTO v_total_payments, v_latest_transaction_id
    FROM public.bank_transactions
    WHERE invoice_id = v_invoice_id
    AND status IN ('matched', 'partially_matched', 'overpaid');
    
    -- If no payments found, exit
    IF v_total_payments = 0 THEN
        RETURN;
    END IF;
    
    -- Determine if invoice is fully paid, partially paid, or overpaid
    IF v_total_payments >= v_invoice_amount THEN
        -- Invoice is fully paid or overpaid
        
        -- Update invoice status to paid if not already
        IF v_invoice_status != 'paid' THEN
            UPDATE public.invoices
            SET status = 'paid', paid_at = NOW()
            WHERE id = v_invoice_id;
            
            -- Update all registrations linked to this invoice
            UPDATE public.registrations
            SET payment_status = 'paid'
            WHERE invoice_id = p_invoice_number;
        END IF;
        
        -- Handle overpayment if any
        v_overpayment_amount := v_total_payments - v_invoice_amount;
        
        IF v_overpayment_amount > 0 THEN
            -- Generate credit note number
            v_current_year := EXTRACT(YEAR FROM CURRENT_DATE);
            
            -- Get next credit note sequence
            SELECT public.get_next_credit_note_sequence(v_current_year)
            INTO v_credit_note_number;
            
            -- Create credit note for overpayment
            INSERT INTO public.credit_notes (
                user_id,
                credit_note_number,
                amount,
                status,
                invoice_id,
                invoice_number,
                type,
                source_transaction_id
            ) VALUES (
                v_user_id,
                v_credit_note_number,
                v_overpayment_amount,
                'issued',
                v_invoice_id,
                p_invoice_number,
                'overpayment',
                v_latest_transaction_id
            )
            RETURNING id INTO v_credit_note_id;
            
            -- Update the transaction status to overpaid
            UPDATE public.bank_transactions
            SET status = 'overpaid'
            WHERE id = v_latest_transaction_id;
        END IF;
    ELSE
        -- Invoice is partially paid
        
        -- Update transaction status to partially_matched
        UPDATE public.bank_transactions
        SET status = 'partially_matched'
        WHERE invoice_id = v_invoice_id;
        
        -- Ensure invoice status remains pending
        IF v_invoice_status != 'pending' THEN
            UPDATE public.invoices
            SET status = 'pending', paid_at = NULL
            WHERE id = v_invoice_id;
        END IF;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Reconcile all existing invoices to update their payment status
DO $$
DECLARE
    v_invoice_number text;
    v_count int := 0;
BEGIN
    -- Get all distinct invoice numbers from credit notes
    FOR v_invoice_number IN 
        SELECT DISTINCT invoice_number 
        FROM credit_notes 
        WHERE invoice_number IS NOT NULL
    LOOP
        -- Update invoice payment status using the invoice number
        BEGIN
            PERFORM public.update_invoice_payment_status(v_invoice_number);
            v_count := v_count + 1;
        EXCEPTION
            WHEN OTHERS THEN
                RAISE NOTICE 'Error updating invoice %: %', v_invoice_number, SQLERRM;
        END;
    END LOOP;
    
    -- Also process invoices referenced by invoice_id
    FOR v_invoice_number IN
        SELECT DISTINCT i.invoice_number
        FROM invoices i
        JOIN credit_notes cn ON cn.invoice_id = i.id
        WHERE i.invoice_number IS NOT NULL
    LOOP
        -- Update invoice payment status using the invoice number
        BEGIN
            PERFORM public.update_invoice_payment_status(v_invoice_number);
            v_count := v_count + 1;
        EXCEPTION
            WHEN OTHERS THEN
                RAISE NOTICE 'Error updating invoice %: %', v_invoice_number, SQLERRM;
        END;
    END LOOP;
    
    RAISE NOTICE 'Updated payment status for % invoices with credit notes', v_count;
END;
$$;