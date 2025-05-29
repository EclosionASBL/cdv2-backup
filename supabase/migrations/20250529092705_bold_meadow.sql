/*
  # Fix storage policies for stages bucket
  
  1. Changes
    - Create stages bucket if it doesn't exist
    - Drop existing policies to avoid conflicts
    - Create new policies with unambiguous column references
    - Allow admin users to manage stage images
    - Allow public read access to stage images
    
  2. Security
    - Enable RLS on storage.objects table
    - Properly check admin role without ambiguous references
*/

-- Create the stages bucket if it doesn't exist
INSERT INTO storage.buckets (id, name)
SELECT 'stages', 'stages'
WHERE NOT EXISTS (
  SELECT 1 FROM storage.buckets WHERE id = 'stages'
);

-- Enable RLS
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop existing policies for the stages bucket to avoid conflicts
DROP POLICY IF EXISTS "Admin users can manage stage images" ON storage.objects;
DROP POLICY IF EXISTS "Public can view stage images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can do all operations" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read public objects" ON storage.objects;

-- Create policy to allow admin users to manage stage images
-- Fixed: Use fully qualified column names and avoid joins
CREATE POLICY "Admin users can manage stage images"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'stages' 
  AND (
    SELECT public.users.role FROM public.users 
    WHERE public.users.id = auth.uid()
  ) = 'admin'
)
WITH CHECK (
  bucket_id = 'stages'
  AND (
    SELECT public.users.role FROM public.users 
    WHERE public.users.id = auth.uid()
  ) = 'admin'
);

-- Create policy to allow public read access to stage images
CREATE POLICY "Public can view stage images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'stages');