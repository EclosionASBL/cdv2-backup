-- Add payment tracking columns to invoices table
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS total_payments numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS transaction_ids uuid[] DEFAULT '{}';

-- Drop existing functions that will be modified
DROP FUNCTION IF EXISTS public.match_all_unmatched_transactions();
DROP FUNCTION IF EXISTS public.update_invoice_payment_status(text);
DROP FUNCTION IF EXISTS public.match_transaction_to_invoice(uuid);
DROP FUNCTION IF EXISTS public.trigger_update_invoice_payment_status();

-- Create function to directly update invoice payment status
CREATE OR REPLACE FUNCTION public.update_invoice_payment_status(p_invoice_id uuid)
RETURNS void AS $$
DECLARE
    v_invoice_amount numeric;
    v_total_payments numeric := 0;
    v_transaction_ids uuid[] := '{}';
    v_new_status text;
BEGIN
    -- Get invoice amount
    SELECT amount INTO v_invoice_amount
    FROM invoices
    WHERE id = p_invoice_id;
    
    IF NOT FOUND THEN
        RETURN; -- Invoice not found, exit
    END IF;
    
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
    
    -- Determine new status
    IF v_total_payments >= v_invoice_amount THEN
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
        WHERE invoice_id = (SELECT invoice_number FROM invoices WHERE id = p_invoice_id);
    END IF;
    
    -- Handle overpayment in a separate function call if needed
    -- This prevents deep recursion
    IF v_total_payments > v_invoice_amount THEN
        PERFORM handle_invoice_overpayment(p_invoice_id, v_total_payments - v_invoice_amount);
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
DROP TRIGGER IF EXISTS trg_update_invoice_payment_status ON public.bank_transactions;
CREATE TRIGGER trg_update_invoice_payment_status
AFTER INSERT OR UPDATE OF amount, invoice_id, status
ON public.bank_transactions
FOR EACH ROW
EXECUTE FUNCTION public.trigger_update_invoice_payment_status();

-- Create a function to match transaction to invoice with better performance
CREATE OR REPLACE FUNCTION public.match_transaction_to_invoice(transaction_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_transaction_record RECORD;
    v_invoice_id UUID;
    v_invoice_amount NUMERIC;
    v_match_status TEXT;
BEGIN
    -- Get the transaction with minimal fields
    SELECT id, communication, amount, extracted_invoice_number
    INTO v_transaction_record
    FROM bank_transactions
    WHERE id = transaction_id;
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- First try to match using extracted_invoice_number if available
    IF v_transaction_record.extracted_invoice_number IS NOT NULL THEN
        SELECT id INTO v_invoice_id
        FROM invoices
        WHERE invoice_number = v_transaction_record.extracted_invoice_number
        AND status = 'pending'
        LIMIT 1;
    END IF;
    
    -- If no match found with extracted_invoice_number, try with communication
    IF v_invoice_id IS NULL THEN
        SELECT id INTO v_invoice_id
        FROM invoices
        WHERE (communication = v_transaction_record.communication OR invoice_number = v_transaction_record.communication)
        AND status = 'pending'
        LIMIT 1;
    END IF;
    
    -- If still no match found, return false
    IF v_invoice_id IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Update the transaction with the invoice link
    -- Initial status is 'matched' - the trigger will handle the rest
    UPDATE bank_transactions
    SET 
        status = 'matched',
        invoice_id = v_invoice_id
    WHERE id = transaction_id;
    
    RETURN TRUE;
END;
$$;

-- Create a function to match all unmatched transactions with better performance
-- Note: Changed return type to integer to avoid the error
CREATE OR REPLACE FUNCTION public.match_all_unmatched_transactions()
RETURNS integer AS $$
DECLARE
    v_transaction_id UUID;
    v_success_count INTEGER := 0;
    v_error_count INTEGER := 0;
    v_batch_size INTEGER := 50;
    v_processed INTEGER := 0;
    v_total_count INTEGER;
    v_transactions CURSOR FOR 
        SELECT id FROM bank_transactions 
        WHERE status = 'unmatched';
BEGIN
    -- Get total count of unmatched transactions
    SELECT COUNT(*) INTO v_total_count
    FROM bank_transactions
    WHERE status = 'unmatched';
    
    -- Process in batches to avoid stack depth issues
    OPEN v_transactions;
    
    LOOP
        -- Fetch next transaction
        FETCH v_transactions INTO v_transaction_id;
        
        -- Exit when no more transactions
        EXIT WHEN NOT FOUND OR v_processed >= v_batch_size;
        
        BEGIN
            -- Try to match the transaction
            IF match_transaction_to_invoice(v_transaction_id) THEN
                v_success_count := v_success_count + 1;
            END IF;
        EXCEPTION
            WHEN OTHERS THEN
                v_error_count := v_error_count + 1;
                -- Log error but continue processing
                RAISE NOTICE 'Error matching transaction %: %', v_transaction_id, SQLERRM;
        END;
        
        v_processed := v_processed + 1;
    END LOOP;
    
    CLOSE v_transactions;
    
    -- Return the number of successfully matched transactions
    RETURN v_success_count;
END;
$$ LANGUAGE plpgsql;

-- Add additional indexes for better performance
CREATE INDEX IF NOT EXISTS idx_bank_transactions_status_invoice_id ON bank_transactions(status, invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status_communication ON invoices(status, communication);
CREATE INDEX IF NOT EXISTS idx_invoices_status_invoice_number ON invoices(status, invoice_number);