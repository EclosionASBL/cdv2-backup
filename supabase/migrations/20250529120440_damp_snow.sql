-- Enable RLS if not already enabled
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename = 'tarif_conditions' 
        AND rowsecurity = true
    ) THEN
        ALTER TABLE tarif_conditions ENABLE ROW LEVEL SECURITY;
    END IF;
END
$$;

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Admins can manage tarif_conditions" ON tarif_conditions;
DROP POLICY IF EXISTS "Public can view active tarif_conditions" ON tarif_conditions;

-- Create policy for admins to manage all tarif_conditions
CREATE POLICY "Admins can manage tarif_conditions"
ON tarif_conditions
FOR ALL
TO authenticated
USING (
  (SELECT role FROM users WHERE users.id = auth.uid()) = 'admin'
)
WITH CHECK (
  (SELECT role FROM users WHERE users.id = auth.uid()) = 'admin'
);

-- Create policy for authenticated users to view active tarif_conditions
CREATE POLICY "Public can view active tarif_conditions"
ON tarif_conditions
FOR SELECT
TO authenticated
USING (active = true);