-- Drop all existing versions of the problematic functions to avoid conflicts
DROP FUNCTION IF EXISTS process_cancellation_approval(uuid, text, text);
DROP FUNCTION IF EXISTS process_cancellation_approval(text, text, text);
DROP FUNCTION IF EXISTS process_cancellation_approval(uuid, text, text, text);
DROP FUNCTION IF EXISTS get_next_credit_note_sequence();
DROP FUNCTION IF EXISTS generate_credit_note_number();

-- Keep only one version of get_next_credit_note_sequence
CREATE OR REPLACE FUNCTION get_next_credit_note_sequence(p_year integer)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sequence integer;
  v_year_suffix text;
  v_formatted_number text;
BEGIN
  -- Get or create the sequence for the year
  INSERT INTO public.credit_note_sequences (year, last_sequence)
  VALUES (p_year, 0)
  ON CONFLICT (year) DO NOTHING;
  
  -- Update the sequence and return the new value
  UPDATE public.credit_note_sequences
  SET last_sequence = last_sequence + 1
  WHERE year = p_year
  RETURNING last_sequence INTO v_sequence;
  
  -- Format the year suffix (last 2 digits)
  v_year_suffix := RIGHT(p_year::text, 2);
  
  -- Format the sequence number with leading zeros
  v_formatted_number := 'NC-' || v_year_suffix || '-' || LPAD(v_sequence::text, 5, '0');
  
  RETURN v_formatted_number;
END;
$$;

-- Create a clean version of process_cancellation_approval
CREATE OR REPLACE FUNCTION process_cancellation_approval(
  p_request_id uuid,
  p_refund_type text,
  p_admin_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_request cancellation_requests%ROWTYPE;
  v_registration registrations%ROWTYPE;
  v_invoice_id TEXT;
  v_invoice_record RECORD;
  v_total_amount NUMERIC := 0;
  v_credit_note_id UUID;
  v_credit_note_number TEXT;
  v_user_id UUID;
  v_registration_ids UUID[] := ARRAY[]::UUID[];
  v_result JSONB;
  v_latest_transaction_id UUID;
BEGIN
  -- Get the cancellation request
  SELECT * INTO v_request
  FROM cancellation_requests
  WHERE id = p_request_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cancellation request not found';
  END IF;
  
  -- Get the registration
  SELECT * INTO v_registration
  FROM registrations
  WHERE id = v_request.registration_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Registration not found';
  END IF;
  
  -- Store user_id for later use
  v_user_id := v_registration.user_id;
  
  -- Get the invoice_id
  v_invoice_id := v_registration.invoice_id;
  
  -- If we have an invoice_id, get all registrations for this invoice
  IF v_invoice_id IS NOT NULL THEN
    -- Get invoice details
    SELECT * INTO v_invoice_record
    FROM invoices
    WHERE invoice_number = v_invoice_id;
    
    -- Calculate total amount to refund (all registrations in the invoice)
    SELECT SUM(amount_paid) INTO v_total_amount
    FROM registrations
    WHERE invoice_id = v_invoice_id;
    
    -- Store all registration IDs for this invoice
    SELECT ARRAY_AGG(id) INTO v_registration_ids
    FROM registrations
    WHERE invoice_id = v_invoice_id;
  ELSE
    -- If no invoice, just use the single registration amount
    v_total_amount := v_registration.amount_paid;
    v_registration_ids := ARRAY[v_registration.id];
  END IF;
  
  -- Apply refund percentage based on refund_type
  IF p_refund_type = 'partial' THEN
    v_total_amount := v_total_amount * 0.5; -- 50% refund
  ELSIF p_refund_type = 'none' THEN
    v_total_amount := 0; -- No refund
  END IF;
  
  -- Generate credit note if there's an amount to refund
  IF v_total_amount > 0 THEN
    -- Generate credit note number
    v_credit_note_number := get_next_credit_note_sequence(EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER);
    
    -- Create credit note record
    INSERT INTO credit_notes (
      user_id,
      registration_id,
      cancellation_request_id,
      credit_note_number,
      amount,
      status,
      invoice_id,
      invoice_number
    ) VALUES (
      v_user_id,
      v_request.registration_id,
      v_request.id,
      v_credit_note_number,
      v_total_amount,
      'issued',
      CASE WHEN v_invoice_record.id IS NOT NULL THEN v_invoice_record.id::text ELSE NULL END,
      v_invoice_id
    )
    RETURNING id INTO v_credit_note_id;
    
    -- Update the cancellation request with the credit note info
    UPDATE cancellation_requests cr
    SET 
      status = 'approved',
      admin_notes = p_admin_notes,
      refund_type = p_refund_type,
      credit_note_id = v_credit_note_number
    WHERE cr.id = p_request_id;
    
    -- Update all registrations in the invoice to cancelled status
    UPDATE registrations
    SET 
      payment_status = 'cancelled',
      cancellation_status = CASE 
        WHEN p_refund_type = 'full' THEN 'cancelled_full_refund'
        WHEN p_refund_type = 'partial' THEN 'cancelled_partial_refund'
        ELSE 'cancelled_no_refund'
      END
    WHERE id = ANY(v_registration_ids);
    
    -- If we have an invoice, update its status to cancelled
    IF v_invoice_id IS NOT NULL THEN
      UPDATE invoices
      SET status = 'cancelled'
      WHERE invoice_number = v_invoice_id;
    END IF;
    
    -- Update session registration counts for all affected sessions
    FOR v_registration IN 
      SELECT * FROM registrations WHERE id = ANY(v_registration_ids)
    LOOP
      -- Use a direct call to update_session_registration_count without using max(uuid)
      -- Get the count of active registrations for this activity
      DECLARE
        v_count INTEGER;
      BEGIN
        SELECT COUNT(*) INTO v_count
        FROM registrations
        WHERE 
          activity_id = v_registration.activity_id
          AND payment_status IN ('paid', 'pending');

        -- Update the sessions table with the new count
        UPDATE sessions
        SET current_registrations = v_count
        WHERE id = v_registration.activity_id;
      END;
    END LOOP;
    
    v_result := jsonb_build_object(
      'success', true,
      'credit_note_id', v_credit_note_id,
      'credit_note_number', v_credit_note_number,
      'amount', v_total_amount,
      'registrations_cancelled', v_registration_ids
    );
  ELSE
    -- No refund, just update statuses
    UPDATE cancellation_requests cr
    SET 
      status = 'approved',
      admin_notes = p_admin_notes,
      refund_type = 'none'
    WHERE cr.id = p_request_id;
    
    -- Update all registrations in the invoice to cancelled status
    UPDATE registrations
    SET 
      payment_status = 'cancelled',
      cancellation_status = 'cancelled_no_refund'
    WHERE id = ANY(v_registration_ids);
    
    -- If we have an invoice, update its status to cancelled
    IF v_invoice_id IS NOT NULL THEN
      UPDATE invoices
      SET status = 'cancelled'
      WHERE invoice_number = v_invoice_id;
    END IF;
    
    -- Update session registration counts for all affected sessions
    FOR v_registration IN 
      SELECT * FROM registrations WHERE id = ANY(v_registration_ids)
    LOOP
      -- Use a direct call to update_session_registration_count without using max(uuid)
      -- Get the count of active registrations for this activity
      DECLARE
        v_count INTEGER;
      BEGIN
        SELECT COUNT(*) INTO v_count
        FROM registrations
        WHERE 
          activity_id = v_registration.activity_id
          AND payment_status IN ('paid', 'pending');

        -- Update the sessions table with the new count
        UPDATE sessions
        SET current_registrations = v_count
        WHERE id = v_registration.activity_id;
      END;
    END LOOP;
    
    v_result := jsonb_build_object(
      'success', true,
      'credit_note_id', NULL,
      'credit_note_number', NULL,
      'amount', 0,
      'registrations_cancelled', v_registration_ids
    );
  END IF;
  
  RETURN v_result;
END;
$$;

-- Fix the update_invoice_payment_status function to avoid max(uuid)
CREATE OR REPLACE FUNCTION update_invoice_payment_status(p_invoice_number text)
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
    SELECT COALESCE(SUM(amount), 0) INTO v_total_payments
    FROM public.bank_transactions
    WHERE invoice_id = v_invoice_id
    AND status IN ('matched', 'partially_matched', 'overpaid');
    
    -- Get the latest transaction by created_at timestamp instead of using max(id)
    SELECT id INTO v_latest_transaction_id
    FROM public.bank_transactions
    WHERE invoice_id = v_invoice_id
    AND status IN ('matched', 'partially_matched', 'overpaid')
    ORDER BY created_at DESC
    LIMIT 1;
    
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
            SELECT get_next_credit_note_sequence(v_current_year)
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
            ) 
            SELECT
                v_user_id,
                (SELECT id FROM registrations WHERE invoice_id = p_invoice_number LIMIT 1),
                v_credit_note_number,
                v_overpayment_amount,
                'issued',
                v_invoice_id::text,
                p_invoice_number,
                'overpayment',
                v_latest_transaction_id
            RETURNING id INTO v_credit_note_id;
            
            -- Update the transaction status to overpaid
            IF v_latest_transaction_id IS NOT NULL THEN
                UPDATE public.bank_transactions
                SET status = 'overpaid'
                WHERE id = v_latest_transaction_id;
            END IF;
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

-- Fix the trigger_update_invoice_status_on_credit_note_change function
CREATE OR REPLACE FUNCTION trigger_update_invoice_status_on_credit_note_change()
RETURNS TRIGGER AS $$
DECLARE
    v_invoice_id text;
    v_invoice_number text;
    v_invoice_uuid uuid;
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
        -- Try to convert the text invoice_id to UUID
        BEGIN
            v_invoice_uuid := v_invoice_id::uuid;
            
            -- Get the invoice_number from the invoice record
            SELECT invoice_number INTO v_invoice_number
            FROM invoices
            WHERE id = v_invoice_uuid;
        EXCEPTION WHEN invalid_text_representation THEN
            -- If conversion fails, v_invoice_number will be used directly
            NULL;
        END;
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
DROP TRIGGER IF EXISTS trg_update_invoice_status_on_credit_note_change ON public.credit_notes;
CREATE TRIGGER trg_update_invoice_status_on_credit_note_change
AFTER INSERT OR UPDATE OR DELETE ON public.credit_notes
FOR EACH ROW
EXECUTE FUNCTION trigger_update_invoice_status_on_credit_note_change();

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_next_credit_note_sequence(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION process_cancellation_approval(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION update_invoice_payment_status(text) TO authenticated;