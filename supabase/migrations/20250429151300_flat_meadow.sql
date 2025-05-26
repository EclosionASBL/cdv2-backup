/*
  # Create separate tables for each form section
  
  1. New Tables
    - `kid_health` - Health information
    - `kid_allergies` - Allergy information  
    - `kid_activities` - Activities information
    - `kid_departure` - Departure information
    - `kid_inclusion` - Inclusion information

  2. Changes
    - Move relevant fields from kids table to new tables
    - Add foreign key constraints to kid_id
    - Enable RLS on all new tables
    
  3. Security
    - Add policies for authenticated users to access their own data
*/

-- Health Information Table
CREATE TABLE IF NOT EXISTS kid_health (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kid_id UUID NOT NULL REFERENCES kids(id) ON DELETE CASCADE,
  specific_medical TEXT,
  medication_details TEXT,
  medication_autonomy BOOLEAN DEFAULT false,
  tetanus BOOLEAN DEFAULT false,
  doctor_name TEXT,
  doctor_phone TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(kid_id)
);

-- Allergies Information Table
CREATE TABLE IF NOT EXISTS kid_allergies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kid_id UUID NOT NULL REFERENCES kids(id) ON DELETE CASCADE,
  has_allergies BOOLEAN DEFAULT false,
  allergies_details TEXT,
  allergies_consequences TEXT,
  special_diet BOOLEAN DEFAULT false,
  diet_details TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(kid_id)
);

-- Activities Information Table
CREATE TABLE IF NOT EXISTS kid_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kid_id UUID NOT NULL REFERENCES kids(id) ON DELETE CASCADE,
  can_participate BOOLEAN DEFAULT true,
  restriction_details TEXT,
  can_swim BOOLEAN DEFAULT false,
  water_fear BOOLEAN DEFAULT false,
  other_info TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(kid_id)
);

-- Departure Information Table
CREATE TABLE IF NOT EXISTS kid_departure (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kid_id UUID NOT NULL REFERENCES kids(id) ON DELETE CASCADE,
  leaves_alone BOOLEAN DEFAULT false,
  departure_time TEXT,
  pickup_people JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(kid_id)
);

-- Inclusion Information Table
CREATE TABLE IF NOT EXISTS kid_inclusion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kid_id UUID NOT NULL REFERENCES kids(id) ON DELETE CASCADE,
  has_disability BOOLEAN DEFAULT false,
  disability_details TEXT,
  needs_specialized_staff BOOLEAN DEFAULT false,
  previous_participation BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(kid_id)
);

-- Enable RLS on all new tables
ALTER TABLE kid_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE kid_allergies ENABLE ROW LEVEL SECURITY;
ALTER TABLE kid_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE kid_departure ENABLE ROW LEVEL SECURITY;
ALTER TABLE kid_inclusion ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for kid_health
CREATE POLICY "Users can view their kids' health data"
  ON kid_health FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM kids
    WHERE kids.id = kid_health.kid_id
    AND kids.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert their kids' health data"
  ON kid_health FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM kids
    WHERE kids.id = kid_health.kid_id
    AND kids.user_id = auth.uid()
  ));

CREATE POLICY "Users can update their kids' health data"
  ON kid_health FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM kids
    WHERE kids.id = kid_health.kid_id
    AND kids.user_id = auth.uid()
  ));

-- Add RLS policies for kid_allergies
CREATE POLICY "Users can view their kids' allergies data"
  ON kid_allergies FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM kids
    WHERE kids.id = kid_allergies.kid_id
    AND kids.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert their kids' allergies data"
  ON kid_allergies FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM kids
    WHERE kids.id = kid_allergies.kid_id
    AND kids.user_id = auth.uid()
  ));

CREATE POLICY "Users can update their kids' allergies data"
  ON kid_allergies FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM kids
    WHERE kids.id = kid_allergies.kid_id
    AND kids.user_id = auth.uid()
  ));

-- Add RLS policies for kid_activities
CREATE POLICY "Users can view their kids' activities data"
  ON kid_activities FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM kids
    WHERE kids.id = kid_activities.kid_id
    AND kids.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert their kids' activities data"
  ON kid_activities FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM kids
    WHERE kids.id = kid_activities.kid_id
    AND kids.user_id = auth.uid()
  ));

CREATE POLICY "Users can update their kids' activities data"
  ON kid_activities FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM kids
    WHERE kids.id = kid_activities.kid_id
    AND kids.user_id = auth.uid()
  ));

-- Add RLS policies for kid_departure
CREATE POLICY "Users can view their kids' departure data"
  ON kid_departure FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM kids
    WHERE kids.id = kid_departure.kid_id
    AND kids.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert their kids' departure data"
  ON kid_departure FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM kids
    WHERE kids.id = kid_departure.kid_id
    AND kids.user_id = auth.uid()
  ));

CREATE POLICY "Users can update their kids' departure data"
  ON kid_departure FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM kids
    WHERE kids.id = kid_departure.kid_id
    AND kids.user_id = auth.uid()
  ));

-- Add RLS policies for kid_inclusion
CREATE POLICY "Users can view their kids' inclusion data"
  ON kid_inclusion FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM kids
    WHERE kids.id = kid_inclusion.kid_id
    AND kids.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert their kids' inclusion data"
  ON kid_inclusion FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM kids
    WHERE kids.id = kid_inclusion.kid_id
    AND kids.user_id = auth.uid()
  ));

CREATE POLICY "Users can update their kids' inclusion data"
  ON kid_inclusion FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM kids
    WHERE kids.id = kid_inclusion.kid_id
    AND kids.user_id = auth.uid()
  ));

-- Create triggers to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_kid_health_updated_at
    BEFORE UPDATE ON kid_health
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_kid_allergies_updated_at
    BEFORE UPDATE ON kid_allergies
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_kid_activities_updated_at
    BEFORE UPDATE ON kid_activities
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_kid_departure_updated_at
    BEFORE UPDATE ON kid_departure
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_kid_inclusion_updated_at
    BEFORE UPDATE ON kid_inclusion
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- Remove columns from kids table that have been moved to new tables
ALTER TABLE kids 
  DROP COLUMN IF EXISTS symptoms_allergies,
  DROP COLUMN IF EXISTS traitement_allergies,
  DROP COLUMN IF EXISTS document_medical,
  DROP COLUMN IF EXISTS besoin_animateur,
  DROP COLUMN IF EXISTS handicap,
  DROP COLUMN IF EXISTS amenagements,
  DROP COLUMN IF EXISTS niveau_natation,
  DROP COLUMN IF EXISTS autorise_sortie_seul,
  DROP COLUMN IF EXISTS personnes_autorisees;