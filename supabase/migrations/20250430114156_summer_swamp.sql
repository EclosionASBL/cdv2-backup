/*
  # Fix admin authentication flow
  
  1. Changes
    - Add function to handle admin user creation
    - Add function to check admin status
    - Add trigger to automatically confirm admin email
    - Update RLS policies for admin_users table
    
  2. Security
    - Ensure admin users can authenticate
    - Auto-confirm admin email addresses
    - Proper RLS policies for admin access
*/

-- Function to handle new admin user creation
CREATE OR REPLACE FUNCTION public.handle_new_admin_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Create auth user if doesn't exist
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
    NEW.id,
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
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to confirm admin email
CREATE OR REPLACE FUNCTION public.confirm_admin_email()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE auth.users 
  SET email_confirmed_at = NOW(),
      updated_at = NOW()
  WHERE email = NEW.email;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin_user(user_email TEXT)
RETURNS TABLE (
  is_admin BOOLEAN,
  admin_role admin_role
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    TRUE as is_admin,
    role as admin_role
  FROM admin_users
  WHERE email = user_email
  AND active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS on_admin_user_created ON public.admin_users;
DROP TRIGGER IF EXISTS confirm_admin_email_on_create ON public.admin_users;

-- Create triggers
CREATE TRIGGER on_admin_user_created
  BEFORE INSERT ON public.admin_users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_admin_user();

CREATE TRIGGER confirm_admin_email_on_create
  AFTER INSERT ON public.admin_users
  FOR EACH ROW
  EXECUTE FUNCTION confirm_admin_email();

-- Update RLS policies
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow admin authentication" ON admin_users;
CREATE POLICY "Allow admin authentication"
  ON admin_users
  FOR SELECT
  TO authenticated
  USING (
    email = current_setting('request.jwt.claims', true)::json->>'email'
    AND active = true
  );

-- Confirm existing admin users
UPDATE auth.users
SET email_confirmed_at = NOW(),
    updated_at = NOW()
WHERE email IN (
  SELECT email FROM admin_users WHERE active = true
);