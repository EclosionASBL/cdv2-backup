/*
  # Add intervention consent column to kid_health table
  
  1. Changes
    - Add intervention_consent column to kid_health table
    - Set default value to false
    - Update existing rows
    
  2. Security
    - Maintain existing RLS policies
*/

-- Add intervention_consent column
ALTER TABLE kid_health
ADD COLUMN IF NOT EXISTS intervention_consent BOOLEAN DEFAULT false;

-- Update existing rows to have default value
UPDATE kid_health
SET intervention_consent = false
WHERE intervention_consent IS NULL;