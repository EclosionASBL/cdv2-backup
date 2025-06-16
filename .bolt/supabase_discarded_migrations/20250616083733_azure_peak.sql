/*
  # Add trigger on credit_notes table to update invoice payment status
  
  1. Changes
    - Create a new trigger function to update invoice payment status when credit notes change
    - Add trigger on credit_notes table for INSERT, UPDATE, and DELETE operations
    - This ensures that invoice payment status is recalculated when credit notes are modified
    
  2. Security
    - Maintain existing RLS policies
    - Ensure proper invoice status updates when credit notes change
*/

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
    
    -- If we have an invoice_id, update its payment status
    IF v_invoice_id IS NOT NULL THEN
        PERFORM public.update_invoice_payment_status(v_invoice_id);
    -- If we have an invoice_number but no invoice_id, try to find the invoice
    ELSIF v_invoice_number IS NOT NULL THEN
        SELECT id INTO v_invoice_id
        FROM invoices
        WHERE invoice_number = v_invoice_number;
        
        IF FOUND THEN
            PERFORM public.update_invoice_payment_status(v_invoice_id);
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

-- Reconcile all existing invoices to update their payment status
DO $$
DECLARE
    v_invoice record;
    v_count int := 0;
BEGIN
    -- Get all invoices with credit notes
    FOR v_invoice IN 
        SELECT DISTINCT i.id
        FROM invoices i
        JOIN credit_notes cn ON cn.invoice_id = i.id OR cn.invoice_number = i.invoice_number
    LOOP
        -- Update invoice payment status
        PERFORM public.update_invoice_payment_status(v_invoice.id);
        v_count := v_count + 1;
    END LOOP;
    
    RAISE NOTICE 'Updated payment status for % invoices with credit notes', v_count;
END;
$$;