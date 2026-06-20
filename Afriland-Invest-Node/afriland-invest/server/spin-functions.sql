-- ═══════════════════════════════════════════════════════════════════════════
-- AFRILAND INVEST — ROUE DE LA FORTUNE (logique 100% atomique en SQL)
-- À exécuter dans Supabase > SQL Editor
--
-- Pourquoi tout en SQL :
--   • FOR UPDATE verrouille la ligne utilisateur + solde le temps du spin.
--     Deux requêtes simultanées (double-tap, 2 onglets) sont SÉRIALISÉES :
--     la 2e attend que la 1re termine → impossible d'avoir un double-débit,
--     un gain dupliqué, un solde négatif, ou deux spins sur le même slot de cycle.
--   • Mise déduite + gain crédité + avance du cycle + historique = 1 transaction.
--     Soit tout réussit, soit rien (rollback automatique).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Colonnes de cycle (SQL pur, sans bloc PL/pgSQL) ──────────────────────────
-- spin_cycle_pos : compteur de position dans le cycle (conservé s'il existe).
-- spin_cycle_seq : séquence du cycle, recréée en TEXT[] pour garantir le bon type.
--   C'est une donnée éphémère (position dans le cycle de 10 tours) : la réinitialiser
--   ne fait que redémarrer le cycle au prochain spin — aucun impact sur les soldes.
ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS spin_cycle_pos INT DEFAULT 0;
ALTER TABLE utilisateurs DROP COLUMN IF EXISTS spin_cycle_seq;
ALTER TABLE utilisateurs ADD COLUMN spin_cycle_seq TEXT[];

-- ── Nettoyage des anciennes versions (évite les doublons / PGRST203) ─────────
-- CREATE OR REPLACE ne remplace PAS une fonction dont les types de paramètres
-- diffèrent : il en crée une 2ᵉ version, et PostgREST ne sait plus laquelle
-- appeler. On supprime donc explicitement toutes les signatures connues avant
-- de recréer une version unique (integer).
DROP FUNCTION IF EXISTS spin_wheel_free(bigint);
DROP FUNCTION IF EXISTS spin_wheel_free(integer);
DROP FUNCTION IF EXISTS spin_wheel_paid(bigint, numeric);
DROP FUNCTION IF EXISTS spin_wheel_paid(bigint, integer);
DROP FUNCTION IF EXISTS spin_wheel_paid(integer, numeric);
DROP FUNCTION IF EXISTS spin_wheel_paid(integer, integer);

-- ── Helper : valeur de gain → index du segment de la roue ────────────────────
-- Indices roue : 0=0 1=×2 2=100 3=0 4=5000 5=×0.5 6=200 7=0
--                8=10000 9=50 10=×10 11=0 12=500 13=1000 14=10 15=2000
CREATE OR REPLACE FUNCTION wheel_value_to_idx(v INT)
RETURNS INT LANGUAGE sql VOLATILE AS $idx$
  SELECT CASE v
    WHEN 10 THEN 14 WHEN 50 THEN 9  WHEN 100 THEN 2  WHEN 200 THEN 6
    WHEN 500 THEN 12 WHEN 1000 THEN 13 WHEN 2000 THEN 15
    WHEN 5000 THEN 4 WHEN 10000 THEN 8
    ELSE (ARRAY[0,3,7,11])[floor(random()*4)::int + 1]   -- fallback : un "0"
  END;
$idx$;

-- ═══════════════════════════════════════════════════════════════════════════
-- SPIN GRATUIT (1 fois / 48h)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION spin_wheel_free(p_user_id INT)
RETURNS JSONB LANGUAGE plpgsql AS $free$
DECLARE
  v_last    TIMESTAMP;
  v_elapsed FLOAT;
  v_roll    NUMERIC;
  v_gain    INT := 0;
  v_index   INT;
BEGIN
  -- Verrou ligne utilisateur (sérialise les spins gratuits simultanés)
  SELECT last_spin_time INTO v_last
    FROM utilisateurs WHERE id = p_user_id FOR UPDATE;

  IF v_last IS NOT NULL THEN
    v_elapsed := EXTRACT(EPOCH FROM (NOW() - v_last));
    IF v_elapsed < 172800 THEN
      RETURN jsonb_build_object(
        'error', 'COOLDOWN',
        'remainingSeconds', CEIL(172800 - v_elapsed)
      );
    END IF;
  END IF;

  -- Tirage pondéré (spin gratuit)
  v_roll := random();
  IF    v_roll < 0.62 THEN v_gain := 0;    v_index := (ARRAY[0,3,7,11])[floor(random()*4)::int+1];
  ELSIF v_roll < 0.74 THEN v_gain := 10;   v_index := 14;
  ELSIF v_roll < 0.84 THEN v_gain := 50;   v_index := 9;
  ELSIF v_roll < 0.91 THEN v_gain := 100;  v_index := 2;
  ELSIF v_roll < 0.96 THEN v_gain := 200;  v_index := 6;
  ELSIF v_roll < 0.99 THEN v_gain := 500;  v_index := 12;
  ELSE                     v_gain := 1000; v_index := 13;
  END IF;

  UPDATE utilisateurs SET last_spin_time = NOW() WHERE id = p_user_id;

  IF v_gain > 0 THEN
    UPDATE soldes SET solde = solde + v_gain, date_maj = NOW() WHERE user_id = p_user_id;
    INSERT INTO historique_revenus (user_id, montant, type)
    VALUES (p_user_id, v_gain, 'bonus');
  END IF;

  RETURN jsonb_build_object('success', true, 'gain', v_gain, 'index', v_index);
END;
$free$;

-- ═══════════════════════════════════════════════════════════════════════════
-- SPIN PAYANT — cycle riggé de 10 tours
--   Sur 10 tours : 5 zéros, 1 demi (×0.5), 4 gains :
--     • win4  : gain "entre X/Y/Z" (1 fois)
--     • win6  : petit gain plafonné "maximum X" (2 fois)
--     • win10 : gain final "X / Y / ×2" (1 fois)
--   L'ordre est mélangé (imprévisible pour le joueur) mais la distribution est garantie.
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION spin_wheel_paid(p_user_id INT, p_mise INT)
RETURNS JSONB LANGUAGE plpgsql AS $paid$
DECLARE
  v_solde     NUMERIC;
  v_pos       INT;
  v_seq       TEXT[];
  v_type      TEXT;
  v_tier      INT;
  v_gain      INT := 0;
  v_index     INT;
  v_outcome   TEXT;
  v_opts      INT[];
  v_roll      NUMERIC;
  v_new_solde NUMERIC;
BEGIN
  IF p_mise IS NULL OR p_mise < 100 THEN
    RAISE EXCEPTION 'MISE_MIN';
  END IF;

  -- Verrou ligne utilisateur (cycle) — ordre de verrou constant : utilisateurs puis soldes
  SELECT spin_cycle_pos, spin_cycle_seq INTO v_pos, v_seq
    FROM utilisateurs WHERE id = p_user_id FOR UPDATE;

  -- Verrou ligne solde
  SELECT solde INTO v_solde
    FROM soldes WHERE user_id = p_user_id FOR UPDATE;

  IF v_solde IS NULL OR v_solde < p_mise THEN
    RAISE EXCEPTION 'SOLDE_INSUFFISANT';
  END IF;

  -- (Re)génération du cycle si terminé / absent
  v_pos := COALESCE(v_pos, 0);
  IF v_seq IS NULL OR array_length(v_seq, 1) < 10 OR v_pos >= 10 THEN
    SELECT array_agg(x ORDER BY random()) INTO v_seq
      FROM unnest(ARRAY['zero','zero','zero','zero','zero','x05','win4','win6','win6','win10']) AS x;
    v_pos := 0;
  END IF;

  v_type := v_seq[v_pos + 1];   -- arrays PL/pgSQL : 1-indexés
  v_tier := CASE WHEN p_mise < 500 THEN 1 WHEN p_mise < 1000 THEN 2 ELSE 3 END;
  v_roll := random();

  IF v_type = 'zero' THEN
    v_gain := 0;
    v_index := (ARRAY[0,3,7,11])[floor(random()*4)::int + 1];
    v_outcome := 'zero';

  ELSIF v_type = 'x05' THEN
    v_gain := floor(p_mise * 0.5);
    v_index := 5;
    v_outcome := 'x05';

  ELSIF v_type = 'win4' THEN
    v_opts := CASE v_tier WHEN 1 THEN ARRAY[10,100,200]
                          WHEN 2 THEN ARRAY[100,200,500]
                          ELSE ARRAY[200,500,1000] END;
    v_gain := v_opts[floor(random()*3)::int + 1];
    v_index := wheel_value_to_idx(v_gain);
    v_outcome := 'win4';

  ELSIF v_type = 'win6' THEN
    v_opts := CASE v_tier WHEN 1 THEN ARRAY[10,50,100]
                          WHEN 2 THEN ARRAY[50,100,500]
                          ELSE ARRAY[100,500,1000] END;
    v_gain := v_opts[floor(random()*3)::int + 1];
    v_index := wheel_value_to_idx(v_gain);
    v_outcome := 'win6';

  ELSIF v_type = 'win10' THEN
    IF v_roll < 0.333 THEN
      v_gain := CASE v_tier WHEN 1 THEN 100 WHEN 2 THEN 200 ELSE 500 END;
      v_index := wheel_value_to_idx(v_gain);
      v_outcome := 'win10';
    ELSIF v_roll < 0.667 THEN
      v_gain := CASE v_tier WHEN 1 THEN 200 WHEN 2 THEN 500 ELSE 1000 END;
      v_index := wheel_value_to_idx(v_gain);
      v_outcome := 'win10';
    ELSE
      v_gain := p_mise * 2;
      v_index := 1;           -- segment ×2
      v_outcome := 'x2';
    END IF;

  ELSE
    v_gain := 0;
    v_index := (ARRAY[0,3,7,11])[floor(random()*4)::int + 1];
    v_outcome := 'zero';
  END IF;

  -- ── Opération financière atomique ──────────────────────────────────────────
  v_new_solde := v_solde - p_mise + v_gain;
  UPDATE soldes SET solde = v_new_solde, date_maj = NOW() WHERE user_id = p_user_id;

  -- ── Avance du cycle ────────────────────────────────────────────────────────
  UPDATE utilisateurs
     SET spin_cycle_pos = v_pos + 1, spin_cycle_seq = v_seq
   WHERE id = p_user_id;

  -- ── Historique ─────────────────────────────────────────────────────────────
  INSERT INTO historique_revenus (user_id, montant, type)
  VALUES (p_user_id, p_mise, 'mise_roue');
  IF v_gain > 0 THEN
    INSERT INTO historique_revenus (user_id, montant, type)
    VALUES (p_user_id, v_gain, 'gain_roue');
  END IF;

  RETURN jsonb_build_object(
    'success',     true,
    'gain',        v_gain,
    'index',       v_index,
    'mise',        p_mise,
    'outcomeType', v_outcome,
    'newSolde',    v_new_solde,
    'cyclePos',    v_pos + 1
  );
END;
$paid$;
