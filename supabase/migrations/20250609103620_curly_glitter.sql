/*
  # Create credit note sequences table
  
  1. New Tables
    - `credit_note_sequences` - Track credit note number sequences by year
      - Used to generate unique, sequential credit note numbers
      
  2. Security
    - Enable RLS
    - Add policies for admins to manage sequences
*/

-- Create credit_note_sequences table
CREATE TABLE IF NOT EXISTS credit_note_sequences (
  year INTEGER PRIMARY KEY,
  last_sequence INTEGER NOT NULL DEFAULT 0
);

-- Create function to get the next credit note sequence number
CREATE OR REPLACE FUNCTION get_next_credit_note_sequence(p_year INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  next_sequence INTEGER;
BEGIN
  -- Insert or update the sequence record
  INSERT INTO credit_note_sequences (year, last_sequence)
  VALUES (p_year, 1)
  ON CONFLICT (year) 
  DO UPDATE SET last_sequence = credit_note_sequences.last_sequence + 1
  RETURNING last_sequence INTO next_sequence;
  
  RETURN next_sequence;
END;
$$;

-- Enable RLS
ALTER TABLE credit_note_sequences ENABLE ROW LEVEL SECURITY;

-- Create policy for admin access
CREATE POLICY "Admins can manage credit note sequences"
  ON credit_note_sequences
  FOR ALL
  TO authenticated
  USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin')
  WITH CHECK ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');