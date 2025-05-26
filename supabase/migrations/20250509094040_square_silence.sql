/*
  # Update kid_inclusion table with new fields
  
  1. Changes
    - Rename has_disability to has_needs
    - Add new columns for detailed inclusion information
    - Maintain existing data
    
  2. Security
    - No changes to RLS policies needed
*/

-- Rename existing column
ALTER TABLE kid_inclusion 
  RENAME COLUMN has_disability TO has_needs;

-- Add new columns
ALTER TABLE kid_inclusion
  ADD COLUMN situation_details TEXT,
  ADD COLUMN impact_details TEXT,
  ADD COLUMN needs_dedicated_staff TEXT,
  ADD COLUMN staff_details TEXT,
  ADD COLUMN strategies TEXT,
  ADD COLUMN assistive_devices TEXT,
  ADD COLUMN stress_signals TEXT,
  ADD COLUMN strengths TEXT,
  ADD COLUMN previous_experience TEXT;

-- Update existing rows to have default values
UPDATE kid_inclusion
SET has_needs = COALESCE(has_needs, false);