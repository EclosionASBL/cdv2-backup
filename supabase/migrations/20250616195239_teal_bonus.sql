/*
  # Fix financial summary view to use total_payments

  1. Changes
     - Update user_financial_summary view to use total_payments column instead of relying on invoice status
     - Ensures the financial summary correctly reflects actual payments received
     - Fixes discrepancy between displayed total paid amount and actual bank transactions

  2. Technical Details
     - Drops and recreates the view with CASCADE to handle dependencies
     - Updates total_paid calculation to use i.total_payments directly
     - Recreates the dependent function get_user_financial_summary
*/

-- Drop the view with CASCADE to handle dependencies
DROP VIEW IF EXISTS user_financial_summary CASCADE;

-- Recreate the view with the corrected total_paid calculation
CREATE VIEW user_financial_summary AS
SELECT 
    u.id as user_id,
    u.prenom,
    u.nom,
    u.email,
    COALESCE(SUM(CASE WHEN i.status = 'pending' OR i.status = 'paid' OR i.status = 'overdue' THEN i.amount ELSE 0 END), 0) as total_invoiced,
    COALESCE(SUM(i.total_payments), 0) as total_paid,
    COALESCE(SUM(CASE WHEN i.status = 'pending' OR i.status = 'overdue' THEN i.amount ELSE 0 END), 0) as total_pending,
    COALESCE(SUM(CASE WHEN i.status = 'cancelled' THEN i.amount ELSE 0 END), 0) as total_cancelled,
    COALESCE(SUM(cn.amount), 0) as total_credits,
    COALESCE(SUM(CASE WHEN i.status = 'pending' OR i.status = 'paid' OR i.status = 'overdue' THEN i.amount ELSE 0 END), 0) as gross_balance,
    COALESCE(SUM(CASE WHEN i.status = 'pending' OR i.status = 'paid' OR i.status = 'overdue' THEN i.amount ELSE 0 END), 0) - COALESCE(SUM(i.total_payments), 0) - COALESCE(SUM(cn.amount), 0) as net_balance
FROM users u
LEFT JOIN invoices i ON u.id = i.user_id
LEFT JOIN credit_notes cn ON u.id = cn.user_id
GROUP BY u.id, u.prenom, u.nom, u.email;

-- Grant appropriate permissions
GRANT SELECT ON user_financial_summary TO authenticated;

-- Recreate the get_user_financial_summary function that depends on the view
CREATE OR REPLACE FUNCTION get_user_financial_summary(p_user_id uuid)
RETURNS SETOF user_financial_summary AS $$
  SELECT * FROM user_financial_summary WHERE user_id = p_user_id;
$$ LANGUAGE sql SECURITY DEFINER;