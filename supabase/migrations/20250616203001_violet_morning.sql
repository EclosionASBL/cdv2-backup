/*
  # Update user balance calculation

  1. Changes
     - Fixes the net_balance calculation to correctly handle credits
     - Updates the formula to: total_invoiced - total_paid - total_credits
     - This ensures negative balances are shown when the organization owes money to the user
  
  2. Implementation
     - Drops existing function and dependent objects with CASCADE
     - Recreates the function with the corrected net_balance formula
     - Recreates the view and dependent function
*/

-- Drop everything with CASCADE to handle all dependencies at once
DROP FUNCTION IF EXISTS calculate_user_balance(uuid) CASCADE;

-- Redefine the calculate_user_balance function with the correct net_balance calculation
CREATE FUNCTION calculate_user_balance(p_user_id UUID)
RETURNS TABLE (
  gross_balance NUMERIC,
  net_balance NUMERIC,
  total_invoiced NUMERIC,
  total_paid NUMERIC,
  total_pending NUMERIC,
  total_cancelled NUMERIC,
  total_credits NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH invoice_totals AS (
    SELECT 
      SUM(amount) AS total_invoiced,
      SUM(total_payments) AS total_paid,
      SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) AS total_pending,
      SUM(CASE WHEN status = 'cancelled' THEN amount ELSE 0 END) AS total_cancelled
    FROM public.invoices
    WHERE user_id = p_user_id
  ),
  credit_note_totals AS (
    SELECT 
      SUM(amount) AS total_credits
    FROM public.credit_notes
    WHERE user_id = p_user_id
  )
  SELECT 
    COALESCE(i.total_invoiced, 0) - COALESCE(i.total_cancelled, 0) - COALESCE(c.total_credits, 0) AS gross_balance,
    COALESCE(i.total_invoiced, 0) - COALESCE(i.total_paid, 0) - COALESCE(c.total_credits, 0) AS net_balance,
    COALESCE(i.total_invoiced, 0) AS total_invoiced,
    COALESCE(i.total_paid, 0) AS total_paid,
    COALESCE(i.total_pending, 0) AS total_pending,
    COALESCE(i.total_cancelled, 0) AS total_cancelled,
    COALESCE(c.total_credits, 0) AS total_credits
  FROM invoice_totals i
  CROSS JOIN credit_note_totals c;
END;
$$ LANGUAGE plpgsql;

-- Update the user_financial_summary view to use the updated function
CREATE VIEW user_financial_summary AS
SELECT 
  u.id AS user_id,
  u.prenom,
  u.nom,
  u.email,
  b.total_invoiced,
  b.total_paid,
  b.total_pending,
  b.total_cancelled,
  b.total_credits,
  b.gross_balance,
  b.net_balance
FROM 
  users u
CROSS JOIN LATERAL calculate_user_balance(u.id) b;

-- Recreate the get_user_financial_summary function that depends on the view
CREATE OR REPLACE FUNCTION get_user_financial_summary(p_user_id UUID)
RETURNS SETOF user_financial_summary AS $$
BEGIN
  RETURN QUERY SELECT * FROM user_financial_summary WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Run a manual update to refresh all financial summaries
DO $$
DECLARE
  v_user RECORD;
BEGIN
  FOR v_user IN SELECT id FROM users LOOP
    PERFORM calculate_user_balance(v_user.id);
  END LOOP;
END;
$$;