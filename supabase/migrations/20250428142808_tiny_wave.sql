/*
  # Add RLS policies for authenticated users

  1. Changes
    - Add RLS policies for authenticated users to access their own data
    - Enable RLS on all tables
    - Add policies for CRUD operations

  2. Security
    - Users can only access their own data
    - Public access is restricted
*/

-- Enable RLS on all tables if not already enabled
ALTER TABLE IF EXISTS users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS kids ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS registrations ENABLE ROW LEVEL SECURITY;

-- Users table policies
DROP POLICY IF EXISTS "Users can view their own data" ON users;
CREATE POLICY "Users can view their own data"
ON users FOR SELECT
TO authenticated
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own data" ON users;
CREATE POLICY "Users can update their own data"
ON users FOR UPDATE
TO authenticated
USING (auth.uid() = id);

-- Kids table policies
DROP POLICY IF EXISTS "Users can view their own kids" ON kids;
CREATE POLICY "Users can view their own kids"
ON kids FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own kids" ON kids;
CREATE POLICY "Users can insert their own kids"
ON kids FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own kids" ON kids;
CREATE POLICY "Users can update their own kids"
ON kids FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own kids" ON kids;
CREATE POLICY "Users can delete their own kids"
ON kids FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Activities table policies
DROP POLICY IF EXISTS "Everyone can view activities" ON activities;
CREATE POLICY "Everyone can view activities"
ON activities FOR SELECT
TO authenticated
USING (true);

-- Registrations table policies
DROP POLICY IF EXISTS "Users can view their own registrations" ON registrations;
CREATE POLICY "Users can view their own registrations"
ON registrations FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own registrations" ON registrations;
CREATE POLICY "Users can insert their own registrations"
ON registrations FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own registrations" ON registrations;
CREATE POLICY "Users can update their own registrations"
ON registrations FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);