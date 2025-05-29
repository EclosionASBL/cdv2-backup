/*
  # Add RLS policies for schools table

  1. Changes
    - Add INSERT policy for admin users
    - Add UPDATE policy for admin users
    - Add DELETE policy for admin users
    - Ensure consistent policy naming

  2. Security
    - Policies restricted to admin users only
    - Policies use role-based access control
*/

-- Add INSERT policy for admin users
CREATE POLICY "Admins can insert schools"
ON public.schools
FOR INSERT
TO authenticated
WITH CHECK (
  (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
);

-- Add UPDATE policy for admin users
CREATE POLICY "Admins can update schools"
ON public.schools
FOR UPDATE
TO authenticated
USING (
  (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
)
WITH CHECK (
  (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
);

-- Add DELETE policy for admin users
CREATE POLICY "Admins can delete schools"
ON public.schools
FOR DELETE
TO authenticated
USING (
  (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
);