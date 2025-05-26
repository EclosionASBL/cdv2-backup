/*
  # Fix authorized persons RLS policies

  1. Changes
    - Drop existing insert policy that has incorrect conditions
    - Create new insert policy that properly handles user_id field
    - Ensure user_id is properly checked for authenticated users

  2. Security
    - Maintain existing select/update/delete policies
    - Add proper insert policy for authenticated users
    - Ensure users can only insert records with their own user_id
*/

-- Drop the existing problematic insert policy
DROP POLICY IF EXISTS "Users can insert their authorized persons" ON authorized_persons;

-- Create new insert policy with proper user_id check
CREATE POLICY "Users can insert their authorized persons"
ON authorized_persons
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
);