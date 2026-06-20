---
name: Afriland Invest architecture
description: Non-obvious deploy/runtime facts for the afriland-invest app
---

# Afriland Invest — architecture atypique

- Le serveur Express tourne en **standalone sur le port 3000** (`afriland-invest/server`), **PAS** via le proxy d'artifact du monorepo. Le client React+Vite est buildé dans `afriland-invest/client/dist` et servi par ce même serveur. `api` baseURL = `/api`.
- **PROD = cPanel EXTERNE** (hors Replit). Déploiement manuel : rebuild `dist` + upload serveur + exécuter le SQL dans Supabase. Aucun déploiement Replit automatique.
- Build client : `cd afriland-invest/client && npx vite build` (le `npm run build` peut timeout via l'outil).
- **Roue de la Fortune — système réel 100% SQL** : fonctions Postgres `spin_wheel_paid` / `spin_wheel_free` (`server/spin-functions.sql`). NE PAS toucher.
- **Mode démo de la Roue = totalement isolé** : tables `roue_demo` / `roue_demo_recharges`, route `/api/demo/*` (`server/routes/demo.js`), logique de tirage truqué en JS (pas en SQL). Les mises/gains démo n'apparaissent jamais côté admin — seules les demandes de rechargement remontent.

**Why:** structure inhabituelle (pas un artifact proxifié, prod hors Replit) — facile de se tromper en supposant le pattern monorepo standard.
