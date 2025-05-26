/*
  # Add admin RLS policies for waiting list view
  
  1. Changes
    - Add policies for admins to view all users data
    - Add policies for admins to view all kids data
    - Add policies for admins to manage waiting list entries
    
  2. Security
    - Maintain existing RLS policies for regular users
    - Add admin-specific policies based on user role
*/

-- Add admin policies for users table
CREATE POLICY "Admins can view all users"
ON public.users
FOR SELECT
TO authenticated
USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

-- Add admin policies for kids table
CREATE POLICY "Admins can view all kids"
ON public.kids
FOR SELECT
TO authenticated
USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

-- Add admin policies for waiting_list table
CREATE POLICY "Admins can manage waiting_list"
ON public.waiting_list
FOR ALL
TO authenticated
USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

-- Add admin policies for kid_health table
CREATE POLICY "Admins can view all kid health data"
ON public.kid_health
FOR SELECT
TO authenticated
USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

-- Add admin policies for kid_allergies table
CREATE POLICY "Admins can view all kid allergies data"
ON public.kid_allergies
FOR SELECT
TO authenticated
USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

-- Add admin policies for kid_activities table
CREATE POLICY "Admins can view all kid activities data"
ON public.kid_activities
FOR SELECT
TO authenticated
USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

-- Add admin policies for kid_departure table
CREATE POLICY "Admins can view all kid departure data"
ON public.kid_departure
FOR SELECT
TO authenticated
USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

-- Add admin policies for kid_inclusion table
CREATE POLICY "Admins can view all kid inclusion data"
ON public.kid_inclusion
FOR SELECT
TO authenticated
USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');