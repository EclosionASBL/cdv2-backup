/*
  # Fix RLS policies for authorized persons table
  
  1. Changes
    - Drop existing policies that may be conflicting
    - Create new policies with proper permissions for all CRUD operations
    - Ensure RLS is enabled
    
  2. Security
    - Users can only access their own data
    - Proper authentication checks on all operations
*/

-- Drop existing policies
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
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their authorized persons"
ON authorized_persons FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their authorized persons"
ON authorized_persons FOR DELETE
TO authenticated
USING (auth.uid() = user_id);