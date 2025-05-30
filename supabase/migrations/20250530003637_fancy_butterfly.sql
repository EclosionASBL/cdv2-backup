-- Add current_registrations column to sessions table
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS current_registrations integer NOT NULL DEFAULT 0;

-- Create function to update registration count
CREATE OR REPLACE FUNCTION update_session_registration_count()
RETURNS TRIGGER
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
  session_id uuid;
  count_value integer;
BEGIN
  -- Determine which activity_id to update based on the operation
  IF TG_OP = 'DELETE' THEN
    session_id := OLD.activity_id;
  ELSE
    session_id := NEW.activity_id;
  END IF;

  -- Count active registrations for this activity
  SELECT COUNT(*) INTO count_value
  FROM registrations
  WHERE 
    activity_id = session_id
    AND payment_status IN ('paid', 'pending');

  -- Update the sessions table with the new count
  UPDATE sessions
  SET current_registrations = count_value
  WHERE id = session_id;

  -- Return the appropriate record based on the operation
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- Create trigger on registrations table
DROP TRIGGER IF EXISTS trg_update_session_registrations ON registrations;
CREATE TRIGGER trg_update_session_registrations
AFTER INSERT OR UPDATE OR DELETE ON registrations
FOR EACH ROW
EXECUTE FUNCTION update_session_registration_count();

-- Update all sessions with current registration counts
UPDATE sessions s
SET current_registrations = (
  SELECT COUNT(*)
  FROM registrations r
  WHERE r.activity_id = s.id
  AND r.payment_status IN ('paid', 'pending')
);