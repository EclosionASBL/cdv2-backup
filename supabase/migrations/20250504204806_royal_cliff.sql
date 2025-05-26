-- Check if schools table exists before creating
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'schools'
  ) THEN
    -- Create schools table
    CREATE TABLE schools (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      code_postal TEXT NOT NULL,
      active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT now()
    );
  END IF;
END $$;

-- Add school_ids to tarif_conditions if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tarif_conditions' 
    AND column_name = 'school_ids'
  ) THEN
    ALTER TABLE tarif_conditions
    ADD COLUMN school_ids UUID[] DEFAULT '{}';
  END IF;
END $$;

-- Enable RLS
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Public can view active schools" ON schools;
DROP POLICY IF EXISTS "Admins can manage schools" ON schools;

-- Create RLS policies
CREATE POLICY "Public can view active schools"
  ON schools FOR SELECT
  TO authenticated
  USING (active = true);

CREATE POLICY "Admins can manage schools"
  ON schools FOR ALL
  TO authenticated
  USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin')
  WITH CHECK ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

-- Grant necessary permissions
GRANT ALL ON schools TO authenticated;