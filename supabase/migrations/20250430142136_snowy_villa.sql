-- Drop all admin-related objects
DROP POLICY IF EXISTS "Users can view their own data" ON users;
DROP POLICY IF EXISTS "Users can update their own data" ON users;
DROP POLICY IF EXISTS "Allow user creation" ON users;

-- Drop admin-related objects
DROP TABLE IF EXISTS admin_users CASCADE;
DROP TYPE IF EXISTS admin_role CASCADE;
DROP FUNCTION IF EXISTS check_admin_status(TEXT) CASCADE;
DROP FUNCTION IF EXISTS handle_new_admin_user() CASCADE;
DROP FUNCTION IF EXISTS verify_admin_credentials(TEXT) CASCADE;

-- Update handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, created_at)
  VALUES (new.id, new.email, new.created_at);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Recreate trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create updated policies
CREATE POLICY "Allow user creation"
ON users
FOR INSERT
TO authenticated, anon
WITH CHECK (
  CASE
    WHEN auth.uid() IS NULL THEN true
    ELSE auth.uid() = id
  END
);

CREATE POLICY "Users can update their own data"
ON users
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can view their own data"
ON users
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Ensure RLS is enabled
ALTER TABLE users ENABLE ROW LEVEL SECURITY;