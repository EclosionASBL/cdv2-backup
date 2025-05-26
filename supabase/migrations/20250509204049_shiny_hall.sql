/*
  # Fix medication details constraint

  1. Changes
    - Drop existing medication_details_required constraint
    - Add new constraint that only requires medication_details when medication_autonomy is true
    
  2. Security
    - Maintain existing RLS policies
*/

-- Drop the existing constraint
ALTER TABLE kid_health
DROP CONSTRAINT IF EXISTS medication_details_required;

-- Add new constraint that requires medication_details only when medication_autonomy is true
ALTER TABLE kid_health
ADD CONSTRAINT medication_details_required
CHECK (
  (medication_autonomy = false)
  OR
  (medication_autonomy = true AND medication_details IS NOT NULL AND medication_details <> '')
);