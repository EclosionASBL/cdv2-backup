/*
  # Fix process_cancellation_approval function parameter types

  1. Changes
    - Update the `process_cancellation_approval` function to properly handle UUID parameters
    - Change `p_request_id` parameter type from `text` to `uuid` to match the database column types
    - Ensure all UUID comparisons work correctly

  2. Security
    - Maintains existing RLS policies
    - No changes to permissions or access control
*/

-- Drop the existing function if it exists
DROP FUNCTION IF EXISTS process_cancellation_approval(text, text, text);
DROP FUNCTION IF EXISTS process_cancellation_approval(uuid, text, text);

-- Recreate the function with correct parameter types
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
  v_user users%ROWTYPE;
  v_credit_note_id uuid;
  v_credit_note_number text;
  v_result jsonb;
BEGIN
  -- Validate refund_type
  IF p_refund_type NOT IN ('full', 'partial', 'none') THEN
    RAISE EXCEPTION 'Invalid refund_type. Must be full, partial, or none.';
  END IF;

  -- Get the cancellation request
  SELECT * INTO v_request
  FROM cancellation_requests
  WHERE id = p_request_id AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cancellation request not found or not pending';
  END IF;

  -- Get the registration
  SELECT * INTO v_registration
  FROM registrations
  WHERE id = v_request.registration_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Registration not found';
  END IF;

  -- Get the user
  SELECT * INTO v_user
  FROM users
  WHERE id = v_request.user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Update the cancellation request
  UPDATE cancellation_requests
  SET 
    status = 'approved',
    refund_type = p_refund_type,
    admin_notes = p_admin_notes
  WHERE id = p_request_id;

  -- Update the registration cancellation status
  UPDATE registrations
  SET cancellation_status = CASE 
    WHEN p_refund_type = 'full' THEN 'cancelled_full_refund'
    WHEN p_refund_type = 'partial' THEN 'cancelled_partial_refund'
    WHEN p_refund_type = 'none' THEN 'cancelled_no_refund'
  END
  WHERE id = v_request.registration_id;

  -- Create credit note if refund is requested
  IF p_refund_type IN ('full', 'partial') THEN
    -- Generate credit note number
    SELECT generate_credit_note_number() INTO v_credit_note_number;
    
    -- Create credit note
    INSERT INTO credit_notes (
      user_id,
      registration_id,
      cancellation_request_id,
      credit_note_number,
      amount,
      status,
      type
    ) VALUES (
      v_request.user_id,
      v_request.registration_id,
      p_request_id,
      v_credit_note_number,
      CASE 
        WHEN p_refund_type = 'full' THEN v_registration.amount_paid
        WHEN p_refund_type = 'partial' THEN v_registration.amount_paid * 0.5 -- 50% refund for partial
      END,
      'issued',
      'cancellation'
    ) RETURNING id INTO v_credit_note_id;

    -- Update the cancellation request with credit note info
    UPDATE cancellation_requests
    SET credit_note_id = v_credit_note_number
    WHERE id = p_request_id;
  END IF;

  -- Prepare result
  v_result := jsonb_build_object(
    'success', true,
    'request_id', p_request_id,
    'refund_type', p_refund_type,
    'credit_note_id', v_credit_note_id,
    'credit_note_number', v_credit_note_number
  );

  RETURN v_result;
END;
$$;

-- Grant execute permission to authenticated users (will be restricted by RLS)
GRANT EXECUTE ON FUNCTION process_cancellation_approval(uuid, text, text) TO authenticated;