/*
  # Fix get_available_centers function GROUP BY clause

  1. Function Updates
    - Fix the `get_available_centers` RPC function to properly include `c.name` in GROUP BY clause
    - Ensure all non-aggregated columns are included in GROUP BY

  2. Changes
    - Update the function to comply with SQL GROUP BY requirements
    - Maintain the same return structure for frontend compatibility
*/

-- Drop the existing function if it exists
DROP FUNCTION IF EXISTS get_available_centers();

-- Create the corrected function
CREATE OR REPLACE FUNCTION get_available_centers()
RETURNS TABLE (
  id uuid,
  name text,
  session_count bigint
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    c.id,
    c.name,
    COUNT(s.id) as session_count
  FROM centers c
  LEFT JOIN sessions s ON c.id = s.center_id
  WHERE c.active = true
  GROUP BY c.id, c.name
  ORDER BY c.name;
$$;