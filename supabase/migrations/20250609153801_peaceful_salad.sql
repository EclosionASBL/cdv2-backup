/*
  # Fix foreign key relationship between invoices and users tables
  
  1. Changes
    - Add a direct foreign key from invoices.user_id to public.users.id
    - This enables PostgREST to correctly identify and follow the relationship for embedding
    
  2. Security
    - Maintains existing RLS policies
*/

-- First, check if the foreign key already exists
DO $$ 
BEGIN
  -- Check if there's a foreign key constraint from invoices.user_id to auth.users
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_name = 'invoices'
    AND ccu.table_name = 'users' 
    AND ccu.table_schema = 'auth'
    AND ccu.column_name = 'id'
  ) THEN
    -- Drop the existing foreign key to auth.users
    EXECUTE (
      SELECT 'ALTER TABLE invoices DROP CONSTRAINT ' || tc.constraint_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY' 
      AND tc.table_name = 'invoices'
      AND ccu.table_name = 'users' 
      AND ccu.table_schema = 'auth'
      AND ccu.column_name = 'id'
      LIMIT 1
    );
  END IF;
END $$;

-- Add the new foreign key constraint to public.users
ALTER TABLE invoices
ADD CONSTRAINT invoices_user_id_fkey
FOREIGN KEY (user_id)
REFERENCES public.users(id);

-- Create an index on user_id for better performance
CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON invoices(user_id);