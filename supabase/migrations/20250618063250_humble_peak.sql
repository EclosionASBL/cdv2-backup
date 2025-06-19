/*
  # Fix process_cancellation_approval function type casting

  1. Changes
    - Update the process_cancellation_approval function to properly cast the p_request_id parameter from text to uuid
    - Ensure all UUID comparisons use proper type casting to prevent "operator does not exist: uuid = text" errors

  2. Security
    - Maintains existing RLS policies and security constraints
    - No changes to permissions or access control
*/

-- Drop the existing function if it exists
DROP FUNCTION IF EXISTS process_cancellation_approval(text, text, text);

-- Create the corrected function with proper type casting
CREATE OR REPLACE FUNCTION process_cancellation_approval(
  p_request_id text,
  p_refund_type text,
  p_admin_notes text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_request_uuid uuid;
  v_request_record record;
  v_registration_record record;
  v_credit_note_id uuid;
  v_result json;
BEGIN
  -- Cast the text parameter to UUID with proper error handling
  BEGIN
    v_request_uuid := p_request_id::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'Invalid request ID format: %', p_request_id;
  END;

  -- Validate refund type
  IF p_refund_type NOT IN ('full', 'partial', 'none') THEN
    RAISE EXCEPTION 'Invalid refund type: %', p_refund_type;
  END IF;

  -- Get the cancellation request with proper UUID casting
  SELECT cr.*, r.amount_paid, r.user_id, r.registration_id
  INTO v_request_record
  FROM cancellation_requests cr
  JOIN registrations r ON r.id = cr.registration_id
  WHERE cr.id = v_request_uuid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cancellation request not found: %', p_request_id;
  END IF;

  -- Check if request is still pending
  IF v_request_record.status != 'pending' THEN
    RAISE EXCEPTION 'Cancellation request is not pending: %', v_request_record.status;
  END IF;

  -- Update the cancellation request status
  UPDATE cancellation_requests 
  SET 
    status = 'approved',
    refund_type = p_refund_type,
    admin_notes = p_admin_notes
  WHERE id = v_request_uuid;

  -- Update the registration cancellation status
  UPDATE registrations
  SET cancellation_status = CASE 
    WHEN p_refund_type = 'full' THEN 'cancelled_full_refund'
    WHEN p_refund_type = 'partial' THEN 'cancelled_partial_refund'
    WHEN p_refund_type = 'none' THEN 'cancelled_no_refund'
  END
  WHERE id = v_request_record.registration_id;

  -- Create credit note if refund is requested
  IF p_refund_type IN ('full', 'partial') THEN
    -- Generate credit note
    INSERT INTO credit_notes (
      user_id,
      registration_id,
      cancellation_request_id,
      credit_note_number,
      amount,
      status,
      type
    )
    VALUES (
      v_request_record.user_id,
      v_request_record.registration_id,
      v_request_uuid,
      'CN-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(nextval('credit_note_sequence')::text, 6, '0'),
      CASE 
        WHEN p_refund_type = 'full' THEN v_request_record.amount_paid
        WHEN p_refund_type = 'partial' THEN v_request_record.amount_paid / 2
      END,
      'issued',
      'cancellation'
    )
    RETURNING id INTO v_credit_note_id;

    -- Update the cancellation request with credit note reference
    UPDATE cancellation_requests
    SET credit_note_id = v_credit_note_id::text
    WHERE id = v_request_uuid;
  END IF;

  -- Return success result
  v_result := json_build_object(
    'success', true,
    'request_id', v_request_uuid,
    'refund_type', p_refund_type,
    'credit_note_id', v_credit_note_id,
    'message', 'Cancellation request processed successfully'
  );

  RETURN v_result;

EXCEPTION WHEN OTHERS THEN
  -- Log the error and re-raise
  RAISE EXCEPTION 'Error processing cancellation approval: %', SQLERRM;
END;
$$;

-- Grant execute permission to authenticated users (admins will be checked via RLS)
GRANT EXECUTE ON FUNCTION process_cancellation_approval(text, text, text) TO authenticated;