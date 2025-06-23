/*
  # Tableau de bord financier pour l'administration
  
  1. Nouvelles fonctions
    - `get_financial_dashboard_data` - Fonction RPC pour obtenir les données financières agrégées
    - Accepte des filtres optionnels pour période, centre et semaine
    
  2. Métriques calculées
    - Montant total facturé
    - Montant total payé
    - Montant total des notes de crédit
    - Montant net à percevoir
    - Factures en souffrance (nombre et montant)
    
  3. Sécurité
    - Fonction accessible uniquement aux administrateurs
*/

-- Fonction pour obtenir les données du tableau de bord financier
CREATE OR REPLACE FUNCTION public.get_financial_dashboard_data(
  p_periode TEXT DEFAULT NULL,
  p_center_id UUID DEFAULT NULL,
  p_semaine TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
  v_total_invoiced NUMERIC;
  v_total_paid NUMERIC;
  v_total_credit_notes NUMERIC;
  v_net_receivable NUMERIC;
  v_overdue_invoices_count INTEGER;
  v_overdue_invoices_amount NUMERIC;
  v_invoices_by_status JSONB;
  v_invoices_by_month JSONB;
  v_recent_invoices JSONB;
  v_overdue_invoices JSONB;
  v_payments_by_center JSONB;
  v_payments_by_periode JSONB;
  v_payments_by_semaine JSONB;
  v_current_date DATE := CURRENT_DATE;
BEGIN
  -- Vérifier que l'utilisateur est un administrateur
  IF NOT EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND role = 'admin'
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Accès non autorisé. Seuls les administrateurs peuvent accéder à ces données.'
    );
  END IF;

  -- Construire la requête de base pour les factures filtrées
  WITH filtered_invoices AS (
    SELECT 
      i.*,
      r.activity_id,
      s.periode,
      s.center_id,
      s.semaine
    FROM 
      invoices i
    JOIN 
      registrations r ON r.invoice_id = i.invoice_number
    JOIN 
      sessions s ON s.id = r.activity_id
    WHERE 
      (p_periode IS NULL OR s.periode = p_periode)
      AND (p_center_id IS NULL OR s.center_id = p_center_id)
      AND (p_semaine IS NULL OR s.semaine = p_semaine)
    GROUP BY 
      i.id, i.invoice_number, r.activity_id, s.periode, s.center_id, s.semaine
  ),
  
  -- Calculer les montants totaux
  totals AS (
    SELECT
      COALESCE(SUM(amount), 0) AS total_invoiced,
      COALESCE(SUM(total_payments), 0) AS total_paid
    FROM 
      filtered_invoices
  ),
  
  -- Calculer le total des notes de crédit
  credit_notes_total AS (
    SELECT
      COALESCE(SUM(cn.amount), 0) AS total_credit_notes
    FROM 
      credit_notes cn
    JOIN 
      filtered_invoices fi ON cn.invoice_id = fi.id::text OR cn.invoice_number = fi.invoice_number
  ),
  
  -- Calculer les factures en souffrance
  overdue_invoices AS (
    SELECT
      COUNT(*) AS count,
      COALESCE(SUM(amount - total_payments), 0) AS amount
    FROM 
      filtered_invoices
    WHERE 
      status = 'pending'
      AND due_date < v_current_date
  ),
  
  -- Calculer les factures par statut
  invoices_by_status AS (
    SELECT
      status,
      COUNT(*) AS count,
      COALESCE(SUM(amount), 0) AS amount
    FROM 
      filtered_invoices
    GROUP BY 
      status
  ),
  
  -- Calculer les factures par mois
  invoices_by_month AS (
    SELECT
      TO_CHAR(created_at, 'YYYY-MM') AS month,
      COUNT(*) AS count,
      COALESCE(SUM(amount), 0) AS amount,
      COALESCE(SUM(total_payments), 0) AS paid_amount
    FROM 
      filtered_invoices
    GROUP BY 
      TO_CHAR(created_at, 'YYYY-MM')
    ORDER BY 
      month DESC
  ),
  
  -- Récupérer les factures récentes
  recent_invoices AS (
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
    FROM 
      filtered_invoices i
    JOIN 
      users u ON i.user_id = u.id
    ORDER BY 
      i.created_at DESC
    LIMIT 10
  ),
  
  -- Récupérer les factures en souffrance
  overdue_invoice_details AS (
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
      (i.amount - i.total_payments) AS amount_due,
      (v_current_date - i.due_date::date) AS days_overdue
    FROM 
      filtered_invoices i
    JOIN 
      users u ON i.user_id = u.id
    WHERE 
      i.status = 'pending'
      AND i.due_date < v_current_date
    ORDER BY 
      i.due_date ASC
  ),
  
  -- Calculer les paiements par centre
  payments_by_center AS (
    SELECT
      c.name AS center_name,
      COUNT(DISTINCT i.id) AS invoice_count,
      COALESCE(SUM(i.amount), 0) AS total_amount,
      COALESCE(SUM(i.total_payments), 0) AS paid_amount
    FROM 
      filtered_invoices i
    JOIN 
      centers c ON i.center_id = c.id
    GROUP BY 
      c.name
    ORDER BY 
      total_amount DESC
  ),
  
  -- Calculer les paiements par période
  payments_by_periode AS (
    SELECT
      i.periode,
      COUNT(DISTINCT i.id) AS invoice_count,
      COALESCE(SUM(i.amount), 0) AS total_amount,
      COALESCE(SUM(i.total_payments), 0) AS paid_amount
    FROM 
      filtered_invoices i
    WHERE 
      i.periode IS NOT NULL
    GROUP BY 
      i.periode
    ORDER BY 
      i.periode
  ),
  
  -- Calculer les paiements par semaine
  payments_by_semaine AS (
    SELECT
      i.semaine,
      COUNT(DISTINCT i.id) AS invoice_count,
      COALESCE(SUM(i.amount), 0) AS total_amount,
      COALESCE(SUM(i.total_payments), 0) AS paid_amount
    FROM 
      filtered_invoices i
    WHERE 
      i.semaine IS NOT NULL
    GROUP BY 
      i.semaine
    ORDER BY 
      i.semaine
  )
  
  -- Récupérer les totaux
  SELECT 
    t.total_invoiced,
    t.total_paid,
    cn.total_credit_notes,
    (t.total_invoiced - t.total_paid - cn.total_credit_notes) AS net_receivable,
    oi.count AS overdue_invoices_count,
    oi.amount AS overdue_invoices_amount
  INTO 
    v_total_invoiced,
    v_total_paid,
    v_total_credit_notes,
    v_net_receivable,
    v_overdue_invoices_count,
    v_overdue_invoices_amount
  FROM 
    totals t,
    credit_notes_total cn,
    overdue_invoices oi;
  
  -- Récupérer les factures par statut
  SELECT 
    jsonb_agg(
      jsonb_build_object(
        'status', status,
        'count', count,
        'amount', amount
      )
    )
  INTO 
    v_invoices_by_status
  FROM 
    invoices_by_status;
  
  -- Récupérer les factures par mois
  SELECT 
    jsonb_agg(
      jsonb_build_object(
        'month', month,
        'count', count,
        'amount', amount,
        'paid_amount', paid_amount
      )
    )
  INTO 
    v_invoices_by_month
  FROM 
    invoices_by_month;
  
  -- Récupérer les factures récentes
  SELECT 
    jsonb_agg(
      jsonb_build_object(
        'invoice_number', invoice_number,
        'amount', amount,
        'status', status,
        'created_at', created_at,
        'due_date', due_date,
        'total_payments', total_payments,
        'prenom', prenom,
        'nom', nom,
        'email', email
      )
    )
  INTO 
    v_recent_invoices
  FROM 
    recent_invoices;
  
  -- Récupérer les factures en souffrance
  SELECT 
    jsonb_agg(
      jsonb_build_object(
        'invoice_number', invoice_number,
        'amount', amount,
        'status', status,
        'created_at', created_at,
        'due_date', due_date,
        'total_payments', total_payments,
        'prenom', prenom,
        'nom', nom,
        'email', email,
        'amount_due', amount_due,
        'days_overdue', days_overdue
      )
    )
  INTO 
    v_overdue_invoices
  FROM 
    overdue_invoice_details;
  
  -- Récupérer les paiements par centre
  SELECT 
    jsonb_agg(
      jsonb_build_object(
        'center_name', center_name,
        'invoice_count', invoice_count,
        'total_amount', total_amount,
        'paid_amount', paid_amount
      )
    )
  INTO 
    v_payments_by_center
  FROM 
    payments_by_center;
  
  -- Récupérer les paiements par période
  SELECT 
    jsonb_agg(
      jsonb_build_object(
        'periode', periode,
        'invoice_count', invoice_count,
        'total_amount', total_amount,
        'paid_amount', paid_amount
      )
    )
  INTO 
    v_payments_by_periode
  FROM 
    payments_by_periode;
  
  -- Récupérer les paiements par semaine
  SELECT 
    jsonb_agg(
      jsonb_build_object(
        'semaine', semaine,
        'invoice_count', invoice_count,
        'total_amount', total_amount,
        'paid_amount', paid_amount
      )
    )
  INTO 
    v_payments_by_semaine
  FROM 
    payments_by_semaine;
  
  -- Construire le résultat final
  v_result := jsonb_build_object(
    'success', true,
    'summary', jsonb_build_object(
      'total_invoiced', v_total_invoiced,
      'total_paid', v_total_paid,
      'total_credit_notes', v_total_credit_notes,
      'net_receivable', v_net_receivable,
      'overdue_invoices_count', v_overdue_invoices_count,
      'overdue_invoices_amount', v_overdue_invoices_amount
    ),
    'invoices_by_status', COALESCE(v_invoices_by_status, '[]'::jsonb),
    'invoices_by_month', COALESCE(v_invoices_by_month, '[]'::jsonb),
    'recent_invoices', COALESCE(v_recent_invoices, '[]'::jsonb),
    'overdue_invoices', COALESCE(v_overdue_invoices, '[]'::jsonb),
    'payments_by_center', COALESCE(v_payments_by_center, '[]'::jsonb),
    'payments_by_periode', COALESCE(v_payments_by_periode, '[]'::jsonb),
    'payments_by_semaine', COALESCE(v_payments_by_semaine, '[]'::jsonb)
  );
  
  RETURN v_result;
END;
$$;

-- Accorder les permissions d'exécution aux utilisateurs authentifiés
GRANT EXECUTE ON FUNCTION public.get_financial_dashboard_data(TEXT, UUID, TEXT) TO authenticated;

-- Fonction pour récupérer les périodes disponibles
CREATE OR REPLACE FUNCTION public.get_available_periodes()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- Vérifier que l'utilisateur est un administrateur
  IF NOT EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND role = 'admin'
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Accès non autorisé. Seuls les administrateurs peuvent accéder à ces données.'
    );
  END IF;

  -- Récupérer les périodes distinctes
  SELECT 
    jsonb_agg(DISTINCT periode ORDER BY periode)
  INTO 
    v_result
  FROM 
    sessions
  WHERE 
    periode IS NOT NULL;

  RETURN jsonb_build_object(
    'success', true,
    'periodes', COALESCE(v_result, '[]'::jsonb)
  );
END;
$$;

-- Accorder les permissions d'exécution aux utilisateurs authentifiés
GRANT EXECUTE ON FUNCTION public.get_available_periodes() TO authenticated;

-- Fonction pour récupérer les semaines disponibles
CREATE OR REPLACE FUNCTION public.get_available_semaines()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- Vérifier que l'utilisateur est un administrateur
  IF NOT EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND role = 'admin'
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Accès non autorisé. Seuls les administrateurs peuvent accéder à ces données.'
    );
  END IF;

  -- Récupérer les semaines distinctes
  SELECT 
    jsonb_agg(DISTINCT semaine ORDER BY semaine)
  INTO 
    v_result
  FROM 
    sessions
  WHERE 
    semaine IS NOT NULL;

  RETURN jsonb_build_object(
    'success', true,
    'semaines', COALESCE(v_result, '[]'::jsonb)
  );
END;
$$;

-- Accorder les permissions d'exécution aux utilisateurs authentifiés
GRANT EXECUTE ON FUNCTION public.get_available_semaines() TO authenticated;

-- Fonction pour récupérer les centres disponibles
CREATE OR REPLACE FUNCTION public.get_available_centers()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- Vérifier que l'utilisateur est un administrateur
  IF NOT EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND role = 'admin'
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Accès non autorisé. Seuls les administrateurs peuvent accéder à ces données.'
    );
  END IF;

  -- Récupérer les centres
  SELECT 
    jsonb_agg(
      jsonb_build_object(
        'id', id,
        'name', name
      )
      ORDER BY name
    )
  INTO 
    v_result
  FROM 
    centers
  WHERE 
    active = true;

  RETURN jsonb_build_object(
    'success', true,
    'centers', COALESCE(v_result, '[]'::jsonb)
  );
END;
$$;

-- Accorder les permissions d'exécution aux utilisateurs authentifiés
GRANT EXECUTE ON FUNCTION public.get_available_centers() TO authenticated;