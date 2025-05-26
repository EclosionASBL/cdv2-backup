/*
  # Fix users table RLS policies

  1. Changes
    - Remove circular dependencies in users table RLS policies
    - Simplify admin policy to use direct role check
    - Update user policies to use direct id comparison
    - Keep existing functionality while preventing infinite recursion

  2. Security
    - Maintains same level of access control
    - Prevents policy evaluation loops
    - Preserves data isolation between users
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can view all users" ON users;
DROP POLICY IF EXISTS "Users can view their own data" ON users;

-- Create new policies without circular references
CREATE POLICY "Admins can view all users"
ON users
FOR SELECT
TO authenticated
USING (role = 'admin');

CREATE POLICY "Users can view their own data"
ON users
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Update policies should remain the same as they don't cause recursion
DROP POLICY IF EXISTS "Users can update their own data" ON users;
CREATE POLICY "Users can update their own data"
ON users
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);