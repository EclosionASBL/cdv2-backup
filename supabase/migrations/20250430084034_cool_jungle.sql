/*
  # Add authorized persons table
  
  1. New Table
    - `authorized_persons`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references users)
      - Basic contact info (name, phone, relationship)
      - Photo URL for profile picture
      
  2. Security
    - Enable RLS
    - Add policies for authenticated users
*/

CREATE TABLE IF NOT EXISTS authorized_persons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  relationship TEXT NOT NULL,
  photo_url TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE authorized_persons ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their authorized persons"
  ON authorized_persons FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their authorized persons"
  ON authorized_persons FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their authorized persons"
  ON authorized_persons FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their authorized persons"
  ON authorized_persons FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_authorized_persons_updated_at
  BEFORE UPDATE ON authorized_persons
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();