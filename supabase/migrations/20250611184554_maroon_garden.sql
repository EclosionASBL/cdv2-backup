/*
  # Update RLS policies to allow anonymous access
  
  1. Changes
    - Update RLS policies for sessions, stages, and centers to allow anonymous users to view active records
    - This enables the homepage to display stages without requiring authentication
    
  2. Security
    - Only allows viewing active records
    - Maintains existing admin policies
*/

-- Drop existing policies that need to be updated
DROP POLICY IF EXISTS "Public can view active sessions" ON sessions;
DROP POLICY IF EXISTS "Public can view active stages" ON stages;
DROP POLICY IF EXISTS "Public can view active centers" ON centers;

-- Create new policies that include anon role
CREATE POLICY "Public can view active sessions"
  ON sessions FOR SELECT
  TO anon, authenticated
  USING (active = true);

CREATE POLICY "Public can view active stages"
  ON stages FOR SELECT
  TO anon, authenticated
  USING (active = true);

CREATE POLICY "Public can view active centers"
  ON centers FOR SELECT
  TO anon, authenticated
  USING (active = true);