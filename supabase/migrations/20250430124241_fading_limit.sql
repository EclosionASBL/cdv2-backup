-- Drop existing problematic functions and triggers
DROP FUNCTION IF EXISTS public.handle_new_admin_user() CASCADE;
DROP FUNCTION IF EXISTS public.ensure_admin_user_exists() CASCADE;
DROP FUNCTION IF EXISTS public.is_admin_user(TEXT) CASCADE;

-- Create improved function to handle new admin users
CREATE OR REPLACE FUNCTION public.handle_new_admin_user()
RETURNS TRIGGER AS $$
DECLARE
  v_auth_user_id UUID;
  v_encrypted_pass TEXT;
BEGIN
  -- Generate a secure random password
  v_encrypted_pass := crypt(gen_random_uuid()::text, gen_salt('bf'));

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
      updated_at,
      confirmation_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(),
      'authenticated',
      'authenticated',
      NEW.email,
      v_encrypted_pass,
      NOW(),
      NOW(),
      jsonb_build_object(
        'provider', 'email',
        'providers', ARRAY['email']
      ),
      jsonb_build_object(),
      NOW(),
      NOW(),
      encode(gen_random_bytes(32), 'hex')
    )
    RETURNING id INTO v_auth_user_id;
  END IF;

  -- Set the admin user's ID to match auth.users
  NEW.id := v_auth_user_id;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to create admin user: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create improved function to check admin status
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

-- Recreate trigger
DROP TRIGGER IF EXISTS on_admin_user_created ON public.admin_users;
CREATE TRIGGER on_admin_user_created
  BEFORE INSERT ON public.admin_users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_admin_user();

-- Update RLS policies
ALTER TABLE admin_users DISABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Allow admin authentication" ON admin_users;
DROP POLICY IF EXISTS "Allow admin users to view admin data" ON admin_users;

-- Create new policies with improved security
CREATE POLICY "Allow admin authentication"
  ON admin_users
  FOR SELECT
  TO authenticated
  USING (
    (email = current_setting('request.jwt.claims', true)::json->>'email' AND active = true) OR
    EXISTS (
      SELECT 1 FROM admin_users au
      WHERE au.email = current_setting('request.jwt.claims', true)::json->>'email'
      AND au.active = true
      AND au.role = 'super_admin'
    )
  );

-- Ensure all admin users have confirmed emails
UPDATE auth.users
SET email_confirmed_at = NOW(),
    updated_at = NOW(),
    email_change_confirm_status = 0,
    aud = 'authenticated',
    role = 'authenticated'
WHERE email IN (
  SELECT email FROM admin_users WHERE active = true
);

-- Re-enable RLS
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Create function to verify admin credentials
CREATE OR REPLACE FUNCTION verify_admin_credentials(p_email TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM admin_users 
    WHERE email = p_email 
    AND active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON admin_users TO authenticated;
GRANT EXECUTE ON FUNCTION verify_admin_credentials TO authenticated;
GRANT EXECUTE ON FUNCTION is_admin_user TO authenticated;