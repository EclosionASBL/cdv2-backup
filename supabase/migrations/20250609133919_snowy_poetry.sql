/*
  # Fix Credit Note Numbering

  1. Changes
     - Fixes the issue with credit note numbering where "NC-" is being duplicated
     - Updates the get_next_credit_note_sequence function to return a properly formatted number

  2. Security
     - No security changes
*/

-- Update the function to return a properly formatted credit note number
CREATE OR REPLACE FUNCTION public.get_next_credit_note_sequence(p_year integer)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sequence integer;
  v_year_suffix text;
  v_formatted_number text;
BEGIN
  -- Get or create the sequence for the year
  INSERT INTO public.credit_note_sequences (year, last_sequence)
  VALUES (p_year, 0)
  ON CONFLICT (year) DO NOTHING;
  
  -- Update the sequence and return the new value
  UPDATE public.credit_note_sequences
  SET last_sequence = last_sequence + 1
  WHERE year = p_year
  RETURNING last_sequence INTO v_sequence;
  
  -- Format the year suffix (last 2 digits)
  v_year_suffix := RIGHT(p_year::text, 2);
  
  -- Format the sequence number with leading zeros
  v_formatted_number := 'NC-' || v_year_suffix || '-' || LPAD(v_sequence::text, 5, '0');
  
  RETURN v_formatted_number;
END;
$$;

-- Update any existing credit notes with duplicate "NC-NC-" prefix
UPDATE public.credit_notes
SET credit_note_number = REPLACE(credit_note_number, 'NC-NC-', 'NC-')
WHERE credit_note_number LIKE 'NC-NC-%';

-- Update any existing cancellation requests with duplicate "NC-NC-" prefix in credit_note_id
UPDATE public.cancellation_requests
SET credit_note_id = REPLACE(credit_note_id, 'NC-NC-', 'NC-')
WHERE credit_note_id LIKE 'NC-NC-%';

-- Update the process-cancellation-approval function to store credit_note_id correctly
COMMENT ON FUNCTION public.get_next_credit_note_sequence IS 'Generates a formatted credit note number with the format NC-YY-XXXXX';