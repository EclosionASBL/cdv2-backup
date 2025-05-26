/*
  # Initial schema for KidsCamp application

  1. New Tables
    - `users`
      - `id` (uuid, primary key from auth.users)
      - Basic user info (name, address, contact details)
    - `kids`
      - `id` (uuid, primary key)
      - `user_id` (foreign key to users)
      - Child information (name, birth date, medical info, etc.)
    - `activities`
      - `id` (uuid, primary key)
      - Activity details (name, description, dates, price, etc.)
    - `registrations`
      - `id` (uuid, primary key)
      - Links kids to activities with payment status

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to access their own data
*/

-- Users table (extension of auth.users)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  email TEXT NOT NULL,
  nom TEXT,
  prenom TEXT,
  adresse TEXT,
  cPostal TEXT,
  localite TEXT,
  telephone TEXT,
  nNational TEXT,
  photo_url TEXT
);

-- Kids table
CREATE TABLE IF NOT EXISTS kids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nom TEXT NOT NULL,
  prenom TEXT NOT NULL,
  dateNaissance DATE NOT NULL,
  nNational TEXT,
  photo_url TEXT,
  allergies BOOLEAN DEFAULT false,
  symptomsAllergies TEXT,
  traitementAllergies TEXT,
  documentMedical BOOLEAN DEFAULT false,
  besoinAnimateur BOOLEAN DEFAULT false,
  handicap BOOLEAN DEFAULT false,
  amenagements TEXT,
  niveauNatation TEXT,
  autoriseSortieSeul BOOLEAN DEFAULT false,
  personnesAutorisees JSONB
);

-- Activities table
CREATE TABLE IF NOT EXISTS activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  nom TEXT NOT NULL,
  description TEXT NOT NULL,
  categorie TEXT NOT NULL,
  dateDebut DATE NOT NULL,
  dateFin DATE NOT NULL,
  centre TEXT NOT NULL,
  prix NUMERIC NOT NULL,
  ageMin INTEGER NOT NULL,
  ageMax INTEGER NOT NULL,
  placesDisponibles INTEGER NOT NULL,
  placesTotales INTEGER NOT NULL,
  image_url TEXT
);

-- Registrations table
CREATE TABLE IF NOT EXISTS registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kid_id UUID NOT NULL REFERENCES kids(id) ON DELETE CASCADE,
  activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  payment_status TEXT NOT NULL DEFAULT 'pending',
  payment_intent_id TEXT,
  amount_paid NUMERIC NOT NULL,
  UNIQUE(kid_id, activity_id)
);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE kids ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE registrations ENABLE ROW LEVEL SECURITY;

-- Policies for users table
CREATE POLICY "Users can view their own data"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own data"
  ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- Policies for kids table
CREATE POLICY "Users can view their own kids"
  ON kids
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own kids"
  ON kids
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own kids"
  ON kids
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own kids"
  ON kids
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Policies for activities table
CREATE POLICY "Everyone can view activities"
  ON activities
  FOR SELECT
  TO authenticated
  USING (true);

-- Policies for registrations table
CREATE POLICY "Users can view their own registrations"
  ON registrations
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own registrations"
  ON registrations
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own registrations"
  ON registrations
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (new.id, new.email);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();