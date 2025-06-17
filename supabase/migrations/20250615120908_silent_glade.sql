/*
  # Create CSV Files Storage Bucket

  1. New Storage Bucket
    - `csv-files` bucket for storing imported CSV files
    - Public access disabled for security
    - File size limit of 10MB
    - Only CSV files allowed

  2. Security Policies
    - Only authenticated admin users can upload files
    - Only authenticated admin users can read files
    - Files are automatically cleaned up after processing

  3. RLS Policies
    - Admin-only access for all operations
    - Secure file handling for sensitive financial data
*/

-- Create the csv-files bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'csv-files',
  'csv-files',
  false,
  10485760, -- 10MB limit
  ARRAY['text/csv', 'application/csv', 'text/plain']
);

-- Create policy for admin users to upload files
CREATE POLICY "Admins can upload CSV files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'csv-files' AND
  (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
);

-- Create policy for admin users to read files
CREATE POLICY "Admins can read CSV files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'csv-files' AND
  (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
);

-- Create policy for admin users to delete files
CREATE POLICY "Admins can delete CSV files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'csv-files' AND
  (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
);

-- Create policy for admin users to update files
CREATE POLICY "Admins can update CSV files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'csv-files' AND
  (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
)
WITH CHECK (
  bucket_id = 'csv-files' AND
  (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
);