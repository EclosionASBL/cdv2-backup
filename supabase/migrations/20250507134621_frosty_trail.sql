/*
  # Update age columns to support decimals
  
  1. Changes
    - Modify age_min and age_max columns in stages table to use NUMERIC type
    - This allows storing decimal values for ages (e.g., 2.5 years)
    
  2. Security
    - No changes to RLS policies needed
*/

ALTER TABLE stages
ALTER COLUMN age_min TYPE NUMERIC USING age_min::numeric,
ALTER COLUMN age_max TYPE NUMERIC USING age_max::numeric;