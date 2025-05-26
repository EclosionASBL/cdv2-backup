-- Create storage bucket for stage images
INSERT INTO storage.buckets (id, name, public)
VALUES ('stages', 'stages', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policy to allow authenticated users to upload stage images
CREATE POLICY "Authenticated users can upload stage images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'stages');

-- Create storage policy to allow public access to stage images
CREATE POLICY "Public access to stage images"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'stages');