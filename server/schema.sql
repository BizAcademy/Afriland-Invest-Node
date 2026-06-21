-- AFRILAND INVEST - Schéma PostgreSQL (compatible Supabase)
-- À exécuter dans votre dashboard Supabase > SQL Editor

CREATE TABLE IF NOT EXISTS utilisateurs (
  id SERIAL PRIMARY KEY,
  nom VARCHAR(100) NOT NULL,
  telephone VARCHAR(25) NOT NULL UNIQUE,
  pays VARCHAR(50),
  mot_de_passe VARCHAR(255) NOT NULL,
  solde DECIMAL(15,2) DEFAULT 0,
  revenus_totaux DECIMAL(15,2) DEFAULT 0,
  nombre_filleuls INT DEFAULT 0,
  code_parrainage VARCHAR(20),
  parrain_id INT REFERENCES utilisateurs(id),
  lien_parrainage VARCHAR(255),
  role VARCHAR(10) DEFAULT 'user',
  last_spin_time TIMESTAMP,
  date_inscription TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS soldes (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL UNIQUE REFERENCES utilisateurs(id) ON DELETE CASCADE,
  solde DECIMAL(15,2) DEFAULT 0,
  date_maj TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vip (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL UNIQUE REFERENCES utilisateurs(id) ON DELETE CASCADE,
  niveau INT DEFAULT 0,
  pourcentage INT DEFAULT 0,
  invitations_requises INT DEFAULT 3,
  invitations_actuelles INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS planinvestissement (
  id SERIAL PRIMARY KEY,
  serie VARCHAR(1) NOT NULL,
  nom VARCHAR(100) NOT NULL,
  prix DECIMAL(10,2) NOT NULL,
  rendement_journalier DECIMAL(5,2) NOT NULL,
  duree_jours INT NOT NULL,
  description TEXT,
  image_url VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS commandes (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  plan_id INT NOT NULL REFERENCES planinvestissement(id),
  montant DECIMAL(15,2) NOT NULL,
  revenu_journalier DECIMAL(15,2) NOT NULL,
  date_debut DATE DEFAULT CURRENT_DATE,
  date_fin DATE NOT NULL,
  statut VARCHAR(20) DEFAULT 'actif',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS depots (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  montant DECIMAL(15,2) NOT NULL,
  pays VARCHAR(100),
  operateur VARCHAR(100),
  numero_payeur VARCHAR(50),
  preuve_paiement VARCHAR(255),
  statut VARCHAR(20) DEFAULT 'en_attente',
  devise VARCHAR(10),
  frais DECIMAL(15,2) DEFAULT 0,
  montant_total DECIMAL(15,2),
  ab_order_id VARCHAR(100),
  ab_transaction_id VARCHAR(100),
  ab_status VARCHAR(20),
  date_depot TIMESTAMP DEFAULT NOW(),
  date_traitement TIMESTAMP
);

CREATE TABLE IF NOT EXISTS operateur_logos (
  operator_code VARCHAR(50) PRIMARY KEY,
  label VARCHAR(100),
  logo_url VARCHAR(255),
  date_maj TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS retraits (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  montant DECIMAL(15,2) NOT NULL,
  frais DECIMAL(15,2) DEFAULT 0,
  montant_net DECIMAL(15,2),
  methode VARCHAR(50),
  numero_compte VARCHAR(100),
  statut VARCHAR(20) DEFAULT 'en_attente',
  date_demande TIMESTAMP DEFAULT NOW(),
  date_traitement TIMESTAMP
);

CREATE TABLE IF NOT EXISTS portefeuilles (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL UNIQUE REFERENCES utilisateurs(id) ON DELETE CASCADE,
  nom_portefeuille VARCHAR(255) NOT NULL,
  pays VARCHAR(100) NOT NULL,
  methode_paiement VARCHAR(100) NOT NULL,
  numero_telephone VARCHAR(25) NOT NULL,
  date_creation TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transaction_passwords (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL UNIQUE REFERENCES utilisateurs(id) ON DELETE CASCADE,
  password VARCHAR(4) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS historique_revenus (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  commande_id INT,
  montant DECIMAL(15,2) NOT NULL,
  type VARCHAR(30) NOT NULL,
  -- Pour les commissions de parrainage : niveau 1/2/3 (NULL pour les autres types).
  niveau SMALLINT,
  date_paiement TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS filleuls (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL UNIQUE REFERENCES utilisateurs(id) ON DELETE CASCADE,
  gains_totaux DECIMAL(15,2) DEFAULT 0,
  date_maj TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS roue (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL UNIQUE REFERENCES utilisateurs(id) ON DELETE CASCADE,
  nombre_tours INT DEFAULT 0,
  dernier_gain INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS posts (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  image VARCHAR(255) DEFAULT '',
  likes INT DEFAULT 0,
  statut VARCHAR(20) DEFAULT 'en_attente',
  date_creation TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS photos_profil (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  nom_fichier VARCHAR(255) NOT NULL,
  date_upload TIMESTAMP DEFAULT NOW()
);

-- Données initiales : Plans d'investissement
INSERT INTO planinvestissement (serie, nom, prix, rendement_journalier, duree_jours, description, image_url) VALUES
('X', 'Action VIP 1', 3000, 10.50, 125, 'Plan d''investissement premium', ''),
('X', 'Action VIP 2', 7000, 11.00, 125, 'Plan d''investissement premium', ''),
('X', 'Action VIP 3', 15000, 12.00, 125, 'Plan d''investissement premium', ''),
('X', 'Action VIP 4', 25000, 12.50, 125, 'Plan d''investissement premium', ''),
('X', 'Action VIP 5', 45000, 13.00, 125, 'Plan d''investissement premium', ''),
('X', 'Action VIP 6', 70000, 13.50, 125, 'Plan d''investissement premium', ''),
('X', 'Action VIP 7', 115000, 14.00, 125, 'Plan d''investissement premium', ''),
('X', 'Action VIP 8', 170000, 14.50, 125, 'Plan d''investissement premium', ''),
('X', 'Action VIP 9', 250000, 19.50, 125, 'Plan d''investissement premium', ''),
('X', 'Action VIP 10', 400000, 19.50, 125, 'Plan d''investissement premium', ''),
('X', 'Action VIP 11', 600000, 19.50, 125, 'Plan d''investissement premium', '')
ON CONFLICT DO NOTHING;

-- ─── Support : messagerie utilisateurs ↔ administrateur ───
CREATE TABLE IF NOT EXISTS support_messages (
  id SERIAL PRIMARY KEY,
  telephone VARCHAR(30) NOT NULL,
  nom VARCHAR(120),
  expediteur VARCHAR(10) NOT NULL CHECK (expediteur IN ('user','admin')),
  message TEXT NOT NULL,
  lu BOOLEAN DEFAULT FALSE,
  date_creation TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_support_messages_tel ON support_messages(telephone);
CREATE INDEX IF NOT EXISTS idx_support_messages_lu ON support_messages(lu);
