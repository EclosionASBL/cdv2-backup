/*
  # Simplify authentication and user roles
  
  1. Changes
    - Add role column to users table
    - Remove admin_users table and related functions
    - Update RLS policies for role-based access
    
  2. Security
    - Maintain secure access control
    - Simplify authentication flow
*/

-- Add role column to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'parent';

-- Drop admin-related objects
DROP TABLE IF EXISTS admin_users CASCADE;
DROP TYPE IF EXISTS admin_role CASCADE;
DROP FUNCTION IF EXISTS check_admin_status(TEXT);

-- Update RLS policies for users table
DROP POLICY IF EXISTS "Allow user creation" ON users;
CREATE POLICY "Allow user creation" ON users
FOR INSERT
TO authenticated, anon
WITH CHECK (
  CASE 
    WHEN auth.uid() IS NULL THEN true
    ELSE auth.uid() = id
  END
);

DROP POLICY IF EXISTS "Users can view their own data" ON users;
CREATE POLICY "Users can view their own data" ON users
FOR SELECT
TO authenticated
USING (auth.uid() = id OR role = 'admin');

DROP POLICY IF EXISTS "Users can update their own data" ON users;
CREATE POLICY "Users can update their own data" ON users
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Update handle_new_user function to set default role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, created_at, role)
  VALUES (new.id, new.email, new.created_at, 'parent')
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;