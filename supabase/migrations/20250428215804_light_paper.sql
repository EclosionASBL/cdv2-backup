/*
  # Fix column names in kids table
  
  1. Changes
    - Rename columns to use snake_case consistently:
      - 'dateNaissance' -> 'date_naissance'
      - 'nNational' -> 'n_national'
      - 'symptomsAllergies' -> 'symptoms_allergies'
      - 'traitementAllergies' -> 'traitement_allergies'
      - 'documentMedical' -> 'document_medical'
      - 'besoinAnimateur' -> 'besoin_animateur'
      - 'niveauNatation' -> 'niveau_natation'
      - 'autoriseSortieSeul' -> 'autorise_sortie_seul'
      - 'personnesAutorisees' -> 'personnes_autorisees'
*/

DO $$ 
BEGIN
  -- Only rename if the old column exists and new doesn't
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'kids' 
    AND column_name = 'datenaissance'
  ) THEN
    ALTER TABLE kids RENAME COLUMN datenaissance TO date_naissance;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'kids' 
    AND column_name = 'nnational'
  ) THEN
    ALTER TABLE kids RENAME COLUMN nnational TO n_national;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'kids' 
    AND column_name = 'symptomsallergies'
  ) THEN
    ALTER TABLE kids RENAME COLUMN symptomsallergies TO symptoms_allergies;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'kids' 
    AND column_name = 'traitementallergies'
  ) THEN
    ALTER TABLE kids RENAME COLUMN traitementallergies TO traitement_allergies;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'kids' 
    AND column_name = 'documentmedical'
  ) THEN
    ALTER TABLE kids RENAME COLUMN documentmedical TO document_medical;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'kids' 
    AND column_name = 'besoinanimateur'
  ) THEN
    ALTER TABLE kids RENAME COLUMN besoinanimateur TO besoin_animateur;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'kids' 
    AND column_name = 'niveaunatation'
  ) THEN
    ALTER TABLE kids RENAME COLUMN niveaunatation TO niveau_natation;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'kids' 
    AND column_name = 'autorisesortieseul'
  ) THEN
    ALTER TABLE kids RENAME COLUMN autorisesortieseul TO autorise_sortie_seul;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'kids' 
    AND column_name = 'personnesautorisees'
  ) THEN
    ALTER TABLE kids RENAME COLUMN personnesautorisees TO personnes_autorisees;
  END IF;
END $$;