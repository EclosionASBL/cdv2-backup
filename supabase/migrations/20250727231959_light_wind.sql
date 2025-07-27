/*
  # Fonction de dissociation des transactions bancaires

  1. Nouvelle fonction RPC
    - `disassociate_bank_transaction(p_transaction_id uuid)`
    - Dissocie une transaction bancaire d'une facture
    - Met à jour le statut de la transaction à 'unmatched'
    - Déclenche automatiquement la réévaluation du statut de la facture

  2. Sécurité
    - Vérification que l'utilisateur est admin
    - Validation de l'existence de la transaction
    - Gestion d'erreur complète

  3. Logique
    - Dissocie la transaction de la facture (invoice_id = NULL)
    - Change le statut à 'unmatched'
    - Le trigger existant `trigger_update_invoice_payment_status` se charge automatiquement
      de réévaluer le statut de la facture et des inscriptions
*/

-- Fonction pour dissocier une transaction bancaire d'une facture
CREATE OR REPLACE FUNCTION disassociate_bank_transaction(p_transaction_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_transaction_record bank_transactions%ROWTYPE;
  v_invoice_id uuid;
  v_user_role text;
BEGIN
  -- Vérifier que l'utilisateur est admin
  SELECT role INTO v_user_role
  FROM users
  WHERE id = auth.uid();
  
  IF v_user_role != 'admin' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Unauthorized: Admin access required'
    );
  END IF;

  -- Vérifier que la transaction existe et est associée à une facture
  SELECT * INTO v_transaction_record
  FROM bank_transactions
  WHERE id = p_transaction_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Transaction not found'
    );
  END IF;
  
  IF v_transaction_record.invoice_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Transaction is not associated with any invoice'
    );
  END IF;
  
  -- Stocker l'ID de la facture pour le retour
  v_invoice_id := v_transaction_record.invoice_id;
  
  -- Dissocier la transaction de la facture
  UPDATE bank_transactions
  SET 
    invoice_id = NULL,
    status = 'unmatched'
  WHERE id = p_transaction_id;
  
  -- Le trigger trigger_update_invoice_payment_status se chargera automatiquement
  -- de réévaluer le statut de la facture et des inscriptions associées
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Transaction successfully disassociated from invoice',
    'transaction_id', p_transaction_id,
    'previous_invoice_id', v_invoice_id
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', 'Error disassociating transaction: ' || SQLERRM
  );
END;
$$;