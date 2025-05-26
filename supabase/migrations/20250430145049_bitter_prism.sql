-- Drop all admin-related functions and triggers
DROP FUNCTION IF EXISTS public.handle_new_admin_user() CASCADE;
DROP FUNCTION IF EXISTS public.ensure_admin_user_exists() CASCADE;
DROP FUNCTION IF EXISTS public.is_admin_user(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.verify_admin_credentials(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.check_admin_status(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.confirm_admin_email() CASCADE;
DROP FUNCTION IF EXISTS public.update_admin_last_signin() CASCADE;
DROP FUNCTION IF EXISTS public.is_admin(UUID) CASCADE;

-- Drop admin-related tables if they still exist
DROP TABLE IF EXISTS admin_users CASCADE;
DROP TABLE IF EXISTS centers CASCADE;
DROP TABLE IF EXISTS activity_templates CASCADE;
DROP TABLE IF EXISTS activity_sessions CASCADE;

-- Drop admin-related types
DROP TYPE IF EXISTS admin_role CASCADE;

-- Ensure the handle_new_user function is clean and simple
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (
    id,
    email,
    created_at,
    role
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.created_at, now()),
    'parent'
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
EXCEPTION
  WHEN others THEN
    RAISE WARNING 'Error in handle_new_user: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Recreate trigger with clean function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Ensure RLS policies are clean and simple
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow user creation" ON users;
CREATE POLICY "Allow user creation"
ON users FOR INSERT
TO authenticated, anon
WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view their own data" ON users;
CREATE POLICY "Users can view their own data"
ON users FOR SELECT
TO authenticated
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own data" ON users;
CREATE POLICY "Users can update their own data"
ON users FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON public.users TO anon, authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;