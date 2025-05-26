/*
  # Update Stripe integration and registrations schema

  1. Changes
    - Add payment reminder columns to registrations table
    - Add indexes for invoice_id and payment_intent_id
    - Enable RLS on registrations table
    - Add RLS policies for registrations

  2. Security
    - Enable RLS on registrations table
    - Add policy for users to view their own registrations
    - Add policy for admins to view all registrations
*/

-- Add payment reminder columns
ALTER TABLE registrations 
ADD COLUMN IF NOT EXISTS due_date timestamptz,
ADD COLUMN IF NOT EXISTS reminder_sent boolean DEFAULT false;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_registrations_invoice_id ON registrations(invoice_id);
CREATE INDEX IF NOT EXISTS idx_registrations_payment_intent_id ON registrations(payment_intent_id);

-- Enable RLS on registrations
ALTER TABLE registrations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Users can view their own registrations" ON registrations;
DROP POLICY IF EXISTS "Users can update their own registrations" ON registrations;
DROP POLICY IF EXISTS "Admins can manage registrations" ON registrations;

-- Create RLS policies
CREATE POLICY "Users can view their own registrations"
  ON registrations FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update their own registrations"
  ON registrations FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can manage registrations"
  ON registrations FOR ALL
  TO authenticated
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );