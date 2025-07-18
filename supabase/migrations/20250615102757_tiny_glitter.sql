/*
  # Fix Security Definer View Issue
  
  1. Changes
    - Drop the get_user_financial_summary function first to remove dependency
    - Drop the user_financial_summary view with CASCADE to handle any remaining dependencies
    - Recreate the view with security_invoker = true
    - Recreate the get_user_financial_summary function
    - Update the calculate_user_balance function
    
  2. Security
    - Ensure view uses security_invoker to respect RLS policies
    - Maintain proper access control for financial data
*/

-- First drop the function that depends on the view
DROP FUNCTION IF EXISTS public.get_user_financial_summary(uuid);

-- Then drop the view with CASCADE to handle any other dependencies
DROP VIEW IF EXISTS public.user_financial_summary CASCADE;

-- Recreate the view with SECURITY INVOKER explicitly set
CREATE VIEW public.user_financial_summary 
WITH (security_invoker = true)
AS
WITH invoice_totals AS (
  SELECT 
    user_id,
    SUM(amount) AS total_invoiced,
    SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) AS total_paid,
    SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) AS total_pending,
    SUM(CASE WHEN status = 'cancelled' THEN amount ELSE 0 END) AS total_cancelled
  FROM public.invoices
  GROUP BY user_id
),
credit_note_totals AS (
  SELECT 
    user_id,
    SUM(amount) AS total_credits
  FROM public.credit_notes
  GROUP BY user_id
)
SELECT 
  u.id AS user_id,
  u.prenom,
  u.nom,
  u.email,
  COALESCE(i.total_invoiced, 0) AS total_invoiced,
  COALESCE(i.total_paid, 0) AS total_paid,
  COALESCE(i.total_pending, 0) AS total_pending,
  COALESCE(i.total_cancelled, 0) AS total_cancelled,
  COALESCE(c.total_credits, 0) AS total_credits,
  COALESCE(i.total_invoiced, 0) - COALESCE(i.total_cancelled, 0) - COALESCE(c.total_credits, 0) AS gross_balance,
  COALESCE(i.total_pending, 0) - COALESCE(c.total_credits, 0) AS net_balance
FROM public.users u
LEFT JOIN invoice_totals i ON u.id = i.user_id
LEFT JOIN credit_note_totals c ON u.id = c.user_id;

-- Recreate the function to use the security_invoker view
CREATE OR REPLACE FUNCTION public.get_user_financial_summary(
  auth_uid uuid
)
RETURNS SETOF public.user_financial_summary
LANGUAGE sql
AS $$
  SELECT * FROM public.user_financial_summary 
  WHERE user_id = auth_uid 
     OR (SELECT role FROM public.users WHERE id = auth_uid) = 'admin';
$$;

-- Grant access to authenticated users
GRANT EXECUTE ON FUNCTION public.get_user_financial_summary(uuid) TO authenticated;

-- Add comment to document the function
COMMENT ON FUNCTION public.get_user_financial_summary IS 'Secure access to user financial summary with RLS built-in';

-- Drop the calculate_user_balance function if it exists
DROP FUNCTION IF EXISTS public.calculate_user_balance(uuid);

-- Recreate the function with security_invoker
CREATE OR REPLACE FUNCTION public.calculate_user_balance(p_user_id uuid)
RETURNS TABLE (
  gross_balance numeric,
  net_balance numeric,
  total_invoiced numeric,
  total_paid numeric,
  total_pending numeric,
  total_credits numeric
) 
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH invoice_totals AS (
    SELECT 
      SUM(amount) AS total_invoiced,
      SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) AS total_paid,
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
    COALESCE(i.total_pending, 0) - COALESCE(c.total_credits, 0) AS net_balance,
    COALESCE(i.total_invoiced, 0) AS total_invoiced,
    COALESCE(i.total_paid, 0) AS total_paid,
    COALESCE(i.total_pending, 0) AS total_pending,
    COALESCE(c.total_credits, 0) AS total_credits
  FROM invoice_totals i
  CROSS JOIN credit_note_totals c;
END;
$$;

-- Make the function accessible to authenticated users
GRANT EXECUTE ON FUNCTION public.calculate_user_balance(uuid) TO authenticated;

-- Add comment to document the function
COMMENT ON FUNCTION public.calculate_user_balance IS 'Calculates the current financial balance for a user, including invoices and credit notes';