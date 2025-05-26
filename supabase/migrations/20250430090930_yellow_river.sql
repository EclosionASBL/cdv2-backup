/*
  # Fix RLS policies for authorized persons table
  
  1. Changes
    - Drop and recreate RLS policies with correct permissions
    - Ensure authenticated users can properly insert records
    
  2. Security
    - Maintain data access security
    - Only allow users to access their own data
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can insert their authorized persons" ON authorized_persons;
DROP POLICY IF EXISTS "Allow authorized persons creation" ON authorized_persons;

-- Create new insert policy
CREATE POLICY "Users can insert their authorized persons"
ON authorized_persons FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
);

-- Ensure RLS is enabled
ALTER TABLE authorized_persons ENABLE ROW LEVEL SECURITY;