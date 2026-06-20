---
name: Afriland revenus journaliers (modèle 24h glissant)
description: Décision durable — versement du revenu journalier "1 fois par tranche de 24h par investissement" et pourquoi, + ordre de déploiement SQL.
---

# Revenu journalier = 1 versement par tranche de 24h, ancré par investissement

**Règle :** chaque commande active est créditée exactement une fois par période
de 24h, ancrée sur `commandes.last_revenue_at` (TIMESTAMPTZ). `buy_plan` pose
`last_revenue_at = NOW()` à l'achat → 1er revenu 24h après, puis toutes les 24h
à la même heure. La fonction `credit_daily_revenues()` (fichier
`server/revenus-24h.sql`, n'existe QUE côté Supabase) crédite et avance l'ancre
de `+24h` (pas `= now()`), une seule période par commande et par appel.

**Why :** l'ancien crédit était basé sur la DATE calendaire
(`last_revenue_date = CURRENT_DATE`). Au passage de minuit UTC, deux crédits
pouvaient tomber à <24h d'écart → plainte "payé deux fois en 24h". L'ancre
horodatée + avance fixe de +24h supprime ce risque et la dérive d'heure.

**How to apply / garanties :**
- Anti-double en multi-workers (cPanel/Passenger) : `FOR UPDATE SKIP LOCKED`.
- Expiration : on compare `v_next_due = last_revenue_at + 24h` à `date_fin`
  (PAS `now()`), sinon un arrêt serveur prolongé qui dépasse `date_fin` ferait
  PERDRE des périodes dues avant l'expiration. On clôt (`statut='termine'`)
  seulement quand `v_next_due::date > date_fin`.
- Rattrapage après downtime : 1 période par appel → catch-up progressif via le
  cron (`*/15 * * * *` dans `index.js`) + appel au démarrage. Évite un gros
  versement multi-jours d'un coup (perçu comme "double").
- `last_revenue_date` (DATE) est CONSERVÉE et mise à jour à chaque crédit
  (= date du dernier versement) car `MyOrders.jsx` l'affiche.
- `nextCreditAt` (route `/investment/my-orders`) = min(`last_revenue_at + 24h`)
  des commandes actives ; ne plus coder en dur 08:00 UTC.

**Ordre de déploiement SQL (IMPÉRATIF) :** exécuter `server/revenus-24h.sql`
(ajout colonne + backfill + nouvelle fonction) AVANT de (re)créer `buy_plan`
qui insère désormais `last_revenue_at`. Sinon `buy_plan` échoue (colonne absente).
Backfill : déjà crédité → `last_revenue_date 08:00 UTC` (continuité ancien cron) ;
jamais crédité → `created_at`.
