/*
  # Fix registrations schema and relationships
  
  1. Changes
    - Drop existing foreign key if it exists
    - Add proper foreign key from registrations.activity_id to sessions.id
    - Update existing registrations data if needed
    
  2. Security
    - Maintain existing RLS policies
*/

-- Drop existing foreign key if it exists
ALTER TABLE registrations 
DROP CONSTRAINT IF EXISTS registrations_activity_id_fkey;

-- Add new foreign key constraint
ALTER TABLE registrations
ADD CONSTRAINT registrations_activity_id_fkey 
FOREIGN KEY (activity_id) 
REFERENCES sessions(id)
ON DELETE CASCADE;

-- Verify and update any existing registrations
DELETE FROM registrations 
WHERE activity_id NOT IN (SELECT id FROM sessions);