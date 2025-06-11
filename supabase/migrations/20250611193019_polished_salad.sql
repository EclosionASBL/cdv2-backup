/*
  # Création du système d'abonnement à la newsletter
  
  1. Nouvelles Tables
    - `newsletter_subscribers` - Stocke tous les abonnés à la newsletter
      - Utilisateurs connectés et visiteurs externes
      - Lien optionnel vers la table users
      
  2. Fonctions et Triggers
    - Fonction pour synchroniser les abonnements entre users et newsletter_subscribers
    - Triggers pour maintenir la cohérence lors des mises à jour
    
  3. Sécurité
    - Enable RLS
    - Politiques pour les administrateurs et les utilisateurs anonymes
*/

-- Créer la table newsletter_subscribers
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  subscribed_at TIMESTAMPTZ DEFAULT now(),
  source TEXT DEFAULT 'website', -- 'website', 'profile', 'import', etc.
  active BOOLEAN DEFAULT true,
  unsubscribed_at TIMESTAMPTZ DEFAULT NULL
);

-- Créer des index pour de meilleures performances
CREATE INDEX IF NOT EXISTS newsletter_subscribers_email_idx ON newsletter_subscribers(email);
CREATE INDEX IF NOT EXISTS newsletter_subscribers_user_id_idx ON newsletter_subscribers(user_id);
CREATE INDEX IF NOT EXISTS newsletter_subscribers_active_idx ON newsletter_subscribers(active);

-- Activer RLS
ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;

-- Créer des politiques RLS
CREATE POLICY "Admins can manage all newsletter subscribers"
  ON newsletter_subscribers
  FOR ALL
  TO authenticated
  USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin')
  WITH CHECK ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Anonymous users can subscribe to newsletter"
  ON newsletter_subscribers
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Fonction pour synchroniser les abonnements
CREATE OR REPLACE FUNCTION sync_newsletter_subscription()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Cas 1: Mise à jour de la colonne newsletter dans users
  IF TG_TABLE_NAME = 'users' AND TG_OP = 'UPDATE' THEN
    -- Si l'utilisateur s'abonne
    IF NEW.newsletter = true AND (OLD.newsletter = false OR OLD.newsletter IS NULL) THEN
      INSERT INTO newsletter_subscribers (email, user_id, source)
      VALUES (NEW.email, NEW.id, 'profile')
      ON CONFLICT (email) 
      DO UPDATE SET 
        user_id = NEW.id,
        active = true,
        unsubscribed_at = NULL;
    -- Si l'utilisateur se désabonne
    ELSIF NEW.newsletter = false AND OLD.newsletter = true THEN
      UPDATE newsletter_subscribers
      SET active = false, unsubscribed_at = now()
      WHERE user_id = NEW.id OR email = NEW.email;
    END IF;
    
    RETURN NEW;
  
  -- Cas 2: Nouvel abonnement dans newsletter_subscribers
  ELSIF TG_TABLE_NAME = 'newsletter_subscribers' AND TG_OP = 'INSERT' THEN
    -- Si l'email correspond à un utilisateur existant, mettre à jour son statut newsletter
    IF NEW.user_id IS NOT NULL THEN
      UPDATE users
      SET newsletter = true
      WHERE id = NEW.user_id;
    ELSIF NEW.email IS NOT NULL THEN
      UPDATE users
      SET newsletter = true
      WHERE email = NEW.email;
    END IF;
    
    RETURN NEW;
  
  -- Cas 3: Désabonnement dans newsletter_subscribers
  ELSIF TG_TABLE_NAME = 'newsletter_subscribers' AND TG_OP = 'UPDATE' THEN
    -- Si l'abonné se désabonne et est lié à un utilisateur
    IF NEW.active = false AND OLD.active = true AND NEW.user_id IS NOT NULL THEN
      UPDATE users
      SET newsletter = false
      WHERE id = NEW.user_id;
    -- Si l'abonné se désabonne par email
    ELSIF NEW.active = false AND OLD.active = true AND NEW.email IS NOT NULL THEN
      UPDATE users
      SET newsletter = false
      WHERE email = NEW.email;
    END IF;
    
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$$;

-- Créer les triggers
CREATE TRIGGER users_newsletter_update
  AFTER UPDATE OF newsletter ON users
  FOR EACH ROW
  EXECUTE FUNCTION sync_newsletter_subscription();

CREATE TRIGGER newsletter_subscriber_insert
  AFTER INSERT ON newsletter_subscribers
  FOR EACH ROW
  EXECUTE FUNCTION sync_newsletter_subscription();

CREATE TRIGGER newsletter_subscriber_update
  AFTER UPDATE OF active ON newsletter_subscribers
  FOR EACH ROW
  EXECUTE FUNCTION sync_newsletter_subscription();

-- Migrer les utilisateurs existants qui sont abonnés à la newsletter
INSERT INTO newsletter_subscribers (email, user_id, source)
SELECT email, id, 'migration'
FROM users
WHERE newsletter = true
ON CONFLICT (email) DO NOTHING;