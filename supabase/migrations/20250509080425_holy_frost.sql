/*
  # Update national number validation
  
  1. Changes
    - Make n_national column nullable
    - Add is_national_number_valid flag
    - Add validation function and constraint
    - Handle existing data before adding constraint
    
  2. Security
    - Maintain existing RLS policies
*/

-- Make n_national nullable
ALTER TABLE kids
  ALTER COLUMN n_national DROP NOT NULL;

-- Add validation flag
ALTER TABLE kids
  ADD COLUMN IF NOT EXISTS is_national_number_valid BOOLEAN DEFAULT false;

-- Create validation function
CREATE OR REPLACE FUNCTION public.validate_belgian_nrn(nrn text)
RETURNS boolean
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  body  bigint;
  chk   int;
BEGIN
  IF nrn IS NULL THEN
    RETURN false;
  END IF;

  IF NOT nrn ~ '^\d{11}$' THEN
    RETURN false;
  END IF;

  body := substr(nrn,1,9)::bigint;
  chk  := substr(nrn,10,2)::int;
  RETURN (97 - (body % 97)) = chk;
END;
$$;

-- Handle existing data: Set invalid national numbers to NULL
UPDATE kids
SET n_national = NULL
WHERE n_national IS NOT NULL 
AND NOT public.validate_belgian_nrn(n_national);

-- Update is_national_number_valid flag for existing data
UPDATE kids
SET is_national_number_valid = CASE
  WHEN n_national IS NULL THEN false
  ELSE public.validate_belgian_nrn(n_national)
END;

-- Now add the validation constraint
ALTER TABLE kids
  ADD CONSTRAINT kids_nrn_chk
  CHECK (
    n_national IS NULL
    OR public.validate_belgian_nrn(n_national) = true
  );