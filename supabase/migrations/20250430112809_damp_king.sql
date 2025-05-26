-- Create function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin_user(user_email TEXT)
RETURNS TABLE (
  is_admin BOOLEAN,
  admin_role admin_role
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    TRUE as is_admin,
    role as admin_role
  FROM admin_users
  WHERE email = user_email
  AND active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update last sign in timestamp when admin logs in
CREATE OR REPLACE FUNCTION update_admin_last_signin()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE admin_users
  SET last_sign_in_at = now()
  WHERE email = NEW.email;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for admin sign in
CREATE TRIGGER on_admin_signin
  AFTER INSERT ON auth.sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_admin_last_signin();