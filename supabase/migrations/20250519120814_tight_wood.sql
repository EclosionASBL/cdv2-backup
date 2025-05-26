/*
  # Add account types and legal guardian status
  
  1. New Types
    - `account_type_enum` - Enum for different account types (parent, organisation, other)
    
  2. Changes
    - Add account_type column to users table
    - Add organisation_name column to users table
    - Add company_number column to users table
    - Add is_legal_guardian column to users table
    
  3. Security
    - Maintain existing RLS policies
*/

-- Create account type enum
DO $$ BEGIN
  CREATE TYPE public.account_type_enum AS ENUM ('parent', 'organisation', 'other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add new columns to users table
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS account_type account_type_enum NOT NULL DEFAULT 'parent',
  ADD COLUMN IF NOT EXISTS organisation_name text,
  ADD COLUMN IF NOT EXISTS company_number text,
  ADD COLUMN IF NOT EXISTS is_legal_guardian boolean NOT NULL DEFAULT true;

-- Migration of existing rows
UPDATE public.users
SET is_legal_guardian = true
WHERE account_type = 'parent';