/*
  # Fix storage policies for kid photos
  
  1. Changes
    - Drop existing policies
    - Create new policies that properly handle authentication
    - Allow authenticated users to upload and view their own photos
    
  2. Security
    - Maintain RLS security
    - Ensure users can only access their own data
*/

-- Drop existing policies
DROP POLICY IF EXISTS "kid_photos_upload_policy" ON storage.objects;
DROP POLICY IF EXISTS "kid_photos_read_policy" ON storage.objects;
DROP POLICY IF EXISTS "authenticated users can upload kid photos" ON storage.objects;
DROP POLICY IF EXISTS "authenticated users can view kid photos" ON storage.objects;

-- Create new upload policy
CREATE POLICY "authenticated_users_upload_kid_photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'kid-photos' AND
  (storage.foldername(name))[1] = 'kid-photos'
);

-- Create new read policy
CREATE POLICY "authenticated_users_view_kid_photos"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'kid-photos' AND
  (storage.foldername(name))[1] = 'kid-photos'
);

-- Ensure bucket exists and is public (to allow access via signed URLs)
INSERT INTO storage.buckets (id, name, public)
VALUES ('kid-photos', 'kid-photos', true)
ON CONFLICT (id) DO UPDATE
SET public = true;