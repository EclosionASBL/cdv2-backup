/*
  # Fix authentication trigger function

  1. Changes
    - Update the handle_new_user trigger function to properly handle user creation
    - Add proper error handling to prevent database errors during authentication
    - Ensure the function returns the NEW record as required by Supabase Auth

  2. Security
    - Function executes with security definer to ensure proper permissions
*/

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, created_at)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.created_at
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
EXCEPTION
  WHEN others THEN
    -- Log the error (Supabase will capture this in the logs)
    RAISE LOG 'Error in handle_new_user trigger: %', SQLERRM;
    -- Return NEW to allow the auth signup to complete even if profile creation fails
    -- This prevents the "Database error granting user" error
    RETURN NEW;
END;
$$;