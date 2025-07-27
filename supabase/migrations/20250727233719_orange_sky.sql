/*
  # Mise à jour de la fonction trigger_update_invoice_payment_status

  Cette migration met à jour la fonction trigger_update_invoice_payment_status pour mieux gérer :
  1. Les factures annulées lors de la dissociation de transactions
  2. La gestion des provisions de surpaiement liées aux transactions bancaires
  3. La réduction des provisions lors de la dissociation de transactions

  ## Changements principaux
  - Récupération du statut actuel de la facture
  - Protection contre la modification du statut des factures annulées
  - Lien direct des provisions aux transactions bancaires
  - Réduction des provisions lors de la dissociation
  - Éviter la création de provisions en double
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
  -- Déterminer l'ID de facture et le montant de la transaction en fonction du type d'opération
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
  
  -- Récupérer les informations de la facture, y compris son statut actuel
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
  
  -- Gestion spéciale pour les transactions dissociées (DELETE ou UPDATE vers unmatched)
  IF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND NEW.status = 'unmatched' AND OLD.status IN ('matched', 'partially_matched', 'overpaid')) THEN
    -- Réduire les provisions de surpaiement liées à cette transaction
    UPDATE user_provisions
    SET 
      amount_remaining = GREATEST(0, amount_remaining - v_transaction_amount),
      status = CASE 
        WHEN amount_remaining - v_transaction_amount <= 0 THEN 'fully_applied'
        WHEN amount_remaining - v_transaction_amount < amount_initial THEN 'partially_applied'
        ELSE status
      END
    WHERE source_bank_transaction_id = v_transaction_id 
      AND type = 'overpayment' 
      AND status IN ('available', 'partially_applied');
  END IF;
  
  -- Ne pas modifier le statut des factures annulées
  IF v_current_invoice_status = 'cancelled' THEN
    RETURN NULL;
  END IF;
  
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
    IF v_balance < 0 AND (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.status IN ('matched', 'partially_matched', 'overpaid'))) THEN
      v_credit_amount := ABS(v_balance);
      
      -- Vérifier s'il existe déjà une provision pour cette transaction
      SELECT id INTO v_existing_provision_id
      FROM user_provisions
      WHERE source_bank_transaction_id = v_transaction_id 
        AND type = 'overpayment'
      LIMIT 1;
      
      -- Créer une provision utilisateur pour le surpaiement seulement si elle n'existe pas déjà
      IF v_existing_provision_id IS NULL THEN
        INSERT INTO user_provisions (
          user_id,
          amount_initial,
          amount_remaining,
          type,
          source_invoice_id,
          source_bank_transaction_id,
          status,
          notes
        ) VALUES (
          v_user_id,
          v_credit_amount,
          v_credit_amount,
          'overpayment',
          v_invoice_id,
          v_transaction_id,
          'available',
          'Surpaiement de la facture ' || v_invoice_number
        );
        
        -- Log du surpaiement
        RAISE NOTICE 'Surpaiement de % € pour la facture %. Provision créée.', v_credit_amount, v_invoice_number;
      END IF;
    END IF;
  ELSE
    -- La facture est partiellement payée ou non payée
    IF v_total_payments > 0 THEN
      UPDATE invoices
      SET status = 'pending'
      WHERE id = v_invoice_id AND status NOT IN ('cancelled', 'pending');
      
      -- Mettre à jour les inscriptions liées à cette facture
      UPDATE registrations
      SET payment_status = 'pending'
      WHERE invoice_id = v_invoice_number AND payment_status = 'paid';
    ELSE
      -- Aucun paiement, remettre en pending si ce n'était pas déjà le cas
      UPDATE invoices
      SET status = 'pending', paid_at = NULL
      WHERE id = v_invoice_id AND status NOT IN ('cancelled', 'pending');
      
      -- Mettre à jour les inscriptions liées à cette facture
      UPDATE registrations
      SET payment_status = 'pending'
      WHERE invoice_id = v_invoice_number AND payment_status = 'paid';
    END IF;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;