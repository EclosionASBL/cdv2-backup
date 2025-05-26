/*
  # Fix user authentication issues

  1. Changes
    - Update users table RLS policies to allow proper user creation
    - Add trigger to handle new user creation
    - Ensure proper role assignment

  2. Security
    - Maintain RLS while fixing authentication
    - Update policies to handle both authenticated and anonymous users
*/

-- First, ensure the trigger function exists
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, role)
  VALUES (new.id, new.email, 'parent')
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email;
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update RLS policies for users table
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to recreate them
DROP POLICY IF EXISTS "Allow user creation" ON public.users;
DROP POLICY IF EXISTS "Users can update their own data" ON public.users;
DROP POLICY IF EXISTS "Users can view their own data" ON public.users;

-- Create updated policies
CREATE POLICY "Allow user creation"
ON public.users
FOR INSERT
TO authenticated, anon
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
USING (
  auth.uid() = id OR 
  (SELECT users.role FROM public.users WHERE users.id = auth.uid()) = 'admin'
);