/*
  # Add invoice_url to registrations table
  
  1. Changes
    - Add invoice_url column to registrations table
    - This allows storing the Stripe hosted invoice URL for each registration
    
  2. Security
    - No changes to RLS policies needed
*/

ALTER TABLE registrations
ADD COLUMN IF NOT EXISTS invoice_url text;