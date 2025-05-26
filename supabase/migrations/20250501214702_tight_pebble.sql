/*
  # Add flexible pricing system
  
  1. New Tables
    - `tarif_conditions` - Store pricing conditions for special rates
    - Add pricing fields to `sessions` table
    
  2. Security
    - Enable RLS
    - Add policies for admin access
*/

-- Create tarif_conditions table
CREATE TABLE tarif_conditions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  label TEXT NOT NULL,
  code_postaux_autorises TEXT[] NOT NULL DEFAULT '{}',
  ecoles_autorisees TEXT[] NOT NULL DEFAULT '{}',
  active BOOLEAN DEFAULT true
);

-- Add pricing fields to sessions table
ALTER TABLE sessions 
ADD COLUMN nombre_jours INTEGER,
ADD COLUMN prix_normal NUMERIC NOT NULL,
ADD COLUMN prix_reduit NUMERIC,
ADD COLUMN prix_local NUMERIC,
ADD COLUMN prix_local_reduit NUMERIC,
ADD COLUMN remarques TEXT,
ADD COLUMN tarif_condition_id UUID REFERENCES tarif_conditions(id);

-- Enable RLS
ALTER TABLE tarif_conditions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Public can view active tarif_conditions"
  ON tarif_conditions FOR SELECT
  TO authenticated
  USING (active = true);

CREATE POLICY "Admins can manage tarif_conditions"
  ON tarif_conditions FOR ALL
  TO authenticated
  USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin')
  WITH CHECK ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');