---
name: Afriland deposits / Afribapay
description: Durable constraints for the Afribapay deposit flow in afriland-invest
---

# Afribapay deposit flow (afriland-invest)

- **Credit RPC must be atomic.** `validate_depot(p_depot_id)` is invoked by BOTH the
  client polling route (`/api/deposit/status`) and the public webhook
  (`/api/deposit/notify`). These can fire concurrently for the same depot.
  **Why:** a non-atomic `SELECT ... WHERE statut='en_attente'` then separate `UPDATE`
  lets two transactions both pass the guard and double-credit the balance.
  **How to apply:** the function must credit via a single guarded
  `UPDATE depots SET statut='valide' WHERE id=p_depot_id AND statut='en_attente' RETURNING ...`,
  and only credit `soldes` when a row is returned. Never split read/update.

- **Fee model (Afribapay DEDUCTS ~3.5%, it does NOT add on top).** The merchant
  receives `amount * (1 - 3.5%)`; the customer is debited exactly the `amount` sent.
  **Why:** owner confirmed "Afribapay coupe les frais de 3,5%" — sending net `montant`
  made the merchant net ~965 on a 1000 deposit while crediting the user 1000 (loss).
  **How to apply:** the CUSTOMER must pay the fee, so send the GROSS amount
  `montantTotal = round(montant * 1.035)` as `amount` to `payin` AND inject it into the
  client-side OTP USSD string (`Deposit.jsx`) — both must match or OTP users underpay.
  Credit only the net `montant` (validate_depot credits the `montant` column). Store
  `frais` / `montant_total` for records.
  **Never disclose the percentage to the user:** Deposit.jsx shows no fee line, and
  `/deposit/config` must NOT return `frais_pourcentage`. The gross amount shown inside
  the USSD code is fine (it is the amount to dial, not a percentage).

- **payin operator field** must be the operator CODE string (`operator.operator_code`),
  not the operator object. `findOperator()` returns `{country, operator}` objects.

- **Country filter:** only XOF/XAF countries, excluding CD/GN/GM. 13 retained:
  BF,CF,CG,CI,CM,GA,GW,ML,NE,SN,TG,BJ,TD. Afribapay returns English country names.

- **Prod only:** Afribapay sandbox is inactive; base is https://api.afribapay.com.

- **Operator logo matching is by NAME, not code.** Wallets/retraits store
  `methode_paiement` as the operator *name* (e.g. "Orange Money"), but
  `operateur_logos` is keyed by `operator_code` (e.g. "orange").
  **Why:** to show a wallet/method logo you cannot join on code directly.
  **How to apply:** build a name→logo_url map from `/deposit/countries` operators
  (which already carry both `operator_name` and `logo_url`) and look up by a
  normalized name (lowercase, strip non-alphanumerics). Used in Wallet.jsx,
  Withdrawal.jsx.

- **getCountries() must never hard-fail the UI.** The Afribapay `/v1/countries`
  call is intermittently flaky in prod; a single rejection used to cascade into the
  Deposit error toast and force Wallet/Withdrawal onto a limited static fallback.
  **Why:** Deposit/Wallet/Withdrawal all derive countries+operators from this one call.
  **How to apply:** `getCountries()` degrades fresh API → in-memory stale → disk cache
  (`server/.cache/countries.json`, written after every success, gitignored) and only
  throws if none exist. Server prewarms it at startup. Clients (Deposit) retry once and
  isolate config/list with per-call `.catch`. Wallet has a `useEffect([paysMethodes])`
  that re-normalizes `form.pays`/`form.methode_paiement` when async data swaps
  fallback→real, otherwise the method `<select>` renders empty.

- **Committed seed is the prod safety net.** Disk cache (`server/.cache/`) is gitignored
  and only fills after a successful live fetch — useless on a freshly deployed cPanel that
  has never reached Afribapay. So `getCountries()` falls back API → memory → disk →
  `server/data/countries-seed.json` (VERSIONED in git, deployed with code) → throw.
  **Why:** prod (manual cPanel) showed empty payment methods on deposit/withdrawal/admin
  whenever the Afribapay countries call failed; nothing in dev reproduces it because dev
  reaches the API fine. **How to apply:** regenerate the seed from a good run
  (`cp server/.cache/countries.json server/data/countries-seed.json`) when operators change,
  and commit it. The seed has NO logo_url (logos come from Supabase `operateur_logos`).

- **Dev ≠ prod deploy gap.** Replit is dev only; production is a manual cPanel upload
  (rebuild `client/dist` + upload `server/`). "Nothing changed on the live site" almost
  always means the user is on the cPanel domain and hasn't redeployed — not a code bug.
