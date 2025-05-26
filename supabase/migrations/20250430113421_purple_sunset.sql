/*
  # Fix admin authentication setup

  1. Changes
    - Add trigger to handle new admin user creation
    - Ensure admin users are properly linked to auth.users
    - Add policy to allow admin authentication

  2. Security
    - Enable RLS on admin_users table
    - Add policies for admin access
*/

-- Function to handle new admin user creation
CREATE OR REPLACE FUNCTION public.handle_new_admin_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Create auth user if doesn't exist
  INSERT INTO auth.users (email, email_confirmed_at, role)
  VALUES (
    NEW.email,
    CURRENT_TIMESTAMP,
    'authenticated'
  )
  ON CONFLICT (email) DO UPDATE
  SET email_confirmed_at = CURRENT_TIMESTAMP
  RETURNING id INTO NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS on_admin_user_created ON public.admin_users;

-- Create trigger for new admin users
CREATE TRIGGER on_admin_user_created
  BEFORE INSERT ON public.admin_users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_admin_user();

-- Update admin users policies
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Allow admin authentication
CREATE POLICY "Allow admin authentication"
  ON public.admin_users
  FOR SELECT
  TO authenticated
  USING (
    email = auth.jwt() ->> 'email'
    AND active = true
  );