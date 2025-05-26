/*
  # Add past_medical field to kid_health table
  
  1. Changes
    - Add past_medical column to kid_health table
    
  2. Security
    - No changes to RLS policies needed
*/

ALTER TABLE kid_health 
ADD COLUMN IF NOT EXISTS past_medical TEXT;