---
name: Afriland balance history reconstruction
description: Why full balance reconstruction from event logs is impossible; mise_roue stored-sign is inconsistent.
---

# Reconstructing solde avant/après for a user

The authoritative current balance is the `soldes` table. The per-event logs
(`depots`, `retraits`, `commandes`, `historique_revenus`) are **incomplete**, so
summing all deltas from zero does NOT land on the current solde for every user.

**Rule:** reconstruct balances by walking BACKWARD from the current `soldes`
value, never forward from 0.
**Why:** some historical admin adjustments changed `soldes` directly without
writing a `historique_revenus` row (e.g. one user was off by ~42k with no
matching debit row). Backward-walk anchors the most recent transactions to the
true balance; only deep history may drift, which is acceptable.
**How to apply:** in any "solde avant/après" feature, set running = currentSolde,
iterate events newest→oldest: solde_apres = running; solde_avant = running - delta;
running = solde_avant.

# mise_roue stored-sign is inconsistent

`historique_revenus.type = 'mise_roue'` rows are stored **negative for recent
spins but positive for older ones** (the wheel RPC changed over time). A mise is
always a debit.
**Rule:** derive the balance delta from the TYPE, not the stored sign:
`mise_roue` and `debit_admin` → `delta = -abs(montant)`; all other revenu types →
`delta = +abs(montant)`.
**Why:** trusting the stored sign double-counted old positive mise_roue rows
(one user drifted by ~188k). Normalizing by semantic type fixed it.

# Balance-effect rules per source (for deltas)

- depot: `+montant` only when `statut === 'valide'` (effective date = date_traitement), else 0.
- retrait: `-montant` unless `statut === 'rejete'` (deducted at request via request_withdrawal; rejected = refunded, net 0).
- commande: `-montant` unless `statut` is `annule`/`refuse` (principal never refunded on completion).
- historique_revenus: by semantic type (see mise_roue rule above).
