/*
  # Add checkout session tracking
  
  1. Changes
    - Add checkout_session_id column to registrations table
    - Add index for faster lookups
*/

-- Add checkout_session_id column
ALTER TABLE registrations 
ADD COLUMN checkout_session_id text;

-- Add index for faster lookups
CREATE INDEX idx_registrations_checkout_session 
ON registrations(checkout_session_id);