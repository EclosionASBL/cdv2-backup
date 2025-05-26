/*
  # Add waiting list functionality
  
  1. New Tables
    - `waiting_list` - Store waiting list entries for full sessions
      - Tracks user requests to join waiting list for full sessions
      - Links to sessions, kids, and users
      - Includes status tracking and invitation management
      
  2. Security
    - Enable RLS
    - Add policies for users to manage their own waiting list entries
    - Add policies for admins to manage all waiting list entries
*/

-- Create waiting_list table
CREATE TABLE IF NOT EXISTS waiting_list (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  kid_id UUID NOT NULL REFERENCES kids(id) ON DELETE CASCADE,
  parent_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  invited_at TIMESTAMPTZ DEFAULT NULL,
  expires_at TIMESTAMPTZ DEFAULT NULL,
  status TEXT NOT NULL DEFAULT 'waiting',
  
  -- Ensure unique combination of activity and kid
  UNIQUE(activity_id, kid_id),
  
  -- Validate status values
  CONSTRAINT valid_status CHECK (status IN ('waiting', 'invited', 'converted', 'cancelled'))
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS waiting_list_activity_idx ON waiting_list(activity_id);
CREATE INDEX IF NOT EXISTS waiting_list_parent_idx ON waiting_list(parent_id);
CREATE INDEX IF NOT EXISTS waiting_list_status_idx ON waiting_list(status);

-- Enable RLS
ALTER TABLE waiting_list ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for users
CREATE POLICY "Users can view their own waiting list entries"
  ON waiting_list FOR SELECT
  TO authenticated
  USING (parent_id = auth.uid());

CREATE POLICY "Users can insert their own waiting list entries"
  ON waiting_list FOR INSERT
  TO authenticated
  WITH CHECK (parent_id = auth.uid());

CREATE POLICY "Users can update their own waiting list entries"
  ON waiting_list FOR UPDATE
  TO authenticated
  USING (parent_id = auth.uid());

CREATE POLICY "Users can delete their own waiting list entries"
  ON waiting_list FOR DELETE
  TO authenticated
  USING (parent_id = auth.uid());

-- Create RLS policies for admins
CREATE POLICY "Admins can view all waiting list entries"
  ON waiting_list FOR SELECT
  TO authenticated
  USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Admins can update all waiting list entries"
  ON waiting_list FOR UPDATE
  TO authenticated
  USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin')
  WITH CHECK ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

-- Create function to handle waiting list expiration
CREATE OR REPLACE FUNCTION handle_expired_waiting_list_invitations()
RETURNS void AS $$
BEGIN
  UPDATE waiting_list
  SET status = 'waiting',
      invited_at = NULL,
      expires_at = NULL
  WHERE status = 'invited'
    AND expires_at < now();
END;
$$ LANGUAGE plpgsql;