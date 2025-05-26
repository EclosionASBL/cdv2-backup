/*
  # Fix schools table creation and tarif_conditions update
  
  1. Changes
    - Create schools table with proper syntax
    - Add school_ids to tarif_conditions
    
  2. Security
    - Enable RLS
    - Add policies for admin access
*/

-- Create schools table
CREATE TABLE IF NOT EXISTS schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code_postal TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add school_ids to tarif_conditions if it doesn't exist
ALTER TABLE tarif_conditions
ADD COLUMN IF NOT EXISTS school_ids UUID[] DEFAULT '{}';

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