/*
  # Add storage policies for stages bucket

  1. Changes
    - Create stages storage bucket if it doesn't exist
    - Enable RLS on stages bucket
    - Add policies for admin users to manage stage images
    - Add policy for authenticated users to view stage images

  2. Security
    - Enable RLS on stages bucket
    - Add policy for admin users to manage images
    - Add policy for public read access
*/

-- Create the stages bucket if it doesn't exist
INSERT INTO storage.buckets (id, name)
SELECT 'stages', 'stages'
WHERE NOT EXISTS (
  SELECT 1 FROM storage.buckets WHERE id = 'stages'
);

-- Enable RLS
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Create policy to allow admin users to manage stage images
CREATE POLICY "Admin users can manage stage images"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'stages' 
  AND (
    SELECT role FROM auth.users 
    JOIN public.users ON auth.users.id = public.users.id 
    WHERE auth.users.id = auth.uid()
  ) = 'admin'
)
WITH CHECK (
  bucket_id = 'stages'
  AND (
    SELECT role FROM auth.users 
    JOIN public.users ON auth.users.id = public.users.id 
    WHERE auth.users.id = auth.uid()
  ) = 'admin'
);

-- Create policy to allow public read access to stage images
CREATE POLICY "Public can view stage images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'stages');