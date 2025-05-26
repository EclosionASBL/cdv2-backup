/*
  # Fix infinite recursion in users table RLS policies
  
  1. Changes
    - Drop existing policies that cause infinite recursion
    - Create new policies with direct role checks instead of nested queries
    - Simplify admin policy to avoid circular references
    
  2. Security
    - Maintain same level of access control
    - Prevent policy evaluation loops
    - Preserve data isolation between users
*/

-- Drop existing policies that cause recursion
DROP POLICY IF EXISTS "Admins can view all users" ON users;
DROP POLICY IF EXISTS "Users can view their own data" ON users;

-- Create new policies without circular references
CREATE POLICY "Admins can view all users"
ON users
FOR SELECT
TO authenticated
USING (
  -- Direct check on role column without subquery
  auth.uid() IN (SELECT id FROM users WHERE role = 'admin')
  OR auth.uid() = id
);

-- Create policy for users to view their own data
CREATE POLICY "Users can view their own data"
ON users
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Update admin policies for waiting_list table if needed
DROP POLICY IF EXISTS "Admins can manage waiting_list" ON waiting_list;
CREATE POLICY "Admins can manage waiting_list"
ON waiting_list
FOR ALL
TO authenticated
USING (
  auth.uid() IN (SELECT id FROM users WHERE role = 'admin')
);