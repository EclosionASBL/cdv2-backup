/*
  # Add admin tables and roles
  
  1. New Tables
    - `admin_users` - Store admin user information
    - `admin_roles` - Define available roles
    - `admin_permissions` - Define granular permissions
    
  2. Security
    - Enable RLS
    - Add policies for admin access
*/

-- Create enum for admin roles
CREATE TYPE admin_role AS ENUM ('super_admin', 'admin', 'editor');

-- Create admin users table
CREATE TABLE admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  email TEXT UNIQUE NOT NULL,
  role admin_role NOT NULL DEFAULT 'editor',
  active BOOLEAN DEFAULT true,
  last_sign_in_at TIMESTAMPTZ
);

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

-- Create activity_templates table
CREATE TABLE activity_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  min_age INTEGER NOT NULL,
  max_age INTEGER NOT NULL,
  max_participants INTEGER NOT NULL,
  image_url TEXT,
  active BOOLEAN DEFAULT true
);

-- Create activity_sessions table
CREATE TABLE activity_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  activity_template_id UUID NOT NULL REFERENCES activity_templates(id),
  center_id UUID NOT NULL REFERENCES centers(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  price NUMERIC NOT NULL,
  reduced_price NUMERIC,
  places_available INTEGER NOT NULL,
  total_places INTEGER NOT NULL,
  active BOOLEAN DEFAULT true,
  tags TEXT[]
);

-- Enable RLS
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_sessions ENABLE ROW LEVEL SECURITY;

-- Create policies for admin users
CREATE POLICY "Allow admin users to view admin data"
ON admin_users FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM admin_users au
    WHERE au.id = auth.uid()
    AND au.active = true
  )
);

-- Create policies for centers
CREATE POLICY "Allow admin users to manage centers"
ON centers FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM admin_users au
    WHERE au.id = auth.uid()
    AND au.active = true
  )
);

-- Create policies for activity templates
CREATE POLICY "Allow admin users to manage activity templates"
ON activity_templates FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM admin_users au
    WHERE au.id = auth.uid()
    AND au.active = true
  )
);

-- Create policies for activity sessions
CREATE POLICY "Allow admin users to manage activity sessions"
ON activity_sessions FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM admin_users au
    WHERE au.id = auth.uid()
    AND au.active = true
  )
);

-- Create function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admin_users
    WHERE id = user_id
    AND active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;