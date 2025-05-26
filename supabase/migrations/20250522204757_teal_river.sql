-- First, drop all existing policies on users table that might cause recursion
DROP POLICY IF EXISTS "Admins can view all users" ON users;
DROP POLICY IF EXISTS "Users can view their own data" ON users;
DROP POLICY IF EXISTS "Users can update their own data" ON users;
DROP POLICY IF EXISTS "Allow user creation" ON users;

-- Create simplified policies without recursion
-- 1. Policy for users to view their own data
CREATE POLICY "Users can view their own data"
ON users
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- 2. Policy for admins to view all users
-- This uses a direct role check from the JWT claims instead of a subquery
CREATE POLICY "Admins can view all users"
ON users
FOR SELECT
TO authenticated
USING (
  (current_setting('request.jwt.claims', true)::json->>'role' = 'admin')
  OR auth.uid() = id
);

-- 3. Policy for users to update their own data
CREATE POLICY "Users can update their own data"
ON users
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 4. Policy for user creation
CREATE POLICY "Allow user creation"
ON users
FOR INSERT
TO anon, authenticated
WITH CHECK (
  CASE
    WHEN auth.uid() IS NULL THEN true
    ELSE auth.uid() = id
  END
);

-- Fix admin policies for other tables that might cause recursion
-- Update waiting_list admin policy
DROP POLICY IF EXISTS "Admins can manage waiting_list" ON waiting_list;
CREATE POLICY "Admins can manage waiting_list"
ON waiting_list
FOR ALL
TO authenticated
USING (
  (current_setting('request.jwt.claims', true)::json->>'role' = 'admin')
);

-- Update admin policies for kids table
DROP POLICY IF EXISTS "Admins can view all kids" ON kids;
CREATE POLICY "Admins can view all kids"
ON kids
FOR SELECT
TO authenticated
USING (
  (current_setting('request.jwt.claims', true)::json->>'role' = 'admin')
  OR user_id = auth.uid()
);

-- Update admin policies for kid_health
DROP POLICY IF EXISTS "Admins can view all kid health data" ON kid_health;
CREATE POLICY "Admins can view all kid health data"
ON kid_health
FOR SELECT
TO authenticated
USING (
  (current_setting('request.jwt.claims', true)::json->>'role' = 'admin')
  OR EXISTS (
    SELECT 1 FROM kids
    WHERE kids.id = kid_health.kid_id
    AND kids.user_id = auth.uid()
  )
);

-- Update admin policies for kid_allergies
DROP POLICY IF EXISTS "Admins can view all kid allergies data" ON kid_allergies;
CREATE POLICY "Admins can view all kid allergies data"
ON kid_allergies
FOR SELECT
TO authenticated
USING (
  (current_setting('request.jwt.claims', true)::json->>'role' = 'admin')
  OR EXISTS (
    SELECT 1 FROM kids
    WHERE kids.id = kid_allergies.kid_id
    AND kids.user_id = auth.uid()
  )
);

-- Update admin policies for kid_activities
DROP POLICY IF EXISTS "Admins can view all kid activities data" ON kid_activities;
CREATE POLICY "Admins can view all kid activities data"
ON kid_activities
FOR SELECT
TO authenticated
USING (
  (current_setting('request.jwt.claims', true)::json->>'role' = 'admin')
  OR EXISTS (
    SELECT 1 FROM kids
    WHERE kids.id = kid_activities.kid_id
    AND kids.user_id = auth.uid()
  )
);

-- Update admin policies for kid_departure
DROP POLICY IF EXISTS "Admins can view all kid departure data" ON kid_departure;
CREATE POLICY "Admins can view all kid departure data"
ON kid_departure
FOR SELECT
TO authenticated
USING (
  (current_setting('request.jwt.claims', true)::json->>'role' = 'admin')
  OR EXISTS (
    SELECT 1 FROM kids
    WHERE kids.id = kid_departure.kid_id
    AND kids.user_id = auth.uid()
  )
);

-- Update admin policies for kid_inclusion
DROP POLICY IF EXISTS "Admins can view all kid inclusion data" ON kid_inclusion;
CREATE POLICY "Admins can view all kid inclusion data"
ON kid_inclusion
FOR SELECT
TO authenticated
USING (
  (current_setting('request.jwt.claims', true)::json->>'role' = 'admin')
  OR EXISTS (
    SELECT 1 FROM kids
    WHERE kids.id = kid_inclusion.kid_id
    AND kids.user_id = auth.uid()
  )
);