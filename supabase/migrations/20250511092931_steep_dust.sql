/*
  # Add swimming level and photo consent fields
  
  1. Changes
    - Add swim_level column to kids table
    - Add photo_consent column to kids table
    
  2. Security
    - Maintain existing RLS policies
*/

-- Add swim_level column if it doesn't exist
ALTER TABLE kids
ADD COLUMN IF NOT EXISTS swim_level text;

-- Add photo_consent column if it doesn't exist
ALTER TABLE kids
ADD COLUMN IF NOT EXISTS photo_consent boolean NOT NULL DEFAULT false;