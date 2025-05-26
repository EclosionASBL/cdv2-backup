/*
  # Fix authentication setup

  1. Changes
    - Drop and recreate the users table foreign key with proper CASCADE
    - Update RLS policies for user authentication
    - Fix user creation trigger

  2. Security
    - Enable RLS on users table
    - Add policies for proper user access
*/

-- Drop existing foreign key
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_id_fkey;

-- Recreate foreign key with proper CASCADE
ALTER TABLE users
ADD CONSTRAINT users_id_fkey 
FOREIGN KEY (id) 
REFERENCES auth.users(id) 
ON DELETE CASCADE;

-- Update RLS policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow user creation" ON users;
CREATE POLICY "Allow user creation" ON users
FOR INSERT
TO authenticated, anon
WITH CHECK (
  CASE 
    WHEN auth.uid() IS NULL THEN true
    ELSE auth.uid() = id
  END
);

DROP POLICY IF EXISTS "Users can view their own data" ON users;
CREATE POLICY "Users can view their own data" ON users
FOR SELECT
TO authenticated
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own data" ON users;
CREATE POLICY "Users can update their own data" ON users
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Update or create handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, created_at)
  VALUES (new.id, new.email, new.created_at)
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

-- Ensure trigger is properly set up
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();