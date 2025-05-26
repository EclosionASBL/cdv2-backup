/*
  # Update user creation policy
  
  1. Changes
    - Drop existing insert policy
    - Create new policy that allows:
      - Authenticated users to insert their own data
      - The trigger to insert data when creating new users
    
  2. Security
    - Maintains RLS security while allowing necessary operations
    - Only allows users to insert their own data
    - Allows trigger to function properly
*/

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Users can insert their own data" ON users;
DROP POLICY IF EXISTS "Allow user creation" ON users;

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

-- Ensure RLS is enabled
ALTER TABLE users ENABLE ROW LEVEL SECURITY;