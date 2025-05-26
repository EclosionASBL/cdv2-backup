/*
  # Add autoriseSortieSeul column to kids table

  1. Changes
    - Add `autoriseSortieSeul` column to `kids` table with boolean type and default value of false
    - This column tracks whether a child is authorized to leave activities alone

  2. Security
    - No changes to RLS policies needed as the column will be protected by existing policies
*/

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'kids' 
    AND column_name = 'autoriseSortieSeul'
  ) THEN
    ALTER TABLE kids 
    ADD COLUMN "autoriseSortieSeul" boolean DEFAULT false;
  END IF;
END $$;