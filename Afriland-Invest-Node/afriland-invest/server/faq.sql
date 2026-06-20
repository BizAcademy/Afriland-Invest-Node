-- Table FAQ (questions fréquentes) — gérée depuis le panneau admin
CREATE TABLE IF NOT EXISTS faq (
  id            SERIAL PRIMARY KEY,
  question      TEXT NOT NULL,
  reponse       TEXT DEFAULT '',
  image         TEXT,
  ordre         INT DEFAULT 0,
  actif         BOOLEAN DEFAULT TRUE,
  date_creation TIMESTAMP DEFAULT NOW(),
  date_maj      TIMESTAMP DEFAULT NOW()
);

-- Seed des questions existantes (uniquement si la table est vide)
INSERT INTO faq (question, reponse, ordre)
SELECT v.question, v.reponse, v.ordre
FROM (VALUES
  ('Comment déposer de l''argent ?', 'Allez dans la section Dépôt, choisissez votre pays et opérateur, envoyez le montant sur notre numéro, puis remplissez le formulaire avec votre numéro payeur. Votre dépôt sera validé sous 24h.', 1),
  ('Comment retirer mes gains ?', 'Configurez d''abord votre portefeuille dans Compte > Portefeuille. Ensuite, allez dans Retrait et remplissez votre demande. Les retraits sont traités du lundi au samedi de 9h à 19h GMT.', 2),
  ('Qu''est-ce que le programme de parrainage ?', 'En partageant votre lien de parrainage, vous gagnez des commissions sur les investissements de vos filleuls sur 3 niveaux : 10% (niveau 1), 5% (niveau 2) et 2% (niveau 3).', 3),
  ('Comment fonctionnent les plans VIP ?', 'Achetez un plan VIP avec votre solde. Chaque jour, vous recevez un rendement entre 10.5% et 19.5% du montant investi pendant la durée du plan (125 jours).', 4),
  ('Comment fonctionnent les cadeaux VIP ?', 'En parrainant des personnes qui investissent, vous débloquez des cadeaux uniques : VIP 1 = 70 filleuls ayant investi → cadeau de 5000 FCFA, VIP 2 = 100 filleuls → 8000 FCFA, VIP 3 = 200 filleuls → 10000 FCFA. Cliquez sur « Réclamer un cadeau » ; l''administrateur confirme avant que le montant soit crédité sur votre solde. Seuls les filleuls ayant effectué un investissement sont comptabilisés.', 5),
  ('Comment fonctionne la roue de la fortune ?', 'Vous avez droit à un tour gratuit toutes les 48h. Le montant sur lequel la roue s''arrête est exactement celui crédité sur votre solde. Pour rejouer avant les 48h, vous pouvez parier (mise à partir de 100 FCFA).', 6),
  ('Quel est le dépôt minimum ?', 'Le dépôt minimum est de 500 FCFA.', 7),
  ('Quel est le retrait minimum ?', 'Le retrait minimum est de 2000 FCFA. Vous devez avoir un plan d''investissement actif pour effectuer un retrait.', 8),
  ('Quels pays sont éligibles ?', 'Cameroun, Côte d''Ivoire, Sénégal, Mali, Bénin, Burkina Faso et Togo. Les opérateurs Mobile Money (MTN, Orange, Wave, Moov) sont acceptés.', 9),
  ('Comment configurer mon mot de passe de transaction ?', 'Allez dans Compte, puis trouvez la section "Mot de passe de transaction". Entrez un code à 4 chiffres. Ce code est requis pour les retraits et les achats de plans.', 10)
) AS v(question, reponse, ordre)
WHERE NOT EXISTS (SELECT 1 FROM faq);
