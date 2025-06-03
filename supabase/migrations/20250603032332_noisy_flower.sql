/*
  # Update invoice numbering system
  
  1. Changes
    - Create a new function to generate invoice numbers with format CDV-TAG-YY00001
    - Add a new table to track invoice sequences by tag and year
  
  2. New Tables
    - `invoice_tag_sequences` - Tracks the last sequence number used for each tag and year
  
  3. New Functions
    - `get_next_invoice_sequence(p_tag TEXT, p_year INTEGER)` - Returns the next sequence number for a given tag and year
*/

-- Create a new table to track invoice sequences by tag and year
CREATE TABLE IF NOT EXISTS invoice_tag_sequences (
  tag TEXT NOT NULL,
  year INTEGER NOT NULL,
  last_sequence INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (tag, year)
);

-- Create a function to get the next invoice sequence number
CREATE OR REPLACE FUNCTION get_next_invoice_sequence(p_tag TEXT, p_year INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  next_sequence INTEGER;
BEGIN
  -- Insert or update the sequence record
  INSERT INTO invoice_tag_sequences (tag, year, last_sequence)
  VALUES (p_tag, p_year, 1)
  ON CONFLICT (tag, year) 
  DO UPDATE SET last_sequence = invoice_tag_sequences.last_sequence + 1
  RETURNING last_sequence INTO next_sequence;
  
  RETURN next_sequence;
END;
$$;

-- Add RLS policy for the new table
ALTER TABLE invoice_tag_sequences ENABLE ROW LEVEL SECURITY;

-- Only admins can manage invoice sequences
CREATE POLICY "Admins can manage invoice sequences" 
  ON invoice_tag_sequences
  FOR ALL 
  TO authenticated
  USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');