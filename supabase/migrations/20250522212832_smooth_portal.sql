/*
  # Fix admin policies for waiting list
  
  1. Changes
    - Update admin policies to properly access waiting list entries
    - Fix the USING clause to correctly check admin role
    - Ensure admin can view all waiting list entries regardless of user_id
    
  2. Security
    - Maintain existing user policies
    - Improve admin access control
*/

-- Drop existing admin policies that might be causing issues
DROP POLICY IF EXISTS "Admins can manage waiting_list" ON waiting_list;
DROP POLICY IF EXISTS "Admins can view all waiting list entries" ON waiting_list;
DROP POLICY IF EXISTS "Admins can update all waiting list entries" ON waiting_list;

-- Create a new comprehensive admin policy for ALL operations
CREATE POLICY "Admins can manage waiting_list"
ON waiting_list
FOR ALL
TO authenticated
USING (
  (current_setting('request.jwt.claims', true)::json ->> 'role') = 'admin'
);

-- Update the waiting list store to properly join related data