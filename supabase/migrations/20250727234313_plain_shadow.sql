/*
  # Mise à jour du trigger pour gérer les paiements sur factures annulées

  1. Modifications
    - Permet l'association de paiements aux factures annulées
    - Crée automatiquement des provisions pour les paiements sur factures annulées
    - Gère la logique de surpaiement pour les factures annulées
    - Améliore la gestion des provisions existantes

  2. Sécurité
    - Maintient les contrôles d'accès existants
    - Évite la création de provisions en double
    - Gère les cas de dissociation correctement
*/

CREATE OR REPLACE FUNCTION trigger_update_invoice_payment_status()
RETURNS TRIGGER AS $$
DECLARE
  v_invoice_id uuid;
  v_invoice_number text;
  v_user_id uuid;
  v_total_payments numeric := 0;
  v_invoice_amount numeric := 0;
  v_balance numeric := 0;
  v_credit_amount numeric := 0;
  v_current_invoice_status text;
  v_transaction_amount numeric := 0;
  v_transaction_id uuid;
  v_existing_provision_id uuid;
BEGIN
  -- Déterminer l'ID de facture en fonction du type d'opération
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    v_invoice_id := NEW.invoice_id;
    v_transaction_amount := NEW.amount;
    v_transaction_id := NEW.id;
    
    -- Si la transaction est liée à une facture par son numéro
    IF NEW.invoice_id IS NULL AND NEW.extracted_invoice_number IS NOT NULL THEN
      SELECT id, invoice_number INTO v_invoice_id, v_invoice_number
      FROM invoices
      WHERE invoice_number = NEW.extracted_invoice_number;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    v_invoice_id := OLD.invoice_id;
    v_transaction_amount := OLD.amount;
    v_transaction_id := OLD.id;
    
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
  SELECT amount, user_id, invoice_number, status 
  INTO v_invoice_amount, v_user_id, v_invoice_number, v_current_invoice_status
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
  
  -- Gestion spéciale pour les factures annulées
  IF v_current_invoice_status = 'cancelled' THEN
    -- Pour les factures annulées, tout paiement va en provision
    IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.status IN ('matched', 'partially_matched', 'overpaid') AND (OLD.status IS NULL OR OLD.status NOT IN ('matched', 'partially_matched', 'overpaid'))) THEN
      -- Vérifier qu'une provision n'existe pas déjà pour cette transaction
      SELECT id INTO v_existing_provision_id
      FROM user_provisions
      WHERE source_bank_transaction_id = v_transaction_id
      AND type = 'overpayment'
      AND status IN ('available', 'partially_applied');
      
      IF v_existing_provision_id IS NULL THEN
        -- Créer une provision pour le paiement sur facture annulée
        INSERT INTO user_provisions (
          user_id,
          amount_initial,
          amount_remaining,
          type,
          source_bank_transaction_id,
          source_invoice_id,
          status,
          notes
        ) VALUES (
          v_user_id,
          v_transaction_amount,
          v_transaction_amount,
          'overpayment',
          v_transaction_id,
          v_invoice_id,
          'available',
          'Paiement reçu pour la facture annulée ' || v_invoice_number
        );
        
        RAISE NOTICE 'Provision de % € créée pour paiement sur facture annulée %', v_transaction_amount, v_invoice_number;
      END IF;
    END IF;
    
    -- Gestion de la dissociation pour factures annulées
    IF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND NEW.status = 'unmatched' AND OLD.status IN ('matched', 'partially_matched', 'overpaid')) THEN
      -- Réduire ou supprimer la provision liée à cette transaction
      UPDATE user_provisions
      SET 
        amount_remaining = GREATEST(0, amount_remaining - v_transaction_amount),
        status = CASE 
          WHEN amount_remaining - v_transaction_amount <= 0 THEN 'fully_applied'
          ELSE status
        END,
        last_applied_at = CURRENT_TIMESTAMP
      WHERE source_bank_transaction_id = v_transaction_id
      AND type = 'overpayment'
      AND status IN ('available', 'partially_applied');
      
      RAISE NOTICE 'Provision réduite de % € suite à dissociation de transaction pour facture annulée %', v_transaction_amount, v_invoice_number;
    END IF;
    
    -- Ne pas modifier le statut des factures annulées
    RETURN NULL;
  END IF;
  
  -- Logique normale pour les factures non annulées
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
      
      -- Vérifier qu'une provision n'existe pas déjà pour cette transaction
      SELECT id INTO v_existing_provision_id
      FROM user_provisions
      WHERE source_bank_transaction_id = v_transaction_id
      AND type = 'overpayment'
      AND status IN ('available', 'partially_applied');
      
      IF v_existing_provision_id IS NULL THEN
        -- Créer une provision utilisateur pour le surpaiement
        INSERT INTO user_provisions (
          user_id,
          amount_initial,
          amount_remaining,
          type,
          source_bank_transaction_id,
          source_invoice_id,
          status,
          notes
        ) VALUES (
          v_user_id,
          v_credit_amount,
          v_credit_amount,
          'overpayment',
          v_transaction_id,
          v_invoice_id,
          'available',
          'Surpaiement de la facture ' || v_invoice_number
        );
        
        RAISE NOTICE 'Surpaiement de % € pour la facture %. Provision créée.', v_credit_amount, v_invoice_number;
      END IF;
    END IF;
  ELSE
    -- La facture est partiellement payée ou non payée
    IF v_total_payments > 0 THEN
      UPDATE invoices
      SET status = 'pending'
      WHERE id = v_invoice_id AND status != 'cancelled';
      
      -- Mettre à jour les inscriptions liées à cette facture
      UPDATE registrations
      SET payment_status = 'pending'
      WHERE invoice_id = v_invoice_number AND payment_status = 'paid';
    END IF;
  END IF;
  
  -- Gestion de la dissociation pour factures normales
  IF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND NEW.status = 'unmatched' AND OLD.status IN ('matched', 'partially_matched', 'overpaid')) THEN
    -- Réduire les provisions liées à cette transaction
    UPDATE user_provisions
    SET 
      amount_remaining = GREATEST(0, amount_remaining - v_transaction_amount),
      status = CASE 
        WHEN amount_remaining - v_transaction_amount <= 0 THEN 'fully_applied'
        ELSE status
      END,
      last_applied_at = CURRENT_TIMESTAMP
    WHERE source_bank_transaction_id = v_transaction_id
    AND type = 'overpayment'
    AND status IN ('available', 'partially_applied');
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;