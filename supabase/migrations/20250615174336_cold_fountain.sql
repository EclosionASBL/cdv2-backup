/*
# Payment Reconciliation System

1. New Tables
  - No new tables created

2. Schema Changes
  - Add `type` column to `credit_notes` table
  - Add `source_transaction_id` column to `credit_notes` table

3. Functions
  - Create `update_invoice_payment_status` function to handle payment reconciliation
  - This function calculates total payments for an invoice and updates statuses accordingly
  - Handles overpayments by creating credit notes automatically
  - Handles partial payments by keeping invoice as pending until fully paid

4. Triggers
  - Create `trg_update_invoice_payment_status` trigger on bank_transactions table
  - Trigger runs after INSERT or UPDATE operations
  - Calls the payment reconciliation function automatically
*/

-- Add type column to credit_notes table
ALTER TABLE public.credit_notes
ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'cancellation'
CHECK (type IN ('cancellation', 'overpayment'));

-- Add source_transaction_id column to credit_notes table
ALTER TABLE public.credit_notes
ADD COLUMN IF NOT EXISTS source_transaction_id uuid REFERENCES public.bank_transactions(id);

-- Create function to update invoice payment status based on linked transactions
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

-- Create trigger to automatically update invoice payment status when transactions change
CREATE OR REPLACE FUNCTION public.trigger_update_invoice_payment_status()
RETURNS TRIGGER AS $$
DECLARE
    v_invoice_number text;
BEGIN
    -- For INSERT or UPDATE operations
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        -- If invoice_id is set and status is relevant for payment calculation
        IF NEW.invoice_id IS NOT NULL AND 
           NEW.status IN ('matched', 'partially_matched', 'overpaid') THEN
            
            -- Get the invoice number
            SELECT invoice_number 
            INTO v_invoice_number
            FROM public.invoices
            WHERE id = NEW.invoice_id;
            
            IF FOUND THEN
                -- Call the function to update invoice payment status
                PERFORM public.update_invoice_payment_status(v_invoice_number);
            END IF;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on bank_transactions table
DROP TRIGGER IF EXISTS trg_update_invoice_payment_status ON public.bank_transactions;
CREATE TRIGGER trg_update_invoice_payment_status
AFTER INSERT OR UPDATE OF amount, invoice_id, status
ON public.bank_transactions
FOR EACH ROW
EXECUTE FUNCTION public.trigger_update_invoice_payment_status();

-- Create a function to manually reconcile all transactions for an invoice
CREATE OR REPLACE FUNCTION public.reconcile_invoice_payments(p_invoice_number text)
RETURNS boolean AS $$
BEGIN
    PERFORM public.update_invoice_payment_status(p_invoice_number);
    RETURN true;
EXCEPTION
    WHEN OTHERS THEN
        RETURN false;
END;
$$ LANGUAGE plpgsql;

-- Create a function to reconcile all invoices
CREATE OR REPLACE FUNCTION public.reconcile_all_invoices()
RETURNS int AS $$
DECLARE
    v_count int := 0;
    v_invoice record;
BEGIN
    FOR v_invoice IN 
        SELECT invoice_number 
        FROM public.invoices 
        WHERE status = 'pending'
    LOOP
        PERFORM public.update_invoice_payment_status(v_invoice.invoice_number);
        v_count := v_count + 1;
    END LOOP;
    
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;