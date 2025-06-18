/*
  # Fix Credit Note Sequence Function

  1. Database Functions
    - Fix the get_next_credit_note_sequence function to properly handle UUID columns
    - Ensure credit note number generation works correctly
    - Remove any invalid max(uuid) operations

  2. Changes
    - Update the function to use proper sequence generation
    - Fix any UUID-related aggregation issues
*/

-- Drop and recreate the get_next_credit_note_sequence function
DROP FUNCTION IF EXISTS get_next_credit_note_sequence();

CREATE OR REPLACE FUNCTION get_next_credit_note_sequence()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_year INTEGER;
    next_sequence INTEGER;
    credit_note_number TEXT;
BEGIN
    -- Get current year
    current_year := EXTRACT(YEAR FROM CURRENT_DATE);
    
    -- Get or create sequence for current year
    INSERT INTO credit_note_sequences (year, last_sequence)
    VALUES (current_year, 0)
    ON CONFLICT (year) DO NOTHING;
    
    -- Get and increment the sequence
    UPDATE credit_note_sequences 
    SET last_sequence = last_sequence + 1
    WHERE year = current_year
    RETURNING last_sequence INTO next_sequence;
    
    -- Format credit note number as YYYY-NNNN
    credit_note_number := current_year || '-' || LPAD(next_sequence::TEXT, 4, '0');
    
    RETURN credit_note_number;
END;
$$;

-- Drop and recreate the process_cancellation_approval function
DROP FUNCTION IF EXISTS process_cancellation_approval(UUID, TEXT, TEXT);

CREATE OR REPLACE FUNCTION process_cancellation_approval(
    request_id UUID,
    refund_type TEXT,
    admin_notes TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    request_record RECORD;
    credit_note_number TEXT;
    credit_note_id UUID;
    result JSON;
BEGIN
    -- Get the cancellation request details
    SELECT cr.*, r.amount_paid, r.user_id, r.registration_id
    INTO request_record
    FROM cancellation_requests cr
    JOIN registrations r ON cr.registration_id = r.id
    WHERE cr.id = request_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Cancellation request not found';
    END IF;
    
    IF request_record.status != 'pending' THEN
        RAISE EXCEPTION 'Cancellation request is not pending';
    END IF;
    
    -- Update the cancellation request status
    UPDATE cancellation_requests
    SET 
        status = 'approved',
        refund_type = process_cancellation_approval.refund_type,
        admin_notes = process_cancellation_approval.admin_notes
    WHERE id = request_id;
    
    -- Update the registration cancellation status
    UPDATE registrations
    SET cancellation_status = CASE 
        WHEN process_cancellation_approval.refund_type = 'full' THEN 'cancelled_full_refund'
        WHEN process_cancellation_approval.refund_type = 'partial' THEN 'cancelled_partial_refund'
        ELSE 'cancelled_no_refund'
    END
    WHERE id = request_record.registration_id;
    
    -- Create credit note if refund is requested
    IF process_cancellation_approval.refund_type IN ('full', 'partial') THEN
        -- Generate credit note number
        credit_note_number := get_next_credit_note_sequence();
        
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
            request_record.user_id,
            request_record.registration_id,
            request_id,
            credit_note_number,
            CASE 
                WHEN process_cancellation_approval.refund_type = 'full' THEN request_record.amount_paid
                ELSE request_record.amount_paid * 0.5 -- Default to 50% for partial refund
            END,
            'issued',
            'cancellation'
        ) RETURNING id INTO credit_note_id;
        
        -- Update cancellation request with credit note info
        UPDATE cancellation_requests
        SET credit_note_id = credit_note_number
        WHERE id = request_id;
    END IF;
    
    -- Return result
    result := json_build_object(
        'success', true,
        'credit_note_number', credit_note_number,
        'credit_note_id', credit_note_id
    );
    
    RETURN result;
END;
$$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION get_next_credit_note_sequence() TO authenticated;
GRANT EXECUTE ON FUNCTION process_cancellation_approval(UUID, TEXT, TEXT) TO authenticated;