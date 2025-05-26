/*
  # Fix storage policies for kid photos
  
  1. Changes
    - Drop existing policies
    - Create simplified policies for authenticated users
    - Allow authenticated users to upload and view photos
    
  2. Security
    - Maintain basic authentication checks
    - Keep bucket private but allow authenticated access
*/

-- Drop existing policies with both old and new names
DROP POLICY IF EXISTS "auth users upload kid photos" ON storage.objects;
DROP POLICY IF EXISTS "authenticated users can upload kid photos" ON storage.objects;
DROP POLICY IF EXISTS "Public access to kid photos" ON storage.objects;
DROP POLICY IF EXISTS "authenticated users can view kid photos" ON storage.objects;
DROP POLICY IF EXISTS "staff can view kid photos" ON storage.objects;
DROP POLICY IF EXISTS "kid_photos_upload_policy" ON storage.objects;
DROP POLICY IF EXISTS "kid_photos_read_policy" ON storage.objects;

-- Create new upload policy with unique name
CREATE POLICY "kid_photos_upload_policy"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'kid-photos');

-- Create new read policy with unique name
CREATE POLICY "kid_photos_read_policy"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'kid-photos');

-- Ensure bucket exists and is private
INSERT INTO storage.buckets (id, name, public)
VALUES ('kid-photos', 'kid-photos', false)
ON CONFLICT (id) DO UPDATE
SET public = false;