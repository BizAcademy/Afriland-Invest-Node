---
name: Supabase RPC function overload (PGRST203)
description: Why recreating a PL/pgSQL function with different param types breaks RPC calls, and how to fix.
---

# Supabase / PostgREST function overload trap (PGRST203)

`CREATE OR REPLACE FUNCTION` only replaces a function with the **exact same parameter
types**. If you recreate it with different types (e.g. `bigint` → `integer`, or
`numeric` → `integer`), Postgres keeps BOTH versions as overloads. PostgREST then
cannot pick one and every `supabase.rpc(...)` call fails with:

`Could not choose the best candidate function between: ... (PGRST203)`

**Why:** a JS number sent over REST matches multiple numeric param types, so the
overload is ambiguous.

**How to apply:** before recreating an RPC whose signature changed, explicitly
`DROP FUNCTION IF EXISTS name(oldtypes);` for every known signature, then recreate
the single intended version. Keep these DROPs at the top of the .sql file so it is
self-healing on re-run. The Afriland Invest spin functions (`spin_wheel_free`,
`spin_wheel_paid`) use `integer` params because `utilisateurs.id` is INT/SERIAL.
