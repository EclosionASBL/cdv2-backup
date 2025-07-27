/*
  # Correction des déclencheurs récursifs

  1. Problème identifié
    - Boucle récursive entre les déclencheurs lors de la création de notes de crédit
    - `trg_apply_provisions_on_new_invoice` → `apply_user_provisions_to_invoices` → création note de crédit
    - `trg_update_invoice_status_on_credit_note_change` → mise à jour facture → redéclenchement

  2. Solution
    - Ajout de clauses de garde utilisant des variables de session
    - Prévention de la récursion infinie dans les fonctions de déclenchement
    - Maintien de la logique métier tout en évitant les boucles

  3. Fonctions modifiées
    - `trigger_apply_provisions_on_new_invoice`
    - `trigger_update_invoice_status_on_credit_note_change`
*/

-- Modifier la fonction trigger_apply_provisions_on_new_invoice avec clause de garde
CREATE OR REPLACE FUNCTION public.trigger_apply_provisions_on_new_invoice()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  -- Clause de garde pour éviter la récursion infinie
  IF current_setting('eclosion.in_trigger_apply_provisions', true) = 'true' THEN
      RETURN NEW;
  END IF;

  -- Définir la variable de session pour indiquer que la fonction est en cours d'exécution
  PERFORM set_config('eclosion.in_trigger_apply_provisions', 'true', true);

  BEGIN
    -- Appliquer les provisions de l'utilisateur à la nouvelle facture
    PERFORM apply_user_provisions_to_invoices(NEW.user_id);
  EXCEPTION WHEN OTHERS THEN
    -- En cas d'erreur, réinitialiser la variable et relancer l'erreur
    PERFORM set_config('eclosion.in_trigger_apply_provisions', 'false', true);
    RAISE;
  END;

  -- Réinitialiser la variable de session à la fin de l'exécution
  PERFORM set_config('eclosion.in_trigger_apply_provisions', 'false', true);

  RETURN NEW;
END;
$function$;

-- Modifier la fonction trigger_update_invoice_status_on_credit_note_change avec clause de garde
CREATE OR REPLACE FUNCTION public.trigger_update_invoice_status_on_credit_note_change()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  v_invoice_record RECORD;
  v_total_credit_amount NUMERIC := 0;
  v_invoice_id UUID;
BEGIN
  -- Clause de garde pour éviter la récursion infinie
  IF current_setting('eclosion.in_trigger_update_invoice_status', true) = 'true' THEN
      RETURN COALESCE(NEW, OLD);
  END IF;

  -- Définir la variable de session pour indiquer que la fonction est en cours d'exécution
  PERFORM set_config('eclosion.in_trigger_update_invoice_status', 'true', true);

  BEGIN
    -- Déterminer l'ID de la facture à partir de la note de crédit
    v_invoice_id := COALESCE(
      COALESCE(NEW, OLD).invoice_id::uuid,
      (SELECT id FROM invoices WHERE invoice_number = COALESCE(NEW, OLD).invoice_number LIMIT 1)
    );

    -- Si nous avons un ID de facture, mettre à jour son statut
    IF v_invoice_id IS NOT NULL THEN
      -- Calculer le montant total des notes de crédit pour cette facture
      SELECT COALESCE(SUM(amount), 0) INTO v_total_credit_amount
      FROM credit_notes 
      WHERE (invoice_id::uuid = v_invoice_id OR 
             invoice_number = (SELECT invoice_number FROM invoices WHERE id = v_invoice_id))
        AND id != COALESCE(OLD.id, '00000000-0000-0000-0000-000000000000'::uuid);

      -- Ajouter le montant de la note de crédit actuelle si c'est un INSERT ou UPDATE
      IF TG_OP IN ('INSERT', 'UPDATE') AND NEW IS NOT NULL THEN
        v_total_credit_amount := v_total_credit_amount + NEW.amount;
      END IF;

      -- Récupérer les informations de la facture
      SELECT * INTO v_invoice_record
      FROM invoices
      WHERE id = v_invoice_id;

      -- Mettre à jour le statut de la facture si nécessaire
      IF v_invoice_record IS NOT NULL THEN
        IF v_total_credit_amount >= v_invoice_record.amount THEN
          -- Si le montant des notes de crédit couvre la facture entière, la marquer comme annulée
          UPDATE invoices 
          SET status = 'cancelled'
          WHERE id = v_invoice_id AND status != 'cancelled';
        END IF;
      END IF;
    END IF;

  EXCEPTION WHEN OTHERS THEN
    -- En cas d'erreur, réinitialiser la variable et relancer l'erreur
    PERFORM set_config('eclosion.in_trigger_update_invoice_status', 'false', true);
    RAISE;
  END;

  -- Réinitialiser la variable de session à la fin de l'exécution
  PERFORM set_config('eclosion.in_trigger_update_invoice_status', 'false', true);

  RETURN COALESCE(NEW, OLD);
END;
$function$;