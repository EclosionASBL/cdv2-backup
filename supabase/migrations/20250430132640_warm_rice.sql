/*
  # Fix user creation permissions

  1. Changes
    - Add missing RLS policies for user creation
    - Fix user creation trigger function
    - Ensure proper role assignments

  2. Security
    - Enable RLS on users table
    - Add policies for user creation and management
*/

-- Drop existing trigger if it exists to avoid conflicts
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Update the handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, created_at)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.created_at
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Ensure RLS is enabled
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Allow user creation" ON public.users;
DROP POLICY IF EXISTS "Users can update their own data" ON public.users;
DROP POLICY IF EXISTS "Users can view their own data" ON public.users;

-- Create comprehensive policies
CREATE POLICY "Allow user creation"
ON public.users
FOR INSERT
TO anon, authenticated
WITH CHECK (
  CASE
    WHEN auth.uid() IS NULL THEN true
    ELSE auth.uid() = id
  END
);

CREATE POLICY "Users can update their own data"
ON public.users
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can view their own data"
ON public.users
FOR SELECT
TO authenticated
USING (auth.uid() = id OR (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin');

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON public.users TO anon, authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;