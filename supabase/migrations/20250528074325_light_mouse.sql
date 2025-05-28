/*
  # Fix admin RLS policy for users table
  
  1. Changes
    - Update the "Admins can view all users" policy to check the role directly from the database
    - This fixes the issue where admins couldn't view user information in the payments page
    
  2. Security
    - Maintains the same level of security
    - Ensures admins can properly access all user data
*/

-- Drop the existing policy that uses JWT claims
DROP POLICY IF EXISTS "Admins can view all users" ON users;

-- Create a new policy that checks the role directly from the database
CREATE POLICY "Admins can view all users"
ON users
FOR SELECT
TO authenticated
USING (
  (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  OR auth.uid() = id
);