/*
  # Add admin RLS policy for registrations table
  
  1. Changes
    - Add policy for admins to manage all registrations
    - Fix issue with converting waiting list entries to registrations
    
  2. Security
    - Maintain existing RLS policies for regular users
    - Add admin-specific policy based on user role
*/

-- Drop existing admin policy if it exists
DROP POLICY IF EXISTS "Admins can manage registrations" ON registrations;

-- Create comprehensive admin policy for registrations
CREATE POLICY "Admins can manage registrations"
ON registrations
FOR ALL
TO authenticated
USING (
  (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
)
WITH CHECK (
  (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
);