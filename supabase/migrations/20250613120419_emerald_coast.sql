/*
  # Fix admin_notes column ambiguity in process_cancellation_approval function

  1. Database Function Fix
    - Update the `process_cancellation_approval` function to properly qualify column references
    - Ensure `admin_notes` references are explicitly qualified with table names
    - Fix any other potential ambiguous column references

  2. Changes Made
    - Recreate the `process_cancellation_approval` function with proper table qualifications
    - Ensure all column references are unambiguous
*/

-- Drop the existing function first
DROP FUNCTION IF EXISTS process_cancellation_approval(uuid, text, text);

-- Recreate the function with proper column qualifications
CREATE OR REPLACE FUNCTION process_cancellation_approval(
  request_id uuid,
  refund_type text,
  admin_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  request_record cancellation_requests%ROWTYPE;
  registration_record registrations%ROWTYPE;
  credit_note_id uuid;
  credit_note_number text;
  result jsonb;
BEGIN
  -- Get the cancellation request
  SELECT * INTO request_record
  FROM cancellation_requests cr
  WHERE cr.id = request_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cancellation request not found';
  END IF;
  
  -- Get the registration
  SELECT * INTO registration_record
  FROM registrations r
  WHERE r.id = request_record.registration_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Registration not found';
  END IF;
  
  -- Update the cancellation request status and admin notes
  UPDATE cancellation_requests cr
  SET 
    status = 'approved',
    refund_type = process_cancellation_approval.refund_type,
    admin_notes = COALESCE(process_cancellation_approval.admin_notes, cr.admin_notes)
  WHERE cr.id = request_id;
  
  -- Update the registration cancellation status
  UPDATE registrations r
  SET cancellation_status = CASE 
    WHEN process_cancellation_approval.refund_type = 'full' THEN 'cancelled_full_refund'
    WHEN process_cancellation_approval.refund_type = 'partial' THEN 'cancelled_partial_refund'
    WHEN process_cancellation_approval.refund_type = 'none' THEN 'cancelled_no_refund'
    ELSE 'cancelled_no_refund'
  END
  WHERE r.id = request_record.registration_id;
  
  -- Create credit note if refund is requested
  IF process_cancellation_approval.refund_type IN ('full', 'partial') THEN
    -- Generate credit note number
    SELECT generate_credit_note_number() INTO credit_note_number;
    
    -- Create credit note
    INSERT INTO credit_notes (
      user_id,
      registration_id,
      cancellation_request_id,
      credit_note_number,
      amount,
      status
    ) VALUES (
      request_record.user_id,
      request_record.registration_id,
      request_id,
      credit_note_number,
      CASE 
        WHEN process_cancellation_approval.refund_type = 'full' THEN registration_record.amount_paid
        WHEN process_cancellation_approval.refund_type = 'partial' THEN registration_record.amount_paid * 0.5
        ELSE 0
      END,
      'issued'
    ) RETURNING id INTO credit_note_id;
    
    -- Update the cancellation request with credit note info
    UPDATE cancellation_requests cr
    SET 
      credit_note_id = process_cancellation_approval.credit_note_id,
      credit_note_url = NULL -- Will be updated when PDF is generated
    WHERE cr.id = request_id;
  END IF;
  
  -- Build result
  result := jsonb_build_object(
    'success', true,
    'cancellation_request_id', request_id,
    'registration_id', request_record.registration_id,
    'refund_type', process_cancellation_approval.refund_type,
    'credit_note_id', credit_note_id,
    'credit_note_number', credit_note_number
  );
  
  RETURN result;
END;
$$;

-- Create the generate_credit_note_number function if it doesn't exist
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