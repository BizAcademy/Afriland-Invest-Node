-- ════════════════════════════════════════════════════════════════════════════
-- AFRIBAPAY — Dépôts automatiques (à exécuter dans Supabase SQL Editor)
-- ════════════════════════════════════════════════════════════════════════════

-- 1) Nouvelles colonnes sur la table des dépôts
ALTER TABLE depots ADD COLUMN IF NOT EXISTS devise            VARCHAR(10);
ALTER TABLE depots ADD COLUMN IF NOT EXISTS frais             DECIMAL(15,2) DEFAULT 0;
ALTER TABLE depots ADD COLUMN IF NOT EXISTS montant_total     DECIMAL(15,2);
ALTER TABLE depots ADD COLUMN IF NOT EXISTS ab_order_id       VARCHAR(100);
ALTER TABLE depots ADD COLUMN IF NOT EXISTS ab_transaction_id VARCHAR(100);
ALTER TABLE depots ADD COLUMN IF NOT EXISTS ab_status         VARCHAR(20);

CREATE INDEX IF NOT EXISTS idx_depots_ab_transaction ON depots(ab_transaction_id);
CREATE INDEX IF NOT EXISTS idx_depots_ab_order ON depots(ab_order_id);

-- 2) Logos des opérateurs (moyens de paiement) configurables par l'admin
CREATE TABLE IF NOT EXISTS operateur_logos (
  operator_code VARCHAR(50) PRIMARY KEY,
  label         VARCHAR(100),
  logo_url      VARCHAR(255),
  date_maj      TIMESTAMP DEFAULT NOW()
);

-- 3) Montant minimum de dépôt (paramètre admin, défaut 500)
INSERT INTO settings (cle, valeur, description)
VALUES ('min_depot', '500', 'Montant minimum de dépôt (FCFA)')
ON CONFLICT (cle) DO NOTHING;

-- 4) validate_depot : crédit ATOMIQUE et idempotent (anti double-crédit)
--    L'UPDATE conditionnel verrouille la ligne : si le polling et le webhook
--    arrivent en même temps, une seule transaction crédite réellement le solde.
CREATE OR REPLACE FUNCTION validate_depot(p_depot_id INT)
RETURNS JSON AS $$
DECLARE
  v_depot depots%ROWTYPE;
BEGIN
  UPDATE depots SET statut = 'valide', date_traitement = NOW()
  WHERE id = p_depot_id AND statut = 'en_attente'
  RETURNING * INTO v_depot;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Dépôt non trouvé ou déjà traité');
  END IF;

  INSERT INTO soldes (user_id, solde, date_maj)
  VALUES (v_depot.user_id, v_depot.montant, NOW())
  ON CONFLICT (user_id) DO UPDATE
    SET solde = soldes.solde + v_depot.montant, date_maj = NOW();

  RETURN json_build_object('success', true, 'message', 'Dépôt validé');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
