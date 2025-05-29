/*
  # Add storage policies for stages bucket

  1. Changes
    - Create stages storage bucket if it doesn't exist
    - Add storage policies for admin users:
      - Allow admins to read all objects
      - Allow admins to insert new objects
      - Allow admins to update objects
      - Allow admins to delete objects
    - Add storage policies for authenticated users:
      - Allow reading public objects
*/

-- Create the stages bucket if it doesn't exist
DO $$
BEGIN
  INSERT INTO storage.buckets (id, name)
  VALUES ('stages', 'stages')
  ON CONFLICT (id) DO NOTHING;
END $$;

-- Enable RLS on the buckets table
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Create policy to allow admin users to do all operations
CREATE POLICY "Admins can do all operations" ON storage.objects
FOR ALL
TO authenticated
USING (
  (bucket_id = 'stages' AND (
    SELECT role FROM auth.users
    WHERE id = auth.uid()
  ) = 'admin')
)
WITH CHECK (
  (bucket_id = 'stages' AND (
    SELECT role FROM auth.users
    WHERE id = auth.uid()
  ) = 'admin')
);

-- Create policy to allow authenticated users to read public objects
CREATE POLICY "Authenticated users can read public objects" ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'stages');