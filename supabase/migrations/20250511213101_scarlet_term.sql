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

-- Drop existing policies
DROP POLICY IF EXISTS "Authenticated users can upload kid photos" ON storage.objects;
DROP POLICY IF EXISTS "Public access to kid photos" ON storage.objects;
DROP POLICY IF EXISTS "staff can view kid photos" ON storage.objects;

-- Create simplified upload policy
CREATE POLICY "authenticated users can upload kid photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'kid-photos');

-- Create simplified read policy
CREATE POLICY "authenticated users can view kid photos"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'kid-photos');

-- Ensure bucket exists and is private
INSERT INTO storage.buckets (id, name, public)
VALUES ('kid-photos', 'kid-photos', false)
ON CONFLICT (id) DO UPDATE
SET public = false;