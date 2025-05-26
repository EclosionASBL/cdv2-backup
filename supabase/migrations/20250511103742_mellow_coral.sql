/*
  # Move swim_level from kids ➜ kid_activities
  & keep photo_consent in kids
*/

-- 1. drop in kids (si présent)
ALTER TABLE kids
  DROP COLUMN IF EXISTS swim_level;

-- 2. add in kid_activities
ALTER TABLE kid_activities
  ADD COLUMN IF NOT EXISTS swim_level text;