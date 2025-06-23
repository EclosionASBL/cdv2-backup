/*
  # Financial Dashboard Views and Functions

  1. New Views
    - `invoices_by_status` - Aggregates invoice data by status
    - `monthly_revenue` - Calculates revenue by month
    - `payment_statistics` - Provides payment conversion metrics
  
  2. New Functions
    - `get_financial_dashboard_data()` - Returns consolidated dashboard data
    - `get_available_centers()` - Returns centers with registration counts
  
  3. Updates
    - Fixes GROUP BY clause issues in existing functions
*/

-- Create view for invoices by status
CREATE OR REPLACE VIEW invoices_by_status AS
SELECT
  status,
  COUNT(*) as count,
  SUM(amount) as total_amount
FROM
  invoices
GROUP BY
  status;

-- Create view for monthly revenue
CREATE OR REPLACE VIEW monthly_revenue AS
SELECT
  DATE_TRUNC('month', created_at) as month,
  SUM(amount) as total_amount,
  COUNT(*) as invoice_count
FROM
  invoices
WHERE
  status = 'paid'
GROUP BY
  DATE_TRUNC('month', created_at)
ORDER BY
  month DESC;

-- Create view for payment statistics
CREATE OR REPLACE VIEW payment_statistics AS
SELECT
  COUNT(*) as total_invoices,
  COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_invoices,
  COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_invoices,
  COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_invoices,
  ROUND(COUNT(CASE WHEN status = 'paid' THEN 1 END)::numeric / NULLIF(COUNT(*), 0)::numeric * 100, 2) as payment_rate
FROM
  invoices;

-- Create function to get financial dashboard data
CREATE OR REPLACE FUNCTION get_financial_dashboard_data()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  WITH invoice_stats AS (
    SELECT
      status,
      COUNT(*) as count,
      SUM(amount) as total_amount
    FROM
      invoices
    GROUP BY
      status
  ),
  monthly_stats AS (
    SELECT
      TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') as month,
      SUM(amount) as total_amount,
      COUNT(*) as invoice_count
    FROM
      invoices
    WHERE
      status = 'paid'
    GROUP BY
      DATE_TRUNC('month', created_at)
    ORDER BY
      DATE_TRUNC('month', created_at) DESC
    LIMIT 12
  ),
  payment_stats AS (
    SELECT
      COUNT(*) as total_invoices,
      COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_invoices,
      COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_invoices,
      COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_invoices,
      ROUND(COUNT(CASE WHEN status = 'paid' THEN 1 END)::numeric / NULLIF(COUNT(*), 0)::numeric * 100, 2) as payment_rate
    FROM
      invoices
  ),
  credit_note_stats AS (
    SELECT
      COUNT(*) as total_credit_notes,
      SUM(amount) as total_credit_amount
    FROM
      credit_notes
  ),
  recent_transactions AS (
    SELECT
      bt.id,
      bt.transaction_date,
      bt.amount,
      bt.status,
      bt.communication,
      bt.counterparty_name,
      i.invoice_number
    FROM
      bank_transactions bt
    LEFT JOIN
      invoices i ON bt.invoice_id = i.id
    ORDER BY
      bt.transaction_date DESC
    LIMIT 10
  )
  SELECT
    json_build_object(
      'invoice_stats', (SELECT json_agg(row_to_json(invoice_stats)) FROM invoice_stats),
      'monthly_stats', (SELECT json_agg(row_to_json(monthly_stats)) FROM monthly_stats),
      'payment_stats', (SELECT row_to_json(payment_stats) FROM payment_stats),
      'credit_note_stats', (SELECT row_to_json(credit_note_stats) FROM credit_note_stats),
      'recent_transactions', (SELECT json_agg(row_to_json(recent_transactions)) FROM recent_transactions)
    ) INTO result;
    
  RETURN result;
END;
$$;

-- Create function to get available centers with registration counts
CREATE OR REPLACE FUNCTION get_available_centers()
RETURNS TABLE (
  id uuid,
  name text,
  registration_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.name,
    COUNT(r.id) as registration_count
  FROM 
    centers c
  LEFT JOIN 
    sessions s ON c.id = s.center_id
  LEFT JOIN 
    registrations r ON s.id = r.activity_id
  WHERE 
    c.active = true
  GROUP BY 
    c.id, c.name
  ORDER BY 
    c.name;
END;
$$;