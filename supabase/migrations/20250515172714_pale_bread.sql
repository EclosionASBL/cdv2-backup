/*
  # Add storage bucket policies for kid photos

  1. Changes
    - Create storage bucket for kid photos if not exists
    - Enable RLS on the bucket
    - Add policies for:
      - Authenticated users can upload their own kid photos
      - Authenticated users can read their own kid photos
      - Authenticated users can update their own kid photos
      - Authenticated users can delete their own kid photos

  2. Security
    - Enable RLS on kid-photos bucket
    - Add policies to ensure users can only access their own kid photos
    - Verify ownership through kids table join
*/

-- Create the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name)
VALUES ('kid-photos', 'kid-photos')
ON CONFLICT (id) DO NOTHING;

-- Enable RLS
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy for uploading photos (INSERT)
CREATE POLICY "Users can upload photos for their own kids" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'kid-photos' AND
  EXISTS (
    SELECT 1 FROM public.kids
    WHERE kids.id::text = SUBSTRING(storage.objects.name FROM '^([^.]+)')
    AND kids.user_id = auth.uid()
  )
);

-- Policy for viewing photos (SELECT)
CREATE POLICY "Users can view their own kid photos" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'kid-photos' AND
  EXISTS (
    SELECT 1 FROM public.kids
    WHERE kids.id::text = SUBSTRING(storage.objects.name FROM '^([^.]+)')
    AND kids.user_id = auth.uid()
  )
);

-- Policy for updating photos (UPDATE)
CREATE POLICY "Users can update their own kid photos" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'kid-photos' AND
  EXISTS (
    SELECT 1 FROM public.kids
    WHERE kids.id::text = SUBSTRING(storage.objects.name FROM '^([^.]+)')
    AND kids.user_id = auth.uid()
  )
)
WITH CHECK (
  bucket_id = 'kid-photos' AND
  EXISTS (
    SELECT 1 FROM public.kids
    WHERE kids.id::text = SUBSTRING(storage.objects.name FROM '^([^.]+)')
    AND kids.user_id = auth.uid()
  )
);

-- Policy for deleting photos (DELETE)
CREATE POLICY "Users can delete their own kid photos" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'kid-photos' AND
  EXISTS (
    SELECT 1 FROM public.kids
    WHERE kids.id::text = SUBSTRING(storage.objects.name FROM '^([^.]+)')
    AND kids.user_id = auth.uid()
  )
);