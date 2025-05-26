/*
  # Fix admin authentication issues
  
  1. Changes
    - Drop and recreate admin authentication functions with proper error handling
    - Ensure admin users can be authenticated properly
    - Fix RLS policies to allow proper access
    
  2. Security
    - Maintain secure access control
    - Ensure only valid admin users can authenticate
*/

-- Drop existing functions
DROP FUNCTION IF EXISTS public.handle_new_admin_user() CASCADE;
DROP FUNCTION IF EXISTS public.check_admin_credentials(TEXT) CASCADE;

-- Create improved function to handle new admin users
CREATE OR REPLACE FUNCTION public.handle_new_admin_user()
RETURNS TRIGGER AS $$
DECLARE
  v_auth_user_id UUID;
BEGIN
  -- Check if user exists in auth.users
  SELECT id INTO v_auth_user_id
  FROM auth.users
  WHERE email = NEW.email;

  IF v_auth_user_id IS NULL THEN
    -- Create new auth user if doesn't exist
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      last_sign_in_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(),
      'authenticated',
      'authenticated',
      NEW.email,
      crypt(gen_random_uuid()::text, gen_salt('bf')),
      NOW(),
      NOW(),
      '{"provider":"email","providers":["email"]}',
      '{}',
      NOW(),
      NOW()
    )
    RETURNING id INTO v_auth_user_id;
  END IF;

  -- Set the admin user's ID to match auth.users
  NEW.id := v_auth_user_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create improved function to check admin credentials
CREATE OR REPLACE FUNCTION public.check_admin_credentials(p_email TEXT)
RETURNS boolean
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM admin_users 
    WHERE email = p_email 
    AND active = true
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$;

-- Recreate trigger
DROP TRIGGER IF EXISTS on_admin_user_created ON public.admin_users;
CREATE TRIGGER on_admin_user_created
  BEFORE INSERT ON public.admin_users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_admin_user();

-- Update RLS policies
ALTER TABLE admin_users DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow admin users to view admin data" ON admin_users;
CREATE POLICY "Allow admin users to view admin data"
  ON admin_users
  FOR SELECT
  TO authenticated
  USING (
    email = current_setting('request.jwt.claims', true)::json->>'email'
    AND active = true
  );

-- Ensure all admin users have confirmed emails
UPDATE auth.users
SET email_confirmed_at = NOW(),
    updated_at = NOW()
WHERE email IN (
  SELECT email FROM admin_users WHERE active = true
);

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;