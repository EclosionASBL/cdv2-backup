/*
  # Remove public policies and fix RLS setup
  
  1. Changes
    - Drop all policies using public role
    - Fix admin policies to use JWT claims
    - Ensure proper RLS enforcement
    
  2. Security
    - Remove public access to tables
    - Maintain authenticated user access
    - Ensure admin access works correctly
*/

-- Drop all policies that use public role
DROP POLICY IF EXISTS "users_admin_full_access" ON users;
DROP POLICY IF EXISTS "users_owner_read" ON users;
DROP POLICY IF EXISTS "users_owner_write" ON users;
DROP POLICY IF EXISTS "users_self_insert" ON users;

-- Fix admin policies for centers
DROP POLICY IF EXISTS "Admins can manage centers" ON centers;
CREATE POLICY "Admins can manage centers"
ON centers FOR ALL
TO authenticated
USING (
  (current_setting('request.jwt.claims', true)::json->>'role' = 'admin')
);

-- Fix admin policies for stages
DROP POLICY IF EXISTS "Admins can manage stages" ON stages;
CREATE POLICY "Admins can manage stages"
ON stages FOR ALL
TO authenticated
USING (
  (current_setting('request.jwt.claims', true)::json->>'role' = 'admin')
);

-- Fix admin policies for sessions
DROP POLICY IF EXISTS "Admins can manage sessions" ON sessions;
CREATE POLICY "Admins can manage sessions"
ON sessions FOR ALL
TO authenticated
USING (
  (current_setting('request.jwt.claims', true)::json->>'role' = 'admin')
);

-- Fix admin policies for tarif_conditions
DROP POLICY IF EXISTS "Admins can manage tarif_conditions" ON tarif_conditions;
CREATE POLICY "Admins can manage tarif_conditions"
ON tarif_conditions FOR ALL
TO authenticated
USING (
  (current_setting('request.jwt.claims', true)::json->>'role' = 'admin')
);

-- Fix admin policies for schools
DROP POLICY IF EXISTS "Admins can manage schools" ON schools;
CREATE POLICY "Admins can manage schools"
ON schools FOR ALL
TO authenticated
USING (
  (current_setting('request.jwt.claims', true)::json->>'role' = 'admin')
);

-- Fix admin policies for waiting_list
DROP POLICY IF EXISTS "Admins can view all waiting list entries" ON waiting_list;
CREATE POLICY "Admins can view all waiting list entries"
ON waiting_list FOR SELECT
TO authenticated
USING (
  (current_setting('request.jwt.claims', true)::json->>'role' = 'admin')
);

DROP POLICY IF EXISTS "Admins can update all waiting list entries" ON waiting_list;
CREATE POLICY "Admins can update all waiting list entries"
ON waiting_list FOR UPDATE
TO authenticated
USING (
  (current_setting('request.jwt.claims', true)::json->>'role' = 'admin')
)
WITH CHECK (
  (current_setting('request.jwt.claims', true)::json->>'role' = 'admin')
);

-- Fix user policies for waiting_list
DROP POLICY IF EXISTS "Users can view their own waiting list entries" ON waiting_list;
CREATE POLICY "Users can view their own waiting list entries"
ON waiting_list FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert their own waiting list entries" ON waiting_list;
CREATE POLICY "Users can insert their own waiting list entries"
ON waiting_list FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own waiting list entries" ON waiting_list;
CREATE POLICY "Users can update their own waiting list entries"
ON waiting_list FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own waiting list entries" ON waiting_list;
CREATE POLICY "Users can delete their own waiting list entries"
ON waiting_list FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- Ensure all tables have RLS enabled
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE kids ENABLE ROW LEVEL SECURITY;
ALTER TABLE kid_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE kid_allergies ENABLE ROW LEVEL SECURITY;
ALTER TABLE kid_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE kid_departure ENABLE ROW LEVEL SECURITY;
ALTER TABLE kid_inclusion ENABLE ROW LEVEL SECURITY;
ALTER TABLE centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tarif_conditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE waiting_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE authorized_persons ENABLE ROW LEVEL SECURITY;