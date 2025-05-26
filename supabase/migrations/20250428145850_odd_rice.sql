/*
  # Fix RLS policy for users table
  
  1. Changes
    - Remove existing policy for user insertion
    - Create new policy that allows both authenticated users and the trigger function
    
  2. Security
    - Allow authenticated users to insert their own data
    - Allow the handle_new_user trigger to create initial user records
*/

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Users can insert their own data" ON users;

-- Create new policy that allows both authenticated users and the trigger
CREATE POLICY "Allow user creation"
ON users FOR INSERT
TO authenticated, anon
WITH CHECK (
  -- Allow authenticated users to insert their own data
  (auth.uid() = id) OR
  -- Allow the trigger to insert data when no auth context exists
  (auth.uid() IS NULL)
);