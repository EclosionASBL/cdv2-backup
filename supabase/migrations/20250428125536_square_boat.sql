/*
  # Add additional fields to users table
  
  1. Changes
    - Add newsletter subscription field
    - Add secondary phone number field
    - Add profile photo URL field
    
  2. Security
    - Maintain existing RLS policies
*/

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS newsletter BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS telephone2 TEXT,
ADD COLUMN IF NOT EXISTS avatar_url TEXT;