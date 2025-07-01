/*
  # Ajout de téléphone et seconde adresse aux centres

  1. Nouvelles Colonnes
    - `phone` (text) - Numéro de téléphone du centre
    - `address2` (text) - Seconde adresse du centre (optionnelle)
  
  2. Modifications
    - Ajout de ces deux colonnes à la table `centers`
*/

-- Ajout des nouvelles colonnes à la table centers
ALTER TABLE centers ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE centers ADD COLUMN IF NOT EXISTS address2 text;

-- Commentaires pour les nouvelles colonnes
COMMENT ON COLUMN centers.phone IS 'Numéro de téléphone du centre';
COMMENT ON COLUMN centers.address2 IS 'Seconde adresse du centre (si le centre a deux sites)';