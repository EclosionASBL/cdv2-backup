/*
  # Credit Note Invoice Tracking and Balance Calculation

  1. Changes
     - Add invoice_id and invoice_number fields to credit_notes table
     - Create view for parent balance calculation
     - Add function to calculate user balance

  2. New Views
     - user_financial_summary - Shows total invoiced, paid, and credit amounts per user

  3. New Functions
     - calculate_user_balance - Returns the current balance for a user
*/

-- Add invoice tracking fields to credit_notes table
ALTER TABLE IF EXISTS public.credit_notes
ADD COLUMN IF NOT EXISTS invoice_id text,
ADD COLUMN IF NOT EXISTS invoice_number text;

-- Create index on invoice_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_credit_notes_invoice_id ON public.credit_notes(invoice_id);

-- Create a view to calculate user financial summary
CREATE OR REPLACE VIEW public.user_financial_summary AS
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

-- Create a function to calculate user balance
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
SECURITY DEFINER
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

-- Add RLS policies for the view
ALTER VIEW public.user_financial_summary OWNER TO postgres;

-- Grant access to authenticated users
GRANT SELECT ON public.user_financial_summary TO authenticated;

-- Create RLS policy for the view
CREATE POLICY "Users can view their own financial summary"
  ON public.user_financial_summary
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin');

-- Update the process-cancellation-approval function to set invoice fields
COMMENT ON FUNCTION public.calculate_user_balance IS 'Calculates the current financial balance for a user, including invoices and credit notes';