/*
  # Fix Financial Dashboard Functions

  1. Corrections
    - Fix get_available_centers function to include center name in GROUP BY clause
    - Fix get_available_periodes function to properly return unique periods
    - Fix get_available_semaines function to properly return unique weeks
    - Fix get_financial_dashboard_data function to handle filters correctly

  2. Security
    - All functions are set as SECURITY DEFINER to bypass RLS
*/

-- Fix get_available_centers function
CREATE OR REPLACE FUNCTION get_available_centers()
RETURNS TABLE (
  id uuid,
  name text,
  session_count bigint
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    c.id,
    c.name,
    COUNT(s.id) as session_count
  FROM centers c
  LEFT JOIN sessions s ON c.id = s.center_id
  WHERE c.active = true
  GROUP BY c.id, c.name
  ORDER BY c.name;
$$;

-- Fix get_available_periodes function
CREATE OR REPLACE FUNCTION get_available_periodes()
RETURNS TABLE (
  success boolean,
  periodes text[]
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    true as success,
    ARRAY(
      SELECT DISTINCT periode
      FROM sessions
      WHERE active = true
      ORDER BY periode
    ) as periodes;
END;
$$;

-- Fix get_available_semaines function
CREATE OR REPLACE FUNCTION get_available_semaines()
RETURNS TABLE (
  success boolean,
  semaines text[]
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    true as success,
    ARRAY(
      SELECT DISTINCT semaine
      FROM sessions
      WHERE active = true AND semaine IS NOT NULL
      ORDER BY semaine
    ) as semaines;
END;
$$;

-- Fix get_financial_dashboard_data function
CREATE OR REPLACE FUNCTION get_financial_dashboard_data(
  p_periode text DEFAULT NULL,
  p_center_id uuid DEFAULT NULL,
  p_semaine text DEFAULT NULL
)
RETURNS TABLE (
  success boolean,
  summary jsonb,
  invoices_by_status jsonb,
  invoices_by_month jsonb,
  recent_invoices jsonb,
  overdue_invoices jsonb,
  payments_by_center jsonb,
  payments_by_periode jsonb,
  payments_by_semaine jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_summary jsonb;
  v_invoices_by_status jsonb;
  v_invoices_by_month jsonb;
  v_recent_invoices jsonb;
  v_overdue_invoices jsonb;
  v_payments_by_center jsonb;
  v_payments_by_periode jsonb;
  v_payments_by_semaine jsonb;
  v_registration_ids uuid[];
BEGIN
  -- Get registration IDs based on filters
  IF p_periode IS NOT NULL OR p_center_id IS NOT NULL OR p_semaine IS NOT NULL THEN
    SELECT array_agg(r.id)
    INTO v_registration_ids
    FROM registrations r
    JOIN sessions s ON r.activity_id = s.id
    WHERE (p_periode IS NULL OR s.periode = p_periode)
    AND (p_center_id IS NULL OR s.center_id = p_center_id)
    AND (p_semaine IS NULL OR s.semaine = p_semaine);
  END IF;

  -- Get summary data
  SELECT jsonb_build_object(
    'total_invoices', COUNT(i.id),
    'paid_invoices', COUNT(i.id) FILTER (WHERE i.status = 'paid'),
    'pending_invoices', COUNT(i.id) FILTER (WHERE i.status = 'pending'),
    'cancelled_invoices', COUNT(i.id) FILTER (WHERE i.status = 'cancelled'),
    'payment_rate', CASE 
      WHEN COUNT(i.id) > 0 THEN 
        ROUND((COUNT(i.id) FILTER (WHERE i.status = 'paid')::numeric / COUNT(i.id)) * 100, 2)
      ELSE 0
    END
  )
  INTO v_summary
  FROM invoices i
  WHERE (v_registration_ids IS NULL OR 
         i.registration_ids && v_registration_ids);

  -- Get invoices by status
  SELECT jsonb_agg(
    jsonb_build_object(
      'status', status,
      'count', count,
      'total_amount', total_amount
    )
  )
  INTO v_invoices_by_status
  FROM (
    SELECT 
      i.status,
      COUNT(i.id) as count,
      SUM(i.amount) as total_amount
    FROM invoices i
    WHERE (v_registration_ids IS NULL OR 
           i.registration_ids && v_registration_ids)
    GROUP BY i.status
    ORDER BY i.status
  ) as status_summary;

  -- Get invoices by month
  SELECT jsonb_agg(
    jsonb_build_object(
      'month', month,
      'total_amount', total_amount,
      'invoice_count', invoice_count
    )
  )
  INTO v_invoices_by_month
  FROM (
    SELECT 
      DATE_TRUNC('month', i.created_at) as month,
      SUM(i.amount) as total_amount,
      COUNT(i.id) as invoice_count
    FROM invoices i
    WHERE (v_registration_ids IS NULL OR 
           i.registration_ids && v_registration_ids)
    GROUP BY DATE_TRUNC('month', i.created_at)
    ORDER BY month DESC
    LIMIT 12
  ) as month_summary;

  -- Get recent invoices
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', i.id,
      'invoice_number', i.invoice_number,
      'created_at', i.created_at,
      'amount', i.amount,
      'status', i.status,
      'user_id', i.user_id,
      'user_name', CONCAT(u.prenom, ' ', u.nom),
      'user_email', u.email
    )
  )
  INTO v_recent_invoices
  FROM invoices i
  JOIN users u ON i.user_id = u.id
  WHERE (v_registration_ids IS NULL OR 
         i.registration_ids && v_registration_ids)
  ORDER BY i.created_at DESC
  LIMIT 10;

  -- Get overdue invoices
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', i.id,
      'invoice_number', i.invoice_number,
      'created_at', i.created_at,
      'due_date', i.due_date,
      'amount', i.amount,
      'user_id', i.user_id,
      'user_name', CONCAT(u.prenom, ' ', u.nom),
      'user_email', u.email,
      'days_overdue', EXTRACT(DAY FROM (CURRENT_DATE - i.due_date))
    )
  )
  INTO v_overdue_invoices
  FROM invoices i
  JOIN users u ON i.user_id = u.id
  WHERE i.status = 'pending' 
  AND i.due_date < CURRENT_DATE
  AND (v_registration_ids IS NULL OR 
       i.registration_ids && v_registration_ids)
  ORDER BY i.due_date ASC;

  -- Get payments by center
  SELECT jsonb_agg(
    jsonb_build_object(
      'center_id', c.id,
      'center_name', c.name,
      'total_amount', COALESCE(SUM(i.amount), 0),
      'invoice_count', COUNT(DISTINCT i.id)
    )
  )
  INTO v_payments_by_center
  FROM centers c
  LEFT JOIN sessions s ON c.id = s.center_id
  LEFT JOIN registrations r ON s.id = r.activity_id
  LEFT JOIN invoices i ON r.invoice_id = i.invoice_number
  WHERE c.active = true
  AND (p_center_id IS NULL OR c.id = p_center_id)
  AND (p_periode IS NULL OR s.periode = p_periode)
  AND (p_semaine IS NULL OR s.semaine = p_semaine)
  GROUP BY c.id, c.name
  ORDER BY c.name;

  -- Get payments by periode
  SELECT jsonb_agg(
    jsonb_build_object(
      'periode', s.periode,
      'total_amount', COALESCE(SUM(i.amount), 0),
      'invoice_count', COUNT(DISTINCT i.id)
    )
  )
  INTO v_payments_by_periode
  FROM sessions s
  LEFT JOIN registrations r ON s.id = r.activity_id
  LEFT JOIN invoices i ON r.invoice_id = i.invoice_number
  WHERE s.active = true
  AND (p_center_id IS NULL OR s.center_id = p_center_id)
  AND (p_periode IS NULL OR s.periode = p_periode)
  AND (p_semaine IS NULL OR s.semaine = p_semaine)
  GROUP BY s.periode
  ORDER BY s.periode;

  -- Get payments by semaine
  SELECT jsonb_agg(
    jsonb_build_object(
      'semaine', s.semaine,
      'total_amount', COALESCE(SUM(i.amount), 0),
      'invoice_count', COUNT(DISTINCT i.id)
    )
  )
  INTO v_payments_by_semaine
  FROM sessions s
  LEFT JOIN registrations r ON s.id = r.activity_id
  LEFT JOIN invoices i ON r.invoice_id = i.invoice_number
  WHERE s.active = true
  AND s.semaine IS NOT NULL
  AND (p_center_id IS NULL OR s.center_id = p_center_id)
  AND (p_periode IS NULL OR s.periode = p_periode)
  AND (p_semaine IS NULL OR s.semaine = p_semaine)
  GROUP BY s.semaine
  ORDER BY s.semaine;

  -- Return all data
  RETURN QUERY
  SELECT 
    true as success,
    COALESCE(v_summary, '{}'::jsonb) as summary,
    COALESCE(v_invoices_by_status, '[]'::jsonb) as invoices_by_status,
    COALESCE(v_invoices_by_month, '[]'::jsonb) as invoices_by_month,
    COALESCE(v_recent_invoices, '[]'::jsonb) as recent_invoices,
    COALESCE(v_overdue_invoices, '[]'::jsonb) as overdue_invoices,
    COALESCE(v_payments_by_center, '[]'::jsonb) as payments_by_center,
    COALESCE(v_payments_by_periode, '[]'::jsonb) as payments_by_periode,
    COALESCE(v_payments_by_semaine, '[]'::jsonb) as payments_by_semaine;
END;
$$;