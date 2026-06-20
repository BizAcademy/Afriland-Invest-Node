-- ============================================================
-- AFRILAND INVEST — Nouvelles tables (à exécuter dans Supabase)
-- ============================================================

-- Table des paramètres admin (clé/valeur)
CREATE TABLE IF NOT EXISTS settings (
  id          SERIAL PRIMARY KEY,
  cle         TEXT UNIQUE NOT NULL,
  valeur      TEXT NOT NULL,
  description TEXT,
  date_maj    TIMESTAMP DEFAULT NOW()
);

-- Valeur par défaut : dépôt minimum 500 FCFA
INSERT INTO settings (cle, valeur, description)
VALUES ('min_depot', '500', 'Montant minimum de dépôt en FCFA')
ON CONFLICT (cle) DO NOTHING;

-- Table des annonces / affiches admin
CREATE TABLE IF NOT EXISTS annonces (
  id             SERIAL PRIMARY KEY,
  titre          TEXT NOT NULL,
  contenu        TEXT NOT NULL,
  couleur        TEXT DEFAULT '#22c55e',
  actif          BOOLEAN DEFAULT TRUE,
  date_creation  TIMESTAMP DEFAULT NOW(),
  date_maj       TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- Mise à jour de la fonction spin_wheel (nouvelles probabilités)
-- Copier-coller depuis supabase-functions.sql si déjà exécuté
-- ============================================================
CREATE OR REPLACE FUNCTION spin_wheel(p_user_id INT)
RETURNS JSON AS $$
DECLARE
  v_last    TIMESTAMP;
  v_elapsed FLOAT;
  v_rand    INT;
  v_gain    INT;
BEGIN
  SELECT last_spin_time INTO v_last FROM utilisateurs WHERE id = p_user_id;
  IF v_last IS NOT NULL THEN
    v_elapsed := EXTRACT(EPOCH FROM (NOW() - v_last));
    IF v_elapsed < 172800 THEN
      RETURN json_build_object(
        'error', 'Vous devez attendre 48h entre chaque spin',
        'remainingSeconds', CEIL(172800 - v_elapsed)
      );
    END IF;
  END IF;

  v_rand := (RANDOM() * 100000)::INT;

  IF    v_rand < 1     THEN v_gain := 500;
  ELSIF v_rand < 11    THEN v_gain := 50;
  ELSIF v_rand < 21    THEN v_gain := 100;
  ELSIF v_rand < 31    THEN v_gain := 200;
  ELSE                      v_gain := 0;
  END IF;

  UPDATE utilisateurs SET last_spin_time = NOW() WHERE id = p_user_id;

  IF v_gain > 0 THEN
    UPDATE soldes SET solde = solde + v_gain, date_maj = NOW() WHERE user_id = p_user_id;
    INSERT INTO historique_revenus (user_id, montant, type) VALUES (p_user_id, v_gain, 'bonus');
  END IF;

  RETURN json_build_object('success', true, 'gain', v_gain);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
