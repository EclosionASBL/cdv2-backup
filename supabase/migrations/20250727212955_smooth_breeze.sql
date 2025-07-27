/*
  # Correction de l'erreur de syntaxe dans trigger_update_invoice_status_on_credit_note_change

  1. Corrections apportées
    - Correction de la syntaxe `COALESCE(NEW, OLD).invoice_id` qui causait l'erreur
    - Utilisation conditionnelle de NEW/OLD selon l'opération (INSERT/UPDATE/DELETE)
    - Amélioration de la logique de mise à jour du statut des factures
    - Maintien de la clause de garde pour éviter la récursion

  2. Logique
    - Pour DELETE: utilise OLD.invoice_id et OLD.invoice_number
    - Pour INSERT/UPDATE: utilise NEW.invoice_id et NEW.invoice_number
    - Calcule le total des notes de crédit pour la facture
    - Met à jour le statut de la facture en conséquence
*/

CREATE OR REPLACE FUNCTION public.trigger_update_invoice_status_on_credit_note_change()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
    v_invoice_uuid uuid;
    v_invoice_number text;
    v_invoice_original_amount numeric;
    v_invoice_current_status text;
    v_total_credit_for_invoice numeric;
    v_invoice_record record;
BEGIN
    -- Clause de garde pour éviter la récursion infinie
    IF current_setting('eclosion.in_trigger_update_invoice_status', true) = 'true' THEN
        RETURN COALESCE(NEW, OLD);
    END IF;
    
    BEGIN
        PERFORM set_config('eclosion.in_trigger_update_invoice_status', 'true', true);

        -- Déterminer l'UUID de la facture et le numéro de facture affectés par la note de crédit
        -- Utiliser NEW pour INSERT/UPDATE, OLD pour DELETE
        IF TG_OP = 'DELETE' THEN
            -- Lors d'une suppression, nous avons besoin des informations de l'ancienne ligne
            v_invoice_uuid := OLD.invoice_id::uuid; -- credit_notes.invoice_id stocke l'UUID de la facture
            v_invoice_number := OLD.invoice_number;
        ELSE -- TG_OP = 'INSERT' OR TG_OP = 'UPDATE'
            -- Lors d'une insertion ou mise à jour, nous avons besoin des informations de la nouvelle ligne
            v_invoice_uuid := NEW.invoice_id::uuid;
            v_invoice_number := NEW.invoice_number;
        END IF;

        -- Si l'UUID de la facture est NULL, il n'y a rien à faire
        IF v_invoice_uuid IS NULL THEN
            PERFORM set_config('eclosion.in_trigger_update_invoice_status', 'false', true);
            RETURN COALESCE(NEW, OLD);
        END IF;

        -- Récupérer la facture concernée
        SELECT * INTO v_invoice_record
        FROM invoices
        WHERE id = v_invoice_uuid;

        IF NOT FOUND THEN
            -- La facture n'existe pas, ou a été supprimée. Rien à faire.
            PERFORM set_config('eclosion.in_trigger_update_invoice_status', 'false', true);
            RETURN COALESCE(NEW, OLD);
        END IF;

        v_invoice_original_amount := v_invoice_record.amount;
        v_invoice_current_status := v_invoice_record.status;

        -- Calculer le montant total des notes de crédit "émises" pour cette facture
        SELECT COALESCE(SUM(amount), 0)
        INTO v_total_credit_for_invoice
        FROM credit_notes
        WHERE invoice_id = v_invoice_uuid::text -- Comparer l'UUID de la facture (stocké en TEXT dans credit_notes)
          AND status = 'issued'; -- Ne considérer que les notes de crédit émises

        -- Déterminer le nouveau statut de la facture
        IF v_total_credit_for_invoice >= v_invoice_original_amount THEN
            -- Si le total des notes de crédit couvre ou dépasse le montant de la facture
            v_invoice_current_status := 'cancelled'; -- Ou 'refunded' si vous avez ce statut
        ELSE
            -- Si le total des notes de crédit est inférieur au montant de la facture,
            -- ou si toutes les notes de crédit ont été supprimées/non émises,
            -- le statut de la facture doit revenir à 'pending' ou 'paid' si elle l'était avant.
            IF v_invoice_current_status = 'cancelled' THEN
                -- Si elle était annulée à cause des notes de crédit, et qu'elle ne l'est plus,
                -- on la remet à 'pending' ou 'paid' selon les paiements reçus
                IF COALESCE(v_invoice_record.total_payments, 0) >= v_invoice_original_amount THEN
                    v_invoice_current_status := 'paid';
                ELSE
                    v_invoice_current_status := 'pending';
                END IF;
            END IF;
        END IF;

        -- Mettre à jour le statut de la facture si nécessaire
        IF v_invoice_current_status != v_invoice_record.status THEN
            UPDATE invoices
            SET status = v_invoice_current_status
            WHERE id = v_invoice_uuid;
        END IF;

        PERFORM set_config('eclosion.in_trigger_update_invoice_status', 'false', true);
        RETURN COALESCE(NEW, OLD);
        
    EXCEPTION WHEN OTHERS THEN
        -- En cas d'erreur, s'assurer que la variable est réinitialisée
        PERFORM set_config('eclosion.in_trigger_update_invoice_status', 'false', true);
        RAISE;
    END;
END;
$function$;