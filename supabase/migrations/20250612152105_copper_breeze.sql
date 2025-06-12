/*
  # Fix Cancellation Process and Credit Note Generation
  
  1. Changes
    - Make cancellation_request_id nullable in credit_notes table
    - Update process-cancellation-approval function to:
      - Properly handle multiple registrations
      - Update all registrations to cancelled status
      - Update invoice status to cancelled
      - Create a single credit note for the full amount
    
  2. Security
    - Maintain existing RLS policies
*/

-- Make cancellation_request_id nullable in credit_notes table
ALTER TABLE credit_notes
ALTER COLUMN cancellation_request_id DROP NOT NULL;

-- Add comment to credit_notes.cancellation_request_id
COMMENT ON COLUMN credit_notes.cancellation_request_id IS 'Optional link to a specific cancellation request. Can be NULL for credit notes covering multiple registrations.';

-- Create or replace the function to handle cancellation approval
CREATE OR REPLACE FUNCTION process_cancellation_approval(
  request_id UUID,
  refund_type TEXT,
  admin_notes TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_request RECORD;
  v_registration RECORD;
  v_invoice_id TEXT;
  v_invoice_record RECORD;
  v_total_amount NUMERIC := 0;
  v_credit_note_id UUID;
  v_credit_note_number TEXT;
  v_credit_note_url TEXT;
  v_user_id UUID;
  v_registration_ids UUID[] := ARRAY[]::UUID[];
  v_result JSONB;
BEGIN
  -- Get the cancellation request
  SELECT * INTO v_request
  FROM cancellation_requests
  WHERE id = request_id;
  
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
  IF refund_type = 'partial' THEN
    v_total_amount := v_total_amount * 0.5; -- 50% refund
  ELSIF refund_type = 'none' THEN
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
      v_invoice_record.id,
      v_invoice_id
    )
    RETURNING id INTO v_credit_note_id;
    
    -- Update the cancellation request with the credit note info
    UPDATE cancellation_requests
    SET 
      status = 'approved',
      admin_notes = admin_notes,
      refund_type = refund_type,
      credit_note_id = v_credit_note_number
    WHERE id = request_id;
    
    -- Update all registrations in the invoice to cancelled status
    UPDATE registrations
    SET 
      payment_status = 'cancelled',
      cancellation_status = CASE 
        WHEN refund_type = 'full' THEN 'cancelled_full_refund'
        WHEN refund_type = 'partial' THEN 'cancelled_partial_refund'
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
      PERFORM update_session_registration_count(v_registration);
    END LOOP;
    
    -- Generate PDF for the credit note
    -- This would typically call an external function or service
    -- For now, we'll just return the credit note ID
    
    v_result := jsonb_build_object(
      'success', true,
      'credit_note_id', v_credit_note_id,
      'credit_note_number', v_credit_note_number,
      'amount', v_total_amount,
      'registrations_cancelled', v_registration_ids
    );
  ELSE
    -- No refund, just update statuses
    UPDATE cancellation_requests
    SET 
      status = 'approved',
      admin_notes = admin_notes,
      refund_type = 'none'
    WHERE id = request_id;
    
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
      PERFORM update_session_registration_count(v_registration);
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

-- Create a helper function to update session registration count
CREATE OR REPLACE FUNCTION update_session_registration_count(reg registrations)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Count active registrations for this activity
  SELECT COUNT(*) INTO v_count
  FROM registrations
  WHERE 
    activity_id = reg.activity_id
    AND payment_status IN ('paid', 'pending');

  -- Update the sessions table with the new count
  UPDATE sessions
  SET current_registrations = v_count
  WHERE id = reg.activity_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION process_cancellation_approval(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION update_session_registration_count(registrations) TO authenticated;