/*
  # Add email sync trigger between auth.users and public.users
  
  1. Changes
    - Create a trigger function to sync email changes from auth.users to public.users
    - Add trigger to auth.users table to call the function on update
    - Ensure existing users have their email synced
    
  2. Security
    - No changes to RLS policies needed
*/

-- Create trigger function to sync email changes
CREATE OR REPLACE FUNCTION sync_user_email()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the email in public.users when it changes in auth.users
  UPDATE public.users
  SET email = NEW.email
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users
DROP TRIGGER IF EXISTS sync_user_email_trigger ON auth.users;
CREATE TRIGGER sync_user_email_trigger
AFTER UPDATE OF email ON auth.users
FOR EACH ROW
WHEN (OLD.email IS DISTINCT FROM NEW.email)
EXECUTE FUNCTION sync_user_email();

-- Sync existing users' emails
UPDATE public.users
SET email = auth.users.email
FROM auth.users
WHERE public.users.id = auth.users.id
AND public.users.email IS DISTINCT FROM auth.users.email;