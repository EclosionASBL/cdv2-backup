-- Create registrations table
CREATE TABLE IF NOT EXISTS registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  kid_id uuid NOT NULL REFERENCES kids(id),
  activity_id uuid NOT NULL REFERENCES sessions(id),
  payment_status text NOT NULL DEFAULT 'pending',
  payment_intent_id text,
  amount_paid numeric NOT NULL,
  UNIQUE(kid_id, activity_id)
);

-- Enable RLS
ALTER TABLE registrations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own registrations" ON registrations;
DROP POLICY IF EXISTS "Users can insert their own registrations" ON registrations;
DROP POLICY IF EXISTS "Users can update their own registrations" ON registrations;

-- RLS Policies
CREATE POLICY "Users can view their own registrations"
  ON registrations FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own registrations"
  ON registrations FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own registrations"
  ON registrations FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- Create function to handle registration creation in transaction
CREATE OR REPLACE FUNCTION create_registrations(
  p_user_id uuid,
  p_items jsonb
) RETURNS SETOF registrations
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH inserted_registrations AS (
    INSERT INTO registrations (
      user_id,
      kid_id,
      activity_id,
      amount_paid
    )
    SELECT
      p_user_id,
      (item->>'kid_id')::uuid,
      (item->>'activity_id')::uuid,
      (item->>'amount_due')::numeric
    FROM jsonb_array_elements(p_items) AS item
    RETURNING *
  )
  SELECT * FROM inserted_registrations;

  -- Update session capacity
  UPDATE sessions s
  SET capacity = capacity - 1
  FROM (
    SELECT activity_id
    FROM jsonb_array_elements(p_items) AS item
  ) AS items
  WHERE s.id = items.activity_id
  AND s.capacity > 0;
END;
$$;