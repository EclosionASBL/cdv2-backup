/*
  # Credit Notes System

  1. New Tables
    - `credit_notes` - Stores credit note information for cancelled registrations
  
  2. Indexes
    - Added indexes for performance on user_id, registration_id, and cancellation_request_id
  
  3. Security
    - Enabled RLS on credit_notes table
    - Added policies for users to view their own credit notes
    - Added policies for admins to manage all credit notes
  
  4. Storage
    - Ensures credit-notes bucket exists
    - Adds storage policies for credit note PDFs
*/

-- Create credit_notes table if it doesn't exist
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

-- Create RLS policies for users (with IF NOT EXISTS)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'credit_notes' 
    AND policyname = 'Users can view their own credit notes'
  ) THEN
    EXECUTE $policy$
    CREATE POLICY "Users can view their own credit notes"
      ON credit_notes FOR SELECT
      TO authenticated
      USING (user_id = auth.uid())
    $policy$;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error creating user policy: %', SQLERRM;
END $$;

-- Create RLS policies for admins (with IF NOT EXISTS)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'credit_notes' 
    AND policyname = 'Admins can manage all credit notes'
  ) THEN
    EXECUTE $policy$
    CREATE POLICY "Admins can manage all credit notes"
      ON credit_notes FOR ALL
      TO authenticated
      USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin')
      WITH CHECK ((SELECT role FROM users WHERE id = auth.uid()) = 'admin')
    $policy$;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error creating admin policy: %', SQLERRM;
END $$;

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
    RAISE NOTICE 'Error creating admin storage policy: %', SQLERRM;
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
    RAISE NOTICE 'Error creating view storage policy: %', SQLERRM;
END $$;