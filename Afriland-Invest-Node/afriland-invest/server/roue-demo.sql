-- ═══════════════════════════════════════════════════════════════════════════
-- AFRILAND INVEST — ROUE DE LA FORTUNE : MODE DÉMO (isolé du système réel)
-- À exécuter dans Supabase > SQL Editor
--
-- Le mode démo est TOTALEMENT séparé du système réel :
--   • Aucun lien avec la table `soldes` (argent réel) ni `historique_revenus`.
--   • Les mises / gains démo ne sont JAMAIS enregistrés dans le panneau admin.
--   • Seules les demandes de rechargement démo apparaissent côté admin
--     (pour approbation), pas les mises ni les gains.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Solde de démonstration par utilisateur (100 000 FCFA pour tous) ──────────
-- cycle_pos : position dans le cycle de 10 tours
-- cycle_seq : ordre (mélangé) des 10 tours pour le cycle courant (indices 0..9)
CREATE TABLE IF NOT EXISTS roue_demo (
  user_id    INT PRIMARY KEY REFERENCES utilisateurs(id) ON DELETE CASCADE,
  solde      NUMERIC NOT NULL DEFAULT 100000,
  cycle_pos  INT NOT NULL DEFAULT 0,
  cycle_seq  INT[],
  date_maj   TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── Demandes de rechargement du solde démo (approuvées par l'admin) ──────────
CREATE TABLE IF NOT EXISTS roue_demo_recharges (
  id               SERIAL PRIMARY KEY,
  user_id          INT NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  statut           TEXT NOT NULL DEFAULT 'en_attente',  -- en_attente | approuve | rejete
  date_demande     TIMESTAMP NOT NULL DEFAULT NOW(),
  date_traitement  TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_roue_demo_recharges_statut
  ON roue_demo_recharges(statut);

-- Une seule demande "en_attente" par utilisateur (garde anti-doublon au niveau base).
CREATE UNIQUE INDEX IF NOT EXISTS uniq_roue_demo_recharge_pending
  ON roue_demo_recharges(user_id)
  WHERE statut = 'en_attente';
