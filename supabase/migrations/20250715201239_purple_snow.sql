/*
  # Ajout de la table user_provisions et modification du trigger de mise à jour des factures

  1. Nouvelle Table
    - `user_provisions` - Stocke les provisions des utilisateurs (crédits, surpaiements)
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key)
      - `amount_initial` (numeric)
      - `amount_remaining` (numeric)
      - `type` (text)
      - `source_invoice_id` (uuid, nullable)
      - `source_bank_transaction_id` (uuid, nullable)
      - `created_at` (timestamp)
      - `last_applied_at` (timestamp, nullable)
      - `status` (text)
      
  2. Modifications
    - Mise à jour de la fonction `trigger_update_invoice_payment_status` pour gérer les provisions
    - Ajout d'un type enum pour les statuts de provision
*/

-- Création du type enum pour les statuts de provision
CREATE TYPE provision_status_enum AS ENUM (
  'available',
  'partially_applied',
  'fully_applied',
  'refund_requested',
  'refunded'
);

-- Création du type enum pour les types de provision
CREATE TYPE provision_type_enum AS ENUM (
  'overpayment',
  'credit_note_refund',
  'admin_manual_credit'
);

-- Création de la table user_provisions
CREATE TABLE IF NOT EXISTS public.user_provisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_initial numeric NOT NULL,
  amount_remaining numeric NOT NULL,
  type provision_type_enum NOT NULL,
  source_invoice_id uuid REFERENCES public.invoices(id),
  source_bank_transaction_id uuid REFERENCES public.bank_transactions(id),
  created_at timestamptz DEFAULT now(),
  last_applied_at timestamptz,
  status provision_status_enum NOT NULL DEFAULT 'available',
  notes text
);

-- Ajout d'index pour améliorer les performances
CREATE INDEX idx_user_provisions_user_id ON public.user_provisions(user_id);
CREATE INDEX idx_user_provisions_status ON public.user_provisions(status);
CREATE INDEX idx_user_provisions_source_invoice_id ON public.user_provisions(source_invoice_id) WHERE source_invoice_id IS NOT NULL;
CREATE INDEX idx_user_provisions_source_bank_transaction_id ON public.user_provisions(source_bank_transaction_id) WHERE source_bank_transaction_id IS NOT NULL;

-- Activer RLS sur la table user_provisions
ALTER TABLE public.user_provisions ENABLE ROW LEVEL SECURITY;

-- Politiques RLS pour user_provisions
CREATE POLICY "Users can view their own provisions" 
  ON public.user_provisions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all provisions" 
  ON public.user_provisions
  FOR ALL
  TO authenticated
  USING (get_user_role(auth.uid()) = 'admin')
  WITH CHECK (get_user_role(auth.uid()) = 'admin');

-- Modification de la fonction trigger_update_invoice_payment_status
CREATE OR REPLACE FUNCTION public.trigger_update_invoice_payment_status()
RETURNS TRIGGER AS $$
DECLARE
  v_invoice_id uuid;
  v_invoice_number text;
  v_user_id uuid;
  v_total_payments numeric := 0;
  v_invoice_amount numeric := 0;
  v_balance numeric := 0;
  v_credit_amount numeric := 0;
BEGIN
  -- Déterminer l'ID de facture en fonction du type d'opération
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    v_invoice_id := NEW.invoice_id;
    
    -- Si la transaction est liée à une facture par son numéro
    IF NEW.invoice_id IS NULL AND NEW.extracted_invoice_number IS NOT NULL THEN
      SELECT id, invoice_number INTO v_invoice_id, v_invoice_number
      FROM invoices
      WHERE invoice_number = NEW.extracted_invoice_number;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    v_invoice_id := OLD.invoice_id;
    
    -- Si la transaction est liée à une facture par son numéro
    IF OLD.invoice_id IS NULL AND OLD.extracted_invoice_number IS NOT NULL THEN
      SELECT id, invoice_number INTO v_invoice_id, v_invoice_number
      FROM invoices
      WHERE invoice_number = OLD.extracted_invoice_number;
    END IF;
  END IF;
  
  -- Si aucune facture n'est trouvée, sortir
  IF v_invoice_id IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Récupérer les informations de la facture
  SELECT amount, user_id, invoice_number INTO v_invoice_amount, v_user_id, v_invoice_number
  FROM invoices
  WHERE id = v_invoice_id;
  
  -- Calculer le total des paiements pour cette facture
  SELECT COALESCE(SUM(amount), 0) INTO v_total_payments
  FROM bank_transactions
  WHERE invoice_id = v_invoice_id AND status IN ('matched', 'partially_matched', 'overpaid');
  
  -- Calculer le solde (montant facture - paiements)
  v_balance := v_invoice_amount - v_total_payments;
  
  -- Mettre à jour le total des paiements dans la facture
  UPDATE invoices
  SET total_payments = v_total_payments
  WHERE id = v_invoice_id;
  
  -- Mettre à jour le statut de la facture en fonction du solde
  IF v_balance <= 0 THEN
    -- La facture est entièrement payée
    UPDATE invoices
    SET status = 'paid', paid_at = CURRENT_TIMESTAMP
    WHERE id = v_invoice_id AND status != 'paid';
    
    -- Mettre à jour les inscriptions liées à cette facture
    UPDATE registrations
    SET payment_status = 'paid'
    WHERE invoice_id = v_invoice_number AND payment_status = 'pending';
    
    -- Si le solde est négatif (surpaiement), créer une provision utilisateur
    IF v_balance < 0 THEN
      v_credit_amount := ABS(v_balance);
      
      -- Créer une provision utilisateur pour le surpaiement
      INSERT INTO user_provisions (
        user_id,
        amount_initial,
        amount_remaining,
        type,
        source_invoice_id,
        status,
        notes
      ) VALUES (
        v_user_id,
        v_credit_amount,
        v_credit_amount,
        'overpayment',
        v_invoice_id,
        'available',
        'Surpaiement de la facture ' || v_invoice_number
      );
      
      -- Log du surpaiement
      RAISE NOTICE 'Surpaiement de % € pour la facture %. Provision créée.', v_credit_amount, v_invoice_number;
    END IF;
  ELSE
    -- La facture est partiellement payée ou non payée
    IF v_total_payments > 0 THEN
      UPDATE invoices
      SET status = 'pending'
      WHERE id = v_invoice_id AND status != 'cancelled';
    ELSE
      -- Aucun paiement, ne pas changer le statut
      NULL;
    END IF;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Ajout d'une nouvelle fonction pour appliquer les provisions aux factures
CREATE OR REPLACE FUNCTION public.apply_user_provisions_to_invoices(p_user_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_provision record;
  v_invoice record;
  v_amount_to_apply numeric;
  v_applied_amount numeric := 0;
  v_total_applied numeric := 0;
  v_result jsonb;
BEGIN
  -- Récupérer toutes les provisions disponibles pour l'utilisateur
  FOR v_provision IN (
    SELECT * FROM user_provisions
    WHERE user_id = p_user_id
      AND status IN ('available', 'partially_applied')
      AND amount_remaining > 0
    ORDER BY created_at ASC
  ) LOOP
    -- Pour chaque provision, chercher les factures en attente
    FOR v_invoice IN (
      SELECT * FROM invoices
      WHERE user_id = p_user_id
        AND status = 'pending'
        AND amount > total_payments
      ORDER BY created_at ASC
    ) LOOP
      -- Calculer le montant à appliquer
      v_amount_to_apply := LEAST(
        v_provision.amount_remaining,
        v_invoice.amount - v_invoice.total_payments
      );
      
      IF v_amount_to_apply > 0 THEN
        -- Mettre à jour la facture
        UPDATE invoices
        SET 
          total_payments = total_payments + v_amount_to_apply,
          status = CASE 
            WHEN total_payments + v_amount_to_apply >= amount THEN 'paid'
            ELSE 'pending'
          END,
          paid_at = CASE 
            WHEN total_payments + v_amount_to_apply >= amount THEN CURRENT_TIMESTAMP
            ELSE paid_at
          END
        WHERE id = v_invoice.id;
        
        -- Mettre à jour la provision
        UPDATE user_provisions
        SET 
          amount_remaining = amount_remaining - v_amount_to_apply,
          last_applied_at = CURRENT_TIMESTAMP,
          status = CASE 
            WHEN amount_remaining - v_amount_to_apply <= 0 THEN 'fully_applied'
            ELSE 'partially_applied'
          END
        WHERE id = v_provision.id;
        
        -- Mettre à jour les compteurs
        v_applied_amount := v_applied_amount + v_amount_to_apply;
        v_total_applied := v_total_applied + v_amount_to_apply;
        
        -- Si la provision est épuisée, passer à la suivante
        IF v_provision.amount_remaining - v_amount_to_apply <= 0 THEN
          EXIT;
        END IF;
      END IF;
    END LOOP;
  END LOOP;
  
  -- Retourner le résultat
  v_result := jsonb_build_object(
    'success', true,
    'user_id', p_user_id,
    'total_applied', v_total_applied,
    'invoices_updated', v_applied_amount > 0
  );
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Ajout d'un trigger pour appliquer automatiquement les provisions lors de la création d'une nouvelle facture
CREATE OR REPLACE FUNCTION public.trigger_apply_provisions_on_new_invoice()
RETURNS TRIGGER AS $$
BEGIN
  -- Appliquer les provisions de l'utilisateur à la nouvelle facture
  PERFORM apply_user_provisions_to_invoices(NEW.user_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Création du trigger sur la table invoices
DROP TRIGGER IF EXISTS trg_apply_provisions_on_new_invoice ON public.invoices;
CREATE TRIGGER trg_apply_provisions_on_new_invoice
AFTER INSERT ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION trigger_apply_provisions_on_new_invoice();