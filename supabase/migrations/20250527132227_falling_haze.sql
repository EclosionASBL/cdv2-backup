/*
  # Create invoices table and RLS policies
  
  1. New Tables
    - `invoices` - Store invoice data
      - `id` (uuid, primary key)
      - `user_id` (uuid, references users.id)
      - `invoice_number` (text, unique)
      - `amount` (numeric)
      - `status` (text, enum-like: 'pending', 'paid', 'cancelled')
      - `due_date` (timestamptz)
      - `created_at` (timestamptz)
      - `paid_at` (timestamptz)
      - `pdf_url` (text)
      - `communication` (text)
      - `registration_ids` (uuid[])
      
  2. Security
    - Enable RLS
    - Add policies for authenticated users to read their own invoices
    - Add policies for service role to create and update invoices
*/

-- Create invoices table
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invoice_number TEXT UNIQUE NOT NULL,
  amount NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  due_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ,
  pdf_url TEXT,
  communication TEXT NOT NULL,
  registration_ids UUID[] NOT NULL,
  
  -- Validate status values
  CONSTRAINT valid_status CHECK (status IN ('pending', 'paid', 'cancelled'))
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS invoices_user_id_idx ON invoices(user_id);
CREATE INDEX IF NOT EXISTS invoices_status_idx ON invoices(status);
CREATE INDEX IF NOT EXISTS invoices_invoice_number_idx ON invoices(invoice_number);

-- Enable RLS
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Users can view their own invoices
CREATE POLICY "Users can view their own invoices"
  ON invoices FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Service role can manage all invoices (create, read, update, delete)
CREATE POLICY "Service role can manage all invoices"
  ON invoices FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Add invoice_id index to registrations table if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_registrations_invoice_id ON registrations(invoice_id);

-- Add admin policy for invoices
CREATE POLICY "Admins can manage all invoices"
  ON invoices FOR ALL
  TO authenticated
  USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin')
  WITH CHECK ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');