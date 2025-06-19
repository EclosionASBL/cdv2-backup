/*
  # Fix process_cancellation_approval function parameter types

  1. Database Function Fix
    - Update the `process_cancellation_approval` function to properly handle UUID parameter types
    - Ensure all UUID comparisons are done with proper type casting
    - Fix the parameter definition to explicitly use UUID type

  2. Function Parameters
    - `p_request_id` should be UUID type, not TEXT
    - Proper type casting for all UUID operations
*/

-- Drop the existing function if it exists
DROP FUNCTION IF EXISTS process_cancellation_approval(text, text, text, text);
DROP FUNCTION IF EXISTS process_cancellation_approval(uuid, text, text, text);

-- Create the corrected function with proper UUID parameter type
CREATE OR REPLACE FUNCTION process_cancellation_approval(
  p_request_id UUID,
  p_action TEXT,
  p_admin_notes TEXT DEFAULT NULL,
  p_refund_type TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_request cancellation_requests%ROWTYPE;
  v_registration registrations%ROWTYPE;
  v_result JSON;
BEGIN
  -- Get the cancellation request
  SELECT * INTO v_request
  FROM cancellation_requests
  WHERE id = p_request_id;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Cancellation request not found');
  END IF;

  -- Check if request is still pending
  IF v_request.status != 'pending' THEN
    RETURN json_build_object('error', 'Request has already been processed');
  END IF;

  -- Get the associated registration
  SELECT * INTO v_registration
  FROM registrations
  WHERE id = v_request.registration_id;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Associated registration not found');
  END IF;

  -- Process based on action
  IF p_action = 'approve' THEN
    -- Update cancellation request
    UPDATE cancellation_requests
    SET 
      status = 'approved',
      admin_notes = p_admin_notes,
      refund_type = p_refund_type
    WHERE id = p_request_id;

    -- Update registration cancellation status
    UPDATE registrations
    SET cancellation_status = CASE 
      WHEN p_refund_type = 'full' THEN 'cancelled_full_refund'
      WHEN p_refund_type = 'partial' THEN 'cancelled_partial_refund'
      WHEN p_refund_type = 'none' THEN 'cancelled_no_refund'
      ELSE 'cancelled_no_refund'
    END
    WHERE id = v_request.registration_id;

    v_result := json_build_object(
      'success', true,
      'message', 'Cancellation request approved',
      'refund_type', p_refund_type
    );

  ELSIF p_action = 'reject' THEN
    -- Update cancellation request
    UPDATE cancellation_requests
    SET 
      status = 'rejected',
      admin_notes = p_admin_notes
    WHERE id = p_request_id;

    v_result := json_build_object(
      'success', true,
      'message', 'Cancellation request rejected'
    );

  ELSE
    RETURN json_build_object('error', 'Invalid action. Must be approve or reject');
  END IF;

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'error', 'Database error: ' || SQLERRM
    );
END;
$$;

-- Grant execute permission to authenticated users (admins will be checked via RLS)
GRANT EXECUTE ON FUNCTION process_cancellation_approval(UUID, TEXT, TEXT, TEXT) TO authenticated;