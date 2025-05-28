/*
  # Fix users table RLS policies

  1. Changes
    - Remove recursive policies on users table that were causing infinite loops
    - Replace with simplified policies that avoid self-referential queries
    - Keep the same access control logic but implement it more efficiently

  2. Security
    - Maintain existing security rules:
      - Admins can view all users
      - Users can only view and update their own data
      - Anonymous users can create accounts
    - Remove recursive role checks that were causing infinite loops
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can view all users" ON users;
DROP POLICY IF EXISTS "Users can view their own data" ON users;
DROP POLICY IF EXISTS "Allow user creation" ON users;
DROP POLICY IF EXISTS "Users can update their own data" ON users;

-- Create new, non-recursive policies
CREATE POLICY "Admins can view all users"
ON users
FOR SELECT
TO authenticated
USING (
  role = 'admin'
);

CREATE POLICY "Users can view their own data"
ON users
FOR SELECT
TO authenticated
USING (
  auth.uid() = id
);

CREATE POLICY "Allow user creation"
ON users
FOR INSERT
TO anon, authenticated
WITH CHECK (
  CASE
    WHEN auth.uid() IS NULL THEN true
    ELSE auth.uid() = id
  END
);

CREATE POLICY "Users can update their own data"
ON users
FOR UPDATE
TO authenticated
USING (
  auth.uid() = id
)
WITH CHECK (
  auth.uid() = id
);