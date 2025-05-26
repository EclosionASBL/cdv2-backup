/*
  # Add visible_from column to sessions table
  
  1. Changes
    - Add visible_from column to sessions table
    - This allows controlling when sessions become visible to parents
    
  2. Security
    - No changes to RLS policies needed
*/

ALTER TABLE sessions
ADD COLUMN IF NOT EXISTS visible_from TIMESTAMPTZ;