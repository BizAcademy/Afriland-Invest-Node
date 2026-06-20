-- ============================================================
-- AFRILAND INVEST — Cadeaux VIP (exécuter dans Supabase SQL Editor)
-- Nouveau système : l'utilisateur réclame un cadeau unique par niveau,
-- l'administrateur confirme avant que le montant soit crédité.
--   VIP 1 = 70 filleuls ayant investi  -> cadeau 5000 FCFA
--   VIP 2 = 100 filleuls ayant investi -> cadeau 8000 FCFA
--   VIP 3 = 200 filleuls ayant investi -> cadeau 10000 FCFA
-- ============================================================

-- 1. Table des réclamations de cadeaux VIP
CREATE TABLE IF NOT EXISTS cadeaux_vip (
  id              SERIAL PRIMARY KEY,
  user_id         INT NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  niveau          INT NOT NULL,
  montant         DECIMAL(15,2) NOT NULL,
  statut          VARCHAR(20) DEFAULT 'en_attente', -- en_attente / valide / rejete
  date_demande    TIMESTAMP DEFAULT NOW(),
  date_traitement TIMESTAMP,
  UNIQUE (user_id, niveau)
);

-- 2. RPC : validation d'un cadeau (atomique — crédite le solde + journalise)
CREATE OR REPLACE FUNCTION validate_cadeau_vip(p_cadeau_id INT)
RETURNS JSON AS $$
DECLARE
  v_cadeau cadeaux_vip%ROWTYPE;
BEGIN
  -- Passage à 'valide' atomique : seule UNE validation concurrente peut réussir,
  -- ce qui empêche un double crédit du même cadeau.
  UPDATE cadeaux_vip
    SET statut = 'valide', date_traitement = NOW()
    WHERE id = p_cadeau_id AND statut = 'en_attente'
    RETURNING * INTO v_cadeau;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Cadeau non trouvé ou déjà traité');
  END IF;

  INSERT INTO soldes (user_id, solde, date_maj)
  VALUES (v_cadeau.user_id, v_cadeau.montant, NOW())
  ON CONFLICT (user_id) DO UPDATE
    SET solde = soldes.solde + v_cadeau.montant, date_maj = NOW();

  INSERT INTO historique_revenus (user_id, montant, type)
  VALUES (v_cadeau.user_id, v_cadeau.montant, 'cadeau_vip');

  RETURN json_build_object('success', true, 'message', 'Cadeau validé');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
