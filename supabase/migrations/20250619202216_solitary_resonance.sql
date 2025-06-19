-- Drop the existing function if it exists
DROP FUNCTION IF EXISTS process_cancellation_approval(uuid, text, text);
DROP FUNCTION IF EXISTS process_cancellation_approval(text, text, text);

-- Create the corrected function with proper type handling
CREATE OR REPLACE FUNCTION process_cancellation_approval(
  p_request_id text,
  p_refund_type text,
  p_admin_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_request_uuid uuid;
  v_request cancellation_requests%ROWTYPE;
  v_registration registrations%ROWTYPE;
  v_invoice_id TEXT;
  v_invoice_record RECORD;
  v_refund_amount NUMERIC := 0;
  v_credit_note_id UUID;
  v_credit_note_number TEXT;
  v_credit_note_url TEXT;
  v_user_id UUID;
  v_result JSONB;
BEGIN
  -- Convert text parameter to UUID with proper error handling
  BEGIN
    v_request_uuid := p_request_id::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'Invalid UUID format for request ID: %', p_request_id;
  END;

  -- Get the cancellation request using the UUID value
  SELECT * INTO v_request
  FROM cancellation_requests
  WHERE id = v_request_uuid;
  
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
  
  -- Calculate refund amount based on the specific registration being cancelled
  IF p_refund_type = 'full' THEN
    v_refund_amount := v_registration.amount_paid;
  ELSIF p_refund_type = 'partial' THEN
    v_refund_amount := v_registration.amount_paid * 0.5; -- 50% refund
  ELSE
    v_refund_amount := 0; -- No refund
  END IF;
  
  -- Generate credit note if there's an amount to refund
  IF v_refund_amount > 0 THEN
    -- Generate credit note number
    v_credit_note_number := get_next_credit_note_sequence(EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER);
    
    -- Get invoice details if available
    IF v_invoice_id IS NOT NULL THEN
      SELECT * INTO v_invoice_record
      FROM invoices
      WHERE invoice_number = v_invoice_id;
    END IF;
    
    -- Create credit note record with explicit type casting for all UUID fields
    INSERT INTO credit_notes (
      user_id,
      registration_id,
      cancellation_request_id,
      credit_note_number,
      amount,
      status,
      invoice_id,
      invoice_number,
      type
    ) VALUES (
      v_user_id,
      v_request.registration_id,
      v_request_uuid,
      v_credit_note_number,
      v_refund_amount,
      'issued',
      CASE WHEN v_invoice_record.id IS NOT NULL THEN v_invoice_record.id::text ELSE NULL END,
      v_invoice_id,
      'cancellation'
    )
    RETURNING id INTO v_credit_note_id;
    
    -- Update the cancellation request with the credit note info
    UPDATE cancellation_requests cr
    SET 
      status = 'approved',
      admin_notes = p_admin_notes,
      refund_type = p_refund_type,
      credit_note_id = v_credit_note_number
    WHERE cr.id = v_request_uuid;
    
    -- Update the specific registration to cancelled status
    UPDATE registrations
    SET 
      payment_status = 'cancelled',
      cancellation_status = CASE 
        WHEN p_refund_type = 'full' THEN 'cancelled_full_refund'
        WHEN p_refund_type = 'partial' THEN 'cancelled_partial_refund'
        ELSE 'cancelled_no_refund'
      END
    WHERE id = v_request.registration_id;
    
    -- Update session registration count
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
    
    v_result := jsonb_build_object(
      'success', true,
      'credit_note_id', v_credit_note_id,
      'credit_note_number', v_credit_note_number,
      'amount', v_refund_amount,
      'registration_cancelled', v_request.registration_id
    );
  ELSE
    -- No refund, just update statuses
    UPDATE cancellation_requests cr
    SET 
      status = 'approved',
      admin_notes = p_admin_notes,
      refund_type = 'none'
    WHERE cr.id = v_request_uuid;
    
    -- Update the specific registration to cancelled status
    UPDATE registrations
    SET 
      payment_status = 'cancelled',
      cancellation_status = 'cancelled_no_refund'
    WHERE id = v_request.registration_id;
    
    -- Update session registration count
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
    
    v_result := jsonb_build_object(
      'success', true,
      'credit_note_id', NULL,
      'credit_note_number', NULL,
      'amount', 0,
      'registration_cancelled', v_request.registration_id
    );
  END IF;
  
  RETURN v_result;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION process_cancellation_approval(text, text, text) TO authenticated;