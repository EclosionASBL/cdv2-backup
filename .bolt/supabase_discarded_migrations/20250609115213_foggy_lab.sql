/*
  # Create credit notes table and storage

  1. New Tables
    - `credit_notes` - Stores credit note information for cancelled registrations
      - `id` (uuid, primary key)
      - `created_at` (timestamp)
      - `user_id` (uuid, references users)
      - `registration_id` (uuid, references registrations)
      - `cancellation_request_id` (uuid, references cancellation_requests)
      - `credit_note_number` (text, unique)
      - `amount` (numeric)
      - `pdf_url` (text)
      - `status` (text, either 'issued' or 'sent')

  2. Security
    - Enable RLS on `credit_notes` table
    - Add policy for users to view their own credit notes
    - Add policy for admins to manage all credit notes
    - Create storage policies for credit notes
*/

-- Create credit_notes table
CREATE TABLE IF NOT EXISTS credit_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  registration_id UUID NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
  cancellation_request_id UUID NOT NULL REFERENCES cancellation_requests(id) ON DELETE CASCADE,
  credit_note_number TEXT NOT NULL UNIQUE,
  amount NUMERIC NOT NULL,
  pdf_url TEXT,
  status TEXT NOT NULL DEFAULT 'issued',
  
  -- Validate status values
  CONSTRAINT valid_status CHECK (status IN ('issued', 'sent'))
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS credit_notes_user_idx ON credit_notes(user_id);
CREATE INDEX IF NOT EXISTS credit_notes_registration_idx ON credit_notes(registration_id);
CREATE INDEX IF NOT EXISTS credit_notes_cancellation_idx ON credit_notes(cancellation_request_id);

-- Enable RLS
ALTER TABLE credit_notes ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for users
CREATE POLICY "Users can view their own credit notes"
  ON credit_notes FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Create RLS policies for admins
CREATE POLICY "Admins can manage all credit notes"
  ON credit_notes FOR ALL
  TO authenticated
  USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin')
  WITH CHECK ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

-- Create storage bucket for credit notes if it doesn't exist
DO $$
BEGIN
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('credit-notes', 'credit-notes', true)
  ON CONFLICT (id) DO NOTHING;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error creating bucket: %', SQLERRM;
END $$;

-- Check if policy already exists before creating it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Admin users can upload credit notes'
  ) THEN
    EXECUTE $policy$
    CREATE POLICY "Admin users can upload credit notes"
    ON storage.objects FOR ALL
    TO authenticated
    USING (
      bucket_id = 'credit-notes' 
      AND (
        SELECT public.users.role FROM public.users 
        WHERE public.users.id = auth.uid()
      ) = 'admin'
    )
    WITH CHECK (
      bucket_id = 'credit-notes'
      AND (
        SELECT public.users.role FROM public.users 
        WHERE public.users.id = auth.uid()
      ) = 'admin'
    )
    $policy$;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error creating policy: %', SQLERRM;
END $$;

-- Check if policy already exists before creating it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Authenticated users can view credit notes'
  ) THEN
    EXECUTE $policy$
    CREATE POLICY "Authenticated users can view credit notes"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (bucket_id = 'credit-notes')
    $policy$;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error creating policy: %', SQLERRM;
END $$;