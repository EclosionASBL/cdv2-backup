/*
  # Fix user policies and trigger

  1. Changes
    - Drop and recreate user policies with correct permissions
    - Update handle_new_user trigger to be more robust
    
  2. Security
    - Maintains RLS security while allowing necessary operations
    - Ensures proper user creation flow
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own data" ON users;
DROP POLICY IF EXISTS "Users can update their own data" ON users;
DROP POLICY IF EXISTS "Allow user creation" ON users;

-- Recreate policies with correct permissions
CREATE POLICY "Users can view their own data"
ON users FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Users can update their own data"
ON users FOR UPDATE
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Allow user creation"
ON users FOR INSERT
TO anon, authenticated
WITH CHECK (
  CASE 
    WHEN auth.uid() IS NULL THEN true  -- Allow trigger to create users
    ELSE auth.uid() = id              -- Allow users to insert their own data
  END
);

-- Drop and recreate the trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (new.id, new.email)
  ON CONFLICT (id) DO NOTHING;  -- Avoid duplicate inserts
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Make sure RLS is enabled
ALTER TABLE users ENABLE ROW LEVEL SECURITY;