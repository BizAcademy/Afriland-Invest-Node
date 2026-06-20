-- ============================================================
-- AFRILAND INVEST — Roue de la fortune (exécuter dans Supabase SQL Editor)
--
-- Disposition canonique de la roue (13 segments, index 0 -> 12) :
--   [0, 10, 50, 0, 5, 100, 0, 200, 10, 0, 5, 500, 1000]
--   => 0f x4 | 10f x2 | 5f x2 | 50/100/200/500/1000 x1
--   Les quatre "0" sont aux index 0, 3, 6, 9.
--
-- IMPORTANT : cet ordre DOIT être identique au tableau SEGMENTS de
-- client/src/pages/Wheel.jsx, sinon l'affichage et le crédit divergeraient.
-- Le backend renvoie l'index du segment gagnant -> la roue s'arrête
-- exactement dessus et c'est CE montant qui est crédité.
--
-- Toutes les opérations sensibles (cooldown 48h, débit de la mise,
-- compteur de cycle) sont ATOMIQUES (UPDATE guardé / SELECT ... FOR UPDATE)
-- pour résister aux requêtes concurrentes (pas de double crédit / dépense).
-- ============================================================

-- 0. Compteur de position dans le cycle de pari (0..4)
--    (réutilise la colonne paris_perdus : 0 = aucun tour fait dans le cycle)
ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS paris_perdus INT DEFAULT 0;

-- ============================================================
-- 1. Spin GRATUIT (1 fois toutes les 48h) — inchangé
--    Probabilités : 5f = 10% | 10f = 5% | 50/100/200 = 0,01% chacun |
--                   500 = 0,001% | 1000 = jamais | 0f = le reste (~84,97%)
-- ============================================================
CREATE OR REPLACE FUNCTION spin_wheel(p_user_id INT)
RETURNS JSON AS $$
DECLARE
  v_last     TIMESTAMP;
  v_elapsed  FLOAT;
  v_updated  INT;
  v_rand     INT;
  v_gain     INT;
  v_index    INT;
  v_layout   INT[] := ARRAY[0, 10, 50, 0, 5, 100, 0, 200, 10, 0, 5, 500, 1000];
BEGIN
  -- Gate atomique : pose last_spin_time uniquement si 48h écoulées (ou jamais joué).
  UPDATE utilisateurs SET last_spin_time = NOW()
  WHERE id = p_user_id
    AND (last_spin_time IS NULL OR EXTRACT(EPOCH FROM (NOW() - last_spin_time)) >= 172800);
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated = 0 THEN
    SELECT last_spin_time INTO v_last FROM utilisateurs WHERE id = p_user_id;
    v_elapsed := EXTRACT(EPOCH FROM (NOW() - v_last));
    RETURN json_build_object(
      'error', 'Vous devez attendre 48h entre chaque spin gratuit',
      'remainingSeconds', CEIL(172800 - v_elapsed)
    );
  END IF;

  v_rand := FLOOR(RANDOM() * 100000)::INT;
  IF    v_rand < 1     THEN v_gain := 500;
  ELSIF v_rand < 11    THEN v_gain := 50;
  ELSIF v_rand < 21    THEN v_gain := 100;
  ELSIF v_rand < 31    THEN v_gain := 200;
  ELSIF v_rand < 5031  THEN v_gain := 10;
  ELSIF v_rand < 15031 THEN v_gain := 5;
  ELSE                      v_gain := 0;
  END IF;

  SELECT pos - 1 INTO v_index
  FROM generate_subscripts(v_layout, 1) AS pos
  WHERE v_layout[pos] = v_gain
  ORDER BY RANDOM() LIMIT 1;

  IF v_gain > 0 THEN
    INSERT INTO soldes (user_id, solde, date_maj)
    VALUES (p_user_id, v_gain, NOW())
    ON CONFLICT (user_id) DO UPDATE
      SET solde = soldes.solde + v_gain, date_maj = NOW();
    INSERT INTO historique_revenus (user_id, montant, type)
    VALUES (p_user_id, v_gain, 'bonus');
  END IF;

  RETURN json_build_object('success', true, 'gain', v_gain, 'index', v_index);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 2. Spin PAYANT (pari) — CYCLE DE 5 TOURS, mise minimum 100 FCFA
--
--   Le système fonctionne par cycles de 5 tours, puis se remet à zéro :
--     • Tours 1, 2, 3  -> PERTE forcée (tombe sur un "0" DIFFÉRENT à chaque
--                          fois : index 0, puis 3, puis 6).
--     • Tour 4         -> GAIN garanti, selon le palier de mise :
--                          - mise entre 100 et 499 : gagne 10, 50, 100 ou 200
--                          - mise de 500 ou plus    : gagne 100, 200 ou 500
--     • Tour 5         -> 50% perte / 50% gain. Si gain, le montant n'est
--                          JAMAIS supérieur à la mise (perte -> 4e "0", idx 9).
--   Après le tour 5, le compteur repart à 0 (nouveau cycle).
--   La mise est débitée à chaque tour. 1000 FCFA ne tombe jamais en pari.
-- ============================================================
CREATE OR REPLACE FUNCTION spin_wheel_bet(p_user_id INT, p_mise INT)
RETURNS JSON AS $$
DECLARE
  v_new_solde DECIMAL;
  v_cycle     INT;      -- nombre de tours déjà faits dans le cycle (0..4)
  v_gain      INT;
  v_index     INT;
  v_layout    INT[] := ARRAY[0, 10, 50, 0, 5, 100, 0, 200, 10, 0, 5, 500, 1000];
  v_zero_idx  INT[] := ARRAY[0, 3, 6, 9];   -- les 4 segments "0" (index 0-based)
  v_choices   INT[];
BEGIN
  IF p_mise IS NULL OR p_mise < 100 THEN
    RETURN json_build_object('error', 'La mise minimum est de 100 FCFA');
  END IF;

  -- Verrou de la ligne utilisateur EN PREMIER (même ordre de verrou que
  -- spin_wheel : utilisateurs puis soldes) -> aucun risque de deadlock.
  -- Sérialise aussi les paris concurrents du même utilisateur.
  -- v_cycle = position dans le cycle AVANT ce tour (0..4).
  SELECT COALESCE(paris_perdus, 0) % 5 INTO v_cycle
  FROM utilisateurs WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Utilisateur introuvable');
  END IF;

  -- Débit atomique : ne s'applique QUE si le solde est suffisant.
  UPDATE soldes SET solde = solde - p_mise, date_maj = NOW()
  WHERE user_id = p_user_id AND solde >= p_mise
  RETURNING solde INTO v_new_solde;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Solde insuffisant pour cette mise');
  END IF;

  INSERT INTO historique_revenus (user_id, montant, type)
  VALUES (p_user_id, -p_mise, 'mise_roue');

  IF v_cycle < 3 THEN
    -- Tours 1, 2, 3 : perte forcée, sur un "0" différent à chaque fois
    v_gain  := 0;
    v_index := v_zero_idx[v_cycle + 1];        -- 0 -> idx0, 1 -> idx3, 2 -> idx6
  ELSIF v_cycle = 3 THEN
    -- Tour 4 : gain garanti selon le palier de mise
    IF p_mise >= 500 THEN
      v_choices := ARRAY[100, 200, 500];
    ELSE
      v_choices := ARRAY[10, 50, 100, 200];
    END IF;
    v_gain := v_choices[1 + FLOOR(RANDOM() * array_length(v_choices, 1))::INT];
  ELSE
    -- Tour 5 : 50% perte / 50% gain ; si gain, montant <= mise (jamais 1000)
    IF RANDOM() < 0.5 THEN
      v_gain  := 0;
      v_index := v_zero_idx[4];                -- 4e "0" (idx 9)
    ELSE
      v_choices := ARRAY(
        SELECT v FROM unnest(ARRAY[5, 10, 50, 100, 200, 500]) AS v WHERE v <= p_mise
      );
      v_gain := v_choices[1 + FLOOR(RANDOM() * array_length(v_choices, 1))::INT];
    END IF;
  END IF;

  -- Avance le cycle (revient à 0 après le 5e tour)
  UPDATE utilisateurs SET paris_perdus = (v_cycle + 1) % 5 WHERE id = p_user_id;

  -- Pour un gain, choisit l'index du segment correspondant et crédite
  IF v_gain > 0 THEN
    SELECT pos - 1 INTO v_index
    FROM generate_subscripts(v_layout, 1) AS pos
    WHERE v_layout[pos] = v_gain
    ORDER BY RANDOM() LIMIT 1;

    UPDATE soldes SET solde = solde + v_gain, date_maj = NOW() WHERE user_id = p_user_id;
    INSERT INTO historique_revenus (user_id, montant, type)
    VALUES (p_user_id, v_gain, 'bonus');
  END IF;

  RETURN json_build_object('success', true, 'gain', v_gain, 'index', v_index, 'mise', p_mise);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
