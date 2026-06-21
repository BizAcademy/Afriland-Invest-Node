-- ============================================================
-- AFRILAND INVEST — Fonctions RPC Supabase
-- À exécuter dans Supabase → SQL Editor APRÈS le schema.sql
-- ============================================================

-- 0. Helper — lit un paramètre numérique depuis settings de façon sûre.
--    Renvoie la valeur par défaut si : table absente, clé absente,
--    valeur vide, non numérique, ou hors de l'intervalle [0, 100].
CREATE OR REPLACE FUNCTION get_setting_decimal(p_cle TEXT, p_default DECIMAL)
RETURNS DECIMAL AS $$
DECLARE
  v_raw TEXT;
  v_val DECIMAL;
BEGIN
  BEGIN
    SELECT valeur INTO v_raw FROM settings WHERE cle = p_cle;
  EXCEPTION WHEN undefined_table THEN
    RETURN p_default;
  END;

  IF v_raw IS NULL OR v_raw = '' THEN
    RETURN p_default;
  END IF;
  IF v_raw !~ '^[0-9]+(\.[0-9]+)?$' THEN
    RETURN p_default;
  END IF;

  v_val := v_raw::DECIMAL;
  IF v_val < 0 OR v_val > 100 THEN
    RETURN p_default;
  END IF;
  RETURN v_val;
END;
$$ LANGUAGE plpgsql;


-- 1. Achat d'un plan d'investissement (atomique)
CREATE OR REPLACE FUNCTION buy_plan(p_user_id INT, p_plan_id INT, p_tx_password TEXT)
RETURNS JSON AS $$
DECLARE
  v_plan    planinvestissement%ROWTYPE;
  v_solde   DECIMAL;
  v_tp      TEXT;
  v_rev_j   DECIMAL;
  v_fin     DATE;
  v_comm    DECIMAL[];
  v_parrain INT;
  v_montant DECIMAL;
  v_visited INT[];
  v_prev_count INT;
  i         INT;
BEGIN
  SELECT password INTO v_tp FROM transaction_passwords WHERE user_id = p_user_id;
  IF v_tp IS NULL THEN
    RETURN json_build_object('error', 'Veuillez configurer votre mot de passe de transaction');
  END IF;
  IF v_tp != p_tx_password THEN
    RETURN json_build_object('error', 'Mot de passe de transaction incorrect');
  END IF;

  SELECT * INTO v_plan FROM planinvestissement WHERE id = p_plan_id;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Plan introuvable');
  END IF;

  -- FOR UPDATE : on verrouille la ligne de solde de l'acheteur pour sérialiser
  -- les achats concurrents d'un MÊME utilisateur (double-clic / requêtes en
  -- parallèle). Cela garantit qu'on ne peut ni dépenser deux fois le solde, ni
  -- distribuer deux fois les commissions du « premier investissement ».
  SELECT solde INTO v_solde FROM soldes WHERE user_id = p_user_id FOR UPDATE;
  IF v_solde IS NULL OR v_solde < v_plan.prix THEN
    RETURN json_build_object('error', 'Solde insuffisant');
  END IF;

  v_rev_j := (v_plan.prix * v_plan.rendement_journalier) / 100;
  v_fin   := CURRENT_DATE + v_plan.duree_jours;

  -- Combien d'investissements l'acheteur a-t-il DÉJÀ (avant celui-ci) ? Sert à
  -- déclencher les commissions uniquement lors du tout premier investissement.
  SELECT COUNT(*) INTO v_prev_count FROM commandes WHERE user_id = p_user_id;

  -- last_revenue_at = NOW() : l'ancre du versement part de l'heure d'achat,
  -- donc le 1er revenu tombe 24h plus tard, puis toutes les 24h à la même heure.
  INSERT INTO commandes (user_id, plan_id, montant, revenu_journalier, date_debut, date_fin, statut, last_revenue_at)
  VALUES (p_user_id, p_plan_id, v_plan.prix, v_rev_j, CURRENT_DATE, v_fin, 'actif', NOW());

  UPDATE soldes SET solde = solde - v_plan.prix, date_maj = NOW() WHERE user_id = p_user_id;

  -- ─── Distribution des commissions de parrainage (3 niveaux) ───
  -- RÈGLE MÉTIER : le parrain n'est commissionné QUE sur le PREMIER
  -- investissement de son filleul. Les achats suivants ne génèrent aucune
  -- commission. On ne distribue donc que si l'acheteur n'avait aucune commande
  -- avant celle-ci (v_prev_count = 0).
  IF v_prev_count = 0 THEN
    -- Les pourcentages sont lus EN DIRECT depuis la table settings (via un
    -- helper sûr : valeurs par défaut 10/5/2 si table/clé absente ou invalide),
    -- donc toute modification dans le panneau admin s'applique immédiatement.
    v_comm := ARRAY[
      get_setting_decimal('commission_niveau1', 10),
      get_setting_decimal('commission_niveau2', 5),
      get_setting_decimal('commission_niveau3', 2)
    ];

    -- v_visited empêche l'auto-commission et les cycles (A→B→A) dans le graphe
    -- de parrainage : on ne crédite jamais deux fois la même personne ni l'acheteur.
    v_visited := ARRAY[p_user_id];
    SELECT parrain_id INTO v_parrain FROM utilisateurs WHERE id = p_user_id;
    i := 1;
    WHILE i <= 3 AND v_parrain IS NOT NULL LOOP
      EXIT WHEN v_parrain = ANY(v_visited);  -- anti-cycle / anti-auto-commission
      v_montant := (v_plan.prix * v_comm[i]) / 100;
      IF v_montant > 0 THEN
        INSERT INTO soldes (user_id, solde, date_maj)
        VALUES (v_parrain, v_montant, NOW())
        ON CONFLICT (user_id) DO UPDATE
          SET solde = soldes.solde + v_montant, date_maj = NOW();

        -- i = profondeur dans la chaîne de parrainage = niveau de la commission
        -- (1 = parrain direct, 2 = grand-parrain, 3 = arrière-grand-parrain).
        INSERT INTO historique_revenus (user_id, montant, type, niveau)
        VALUES (v_parrain, v_montant, 'parrainage', i);
      END IF;
      v_visited := array_append(v_visited, v_parrain);
      SELECT parrain_id INTO v_parrain FROM utilisateurs WHERE id = v_parrain;
      i := i + 1;
    END LOOP;
  END IF;

  RETURN json_build_object('success', true, 'message', 'Plan activé avec succès', 'plan_nom', v_plan.nom);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Roue de la fortune — probabilités pondérées + cooldown 48h
--    1000 FCFA : 0%
--    500  FCFA : 0,001%  (1 / 100 000)
--    200  FCFA : 0,01%   (10 / 100 000)
--    100  FCFA : 0,01%   (10 / 100 000)
--    50   FCFA : 0,01%   (10 / 100 000)
--    0    FCFA : ~99,96% (99 969 / 100 000)
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
    IF v_elapsed < 172800 THEN  -- 48h en secondes
      RETURN json_build_object(
        'error', 'Vous devez attendre 48h entre chaque spin',
        'remainingSeconds', CEIL(172800 - v_elapsed)
      );
    END IF;
  END IF;

  -- Tirage pondéré sur 100 000 unités
  v_rand := (RANDOM() * 100000)::INT;

  IF    v_rand < 1     THEN v_gain := 500;   -- 0,001%
  ELSIF v_rand < 11    THEN v_gain := 50;    -- 0,01%
  ELSIF v_rand < 21    THEN v_gain := 100;   -- 0,01%
  ELSIF v_rand < 31    THEN v_gain := 200;   -- 0,01%
  ELSE                      v_gain := 0;     -- ~99,969%
  END IF;
  -- 1000 FCFA : jamais (0%)

  UPDATE utilisateurs SET last_spin_time = NOW() WHERE id = p_user_id;

  IF v_gain > 0 THEN
    UPDATE soldes SET solde = solde + v_gain, date_maj = NOW() WHERE user_id = p_user_id;
    INSERT INTO historique_revenus (user_id, montant, type) VALUES (p_user_id, v_gain, 'bonus');
  END IF;

  RETURN json_build_object('success', true, 'gain', v_gain);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. Validation d'un dépôt (atomique — crédite le solde)
CREATE OR REPLACE FUNCTION validate_depot(p_depot_id INT)
RETURNS JSON AS $$
DECLARE
  v_depot depots%ROWTYPE;
BEGIN
  -- UPDATE atomique avec garde sur le statut : seule la première transaction
  -- concurrente verrouille et passe la ligne à 'valide'. Empêche tout double
  -- crédit lorsque le polling (/deposit/status) et le webhook (/deposit/notify)
  -- s'exécutent simultanément.
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


-- 4. Demande de retrait (atomique — déduit le solde BRUT, stocke frais + net)
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

  -- On déduit le montant BRUT (saisi par l'utilisateur) du solde principal.
  UPDATE soldes SET solde = solde - p_montant, date_maj = NOW() WHERE user_id = p_user_id;

  RETURN json_build_object('success', true, 'message', 'Demande de retrait créée');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 5. Rejet / annulation d'un retrait (atomique — rembourse le solde BRUT,
--    donc montant net + frais de 10%).
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

  -- Remboursement intégral (montant brut = net + frais).
  UPDATE soldes SET solde = solde + v_retrait.montant, date_maj = NOW() WHERE user_id = v_retrait.user_id;

  RETURN json_build_object('success', true, 'message', 'Retrait annulé, montant remboursé');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 6. Crédit manuel d'un utilisateur (admin)
--    Le crédit admin est traité EXACTEMENT comme un dépôt validé : on crédite le
--    solde ET on enregistre une ligne dans la table `depots` avec statut 'valide'.
--    Conséquence : cet argent est éligible à l'investissement et au retrait, et il
--    est compté dans les totaux de dépôts, au même titre qu'un dépôt réel.
--    (On n'écrit plus dans historique_revenus : un dépôt n'est pas un « revenu ».)
CREATE OR REPLACE FUNCTION credit_user(p_user_id INT, p_montant DECIMAL)
RETURNS JSON AS $$
BEGIN
  IF p_montant <= 0 THEN
    RETURN json_build_object('error', 'Montant invalide');
  END IF;

  INSERT INTO soldes (user_id, solde, date_maj)
  VALUES (p_user_id, p_montant, NOW())
  ON CONFLICT (user_id) DO UPDATE
    SET solde = soldes.solde + p_montant, date_maj = NOW();

  INSERT INTO depots (user_id, montant, operateur, statut, date_depot, date_traitement)
  VALUES (p_user_id, p_montant, 'Crédit admin', 'valide', NOW(), NOW());

  RETURN json_build_object('success', true, 'message', 'Crédit effectué');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 6b. Débit manuel d'un utilisateur (admin) — réduit le solde de façon atomique
CREATE OR REPLACE FUNCTION debit_user(p_user_id INT, p_montant DECIMAL)
RETURNS JSON AS $$
DECLARE
  v_new DECIMAL;
BEGIN
  IF p_montant <= 0 THEN
    RETURN json_build_object('error', 'Montant invalide');
  END IF;

  UPDATE soldes
  SET solde = solde - p_montant, date_maj = NOW()
  WHERE user_id = p_user_id AND solde >= p_montant
  RETURNING solde INTO v_new;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Solde insuffisant pour ce retrait');
  END IF;

  INSERT INTO historique_revenus (user_id, montant, type)
  VALUES (p_user_id, -p_montant, 'debit_admin');

  RETURN json_build_object('success', true, 'message', 'Solde réduit', 'solde', v_new);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 7. Incrémenter le compteur de filleuls du parrain
CREATE OR REPLACE FUNCTION increment_filleuls(p_user_id INT)
RETURNS VOID AS $$
BEGIN
  UPDATE utilisateurs SET nombre_filleuls = nombre_filleuls + 1 WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
