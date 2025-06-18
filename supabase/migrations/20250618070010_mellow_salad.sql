/*
  # Fix Credit Note Functions and Type Handling

  1. Changes
    - Drop all existing versions of credit note related functions
    - Recreate get_next_credit_note_sequence with proper parameter handling
    - Recreate process_cancellation_approval with proper UUID handling
    - Fix trigger_update_invoice_status_on_credit_note_change to avoid max(uuid)
    
  2. Security
    - Maintain existing RLS policies
    - Ensure proper SECURITY DEFINER settings
*/

-- First, drop all existing versions of the problematic functions
DROP FUNCTION IF EXISTS process_cancellation_approval(uuid, text, text);
DROP FUNCTION IF EXISTS process_cancellation_approval(text, text, text);
DROP FUNCTION IF EXISTS process_cancellation_approval(uuid, text, text, text);
DROP FUNCTION IF EXISTS get_next_credit_note_sequence();
DROP FUNCTION IF EXISTS get_next_credit_note_sequence(integer);
DROP FUNCTION IF EXISTS generate_credit_note_number();

-- Create a clean version of get_next_credit_note_sequence
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

-- Fix the update_session_registration_count function to avoid max(uuid)
CREATE OR REPLACE FUNCTION update_session_registration_count()
RETURNS TRIGGER
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
  session_id uuid;
  count_value integer;
BEGIN
  -- Determine which activity_id to update based on the operation
  IF TG_OP = 'DELETE' THEN
    session_id := OLD.activity_id;
  ELSE
    session_id := NEW.activity_id;
  END IF;

  -- Count active registrations for this activity
  SELECT COUNT(*) INTO count_value
  FROM registrations
  WHERE 
    activity_id = session_id
    AND payment_status IN ('paid', 'pending');

  -- Update the sessions table with the new count
  UPDATE sessions
  SET current_registrations = count_value
  WHERE id = session_id;

  -- Return the appropriate record based on the operation
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- Fix the trigger_update_invoice_status_on_credit_note_change function
DROP FUNCTION IF EXISTS trigger_update_invoice_status_on_credit_note_change() CASCADE;

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
        -- Get the invoice record by invoice_number
        SELECT id::uuid INTO v_invoice_uuid
        FROM invoices
        WHERE invoice_number = v_invoice_number;
        
        IF FOUND THEN
            -- Update the invoice status based on credit notes
            UPDATE invoices 
            SET status = CASE 
                WHEN amount <= COALESCE((
                    SELECT SUM(cn.amount) 
                    FROM credit_notes cn 
                    WHERE (cn.invoice_id = v_invoice_id OR cn.invoice_number = v_invoice_number)
                    AND cn.status = 'issued'
                ), 0) THEN 'cancelled'
                ELSE status
            END
            WHERE id = v_invoice_uuid;
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
CREATE TRIGGER trg_update_invoice_status_on_credit_note_change
AFTER INSERT OR UPDATE OR DELETE ON public.credit_notes
FOR EACH ROW
EXECUTE FUNCTION trigger_update_invoice_status_on_credit_note_change();

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_next_credit_note_sequence(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION process_cancellation_approval(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION update_session_registration_count() TO authenticated;