-- Drop the existing trigger first
DROP TRIGGER IF EXISTS trg_update_invoice_status_on_credit_note_change ON credit_notes;

-- Drop the existing function
DROP FUNCTION IF EXISTS trigger_update_invoice_status_on_credit_note_change();

-- Create a new version of the function with proper type casting
CREATE OR REPLACE FUNCTION trigger_update_invoice_status_on_credit_note_change()
RETURNS TRIGGER AS $$
DECLARE
    v_invoice_id text;
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
        -- IMPORTANT: Cast the text v_invoice_id to UUID for comparison with invoices.id
        SELECT invoice_number INTO v_invoice_number
        FROM invoices
        WHERE id = v_invoice_id::uuid;
    END IF;
    
    -- If we have an invoice_number, update its payment status
    IF v_invoice_number IS NOT NULL THEN
        -- Call the function with the invoice_number parameter
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
CREATE TRIGGER trg_update_invoice_status_on_credit_note_change
AFTER INSERT OR UPDATE OR DELETE ON public.credit_notes
FOR EACH ROW
EXECUTE FUNCTION trigger_update_invoice_status_on_credit_note_change();