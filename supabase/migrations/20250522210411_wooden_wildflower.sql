/*
  # Fix waiting_list table to use user_id instead of parent_id
  
  1. Changes
    - Rename parent_id column to user_id
    - Update all RLS policies to use user_id
    - Update all references to parent_id
    
  2. Security
    - Maintain existing RLS policies but with updated column name
*/

-- First check if the column exists and needs to be renamed
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'waiting_list' AND column_name = 'parent_id'
  ) THEN
    -- Rename parent_id to user_id
    ALTER TABLE waiting_list RENAME COLUMN parent_id TO user_id;
    
    -- Update foreign key constraint
    ALTER TABLE waiting_list 
    DROP CONSTRAINT IF EXISTS waiting_list_parent_id_fkey;
    
    ALTER TABLE waiting_list
    ADD CONSTRAINT waiting_list_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE CASCADE;
  END IF;
END $$;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own waiting list entries" ON waiting_list;
DROP POLICY IF EXISTS "Users can insert their own waiting list entries" ON waiting_list;
DROP POLICY IF EXISTS "Users can update their own waiting list entries" ON waiting_list;
DROP POLICY IF EXISTS "Users can delete their own waiting list entries" ON waiting_list;
DROP POLICY IF EXISTS "Admins can view all waiting list entries" ON waiting_list;
DROP POLICY IF EXISTS "Admins can update all waiting list entries" ON waiting_list;
DROP POLICY IF EXISTS "Admins can manage waiting_list" ON waiting_list;

-- Recreate policies using user_id
CREATE POLICY "Users can view their own waiting list entries"
ON waiting_list FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own waiting list entries"
ON waiting_list FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own waiting list entries"
ON waiting_list FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own waiting list entries"
ON waiting_list FOR DELETE
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins can view all waiting list entries"
ON waiting_list FOR SELECT
TO authenticated
USING ((current_setting('request.jwt.claims', true)::json->>'role' = 'admin'));

CREATE POLICY "Admins can update all waiting list entries"
ON waiting_list FOR UPDATE
TO authenticated
USING ((current_setting('request.jwt.claims', true)::json->>'role' = 'admin'))
WITH CHECK ((current_setting('request.jwt.claims', true)::json->>'role' = 'admin'));

-- Create a comprehensive admin policy
CREATE POLICY "Admins can manage waiting_list"
ON waiting_list FOR ALL
TO authenticated
USING ((current_setting('request.jwt.claims', true)::json->>'role' = 'admin'))
WITH CHECK ((current_setting('request.jwt.claims', true)::json->>'role' = 'admin'));