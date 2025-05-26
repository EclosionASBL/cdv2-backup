/*
  # Create schools table and update tarif_conditions
  
  1. New Tables
    - `schools` - Store school information
    
  2. Changes
    - Add school_ids to tarif_conditions
    - Keep ecoles_autorisees for transition
    
  3. Security
    - Enable RLS
    - Add policies for admin access
*/

-- Create schools table
CREATE TABLE schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code_postal TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add school_ids to tarif_conditions
ALTER TABLE tarif_conditions
ADD COLUMN school_ids UUID[] DEFAULT '{}';

-- Enable RLS
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;

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