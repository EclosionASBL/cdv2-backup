-- Add intervention_consent column
ALTER TABLE kid_health
ADD COLUMN IF NOT EXISTS intervention_consent BOOLEAN DEFAULT false;

-- Update existing rows to have default value
UPDATE kid_health
SET intervention_consent = false
WHERE intervention_consent IS NULL;