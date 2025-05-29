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
-- Fixed: Use fully qualified column names to avoid ambiguity
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