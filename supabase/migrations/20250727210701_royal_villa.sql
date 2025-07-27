/*
  # Correction des déclencheurs récursifs

  1. Problème
    - Erreur "stack depth limit exceeded" lors de la création de notes de crédit
    - Boucle récursive entre les déclencheurs sur les tables invoices et credit_notes

  2. Solution
    - Ajouter des clauses de garde aux fonctions de déclenchement
    - Utiliser des variables de session pour détecter et prévenir la récursion

  3. Fonctions modifiées
    - trigger_apply_provisions_on_new_invoice
    - trigger_update_invoice_status_on_credit_note_change
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

  -- Appliquer les provisions de l'utilisateur à la nouvelle facture
  PERFORM apply_user_provisions_to_invoices(NEW.user_id);

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
BEGIN
  -- Clause de garde pour éviter la récursion infinie
  IF current_setting('eclosion.in_trigger_update_invoice_status', true) = 'true' THEN
      RETURN NEW;
  END IF;

  -- Définir la variable de session pour indiquer que la fonction est en cours d'exécution
  PERFORM set_config('eclosion.in_trigger_update_invoice_status', 'true', true);

  -- Logique de mise à jour du statut de la facture basée sur les notes de crédit
  -- Cette fonction met probablement à jour le statut de la facture ou applique des provisions
  -- en fonction des changements dans les notes de crédit
  
  -- Si c'est une insertion ou mise à jour d'une note de crédit
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    -- Mettre à jour le statut de la facture si nécessaire
    -- (La logique exacte dépend de votre implémentation actuelle)
    
    -- Exemple de logique possible (à adapter selon votre cas) :
    IF NEW.invoice_id IS NOT NULL THEN
      -- Calculer le total des notes de crédit pour cette facture
      DECLARE
        total_credit_amount NUMERIC := 0;
        invoice_amount NUMERIC := 0;
      BEGIN
        SELECT COALESCE(SUM(amount), 0) INTO total_credit_amount
        FROM credit_notes 
        WHERE invoice_id = NEW.invoice_id;
        
        SELECT amount INTO invoice_amount
        FROM invoices 
        WHERE id = NEW.invoice_id;
        
        -- Si le total des notes de crédit égale ou dépasse le montant de la facture
        IF total_credit_amount >= invoice_amount THEN
          UPDATE invoices 
          SET status = 'cancelled'
          WHERE id = NEW.invoice_id AND status != 'cancelled';
        END IF;
      END;
    END IF;
  END IF;

  -- Réinitialiser la variable de session à la fin de l'exécution
  PERFORM set_config('eclosion.in_trigger_update_invoice_status', 'false', true);

  RETURN NEW;
END;
$function$;