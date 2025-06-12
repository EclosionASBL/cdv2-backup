/*
  # Make cancellation_request_id nullable in credit_notes table
  
  1. Changes
    - Modify the credit_notes table to make cancellation_request_id nullable
    - This allows creating a single credit note for multiple registrations
    - The credit note can be linked to the invoice rather than individual cancellation requests
    
  2. Security
    - No changes to RLS policies needed
*/

-- Alter the credit_notes table to make cancellation_request_id nullable
ALTER TABLE credit_notes
  ALTER COLUMN cancellation_request_id DROP NOT NULL;

-- Add comment to explain the change
COMMENT ON COLUMN credit_notes.cancellation_request_id IS 'Optional link to a specific cancellation request. Can be NULL for credit notes covering multiple registrations.';