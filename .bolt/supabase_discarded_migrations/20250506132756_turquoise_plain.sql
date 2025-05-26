/*
  # Create activities table

  1. New Tables
    - `activities`
      - `id` (uuid, primary key)
      - `created_at` (timestamp)
      - `title` (text)
      - `description` (text)
      - `start_date` (date)
      - `end_date` (date)
      - `center_id` (uuid, foreign key to centers)
      - `price` (numeric)
      - `age_min` (integer)
      - `age_max` (integer)
      - `capacity` (integer)
      - `available_spots` (integer)
      - `image_url` (text)
      - `active` (boolean)

  2. Security
    - Enable RLS on `activities` table
    - Add policies for public viewing of active activities
    - Add policies for admin management
*/

CREATE TABLE IF NOT EXISTS activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  title text NOT NULL,
  description text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  center_id uuid REFERENCES centers(id) ON DELETE CASCADE,
  price numeric NOT NULL CHECK (price >= 0),
  age_min integer NOT NULL CHECK (age_min >= 0),
  age_max integer NOT NULL CHECK (age_max >= age_min),
  capacity integer NOT NULL CHECK (capacity > 0),
  available_spots integer NOT NULL CHECK (available_spots >= 0),
  image_url text,
  active boolean DEFAULT true,
  CONSTRAINT valid_dates CHECK (end_date >= start_date)
);

ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

-- Policy for public viewing of active activities
CREATE POLICY "Public can view active activities"
  ON activities
  FOR SELECT
  TO authenticated
  USING (active = true);

-- Policy for admin management
CREATE POLICY "Admins can manage activities"
  ON activities
  TO authenticated
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  )
  WITH CHECK (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

-- Create index for common queries
CREATE INDEX activities_start_date_idx ON activities(start_date);
CREATE INDEX activities_center_id_idx ON activities(center_id);