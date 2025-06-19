-- Drop the existing functions to avoid conflicts
DROP FUNCTION IF EXISTS process_cancellation_approval(uuid, text, text);
DROP FUNCTION IF EXISTS process_cancellation_approval(uuid, text, text, text);

-- Create the corrected function with proper type handling
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
  v_credit_note_url TEXT;
  v_user_id UUID;
  v_registration_ids UUID[] := ARRAY[]::UUID[];
  v_result JSONB;
  v_reg RECORD;
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
      v_request.registration_id, -- Link to the original registration that triggered the cancellation
      v_request.id,
      v_credit_note_number,
      v_total_amount,
      'issued',
      v_invoice_record.id::text, -- Cast UUID to text to match column type
      v_invoice_id
    )
    RETURNING id INTO v_credit_note_id;
    
    -- Update the cancellation request with the credit note info
    -- IMPORTANT: Store the credit_note_number (text) instead of credit_note_id (uuid)
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
    FOR v_reg IN 
      SELECT * FROM registrations WHERE id = ANY(v_registration_ids)
    LOOP
      PERFORM update_session_registration_count(v_reg);
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
    FOR v_reg IN 
      SELECT * FROM registrations WHERE id = ANY(v_registration_ids)
    LOOP
      PERFORM update_session_registration_count(v_reg);
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

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION process_cancellation_approval(uuid, text, text) TO authenticated;

-- Create a helper function to generate credit note numbers if it doesn't exist
CREATE OR REPLACE FUNCTION generate_credit_note_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_year integer;
  next_sequence integer;
  credit_note_number text;
BEGIN
  current_year := EXTRACT(YEAR FROM CURRENT_DATE);
  
  -- Get or create the sequence for this year
  INSERT INTO credit_note_sequences (year, last_sequence)
  VALUES (current_year, 1)
  ON CONFLICT (year) 
  DO UPDATE SET last_sequence = credit_note_sequences.last_sequence + 1
  RETURNING last_sequence INTO next_sequence;
  
  -- Format: CN-YYYY-NNNN (e.g., CN-2024-0001)
  credit_note_number := 'CN-' || current_year || '-' || LPAD(next_sequence::text, 4, '0');
  
  RETURN credit_note_number;
END;
$$;