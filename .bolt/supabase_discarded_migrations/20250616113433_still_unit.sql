/*
  # Correction du déclencheur pour les notes de crédit
  
  1. Problème
    - Le déclencheur `trigger_update_invoice_status_on_credit_note_change` appelle la fonction 
      `update_invoice_payment_status` avec un paramètre de type incorrect
    - La fonction attend un UUID (id de facture) mais le déclencheur lui passe un TEXT (numéro de facture)
    
  2. Solution
    - Recréer le déclencheur pour qu'il récupère correctement l'ID de la facture à partir du numéro
    - S'assurer que la fonction est appelée avec le bon type de paramètre
*/

-- Supprimer le déclencheur existant
DROP TRIGGER IF EXISTS trg_update_invoice_status_on_credit_note_change ON public.credit_notes;

-- Recréer la fonction de déclenchement avec la correction
CREATE OR REPLACE FUNCTION public.trigger_update_invoice_status_on_credit_note_change()
RETURNS TRIGGER AS $$
DECLARE
    v_invoice_id uuid;
    v_invoice_number text;
BEGIN
    -- Déterminer quel enregistrement utiliser en fonction du type d'opération
    IF TG_OP = 'DELETE' THEN
        -- Pour les opérations DELETE, utiliser l'enregistrement OLD
        v_invoice_id := OLD.invoice_id;
        v_invoice_number := OLD.invoice_number;
    ELSE
        -- Pour les opérations INSERT et UPDATE, utiliser l'enregistrement NEW
        v_invoice_id := NEW.invoice_id;
        v_invoice_number := NEW.invoice_number;
    END IF;
    
    -- Si nous avons directement l'ID de la facture, l'utiliser
    IF v_invoice_id IS NOT NULL THEN
        -- Appeler la fonction avec l'ID de la facture (UUID)
        PERFORM public.update_invoice_payment_status(v_invoice_id);
    -- Si nous avons seulement le numéro de facture, rechercher l'ID correspondant
    ELSIF v_invoice_number IS NOT NULL THEN
        -- Récupérer l'ID de la facture à partir du numéro
        SELECT id INTO v_invoice_id
        FROM invoices
        WHERE invoice_number = v_invoice_number;
        
        IF FOUND THEN
            -- Appeler la fonction avec l'ID de la facture (UUID)
            PERFORM public.update_invoice_payment_status(v_invoice_id);
        END IF;
    END IF;
    
    -- Retourner l'enregistrement approprié en fonction du type d'opération
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Recréer le déclencheur
CREATE TRIGGER trg_update_invoice_status_on_credit_note_change
AFTER INSERT OR UPDATE OR DELETE ON public.credit_notes
FOR EACH ROW
EXECUTE FUNCTION public.trigger_update_invoice_status_on_credit_note_change();

-- Ajouter un script pour réconcilier les factures existantes avec des notes de crédit
DO $$
DECLARE
    v_invoice_id uuid;
    v_count int := 0;
BEGIN
    -- Récupérer toutes les factures distinctes ayant des notes de crédit
    FOR v_invoice_id IN 
        SELECT DISTINCT i.id
        FROM invoices i
        LEFT JOIN credit_notes cn1 ON cn1.invoice_id = i.id
        LEFT JOIN credit_notes cn2 ON cn2.invoice_number = i.invoice_number
        WHERE cn1.id IS NOT NULL OR cn2.id IS NOT NULL
    LOOP
        -- Mettre à jour le statut de paiement de la facture
        PERFORM public.update_invoice_payment_status(v_invoice_id);
        v_count := v_count + 1;
    END LOOP;
    
    RAISE NOTICE 'Statut de paiement mis à jour pour % factures avec des notes de crédit', v_count;
END;
$$;