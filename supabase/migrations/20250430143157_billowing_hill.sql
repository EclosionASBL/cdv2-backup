/*
  # Fix authentication trigger and policies
  
  1. Changes
    - Simplify handle_new_user trigger function
    - Update RLS policies for users table
    - Remove all admin-related functionality
    
  2. Security
    - Maintain basic user authentication
    - Enable RLS on users table
*/

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Create simplified handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, created_at)
  VALUES (NEW.id, NEW.email, NEW.created_at)
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      created_at = EXCLUDED.created_at;
  RETURN NEW;
EXCEPTION
  WHEN others THEN
    RETURN NEW;
END;
$$;

-- Recreate trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Update RLS policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Allow user creation" ON users;
DROP POLICY IF EXISTS "Users can update their own data" ON users;
DROP POLICY IF EXISTS "Users can view their own data" ON users;

-- Create simplified policies
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