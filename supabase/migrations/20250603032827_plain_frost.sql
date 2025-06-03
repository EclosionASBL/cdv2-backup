/*
  # Implement annual invoice sequencing
  
  1. Changes
     - Replace tag-based invoice sequencing with annual-only sequencing
     - Create new invoice_year_sequences table to track sequences by year only
     - Update get_next_invoice_sequence function to use year-only sequencing
  
  2. Security
     - Enable RLS on the new table
     - Add policy for admin access
*/

-- Drop the old function first
DROP FUNCTION IF EXISTS get_next_invoice_sequence;

-- Drop the old table if it exists
DROP TABLE IF EXISTS invoice_tag_sequences;

-- Create a new table to track invoice sequences by year only
CREATE TABLE IF NOT EXISTS invoice_year_sequences (
  year INTEGER PRIMARY KEY,
  last_sequence INTEGER NOT NULL DEFAULT 0
);

-- Create a new function to get the next invoice sequence number (annual only)
CREATE OR REPLACE FUNCTION get_next_invoice_sequence(p_tag TEXT, p_year INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  next_sequence INTEGER;
BEGIN
  -- Insert or update the sequence record for the year only
  -- The tag parameter is still accepted for backward compatibility but not used for sequencing
  INSERT INTO invoice_year_sequences (year, last_sequence)
  VALUES (p_year, 1)
  ON CONFLICT (year) 
  DO UPDATE SET last_sequence = invoice_year_sequences.last_sequence + 1
  RETURNING last_sequence INTO next_sequence;
  
  RETURN next_sequence;
END;
$$;

-- Add RLS policy for the new table
ALTER TABLE invoice_year_sequences ENABLE ROW LEVEL SECURITY;

-- Only admins can manage invoice sequences
CREATE POLICY "Admins can manage invoice sequences" 
  ON invoice_year_sequences
  FOR ALL 
  TO authenticated
  USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');