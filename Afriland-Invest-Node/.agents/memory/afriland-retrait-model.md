---
name: Afriland retrait (withdrawal) model
description: Durable rules for how withdrawals compute amounts, fees, and eligible balance.
---

# Modèle de retrait Afriland

Règle: le `montant` saisi par l'utilisateur est le **BRUT**. C'est ce montant qui est
déduit du solde, stocké en `retraits.montant`, et remboursé intégralement si l'admin annule.
- `frais` = round(10% du brut). `montant_net` = brut − frais.
- L'**admin voit/paie le `montant_net`** (frais déjà appliqués), pas le brut.

**Why:** l'utilisateur veut que ce qu'il tape soit ce qui quitte son solde, et que l'admin
ne paie que le net après frais — éviter toute ambiguïté brut/net entre les deux écrans.

## Solde retirable (computeRetirable)
`retirable = min( solde, max(0, eligible − retraits_en_attente_et_valides) )`
où `eligible = Σ(revenu_journalier + bonus + gain_roue) + (a_investi ? Σ(parrainage) : 0)`.
- L'argent **déposé** (dépôts réels OU crédités par l'admin) n'est **jamais** retirable.
- Le parrainage n'est retirable **que** si l'utilisateur a souscrit ≥1 investissement (`commandes`).
- `mise_roue` n'est **pas** soustrait explicitement; le plafonnement par `soldes.solde`
  gère le fait que les mises ont déjà puisé dans le solde réel.

**How to apply:** toute évolution du retrait doit garder le plafond par solde réel (sinon on
affiche un retirable non débitable → RPC "solde insuffisant").

## Contraintes serveur
Lundi–samedi 07:00–20:00 GMT (UTC), min 2000, max 2 retraits / 24h glissantes
(statuts `en_attente`/`valide` sur `date_demande`).

## RPC
`request_withdrawal` est passée de 4 → 6 args (ajout `p_frais`, `p_montant_net`).
DROP de l'ancienne signature obligatoire avant CREATE (voir supabase-rpc-overload.md).
`reject_retrait` rembourse le **brut** (= net + frais) — inchangé.
