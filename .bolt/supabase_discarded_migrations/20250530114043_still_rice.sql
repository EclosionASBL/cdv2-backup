-- Create table for invoice daily sequences
CREATE TABLE IF NOT EXISTS invoice_daily_sequences (
  invoice_date DATE PRIMARY KEY,
  last_sequence INTEGER NOT NULL DEFAULT 0
);

-- Create function to get next invoice sequence
CREATE OR REPLACE FUNCTION get_next_invoice_sequence(p_date DATE)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sequence INTEGER;
BEGIN
  -- Insert a new record for the date if it doesn't exist
  INSERT INTO invoice_daily_sequences (invoice_date, last_sequence)
  VALUES (p_date, 0)
  ON CONFLICT (invoice_date) DO NOTHING;
  
  -- Update the sequence and return the new value
  UPDATE invoice_daily_sequences
  SET last_sequence = last_sequence + 1
  WHERE invoice_date = p_date
  RETURNING last_sequence INTO v_sequence;
  
  RETURN v_sequence;
END;
$$;

-- Enable RLS on the sequence table
ALTER TABLE invoice_daily_sequences ENABLE ROW LEVEL SECURITY;

-- Create policy for admin access
CREATE POLICY "Admins can manage invoice sequences"
ON invoice_daily_sequences
FOR ALL
TO authenticated
USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin')
WITH CHECK ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');