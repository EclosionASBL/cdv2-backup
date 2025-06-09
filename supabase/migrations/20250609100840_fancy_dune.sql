/*
  # Add cancellation requests functionality
  
  1. New Tables
    - `cancellation_requests` - Store cancellation requests for registrations
      - Tracks user requests to cancel registrations
      - Links to registrations, kids, and sessions
      - Includes status tracking and notes
      
  2. Security
    - Enable RLS
    - Add policies for users to manage their own cancellation requests
    - Add policies for admins to manage all cancellation requests
*/

-- Create cancellation_requests table
CREATE TABLE IF NOT EXISTS cancellation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  registration_id UUID NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
  kid_id UUID NOT NULL REFERENCES kids(id) ON DELETE CASCADE,
  activity_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  request_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'pending',
  parent_notes TEXT,
  admin_notes TEXT,
  refund_type TEXT, -- 'full', 'partial', 'none'
  credit_note_id TEXT,
  credit_note_url TEXT,
  
  -- Ensure unique registration_id (one cancellation request per registration)
  UNIQUE(registration_id),
  
  -- Validate status values
  CONSTRAINT valid_status CHECK (status IN ('pending', 'approved', 'rejected')),
  
  -- Validate refund_type values
  CONSTRAINT valid_refund_type CHECK (refund_type IS NULL OR refund_type IN ('full', 'partial', 'none'))
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS cancellation_requests_user_idx ON cancellation_requests(user_id);
CREATE INDEX IF NOT EXISTS cancellation_requests_registration_idx ON cancellation_requests(registration_id);
CREATE INDEX IF NOT EXISTS cancellation_requests_activity_idx ON cancellation_requests(activity_id);
CREATE INDEX IF NOT EXISTS cancellation_requests_status_idx ON cancellation_requests(status);

-- Enable RLS
ALTER TABLE cancellation_requests ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for users
CREATE POLICY "Users can view their own cancellation requests"
  ON cancellation_requests FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own cancellation requests"
  ON cancellation_requests FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Create RLS policies for admins
CREATE POLICY "Admins can manage all cancellation requests"
  ON cancellation_requests FOR ALL
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