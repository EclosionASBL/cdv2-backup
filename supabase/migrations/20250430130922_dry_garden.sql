-- Drop existing complex functions and triggers
DROP FUNCTION IF EXISTS public.handle_new_admin_user() CASCADE;
DROP FUNCTION IF EXISTS public.ensure_admin_user_exists() CASCADE;
DROP FUNCTION IF EXISTS public.is_admin_user(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.verify_admin_credentials(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.is_admin(TEXT) CASCADE;

-- Create simple function to check admin status with unique name
CREATE OR REPLACE FUNCTION check_admin_status(user_email TEXT)
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

-- Update RLS policies
ALTER TABLE admin_users DISABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Allow admin authentication" ON admin_users;
DROP POLICY IF EXISTS "Allow admin users to view admin data" ON admin_users;

-- Create simplified policies
CREATE POLICY "Allow admin authentication"
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
    updated_at = NOW(),
    email_change_confirm_status = 0,
    aud = 'authenticated',
    role = 'authenticated'
WHERE email IN (
  SELECT email FROM admin_users WHERE active = true
);

-- Re-enable RLS
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON admin_users TO authenticated;
GRANT EXECUTE ON FUNCTION check_admin_status(TEXT) TO authenticated;