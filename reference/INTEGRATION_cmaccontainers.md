# Bolt-Data → cmaccontainers.com Employee Dashboard — Integration Guide

**Audience:** the AI agent (and Cody) building the *new* cmaccontainers.com
employee dashboard.
**Goal:** show live container-home inventory counts (and, optionally, the
underlying unit list) on the dashboard — pulled from the **Bolt-Data mirror**,
never from the ECI Bolt API directly.

---

## 1. The one mental-model you must hold

There is a background service ("Bolt-Data") that continuously mirrors the ECI
Bolt API into a **Supabase Postgres database**. A throttled worker on a GCP VM
(`big-boy-vm`, systemd service `bolt-data`) keeps it fresh ~every 15 minutes.

```
ECI Bolt API ──(worker, every ~15 min)──► Supabase Postgres ──► YOUR dashboard reads here
```

**Golden rules:**

1. ✅ **Read from Supabase.** The dashboard queries the mirror. It is fast,
   persistent, and always available.
2. ❌ **Never call the ECI Bolt API from the website.** That is the whole
   problem this project exists to eliminate (rate limits, timeouts, many calls
   for one fact). If you find yourself adding a Bolt token to the website, stop.
3. ❌ **Never re-implement the inventory counting logic.** Use the
   `mini_homes_inventory` view. If the definition of "available" changes, it
   changes in one place (the view), not in every consumer.
4. 🔒 **All access is server-side.** See the security section — the public
   (anon) key returns **nothing** by design.

---

## 2. What "inventory" means (so the number is trustworthy)

- Each container home is a **job** in Bolt whose **office = `Mini Homes`**.
- Availability is a **checkbox** on one of that job's work orders, labeled
  exactly `Assign to "Inventory"`. When checked, the unit counts as available.
- A second checkbox, `Allocated to Boss Containers`, is tracked separately.

The `mini_homes_inventory` view encapsulates all of that. As of this writing it
returns `available_inventory = 35`, `allocated_boss = 3`.

---

## 3. Connection details

| Item | Value |
|---|---|
| Supabase project | `bolt-data` |
| Project ref | `jlqvanrtzdhnjgrmmumc` |
| Project URL | `https://jlqvanrtzdhnjgrmmumc.supabase.co` |
| REST base | `https://jlqvanrtzdhnjgrmmumc.supabase.co/rest/v1` |
| The view | `public.mini_homes_inventory` |
| Postgres (pooler, IPv4) | `aws-0-us-east-1.pooler.supabase.com:5432`, db `postgres`, user `postgres.jlqvanrtzdhnjgrmmumc` |

**Secrets you must obtain from Cody (do NOT hardcode them in the repo):**

- `SUPABASE_SERVICE_ROLE_KEY` — from Supabase dashboard → project `bolt-data` →
  *Project Settings → API → service_role*. This is a **secret** key.
- **OR** the Postgres connection string (includes the DB password) if you query
  Postgres directly instead of via the Supabase REST client.

Store whichever you use in the website backend's environment (e.g. `.env`,
Vercel/Netlify env vars, or your host's secret manager). Never ship it to the
browser and never commit it.

---

## 4. Security model — read this or you'll get empty results

The mirror holds customer PII (names, addresses, phones), so every table has
**Row-Level Security enabled with no policies = deny-all**. Consequences:

- The **anon / publishable key returns zero rows** for everything, including the
  view. This is intentional.
- Only the **`service_role` key** (or a direct Postgres connection as the
  `postgres` role) can read the data — and both of those are **server-side
  only**.

**Therefore the dashboard architecture must be:**

```
Browser ──► YOUR backend (API route / server) ──(service_role)──► Supabase
```

The browser calls *your* endpoint; *your server* holds the service_role key and
talks to Supabase. The key never reaches the client.

> ⚠️ If you ever put the `service_role` key in front-end code or a public env
> var (`NEXT_PUBLIC_*`, `VITE_*`, etc.), you expose god-mode access to the entire
> database. Backend/server context only.

---

## 5. Implementation — pick ONE of these

### Option A — Supabase JS client (recommended if the site already uses Supabase)

Server-side only (Next.js Route Handler / API route, Express handler, etc.):

```ts
// app/api/inventory/route.ts   (Next.js App Router example)
import { createClient } from "@supabase/supabase-js";

// Server-only env vars (NOT prefixed with NEXT_PUBLIC_)
const supabase = createClient(
  process.env.SUPABASE_URL!,            // https://jlqvanrtzdhnjgrmmumc.supabase.co
  process.env.SUPABASE_SERVICE_ROLE_KEY! // service_role secret — server only
);

export async function GET() {
  const { data, error } = await supabase
    .from("mini_homes_inventory")
    .select("*")
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
  // data = { available_inventory, allocated_boss, last_synced_at }
  return Response.json(data);
}
```

### Option B — Direct Postgres (node-postgres)

Use the **pooler** host (the DB has no public IPv4 on the direct host):

```ts
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // pooler URI from Cody, incl. password
  // e.g. postgresql://postgres.jlqvanrtzdhnjgrmmumc:<pw>@aws-0-us-east-1.pooler.supabase.com:5432/postgres
});

export async function getInventory() {
  const { rows } = await pool.query("SELECT * FROM mini_homes_inventory");
  return rows[0]; // { available_inventory, allocated_boss, last_synced_at }
}
```

### Option C — Raw REST (no SDK)

```bash
curl "https://jlqvanrtzdhnjgrmmumc.supabase.co/rest/v1/mini_homes_inventory?select=*" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
# -> [{ "available_inventory": 35, "allocated_boss": 3, "last_synced_at": "..." }]
```

---

## 6. The data contract (what your endpoint returns)

`GET /api/inventory` →

```json
{
  "available_inventory": 35,
  "allocated_boss": 3,
  "last_synced_at": "2026-08-21T22:33:56.000Z"
}
```

| Field | Type | Meaning |
|---|---|---|
| `available_inventory` | integer | Container homes currently available (`Assign to "Inventory"` checked). **This is the headline number.** |
| `allocated_boss` | integer | Units flagged `Allocated to Boss Containers`. |
| `last_synced_at` | timestamptz | When the underlying rows were last refreshed by the worker. Use it to show an "as of …" label. |

---

## 7. Freshness & staleness

- The worker refreshes Mini Homes data roughly every **15 minutes**, so the
  count can lag reality by up to that. For a container inventory board that is
  effectively real-time.
- **Surface `last_synced_at`** in the UI (e.g. "Inventory as of 3:33 PM"). If it
  is more than ~1 hour old, the worker may be down — show a subtle "data may be
  stale" indicator rather than a wrong-looking hard number.
- Cache your endpoint response for 30–60s if you like; do **not** hammer the DB
  on every page render.

---

## 8. Optional — list the actual available units

If the dashboard wants a table of units, not just a count, query the base tables.
Ask Cody before relying on specific address fields (Bolt's `city` field embeds
state, e.g. `"Frisco, TX"`, and street `address` may be null on some jobs):

```sql
SELECT DISTINCT j.id AS job_number, j.address, j.city, j.community, j.customer
FROM jobs j
JOIN work_orders wo ON wo.job_number = j.id
JOIN work_order_statuses s ON s.work_order_id = wo.id
WHERE j.office = 'Mini Homes'
  AND j.deleted_at IS NULL
  AND s.status IS TRUE
  AND replace(lower(s.description), '"', '') LIKE '%assign to inventory%'
ORDER BY j.city, j.address;
```

If a unit list becomes a permanent dashboard feature, tell Cody — the
Bolt-Data project should add a dedicated view (e.g. `mini_homes_available_units`)
so the website keeps consuming a stable interface instead of raw joins.

---

## 9. Do / Don't checklist

**Do**
- Read `mini_homes_inventory` for the count.
- Keep the service_role key / DB string strictly server-side.
- Show `last_synced_at`.
- Treat the view as the stable contract; request new views for new needs.

**Don't**
- Don't call the ECI Bolt API from the website.
- Don't use the anon/publishable key (it returns nothing here).
- Don't put the service_role key in client code or a `PUBLIC_*` env var.
- Don't copy the counting SQL into the app and maintain it separately.
- Don't use the direct DB host `db.jlqvanrtzdhnjgrmmumc.supabase.co` — it is
  IPv6-only; use the **pooler** host.

---

## 10. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Query returns `[]` / null | Using the anon/publishable key (RLS deny-all) | Use the `service_role` key or a Postgres connection, server-side |
| `Network is unreachable` / connect timeout to DB | Using the IPv6-only direct host from an IPv4 environment | Use the pooler host `aws-0-us-east-1.pooler.supabase.com:5432` |
| Count looks frozen | Worker down on `big-boy-vm` | Cody: `ssh big-boy-vm 'sudo systemctl status bolt-data'` and `journalctl -u bolt-data -f` |
| Number seems wrong | Definition of "available" changed in Bolt | Fix once in the `mini_homes_inventory` view; consumers need no change |

---

## 11. Ownership

- **Bolt-Data service / mirror / views:** owned by the Bolt-Data project (repo
  `github.com/cojovi/bolt_data_retrieval_cmac`), running on `big-boy-vm`.
- **Need a new field, view, or dataset** (e.g. per-unit list, addresses for the
  CMAC dash, roofing report status)? Request it there — do not work around it by
  querying Bolt or duplicating logic in the website.
```
