/*
  # Fix waiting list RLS policies for admin access
  
  1. Changes
    - Drop existing policies that might be causing issues
    - Create new policies with direct role checks
    - Ensure admin users can access all waiting list entries
    
  2. Security
    - Maintain proper access control
    - Fix admin role check to use the correct column
*/

-- Drop existing policies that might be causing issues
DROP POLICY IF EXISTS "Admins can manage waiting_list" ON waiting_list;
DROP POLICY IF EXISTS "Admins can view all waiting list entries" ON waiting_list;
DROP POLICY IF EXISTS "Admins can update all waiting list entries" ON waiting_list;

-- Create a new comprehensive admin policy
CREATE POLICY "Admins can manage waiting_list"
ON waiting_list
FOR ALL
TO authenticated
USING (
  (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
);

-- Ensure the user_id foreign key constraint is correct
ALTER TABLE waiting_list
DROP CONSTRAINT IF EXISTS waiting_list_parent_id_fkey;

ALTER TABLE waiting_list
DROP CONSTRAINT IF EXISTS waiting_list_user_id_fkey;

-- Add the correct foreign key constraint
ALTER TABLE waiting_list
ADD CONSTRAINT waiting_list_user_id_fkey
FOREIGN KEY (user_id)
REFERENCES users(id)
ON DELETE CASCADE;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS waiting_list_user_idx ON waiting_list(user_id);