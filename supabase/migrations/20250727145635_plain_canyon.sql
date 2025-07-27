/*
  # Permettre la création de notes de crédit sans inscription

  1. Modifications de la table
    - Rendre la colonne `registration_id` nullable dans la table `credit_notes`
    - Cela permet de créer des notes de crédit pour des factures sans inscriptions associées

  2. Sécurité
    - Maintenir les politiques RLS existantes
    - Aucun changement aux contraintes de sécurité
*/

-- Rendre la colonne registration_id nullable dans la table credit_notes
ALTER TABLE credit_notes ALTER COLUMN registration_id DROP NOT NULL;

-- Ajouter un commentaire pour documenter le changement
COMMENT ON COLUMN credit_notes.registration_id IS 'ID de l''inscription associée (nullable pour les notes de crédit générales)';