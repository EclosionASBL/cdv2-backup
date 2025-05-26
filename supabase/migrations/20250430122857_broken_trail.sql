/*
  # Fix admin user authentication
  
  1. Changes
    - Ensure admin user exists in auth.users
    - Update admin authentication policies
    - Add function to sync admin users
    
  2. Security
    - Maintain secure access control
    - Ensure admin users can authenticate
*/

-- Function to ensure admin user exists in auth.users
CREATE OR REPLACE FUNCTION ensure_admin_user_exists()
RETURNS void AS $$
DECLARE
  admin_email text;
  admin_id uuid;
BEGIN
  -- Get admin email
  SELECT email INTO admin_email
  FROM admin_users 
  WHERE active = true 
  LIMIT 1;

  IF admin_email IS NOT NULL THEN
    -- Check if user exists in auth.users
    SELECT id INTO admin_id
    FROM auth.users
    WHERE email = admin_email;

    -- If user doesn't exist, create it
    IF admin_id IS NULL THEN
      INSERT INTO auth.users (
        instance_id,
        id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        created_at,
        updated_at,
        confirmation_token
      ) VALUES (
        '00000000-0000-0000-0000-000000000000',
        gen_random_uuid(),
        'authenticated',
        'authenticated',
        admin_email,
        crypt('admin123', gen_salt('bf')), -- Temporary password
        NOW(),
        NOW(),
        NOW(),
        encode(gen_random_bytes(32), 'hex')
      );
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Run the function
SELECT ensure_admin_user_exists();

-- Update RLS policies
DROP POLICY IF EXISTS "Allow admin authentication" ON admin_users;
CREATE POLICY "Allow admin authentication"
ON admin_users FOR SELECT
TO authenticated
USING (
  email = current_setting('request.jwt.claims', true)::json->>'email'
  AND active = true
);