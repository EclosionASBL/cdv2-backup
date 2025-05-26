/*
  # Fix photo upload policies

  1. Changes
    - Add storage policies for kid-photos bucket
    - Add RLS policies for photo_url updates
    - Add file extension validation

  2. Security
    - Enable RLS on storage bucket
    - Add policies for authenticated users to manage their kids' photos
*/

-- First enable storage policies for kid-photos bucket
BEGIN;

-- Create policy to allow authenticated users to upload photos for their kids
CREATE POLICY "Users can upload photos for their kids" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'kid-photos' AND
    EXISTS (
      SELECT 1 FROM public.kids
      WHERE kids.id::text = REGEXP_REPLACE(name, '\.(jpg|jpeg|png)$', '')
      AND kids.user_id = auth.uid()
    )
  );

-- Create policy to allow authenticated users to update photos for their kids
CREATE POLICY "Users can update photos for their kids" ON storage.objects
  FOR UPDATE TO authenticated
  WITH CHECK (
    bucket_id = 'kid-photos' AND
    EXISTS (
      SELECT 1 FROM public.kids
      WHERE kids.id::text = REGEXP_REPLACE(name, '\.(jpg|jpeg|png)$', '')
      AND kids.user_id = auth.uid()
    )
  );

-- Create policy to allow authenticated users to read their kids' photos
CREATE POLICY "Users can read their kids' photos" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'kid-photos' AND
    EXISTS (
      SELECT 1 FROM public.kids
      WHERE kids.id::text = REGEXP_REPLACE(name, '\.(jpg|jpeg|png)$', '')
      AND kids.user_id = auth.uid()
    )
  );

-- Create policy to allow authenticated users to delete their kids' photos
CREATE POLICY "Users can delete their kids' photos" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'kid-photos' AND
    EXISTS (
      SELECT 1 FROM public.kids
      WHERE kids.id::text = REGEXP_REPLACE(name, '\.(jpg|jpeg|png)$', '')
      AND kids.user_id = auth.uid()
    )
  );

-- Update kids table policy to allow photo_url updates
CREATE POLICY "Users can update their kids' photo_url"
  ON public.kids
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid() AND
    (
      photo_url IS NULL OR
      photo_url ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png)$'
    )
  );

COMMIT;