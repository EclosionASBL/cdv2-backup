/*
  # Add RLS policies for tarif_conditions table

  1. Security Changes
    - Enable RLS on tarif_conditions table
    - Add policy for admins to manage tarif_conditions
    - Add policy for authenticated users to view active tarif_conditions

  2. Changes
    - No schema changes, only security policy updates
*/

-- Enable RLS
ALTER TABLE tarif_conditions ENABLE ROW LEVEL SECURITY;

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