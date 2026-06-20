-- ═══════════════════════════════════════════════════════════════════════════
-- AFRILAND INVEST — REVENUS JOURNALIERS : 1 SEUL versement par TRANCHE DE 24h
-- À exécuter dans Supabase > SQL Editor.
--
-- POURQUOI CE CHANGEMENT
--   L'ancien crédit était basé sur la DATE calendaire (last_revenue_date =
--   CURRENT_DATE). Au passage de minuit UTC, deux crédits pouvaient tomber à
--   moins de 24h d'écart → impression de « payé deux fois en 24h ».
--   On passe à une ANCRE horodatée par investissement : chaque commande est
--   créditée EXACTEMENT une fois toutes les 24h, à la même heure que l'achat.
--
-- GARANTIES « ZÉRO BUG »
--   • Un seul versement par commande et par tranche de 24h (jamais deux).
--   • FOR UPDATE SKIP LOCKED : même si deux process serveur appellent la
--     fonction en même temps (cPanel/Passenger peut lancer plusieurs workers),
--     aucune ligne n'est créditée deux fois.
--   • L'ancre avance d'exactement +24h (pas « = now() ») → pas de dérive de
--     l'heure de versement au fil des jours.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Nouvelle colonne d'ancrage (horodatage du dernier versement « théorique »)
ALTER TABLE commandes ADD COLUMN IF NOT EXISTS last_revenue_at TIMESTAMPTZ;

-- 2. Backfill (à exécuter une seule fois ; sans risque de double versement) :
--    • Commande déjà créditée  → ancre = jour du dernier crédit à 08:00 UTC
--      (continuité avec l'ancien cron quotidien de 08:00 UTC).
--    • Commande jamais créditée → ancre = date de création (1er versement 24h après).
UPDATE commandes
   SET last_revenue_at = CASE
         WHEN last_revenue_date IS NOT NULL
           THEN (last_revenue_date::timestamp AT TIME ZONE 'UTC') + interval '8 hours'
           ELSE (created_at AT TIME ZONE 'UTC')
       END
 WHERE last_revenue_at IS NULL;

-- 3. Fonction de crédit : crédite UNE tranche de 24h par commande éligible.
--    Idempotente et concurrente-safe. Renvoie le nombre de crédits effectués.
CREATE OR REPLACE FUNCTION credit_daily_revenues()
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
  r           RECORD;
  v_next_due  TIMESTAMPTZ;
  v_count     INT := 0;
BEGIN
  FOR r IN
    SELECT id, user_id, revenu_journalier, last_revenue_at, date_fin
      FROM commandes
     WHERE statut = 'actif'
       AND last_revenue_at IS NOT NULL
       AND now() >= last_revenue_at + interval '24 hours'
     ORDER BY id
     FOR UPDATE SKIP LOCKED
  LOOP
    -- Période due en cours de traitement (celle qui s'achève à v_next_due).
    v_next_due := r.last_revenue_at + interval '24 hours';

    -- Si cette période due tombe APRÈS la fin du plan, c'est que toutes les
    -- périodes légitimes ont déjà été versées → on clôt la commande.
    -- Important : on se base sur v_next_due (et non sur now()), de sorte qu'un
    -- arrêt serveur prolongé ne fasse PERDRE aucun versement dû avant date_fin
    -- (les périodes dues sont créditées d'abord, une par appel, puis clôture).
    IF (v_next_due AT TIME ZONE 'UTC')::date > r.date_fin THEN
      UPDATE commandes SET statut = 'termine' WHERE id = r.id;
      CONTINUE;
    END IF;

    -- Crédit du solde (création de la ligne si elle n'existe pas encore).
    INSERT INTO soldes (user_id, solde, date_maj)
    VALUES (r.user_id, r.revenu_journalier, now())
    ON CONFLICT (user_id) DO UPDATE
      SET solde = soldes.solde + EXCLUDED.solde, date_maj = now();

    INSERT INTO historique_revenus (user_id, montant, type)
    VALUES (r.user_id, r.revenu_journalier, 'revenu_journalier');

    -- Avance de l'ancre d'EXACTEMENT +24h (anti-dérive et anti-double).
    -- last_revenue_date conserve la DATE du dernier versement (affichage « Mes ordres »).
    UPDATE commandes
       SET last_revenue_at   = v_next_due,
           last_revenue_date = now()::date
     WHERE id = r.id;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;
