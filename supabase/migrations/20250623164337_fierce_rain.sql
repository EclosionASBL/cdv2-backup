-- Drop existing functions first to avoid return type errors
DROP FUNCTION IF EXISTS get_available_periodes();
DROP FUNCTION IF EXISTS get_available_centers();
DROP FUNCTION IF EXISTS get_available_semaines();
DROP FUNCTION IF EXISTS get_financial_dashboard_data(text, uuid, text);

-- Function to get available periods
CREATE OR REPLACE FUNCTION get_available_periodes()
RETURNS TABLE (
  success BOOLEAN,
  periodes TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    true as success,
    ARRAY(
      SELECT DISTINCT s.periode 
      FROM sessions s 
      WHERE s.periode IS NOT NULL 
      ORDER BY s.periode
    ) as periodes;
END;
$$;

-- Function to get available centers
CREATE OR REPLACE FUNCTION get_available_centers()
RETURNS TABLE (
  success BOOLEAN,
  centers JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    true as success,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', c.id,
          'name', c.name
        )
      ),
      '[]'::jsonb
    ) as centers
  FROM centers c
  WHERE c.active = true
  ORDER BY c.name;
END;
$$;

-- Function to get available weeks
CREATE OR REPLACE FUNCTION get_available_semaines()
RETURNS TABLE (
  success BOOLEAN,
  semaines TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    true as success,
    ARRAY(
      SELECT DISTINCT s.semaine 
      FROM sessions s 
      WHERE s.semaine IS NOT NULL 
      ORDER BY s.semaine
    ) as semaines;
END;
$$;

-- Main financial dashboard function
CREATE OR REPLACE FUNCTION get_financial_dashboard_data(
  p_periode TEXT DEFAULT NULL,
  p_center_id UUID DEFAULT NULL,
  p_semaine TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  summary JSONB,
  invoices_by_status JSONB,
  invoices_by_month JSONB,
  recent_invoices JSONB,
  overdue_invoices JSONB,
  payments_by_center JSONB,
  payments_by_periode JSONB,
  payments_by_semaine JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_invoiced NUMERIC := 0;
  v_total_paid NUMERIC := 0;
  v_total_credit_notes NUMERIC := 0;
  v_net_receivable NUMERIC := 0;
  v_overdue_count INTEGER := 0;
  v_overdue_amount NUMERIC := 0;
  v_summary JSONB;
  v_invoices_by_status JSONB;
  v_invoices_by_month JSONB;
  v_recent_invoices JSONB;
  v_overdue_invoices JSONB;
  v_payments_by_center JSONB;
  v_payments_by_periode JSONB;
  v_payments_by_semaine JSONB;
BEGIN
  -- Build the base query with filters
  WITH filtered_invoices AS (
    SELECT i.*
    FROM invoices i
    WHERE (p_periode IS NULL OR EXISTS (
      SELECT 1 FROM registrations r
      JOIN sessions s ON r.activity_id = s.id
      WHERE r.id = ANY(i.registration_ids)
      AND s.periode = p_periode
    ))
    AND (p_center_id IS NULL OR EXISTS (
      SELECT 1 FROM registrations r
      JOIN sessions s ON r.activity_id = s.id
      WHERE r.id = ANY(i.registration_ids)
      AND s.center_id = p_center_id::uuid
    ))
    AND (p_semaine IS NULL OR EXISTS (
      SELECT 1 FROM registrations r
      JOIN sessions s ON r.activity_id = s.id
      WHERE r.id = ANY(i.registration_ids)
      AND s.semaine = p_semaine
    ))
  )
  
  -- Calculate summary statistics
  SELECT 
    COALESCE(SUM(amount), 0),
    COALESCE(SUM(total_payments), 0),
    COALESCE(SUM(amount) - SUM(total_payments), 0)
  INTO v_total_invoiced, v_total_paid, v_net_receivable
  FROM filtered_invoices;
  
  -- Get credit notes total
  SELECT COALESCE(SUM(amount), 0)
  INTO v_total_credit_notes
  FROM credit_notes cn
  WHERE (p_periode IS NULL OR EXISTS (
    SELECT 1 FROM registrations r
    JOIN sessions s ON r.activity_id = s.id
    WHERE r.id = cn.registration_id
    AND s.periode = p_periode
  ))
  AND (p_center_id IS NULL OR EXISTS (
    SELECT 1 FROM registrations r
    JOIN sessions s ON r.activity_id = s.id
    WHERE r.id = cn.registration_id
    AND s.center_id = p_center_id::uuid
  ))
  AND (p_semaine IS NULL OR EXISTS (
    SELECT 1 FROM registrations r
    JOIN sessions s ON r.activity_id = s.id
    WHERE r.id = cn.registration_id
    AND s.semaine = p_semaine
  ));
  
  -- Calculate overdue invoices
  SELECT 
    COUNT(*),
    COALESCE(SUM(amount - total_payments), 0)
  INTO v_overdue_count, v_overdue_amount
  FROM filtered_invoices
  WHERE status = 'pending' 
  AND due_date < CURRENT_DATE
  AND amount > total_payments;
  
  -- Build summary object
  v_summary := jsonb_build_object(
    'total_invoiced', v_total_invoiced,
    'total_paid', v_total_paid,
    'total_credit_notes', v_total_credit_notes,
    'net_receivable', v_net_receivable,
    'overdue_invoices_count', v_overdue_count,
    'overdue_invoices_amount', v_overdue_amount
  );
  
  -- Get invoices by status
  WITH status_summary AS (
    SELECT 
      status,
      COUNT(*) as count,
      COALESCE(SUM(amount), 0) as amount
    FROM filtered_invoices
    GROUP BY status
  )
  SELECT COALESCE(jsonb_agg(row_to_json(status_summary)), '[]'::jsonb)
  INTO v_invoices_by_status
  FROM status_summary;
  
  -- Get invoices by month
  WITH monthly_summary AS (
    SELECT 
      TO_CHAR(created_at, 'YYYY-MM') as month,
      COUNT(*) as count,
      COALESCE(SUM(amount), 0) as amount,
      COALESCE(SUM(total_payments), 0) as paid_amount
    FROM filtered_invoices
    GROUP BY TO_CHAR(created_at, 'YYYY-MM')
    ORDER BY month DESC
    LIMIT 12
  )
  SELECT COALESCE(jsonb_agg(row_to_json(monthly_summary)), '[]'::jsonb)
  INTO v_invoices_by_month
  FROM monthly_summary;
  
  -- Get recent invoices
  WITH recent_invoices_data AS (
    SELECT 
      i.invoice_number,
      i.amount,
      i.status,
      i.created_at,
      i.due_date,
      i.total_payments,
      u.prenom,
      u.nom,
      u.email
    FROM filtered_invoices i
    JOIN users u ON i.user_id = u.id
    ORDER BY i.created_at DESC
    LIMIT 20
  )
  SELECT COALESCE(jsonb_agg(row_to_json(recent_invoices_data)), '[]'::jsonb)
  INTO v_recent_invoices
  FROM recent_invoices_data;
  
  -- Get overdue invoices
  WITH overdue_invoices_data AS (
    SELECT 
      i.invoice_number,
      i.amount,
      i.status,
      i.created_at,
      i.due_date,
      i.total_payments,
      u.prenom,
      u.nom,
      u.email,
      (i.amount - i.total_payments) as amount_due,
      CASE 
        WHEN i.due_date IS NOT NULL 
        THEN EXTRACT(days FROM (CURRENT_DATE - i.due_date))::INTEGER
        ELSE NULL 
      END as days_overdue
    FROM filtered_invoices i
    JOIN users u ON i.user_id = u.id
    WHERE i.status = 'pending' 
    AND i.due_date < CURRENT_DATE
    AND i.amount > i.total_payments
    ORDER BY i.due_date ASC
  )
  SELECT COALESCE(jsonb_agg(row_to_json(overdue_invoices_data)), '[]'::jsonb)
  INTO v_overdue_invoices
  FROM overdue_invoices_data;
  
  -- Get payments by center
  WITH center_payments AS (
    SELECT 
      c.name as center_name,
      COUNT(DISTINCT i.id) as invoice_count,
      COALESCE(SUM(i.amount), 0) as total_amount,
      COALESCE(SUM(i.total_payments), 0) as paid_amount
    FROM filtered_invoices i
    JOIN registrations r ON r.id = ANY(i.registration_ids)
    JOIN sessions s ON r.activity_id = s.id
    JOIN centers c ON s.center_id = c.id
    GROUP BY c.id, c.name
    ORDER BY total_amount DESC
  )
  SELECT COALESCE(jsonb_agg(row_to_json(center_payments)), '[]'::jsonb)
  INTO v_payments_by_center
  FROM center_payments;
  
  -- Get payments by periode
  WITH periode_payments AS (
    SELECT 
      s.periode,
      COUNT(DISTINCT i.id) as invoice_count,
      COALESCE(SUM(i.amount), 0) as total_amount,
      COALESCE(SUM(i.total_payments), 0) as paid_amount
    FROM filtered_invoices i
    JOIN registrations r ON r.id = ANY(i.registration_ids)
    JOIN sessions s ON r.activity_id = s.id
    WHERE s.periode IS NOT NULL
    GROUP BY s.periode
    ORDER BY s.periode DESC
  )
  SELECT COALESCE(jsonb_agg(row_to_json(periode_payments)), '[]'::jsonb)
  INTO v_payments_by_periode
  FROM periode_payments;
  
  -- Get payments by semaine
  WITH semaine_payments AS (
    SELECT 
      s.semaine,
      COUNT(DISTINCT i.id) as invoice_count,
      COALESCE(SUM(i.amount), 0) as total_amount,
      COALESCE(SUM(i.total_payments), 0) as paid_amount
    FROM filtered_invoices i
    JOIN registrations r ON r.id = ANY(i.registration_ids)
    JOIN sessions s ON r.activity_id = s.id
    WHERE s.semaine IS NOT NULL
    GROUP BY s.semaine
    ORDER BY s.semaine DESC
  )
  SELECT COALESCE(jsonb_agg(row_to_json(semaine_payments)), '[]'::jsonb)
  INTO v_payments_by_semaine
  FROM semaine_payments;
  
  -- Return all data
  RETURN QUERY
  SELECT 
    true as success,
    v_summary,
    v_invoices_by_status,
    v_invoices_by_month,
    v_recent_invoices,
    v_overdue_invoices,
    v_payments_by_center,
    v_payments_by_periode,
    v_payments_by_semaine;
    
EXCEPTION
  WHEN OTHERS THEN
    RETURN QUERY
    SELECT 
      false as success,
      jsonb_build_object('error', SQLERRM) as summary,
      '[]'::jsonb as invoices_by_status,
      '[]'::jsonb as invoices_by_month,
      '[]'::jsonb as recent_invoices,
      '[]'::jsonb as overdue_invoices,
      '[]'::jsonb as payments_by_center,
      '[]'::jsonb as payments_by_periode,
      '[]'::jsonb as payments_by_semaine;
END;
$$;

-- Grant execute permissions to authenticated users with admin role
REVOKE ALL ON FUNCTION get_financial_dashboard_data FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_financial_dashboard_data TO authenticated;

REVOKE ALL ON FUNCTION get_available_periodes FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_available_periodes TO authenticated;

REVOKE ALL ON FUNCTION get_available_centers FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_available_centers TO authenticated;

REVOKE ALL ON FUNCTION get_available_semaines FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_available_semaines TO authenticated;