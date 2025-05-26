/*
  # Disable email confirmation for admin users
  
  1. Changes
    - Add function to automatically confirm admin user emails
    - Add trigger to run on admin user creation
    
  2. Security
    - Only affects users in admin_users table
*/

-- Create function to confirm admin user email
CREATE OR REPLACE FUNCTION confirm_admin_email()
RETURNS TRIGGER AS $$
BEGIN
  -- Confirm the email for the admin user
  UPDATE auth.users 
  SET email_confirmed_at = now(),
      updated_at = now()
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to run on admin user creation
CREATE TRIGGER confirm_admin_email_on_create
  AFTER INSERT ON admin_users
  FOR EACH ROW
  EXECUTE FUNCTION confirm_admin_email();

-- Confirm existing admin users
UPDATE auth.users
SET email_confirmed_at = now(),
    updated_at = now()
WHERE id IN (
  SELECT id FROM admin_users WHERE active = true
);