/*
  # Add insert policy for users table
  
  1. Changes
    - Add policy to allow inserting new users
    
  2. Security
    - Only allow inserting user's own data
*/

CREATE POLICY "Users can insert their own data"
ON users FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);