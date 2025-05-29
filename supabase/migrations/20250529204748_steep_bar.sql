/*
  # Create inclusion_requests table
  
  1. New Tables
    - `inclusion_requests` - Store inclusion requests for kids with special needs
      - Tracks user requests for inclusion in activities
      - Links to sessions, kids, and users
      - Includes status tracking and admin notes
      
  2. Security
    - Enable RLS
    - Add policies for users to manage their own inclusion requests
    - Add policies for admins to manage all inclusion requests
*/

-- Create inclusion_requests table
CREATE TABLE IF NOT EXISTS inclusion_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kid_id UUID NOT NULL REFERENCES kids(id) ON DELETE CASCADE,
  activity_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  request_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'pending',
  inclusion_details JSONB NOT NULL,
  admin_notes TEXT,
  
  -- Validate status values
  CONSTRAINT valid_status CHECK (status IN ('pending', 'approved', 'rejected', 'converted'))
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS inclusion_requests_user_idx ON inclusion_requests(user_id);
CREATE INDEX IF NOT EXISTS inclusion_requests_activity_idx ON inclusion_requests(activity_id);
CREATE INDEX IF NOT EXISTS inclusion_requests_status_idx ON inclusion_requests(status);

-- Enable RLS
ALTER TABLE inclusion_requests ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for users
CREATE POLICY "Users can view their own inclusion requests"
  ON inclusion_requests FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own inclusion requests"
  ON inclusion_requests FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Create RLS policies for admins
CREATE POLICY "Admins can manage inclusion requests"
  ON inclusion_requests FOR ALL
  TO authenticated
  USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin')
  WITH CHECK ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');