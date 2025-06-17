/*
  # Fix process_cancellation_approval function type casting

  1. Function Updates
    - Drop and recreate the process_cancellation_approval function with proper return type
    - Ensure the function returns the correct structure that matches expectations
    - Fix type casting issues by explicitly defining return columns

  2. Changes
    - Update function signature to return TABLE with explicit column definitions
    - Ensure all returned values match the expected types
    - Handle the cancellation approval process correctly
*/

-- Drop the existing function if it exists
DROP FUNCTION IF EXISTS process_cancellation_approval(uuid);

-- Create the corrected function with proper return type
CREATE OR REPLACE FUNCTION process_cancellation_approval(request_id uuid)
RETURNS TABLE (
  registration_id uuid,
  credit_note_id uuid,
  refund_amount numeric,
  status text
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  cancellation_rec record;
  registration_rec record;
  credit_note_rec record;
  refund_amount_calc numeric;
BEGIN
  -- Get the cancellation request
  SELECT cr.*, r.amount_paid, r.user_id, r.kid_id, r.activity_id
  INTO cancellation_rec
  FROM cancellation_requests cr
  JOIN registrations r ON cr.registration_id = r.id
  WHERE cr.id = request_id AND cr.status = 'pending';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cancellation request not found or not pending';
  END IF;
  
  -- Get the registration details
  SELECT * INTO registration_rec
  FROM registrations r
  WHERE r.id = cancellation_rec.registration_id;
  
  -- Calculate refund amount based on refund type
  CASE cancellation_rec.refund_type
    WHEN 'full' THEN
      refund_amount_calc := registration_rec.amount_paid;
    WHEN 'partial' THEN
      refund_amount_calc := registration_rec.amount_paid * 0.5; -- 50% refund for partial
    WHEN 'none' THEN
      refund_amount_calc := 0;
    ELSE
      refund_amount_calc := 0;
  END CASE;
  
  -- Update the cancellation request status
  UPDATE cancellation_requests 
  SET status = 'approved'
  WHERE id = request_id;
  
  -- Update the registration cancellation status
  UPDATE registrations 
  SET cancellation_status = CASE 
    WHEN cancellation_rec.refund_type = 'full' THEN 'cancelled_full_refund'
    WHEN cancellation_rec.refund_type = 'partial' THEN 'cancelled_partial_refund'
    WHEN cancellation_rec.refund_type = 'none' THEN 'cancelled_no_refund'
    ELSE 'cancelled_no_refund'
  END,
  payment_status = CASE 
    WHEN cancellation_rec.refund_type IN ('full', 'partial') THEN 'refunded'::payment_status_enum
    ELSE payment_status
  END
  WHERE id = cancellation_rec.registration_id;
  
  -- Create credit note if there's a refund amount
  IF refund_amount_calc > 0 THEN
    -- Generate credit note number
    DECLARE
      credit_note_number text;
      current_year int := EXTRACT(year FROM CURRENT_DATE);
      next_sequence int;
    BEGIN
      -- Get or create sequence for current year
      INSERT INTO credit_note_sequences (year, last_sequence)
      VALUES (current_year, 0)
      ON CONFLICT (year) DO NOTHING;
      
      -- Get next sequence number
      UPDATE credit_note_sequences 
      SET last_sequence = last_sequence + 1
      WHERE year = current_year
      RETURNING last_sequence INTO next_sequence;
      
      -- Format credit note number
      credit_note_number := 'CN' || current_year || '-' || LPAD(next_sequence::text, 4, '0');
      
      -- Create the credit note
      INSERT INTO credit_notes (
        user_id,
        registration_id,
        cancellation_request_id,
        credit_note_number,
        amount,
        status
      ) VALUES (
        cancellation_rec.user_id,
        cancellation_rec.registration_id,
        request_id,
        credit_note_number,
        refund_amount_calc,
        'issued'
      ) RETURNING id INTO credit_note_rec.id;
      
      -- Update cancellation request with credit note info
      UPDATE cancellation_requests 
      SET credit_note_id = credit_note_rec.id::text
      WHERE id = request_id;
    END;
  END IF;
  
  -- Return the results
  RETURN QUERY SELECT 
    cancellation_rec.registration_id,
    credit_note_rec.id,
    refund_amount_calc,
    'approved'::text;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION process_cancellation_approval(uuid) TO authenticated;