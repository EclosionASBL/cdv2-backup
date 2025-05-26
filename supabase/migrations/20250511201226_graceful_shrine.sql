/*
  # Add photo consent column to kids table
  
  1. Changes
    - Add photo_consent column to track parental consent for photos
    
  2. Security
    - Maintain existing RLS policies
*/

ALTER TABLE kids
ADD COLUMN IF NOT EXISTS photo_consent BOOLEAN NOT NULL DEFAULT FALSE;