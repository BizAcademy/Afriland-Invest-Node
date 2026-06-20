-- ============================================================
-- AFRILAND INVEST — Corrections (exécuter dans Supabase SQL Editor)
-- ============================================================

-- 1. Créer la table settings si elle n'existe pas
CREATE TABLE IF NOT EXISTS settings (
  id       SERIAL PRIMARY KEY,
  cle      TEXT UNIQUE NOT NULL,
  valeur   TEXT NOT NULL,
  description TEXT,
  date_maj TIMESTAMP DEFAULT NOW()
);
INSERT INTO settings (cle, valeur, description)
VALUES ('min_depot', '500', 'Montant minimum de dépôt en FCFA')
ON CONFLICT (cle) DO NOTHING;

-- 1b. Pourcentages de commission de parrainage (3 niveaux)
INSERT INTO settings (cle, valeur, description) VALUES
  ('commission_niveau1', '10', 'Commission parrainage niveau 1 (%)'),
  ('commission_niveau2', '5',  'Commission parrainage niveau 2 (%)'),
  ('commission_niveau3', '2',  'Commission parrainage niveau 3 (%)')
ON CONFLICT (cle) DO NOTHING;

-- 2. Créer/mettre à jour la table annonces (images obligatoires, titre optionnel)
CREATE TABLE IF NOT EXISTS annonces (
  id            SERIAL PRIMARY KEY,
  titre         TEXT DEFAULT '',
  contenu       TEXT DEFAULT '',
  image         TEXT,
  couleur       TEXT DEFAULT '#22c55e',
  actif         BOOLEAN DEFAULT TRUE,
  date_creation TIMESTAMP DEFAULT NOW(),
  date_maj      TIMESTAMP DEFAULT NOW()
);
-- Si la table existait déjà, rendre titre et contenu optionnels
ALTER TABLE annonces ALTER COLUMN titre SET DEFAULT '';
ALTER TABLE annonces ALTER COLUMN contenu SET DEFAULT '';
ALTER TABLE annonces ALTER COLUMN titre DROP NOT NULL;
ALTER TABLE annonces ALTER COLUMN contenu DROP NOT NULL;

-- 3. Nettoyer les plans dupliqués et créer exactement 10 VIP
-- (Attention : supprime tous les plans existants)

-- Élargir la colonne serie (était VARCHAR(1) → trop court pour "10")
ALTER TABLE planinvestissement ALTER COLUMN serie TYPE VARCHAR(10);

-- Colonnes nécessaires pour les images / descriptions des plans (admin)
ALTER TABLE planinvestissement ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE planinvestissement ADD COLUMN IF NOT EXISTS image_url VARCHAR(255);

DELETE FROM planinvestissement;

INSERT INTO planinvestissement (nom, prix, duree_jours, rendement_journalier, serie) VALUES
  ('VIP 1',       1000,     30,  1.5,  1),
  ('VIP 2',       3000,     30,  2.5,  2),
  ('VIP 3',       5000,     30,  3.5,  3),
  ('VIP 4',      10000,     45,  5.0,  4),
  ('VIP 5',      20000,     45,  7.0,  5),
  ('VIP 6',      50000,     60,  9.5,  6),
  ('VIP 7',     100000,     60, 12.0,  7),
  ('VIP 8',     200000,     90, 14.5,  8),
  ('VIP 9',     500000,     90, 17.0,  9),
  ('VIP 10',   1000000,    120, 19.5, 10);

-- Vérification
SELECT id, nom, prix, duree_jours, rendement_journalier FROM planinvestissement ORDER BY serie;
