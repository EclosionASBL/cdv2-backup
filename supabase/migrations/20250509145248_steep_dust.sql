/*
  # Add medication form tracking
  
  1. Changes
    - Add medication_form_sent column to kid_health table
    - Handle existing data before adding constraint
    - Add constraint for medication details validation
    
  2. Security
    - No changes to RLS policies needed
*/

-- Add medication form sent tracking
ALTER TABLE kid_health
ADD COLUMN IF NOT EXISTS medication_form_sent BOOLEAN NOT NULL DEFAULT false;

-- Update existing rows to ensure they meet the constraint
UPDATE kid_health
SET medication_details = NULL
WHERE medication_details = '';

-- Add constraint to ensure medication details are properly filled when provided
ALTER TABLE kid_health
ADD CONSTRAINT medication_details_required 
CHECK (
  medication_details IS NULL OR 
  (medication_details IS NOT NULL AND medication_details != '')
);