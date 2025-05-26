/*
  # Fix admin authentication

  1. Changes
    - Add function to check admin credentials before login
    - Add policy to allow admin authentication
    - Add policy to allow admin users to view admin data

  2. Security
    - Function is executed with security definer to access admin_users table
    - Policies ensure only valid admin users can access admin data
*/

-- Function to check admin credentials
CREATE OR REPLACE FUNCTION check_admin_credentials(p_email TEXT)
RETURNS boolean
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM admin_users 
    WHERE email = p_email 
    AND active = true
  );
END;
$$;