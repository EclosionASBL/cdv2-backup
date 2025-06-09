/*
  # Add Credit Note Sequence Function

  1. New Functions
    - `get_next_credit_note_sequence`: Generates sequential credit note numbers based on year
  
  2. Changes
    - Ensures credit note numbers follow a consistent format: NC-YY-XXXXX
    - Uses the credit_note_sequences table to track the last used sequence number for each year
*/

-- Create a function to get the next credit note sequence number
CREATE OR REPLACE FUNCTION get_next_credit_note_sequence(p_year INT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_sequence INT;
  v_year_suffix TEXT;
  v_credit_note_number TEXT;
BEGIN
  -- Insert or update the sequence for the given year
  INSERT INTO credit_note_sequences (year, last_sequence)
  VALUES (p_year, 1)
  ON CONFLICT (year) 
  DO UPDATE SET last_sequence = credit_note_sequences.last_sequence + 1
  RETURNING last_sequence INTO v_sequence;
  
  -- Format the year suffix (last 2 digits)
  v_year_suffix := RIGHT(p_year::TEXT, 2);
  
  -- Format the credit note number: NC-YY-XXXXX
  v_credit_note_number := 'NC-' || v_year_suffix || '-' || LPAD(v_sequence::TEXT, 5, '0');
  
  RETURN v_credit_note_number;
END;
$$;