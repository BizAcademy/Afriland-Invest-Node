---
name: Afriland Invest env quirks
description: How the Afriland Invest app runs and is tested in this Replit project
---

# Afriland Invest — environment

- The app is a **custom workflow** ("Afriland Invest", `cd afriland-invest && node server/index.js`) that listens on **port 3000**. It is NOT a registered Replit artifact.
- Because the shared proxy at `localhost:80` only routes to registered artifacts (api-server `/api`, mockup-sandbox), hitting `localhost:80/api/...` returns **502**. Test the app directly on **`localhost:3000`** (e.g. `curl localhost:3000/api/faq`).
- Production is an EXTERNAL host (Phusion Passenger/cPanel, gifetalpro.site) — NOT Replit. After client changes, the user must rebuild `client/dist` and upload it to production manually; Replit deploy logs do not apply.
- Supabase tables/functions live only in the DB; SQL source files in `server/*.sql` must be run manually in Supabase (the app uses supabase-js, no migrations run automatically).
