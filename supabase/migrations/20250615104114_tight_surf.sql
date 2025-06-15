/*
  # Prévention des imports CSV en double
  
  1. Changements
    - Ajout d'un index unique sur la colonne raw_coda_file_path dans bank_transactions
    - Création d'une table pour suivre les imports de fichiers CSV
    - Ajout de fonctions pour vérifier si un fichier a déjà été importé
    
  2. Sécurité
    - Activation de RLS sur la nouvelle table
    - Ajout de politiques pour les administrateurs
*/

-- Créer un index unique sur raw_coda_file_path pour empêcher les doublons
-- Utilisation d'un index partiel pour n'inclure que les valeurs non-nulles
CREATE UNIQUE INDEX IF NOT EXISTS idx_bank_transactions_coda_file_path 
ON bank_transactions(raw_coda_file_path) 
WHERE raw_coda_file_path IS NOT NULL;

-- Créer une table pour suivre les imports de fichiers CSV
CREATE TABLE IF NOT EXISTS coda_file_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_path TEXT NOT NULL UNIQUE,
  imported_at TIMESTAMPTZ DEFAULT now(),
  imported_by UUID REFERENCES auth.users(id),
  batch_id TEXT,
  transaction_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'success',
  error_message TEXT
);

-- Activer RLS
ALTER TABLE coda_file_imports ENABLE ROW LEVEL SECURITY;

-- Créer une politique RLS pour les administrateurs
CREATE POLICY "Admins can manage coda_file_imports"
  ON coda_file_imports
  FOR ALL
  TO authenticated
  USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin')
  WITH CHECK ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

-- Créer une fonction pour vérifier si un fichier a déjà été importé
CREATE OR REPLACE FUNCTION public.check_csv_file_import(file_path TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM bank_transactions 
    WHERE raw_coda_file_path = file_path
    LIMIT 1
  );
END;
$$;

-- Accorder les permissions d'exécution aux utilisateurs authentifiés
GRANT EXECUTE ON FUNCTION public.check_csv_file_import(TEXT) TO authenticated;