/*
  # Create credit notes table for cancellation refunds
  
  1. New Tables
    - `credit_notes` - Store credit notes for refunds
      - Tracks refunds issued for cancelled registrations
      - Links to users, registrations, and cancellation requests
      - Includes credit note number, amount, and PDF URL
      
  2. Security
    - Enable RLS
    - Add policies for users to view their own credit notes
    - Add policies for admins to manage all credit notes
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
INSERT INTO storage.buckets (id, name, public)
VALUES ('credit-notes', 'credit-notes', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policy to allow admin users to upload credit notes
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
);

-- Create storage policy to allow authenticated users to view credit notes
CREATE POLICY "Authenticated users can view credit notes"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'credit-notes');