-- Create storage bucket for kid photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('kid-photos', 'kid-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policy to allow authenticated users to upload photos
CREATE POLICY "Authenticated users can upload kid photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'kid-photos');

-- Create storage policy to allow public access to kid photos
CREATE POLICY "Public access to kid photos"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'kid-photos');