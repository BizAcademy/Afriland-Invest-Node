-- ============================================================================
-- Mise à jour des RETRAITS : frais de 10% + montant net + colonnes admin
-- À exécuter dans Supabase (SQL Editor). Idempotent.
-- ============================================================================

-- 1. Nouvelles colonnes sur la table retraits
--    montant      = montant BRUT saisi par l'utilisateur (déduit du solde,
--                   et intégralement remboursé en cas d'annulation).
--    frais        = 10% du montant brut.
--    montant_net  = montant - frais = ce que l'utilisateur reçoit réellement
--                   et ce que l'administrateur voit (frais déjà appliqués).
ALTER TABLE retraits ADD COLUMN IF NOT EXISTS frais DECIMAL(15,2) DEFAULT 0;
ALTER TABLE retraits ADD COLUMN IF NOT EXISTS montant_net DECIMAL(15,2);

-- Renseigner les anciennes lignes (frais nuls) pour cohérence d'affichage.
UPDATE retraits SET frais = 0 WHERE frais IS NULL;
UPDATE retraits SET montant_net = montant WHERE montant_net IS NULL;

-- 2. Demande de retrait (atomique) — déduit le solde du montant BRUT et
--    enregistre frais + montant net. On supprime d'abord l'ancienne signature
--    (4 args) pour éviter une surcharge en double (PGRST203).
DROP FUNCTION IF EXISTS request_withdrawal(INT, DECIMAL, TEXT, TEXT);
CREATE OR REPLACE FUNCTION request_withdrawal(
  p_user_id INT,
  p_montant DECIMAL,
  p_frais DECIMAL,
  p_montant_net DECIMAL,
  p_methode TEXT,
  p_numero TEXT
)
RETURNS JSON AS $$
DECLARE
  v_solde DECIMAL;
BEGIN
  SELECT solde INTO v_solde FROM soldes WHERE user_id = p_user_id;
  IF v_solde IS NULL OR v_solde < p_montant THEN
    RETURN json_build_object('error', 'Solde insuffisant');
  END IF;

  INSERT INTO retraits (user_id, montant, frais, montant_net, methode, numero_compte, statut)
  VALUES (p_user_id, p_montant, p_frais, p_montant_net, p_methode, p_numero, 'en_attente');

  -- On déduit le montant BRUT du solde principal.
  UPDATE soldes SET solde = solde - p_montant, date_maj = NOW() WHERE user_id = p_user_id;

  RETURN json_build_object('success', true, 'message', 'Demande de retrait créée');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Rejet / annulation d'un retrait — rembourse le montant BRUT (donc
--    montant net + frais) dans le solde, instantanément. (Inchangé : la
--    fonction rembourse déjà retraits.montant qui est le brut.)
CREATE OR REPLACE FUNCTION reject_retrait(p_retrait_id INT)
RETURNS JSON AS $$
DECLARE
  v_retrait retraits%ROWTYPE;
BEGIN
  SELECT * INTO v_retrait FROM retraits WHERE id = p_retrait_id AND statut = 'en_attente';
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Retrait non trouvé ou déjà traité');
  END IF;

  UPDATE retraits SET statut = 'rejete', date_traitement = NOW() WHERE id = p_retrait_id;

  -- Remboursement intégral (montant brut = net + frais de 10%).
  UPDATE soldes SET solde = solde + v_retrait.montant, date_maj = NOW() WHERE user_id = v_retrait.user_id;

  RETURN json_build_object('success', true, 'message', 'Retrait annulé, montant remboursé');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
