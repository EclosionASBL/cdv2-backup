-- Create a trigger function to update invoice payment status when credit notes change
CREATE OR REPLACE FUNCTION public.trigger_update_invoice_status_on_credit_note_change()
RETURNS TRIGGER AS $$
DECLARE
    v_invoice_id uuid;
    v_invoice_number text;
    v_invoice_record record;
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
    
    -- If we have an invoice_id, update its payment status
    IF v_invoice_id IS NOT NULL THEN
        -- Get the invoice_number from the invoice record
        SELECT invoice_number INTO v_invoice_number
        FROM invoices
        WHERE id = v_invoice_id;
        
        IF FOUND THEN
            PERFORM public.update_invoice_payment_status(v_invoice_number);
        END IF;
    -- If we have an invoice_number but no invoice_id, use it directly
    ELSIF v_invoice_number IS NOT NULL THEN
        PERFORM public.update_invoice_payment_status(v_invoice_number);
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
        PERFORM public.update_invoice_payment_status(v_invoice_number);
        v_count := v_count + 1;
    END LOOP;
    
    -- Also process invoices referenced by invoice_id
    FOR v_invoice_number IN
        SELECT DISTINCT i.invoice_number
        FROM invoices i
        JOIN credit_notes cn ON cn.invoice_id = i.id
        WHERE i.invoice_number IS NOT NULL
    LOOP
        -- Update invoice payment status using the invoice number
        PERFORM public.update_invoice_payment_status(v_invoice_number);
        v_count := v_count + 1;
    END LOOP;
    
    RAISE NOTICE 'Updated payment status for % invoices with credit notes', v_count;
END;
$$;