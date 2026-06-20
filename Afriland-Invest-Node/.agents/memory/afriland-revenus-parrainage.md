---
name: Afriland revenus & parrainage business rules
description: Revenue type vocabulary and referral-commission rule for afriland-invest
---

# historique_revenus type vocabulary
Source of truth for "what counts as a gain". Note: the daily-investment RPC
`credit_daily_revenues` exists ONLY in Supabase (not in the repo SQL files), so
its inserted type is not greppable locally — it is `revenu_journalier`.

- `revenu_journalier` — daily investment income (credit, +)
- `parrainage` — referral commission (credit, +)
- `bonus` — free wheel win (credit, +)
- `gain_roue` — paid wheel win (credit, +)
- `mise_roue` — paid wheel BET (NOT a gain; sign has varied between functions — treat as non-revenue)
- `cadeau_vip` — VIP gift (credit, but NOT part of "revenus totaux")
- `debit_admin` — admin debit (negative)

**Revenus totaux** (dashboard, computed in server/routes/user.js): sum of ONLY
`['revenu_journalier','parrainage','bonus','gain_roue']`. Allow-list, never
denylist — guarantees the total only ever increases (cumulative lifetime gains).

# Referral commission rule
**Why:** business decision — a parrain earns 3-level commissions ONLY on a
filleul's FIRST investment, never on subsequent ones.
**How to apply:** in `buy_plan` (server/supabase-functions.sql), `SELECT solde
... FOR UPDATE` to serialize concurrent same-user buys, capture
`v_prev_count = COUNT(commandes WHERE user_id)` BEFORE inserting the new
commande, and gate the commission loop behind `IF v_prev_count = 0`.
