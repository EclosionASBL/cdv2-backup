/*
  # Add registration notification column to users table
  
  1. Changes
    - Add has_new_registration_notification column to users table
    - Set default value to false
    - Update existing rows
    
  2. Security
    - No changes to RLS policies needed
*/

-- Add has_new_registration_notification column
ALTER TABLE users
ADD COLUMN IF NOT EXISTS has_new_registration_notification BOOLEAN NOT NULL DEFAULT FALSE;

-- Update existing rows to have default value
UPDATE users
SET has_new_registration_notification = FALSE
WHERE has_new_registration_notification IS NULL;