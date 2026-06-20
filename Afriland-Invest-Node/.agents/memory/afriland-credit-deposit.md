---
name: Afriland — admin credit = validated deposit
description: Eligibility to invest/withdraw keys off a validated `depots` row; admin credit must mirror a deposit.
---

# Admin credit must be treated exactly like a deposit

In Afriland Invest, the right to **invest** (`routes/investment.js`) and to **withdraw**
(`routes/withdrawal.js`) is gated on the user having at least one row in `depots` with
`statut='valide'`. Referral/parrainage money alone (in `soldes`) is NOT enough.

**Decision:** the admin "credit_user" RPC writes a validated `depots` row (operateur
'Crédit admin', statut 'valide') and updates `soldes` — it does NOT write to
`historique_revenus`.

**Why:** a real deposit (`validate_depot`) only touches `depots` + `soldes` and is NOT a
"revenu". `user.js` computes `revenus_totaux` by summing ALL `historique_revenus` rows
(no type filter), so writing a credit there both inflated revenue totals and failed the
deposit-based eligibility gate, blocking admin-credited users from investing.

**How to apply:** any "give the user money so they can invest" flow must create a
validated `depots` row, not a `historique_revenus` entry. When changing this, also
backfill/clean existing `historique_revenus(type='credit_admin')` rows so old and new
credits stay consistent (avoid double-counting as both deposit and revenu).
