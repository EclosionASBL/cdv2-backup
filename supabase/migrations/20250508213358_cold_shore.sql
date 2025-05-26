/*
  # Add pickup_people_ids to kid_departure table
  
  1. Changes
    - Add pickup_people_ids column to store authorized person IDs
    - Keep existing pickup_people JSONB for backward compatibility
    
  2. Security
    - No changes to RLS policies needed
*/

ALTER TABLE kid_departure
ADD COLUMN IF NOT EXISTS pickup_people_ids UUID[] DEFAULT '{}';