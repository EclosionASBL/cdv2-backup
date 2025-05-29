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
    SELECT public.users.role FROM auth.users 
    JOIN public.users ON auth.users.id = public.users.id 
    WHERE auth.users.id = auth.uid()
  ) = 'admin'
)
WITH CHECK (
  bucket_id = 'stages'
  AND (
    SELECT public.users.role FROM auth.users 
    JOIN public.users ON auth.users.id = public.users.id 
    WHERE auth.users.id = auth.uid()
  ) = 'admin'
);

-- Create policy to allow public read access to stage images
CREATE POLICY "Public can view stage images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'stages');