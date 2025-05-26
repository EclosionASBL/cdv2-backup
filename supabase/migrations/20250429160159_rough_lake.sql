/*
  # Add address and school fields to kids table
  
  1. Changes
    - Add address-related columns to kids table
    - Add school column
    
  2. Security
    - Maintains existing RLS policies
*/

DO $$ 
BEGIN
  -- Add address fields if they don't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'kids' AND column_name = 'adresse'
  ) THEN
    ALTER TABLE kids ADD COLUMN adresse text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'kids' AND column_name = 'cpostal'
  ) THEN
    ALTER TABLE kids ADD COLUMN cpostal text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'kids' AND column_name = 'localite'
  ) THEN
    ALTER TABLE kids ADD COLUMN localite text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'kids' AND column_name = 'ecole'
  ) THEN
    ALTER TABLE kids ADD COLUMN ecole text;
  END IF;
END $$;