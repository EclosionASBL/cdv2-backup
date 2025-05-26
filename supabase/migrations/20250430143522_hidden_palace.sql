/*
  # Fix user creation trigger
  
  1. Changes
    - Drop trigger before function
    - Recreate function with better error handling
    - Recreate trigger
    
  2. Security
    - Maintain RLS policies
    - Keep security definer setting
*/

-- First drop the trigger that depends on the function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Now we can safely drop and recreate the function
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Create the trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, created_at)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.created_at
  );
  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    -- If user already exists, just return the new auth user
    RETURN NEW;
  WHEN others THEN
    -- Log other errors and still create the auth user
    RAISE WARNING 'Error in handle_new_user: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Create the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Ensure RLS is enabled
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;