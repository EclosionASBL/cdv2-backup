/*
  # Fix infinite recursion in users table policies

  1. New Functions
    - `is_admin(uuid)`: A security definer function to safely check if a user is an admin
  
  2. Security
    - Drops and recreates all users table policies to avoid recursion
    - Grants execute permission on the helper function to authenticated users
*/

-- Create a helper function to check admin status without triggering RLS
CREATE OR REPLACE FUNCTION is_admin(uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER AS $$
  SELECT role = 'admin' FROM public.users WHERE id = uid;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION is_admin(uuid) TO authenticated;

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can view all users" ON users;
DROP POLICY IF EXISTS "Users can view their own data" ON users;
DROP POLICY IF EXISTS "Allow user creation" ON users;
DROP POLICY IF EXISTS "Users can update their own data" ON users;

-- Create new policies using the helper function
CREATE POLICY "Admins can view all users"
ON users
FOR SELECT
TO authenticated
USING (
  is_admin(auth.uid()) OR auth.uid() = id
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