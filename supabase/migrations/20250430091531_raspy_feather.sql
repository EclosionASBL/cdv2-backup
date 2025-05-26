/*
  # Fix RLS policies for authorized persons table
  
  1. Changes
    - Drop all existing policies
    - Create new policies with correct permissions
    - Add anon role to insert policy to allow new users
    
  2. Security
    - Enable RLS
    - Ensure proper user authentication checks
*/

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can view their authorized persons" ON authorized_persons;
DROP POLICY IF EXISTS "Users can insert their authorized persons" ON authorized_persons;
DROP POLICY IF EXISTS "Users can update their authorized persons" ON authorized_persons;
DROP POLICY IF EXISTS "Users can delete their authorized persons" ON authorized_persons;
DROP POLICY IF EXISTS "Allow authorized persons creation" ON authorized_persons;

-- Ensure RLS is enabled
ALTER TABLE authorized_persons ENABLE ROW LEVEL SECURITY;

-- Create new policies with proper permissions
CREATE POLICY "Users can view their authorized persons"
ON authorized_persons FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their authorized persons"
ON authorized_persons FOR INSERT
TO authenticated, anon
WITH CHECK (
  CASE 
    WHEN auth.uid() IS NULL THEN true
    ELSE auth.uid() = user_id
  END
);

CREATE POLICY "Users can update their authorized persons"
ON authorized_persons FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their authorized persons"
ON authorized_persons FOR DELETE
TO authenticated
USING (auth.uid() = user_id);