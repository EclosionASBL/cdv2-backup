/*
  # Create admin schema and tables
  
  1. New Tables
    - `centers` - Locations where activities take place
    - `stages` - Activity templates/catalog
    - `sessions` - Scheduled activities
    
  2. Security
    - Enable RLS
    - Add policies for admin access
*/

-- Create centers table
CREATE TABLE centers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  postal_code TEXT NOT NULL,
  city TEXT NOT NULL,
  tag TEXT NOT NULL,
  active BOOLEAN DEFAULT true
);

-- Create stages (activity templates) table
CREATE TABLE stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  age_min INTEGER NOT NULL,
  age_max INTEGER NOT NULL,
  base_price NUMERIC NOT NULL,
  image_url TEXT,
  active BOOLEAN DEFAULT true
);

-- Create sessions table
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  stage_id UUID NOT NULL REFERENCES stages(id),
  center_id UUID NOT NULL REFERENCES centers(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  capacity INTEGER NOT NULL,
  price_full NUMERIC NOT NULL,
  price_reduced NUMERIC,
  season TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  CONSTRAINT valid_dates CHECK (end_date >= start_date),
  CONSTRAINT valid_capacity CHECK (capacity > 0)
);

-- Enable RLS
ALTER TABLE centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Public can view active centers"
  ON centers FOR SELECT
  TO authenticated
  USING (active = true);

CREATE POLICY "Public can view active stages"
  ON stages FOR SELECT
  TO authenticated
  USING (active = true);

CREATE POLICY "Public can view active sessions"
  ON sessions FOR SELECT
  TO authenticated
  USING (active = true);

-- Admin policies (based on user role)
CREATE POLICY "Admins can manage centers"
  ON centers FOR ALL
  TO authenticated
  USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin')
  WITH CHECK ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Admins can manage stages"
  ON stages FOR ALL
  TO authenticated
  USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin')
  WITH CHECK ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Admins can manage sessions"
  ON sessions FOR ALL
  TO authenticated
  USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin')
  WITH CHECK ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON centers TO authenticated;
GRANT ALL ON stages TO authenticated;
GRANT ALL ON sessions TO authenticated;