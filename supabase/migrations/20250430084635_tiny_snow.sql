-- Create storage bucket for authorized persons photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('authorized-persons-photos', 'authorized-persons-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policy to allow authenticated users to upload photos
CREATE POLICY "Authenticated users can upload authorized persons photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'authorized-persons-photos');

-- Create storage policy to allow public access to authorized persons photos
CREATE POLICY "Public access to authorized persons photos"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'authorized-persons-photos');