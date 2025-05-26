/*
  # Fix RLS policies for registrations table
  
  1. Changes
    - Add admin policy to allow admins to manage all registrations
    - This fixes the "new row violates row-level security policy" error
    
  2. Security
    - Maintain existing user policies
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