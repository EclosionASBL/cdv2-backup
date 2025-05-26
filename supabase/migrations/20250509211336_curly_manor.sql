/*
  # Fix medication details constraint and add medication column

  1. Changes
    - Drop existing medication_details_required constraint
    - Add new medication boolean column to kid_health table
    - Add new constraint that only requires medication_details when medication is true and medication_autonomy is true
    
  2. Security
    - Maintain existing RLS policies
*/

-- Drop the existing constraint
ALTER TABLE kid_health
DROP CONSTRAINT IF EXISTS medication_details_required;

-- Add the medication column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'kid_health' AND column_name = 'medication'
  ) THEN
    ALTER TABLE kid_health ADD COLUMN medication BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- Add new constraint that requires medication_details only when medication is true and medication_autonomy is true
ALTER TABLE kid_health
ADD CONSTRAINT medication_details_required
CHECK (
  (medication = false)
  OR
  (medication = true AND medication_autonomy = false)
  OR
  (medication = true AND medication_autonomy = true AND medication_details IS NOT NULL AND medication_details <> '')
);