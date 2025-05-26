-- Create payment status enum if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status_enum') THEN
    CREATE TYPE payment_status_enum AS ENUM (
      'pending',
      'paid',
      'refunded',
      'cancelled'
    );
  END IF;
END $$;

-- Add new columns if they don't exist
DO $$ 
BEGIN
  -- Check if price_type column exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'registrations' AND column_name = 'price_type') THEN
    ALTER TABLE registrations ADD COLUMN price_type text NOT NULL DEFAULT 'normal';
  END IF;

  -- Check if reduced_declaration column exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'registrations' AND column_name = 'reduced_declaration') THEN
    ALTER TABLE registrations ADD COLUMN reduced_declaration boolean NOT NULL DEFAULT false;
  END IF;

  -- Check if invoice_id column exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'registrations' AND column_name = 'invoice_id') THEN
    ALTER TABLE registrations ADD COLUMN invoice_id text;
  END IF;

  -- Convert existing payment_status to enum if needed
  IF EXISTS (SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'registrations' AND column_name = 'payment_status' 
            AND data_type = 'text') THEN
    -- Create a temporary column
    ALTER TABLE registrations ADD COLUMN payment_status_new payment_status_enum;
    
    -- Update the temporary column
    UPDATE registrations 
    SET payment_status_new = payment_status::payment_status_enum;
    
    -- Drop the old column
    ALTER TABLE registrations DROP COLUMN payment_status;
    
    -- Rename the new column
    ALTER TABLE registrations RENAME COLUMN payment_status_new TO payment_status;
    
    -- Set not null constraint
    ALTER TABLE registrations ALTER COLUMN payment_status SET NOT NULL;
    
    -- Set default value
    ALTER TABLE registrations ALTER COLUMN payment_status SET DEFAULT 'pending';
  END IF;
END $$;

-- Add indexes for performance if they don't exist
CREATE INDEX IF NOT EXISTS registrations_user_idx ON registrations(user_id);
CREATE INDEX IF NOT EXISTS registrations_activity_idx ON registrations(activity_id);

-- Update RLS policies
ALTER TABLE registrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own registrations" ON registrations;
CREATE POLICY "Users can view their own registrations"
ON registrations FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert their own registrations" ON registrations;
CREATE POLICY "Users can insert their own registrations"
ON registrations FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own registrations" ON registrations;
CREATE POLICY "Users can update their own registrations"
ON registrations FOR UPDATE
TO authenticated
USING (user_id = auth.uid());