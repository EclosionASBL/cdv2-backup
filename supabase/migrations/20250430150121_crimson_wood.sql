-- Drop any remaining admin-related objects
DROP FUNCTION IF EXISTS public.handle_new_admin_user() CASCADE;
DROP FUNCTION IF EXISTS public.ensure_admin_user_exists() CASCADE;
DROP FUNCTION IF EXISTS public.is_admin_user(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.verify_admin_credentials(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.check_admin_status(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.confirm_admin_email() CASCADE;
DROP FUNCTION IF EXISTS public.update_admin_last_signin() CASCADE;
DROP FUNCTION IF EXISTS public.is_admin(UUID) CASCADE;

-- Create a clean and simple handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (
    id,
    email,
    created_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.created_at, now())
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
EXCEPTION
  WHEN others THEN
    -- Just log the error and continue
    RAISE WARNING 'Error in handle_new_user: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Recreate trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Ensure RLS policies are simple and effective
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