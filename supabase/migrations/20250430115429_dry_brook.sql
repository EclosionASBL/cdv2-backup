-- Drop existing functions and triggers
DROP FUNCTION IF EXISTS public.handle_new_admin_user() CASCADE;
DROP FUNCTION IF EXISTS public.confirm_admin_email() CASCADE;
DROP FUNCTION IF EXISTS public.is_admin_user(TEXT) CASCADE;

-- Create function to handle new admin user creation
CREATE OR REPLACE FUNCTION public.handle_new_admin_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Ensure email exists in auth.users before creating admin user
  IF NOT EXISTS (
    SELECT 1 FROM auth.users WHERE email = NEW.email
  ) THEN
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
    );
  END IF;

  -- Set the admin user's ID to match auth.users
  NEW.id := (SELECT id FROM auth.users WHERE email = NEW.email);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to confirm admin email
CREATE OR REPLACE FUNCTION public.confirm_admin_email()
RETURNS TRIGGER AS $$
BEGIN
  -- Confirm email for admin user
  UPDATE auth.users 
  SET email_confirmed_at = NOW(),
      updated_at = NOW()
  WHERE email = NEW.email;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check admin status
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

-- Create triggers
CREATE TRIGGER on_admin_user_created
  BEFORE INSERT ON public.admin_users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_admin_user();

CREATE TRIGGER confirm_admin_email_on_create
  AFTER INSERT ON public.admin_users
  FOR EACH ROW
  EXECUTE FUNCTION confirm_admin_email();

-- Temporarily disable RLS
ALTER TABLE admin_users DISABLE ROW LEVEL SECURITY;

-- Confirm existing admin users
UPDATE auth.users
SET email_confirmed_at = NOW(),
    updated_at = NOW()
WHERE email IN (
  SELECT email FROM admin_users WHERE active = true
);

-- Create policy for admin authentication
DROP POLICY IF EXISTS "Allow admin authentication" ON admin_users;
CREATE POLICY "Allow admin authentication"
  ON admin_users
  FOR SELECT
  TO authenticated
  USING (
    email = current_setting('request.jwt.claims', true)::json->>'email'
    AND active = true
  );

-- Re-enable RLS
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;