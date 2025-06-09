/*
  # Add cancellation status to registrations table
  
  1. Changes
    - Add cancellation_status column to registrations table
    - This allows tracking the status of cancellation requests
    - Possible values: 'none', 'requested', 'cancelled_full_refund', 'cancelled_partial_refund', 'cancelled_no_refund'
    
  2. Security
    - No changes to RLS policies needed
*/

-- Add cancellation_status column
ALTER TABLE registrations
ADD COLUMN IF NOT EXISTS cancellation_status TEXT NOT NULL DEFAULT 'none';

-- Add constraint to validate cancellation_status values
ALTER TABLE registrations
ADD CONSTRAINT valid_cancellation_status
CHECK (cancellation_status IN ('none', 'requested', 'cancelled_full_refund', 'cancelled_partial_refund', 'cancelled_no_refund'));

-- Update existing rows to have default value
UPDATE registrations
SET cancellation_status = 'none'
WHERE cancellation_status IS NULL;

-- Update existing cancellation requests to set the registration status
UPDATE registrations r
SET cancellation_status = 'requested'
FROM cancellation_requests cr
WHERE r.id = cr.registration_id
AND cr.status = 'pending';

-- Update existing approved cancellation requests
UPDATE registrations r
SET 
  cancellation_status = CASE 
    WHEN cr.refund_type = 'full' THEN 'cancelled_full_refund'
    WHEN cr.refund_type = 'partial' THEN 'cancelled_partial_refund'
    ELSE 'cancelled_no_refund'
  END
FROM cancellation_requests cr
WHERE r.id = cr.registration_id
AND cr.status = 'approved';