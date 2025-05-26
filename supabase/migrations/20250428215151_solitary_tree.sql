/*
  # Fix autoriseSortieSeul column type

  1. Changes
    - Ensure autoriseSortieSeul column exists with correct type and default
    - Update any existing NULL values to false
    
  2. Security
    - Maintains existing RLS policies
*/

-- Update any NULL values to false
UPDATE kids 
SET autoriseSortieSeul = false 
WHERE autoriseSortieSeul IS NULL;

-- Ensure the column has the correct type and default
ALTER TABLE kids 
ALTER COLUMN autoriseSortieSeul SET DEFAULT false,
ALTER COLUMN autoriseSortieSeul SET NOT NULL;