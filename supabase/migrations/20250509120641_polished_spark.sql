/*
  # Remove legacy inclusion fields
  
  1. Changes
    - Drop unused columns from kid_inclusion table:
      - disability_details
      - needs_specialized_staff  
      - previous_participation
    - These fields have been replaced by the new inclusion fields
    
  2. Security
    - No changes to RLS policies needed
*/

ALTER TABLE kid_inclusion
  DROP COLUMN IF EXISTS disability_details,
  DROP COLUMN IF EXISTS needs_specialized_staff,
  DROP COLUMN IF EXISTS previous_participation;