/*
  # Create storage bucket for CODA files
  
  1. Changes
    - Create a new storage bucket for CODA files
    - Add RLS policies for admin access
    
  2. Security
    - Only admins can upload and manage CODA files
    - Files are not publicly accessible
*/

-- Create the coda-files bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('coda-files', 'coda-files', false)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on storage.objects if not already enabled
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Create policy to allow admin users to manage CODA files
CREATE POLICY "Admin users can manage CODA files"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'coda-files' 
  AND (
    SELECT role FROM public.users 
    WHERE id = auth.uid()
  ) = 'admin'
)
WITH CHECK (
  bucket_id = 'coda-files'
  AND (
    SELECT role FROM public.users 
    WHERE id = auth.uid()
  ) = 'admin'
);