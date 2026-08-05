# ECI Bolt → Site Live Inventory Pipeline

**Handoff document for the next agent rebuilding / restyling this site.**  
This describes the **exact** Bolt Open API integration used on Boss Container Homes (`cmac-containers-site`) so the same live inventory counts can be rewired into a new UI with different styles/colors. The data path should be **nearly identical**; only presentation should change.

| Item | Value |
|---|---|
| Source of truth for counts | ECI Bolt Open API (`https://app.bolttech.net/open/v1`) |
| Office filter | `Mini Homes` (env-overridable) |
| Server entrypoint | `api/bolt-inventory.js` |
| Local API companion | `scripts/local-api-server.js` on `:8787` |
| Admin UI consumer | `portal/admin.html` (Ops Board → **Refresh**) |
| Secrets location | Vercel env vars (prod) or `.env.local` (local) — **never** in client JS |
| API schema version | `2` |

Related shorter session notes: [`DOCUMENTATION.md`](DOCUMENTATION.md) (section “Bolt Live Board Refresh”).  
Broader Bolt reference packs (not required to ship the feature): `bolt_api_stuff/`.

---

## 1. What this feature does (product intent)

Admins need Live Board numbers that reflect **what Bolt says is inventory-ready today**, not only what the portal’s Supabase inventory tables say.

On **Refresh** (manual button — not auto-polling):

| Live Board tile | Data source after successful Refresh |
|---|---|
| **Available now** (`#lv-avail`) | Bolt: jobs with Stage 6 checkbox **Assign to "Inventory"** checked |
| **Built & ready** (`#lv-ready`) | **Same number** as Available now (by product decision) |
| **Allocated** (`#lv-alloc`) | Bolt: jobs with Stage 6 checkbox **Allocated to Boss Containers** checked |
| **Scheduled / next batch** | Still from Supabase inventory summary (unchanged) |
| Pipeline rows (Awaiting Agreement, Awaiting Wire, …) | Still sums of `orders.qty` by `orders.status` in Postgres |

**In Production** from Bolt was explicitly deferred — do not invent a third checkbox scan unless product asks for it.

Until the admin clicks Refresh in a browser tab, tiles fall back to Supabase inventory math (`summary.ready_units`, `allocated_units`, etc.). After Refresh, Bolt values override for that **tab session** via `sessionStorage`.

---

## 2. Architecture (do not put the Bolt token in the browser)

```
┌─────────────────────────────┐
│  Admin browser              │
│  portal/admin.html          │
│  - Supabase session JWT     │
│  - Fetch GET bolt-inventory │
│  - Write DOM + sessionStorage
└──────────────┬──────────────┘
               │ Authorization: Bearer <supabase_access_token>
               │
     ┌─────────▼──────────┐         ┌────────────────────────────┐
     │ Local :8787        │         │ Production (Vercel)        │
     │ local-api-server   │   OR    │ /api/bolt-inventory        │
     │ CORS for :8080     │         │ maxDuration 60s            │
     └─────────┬──────────┘         └─────────────┬──────────────┘
               │                                  │
               └──────────────┬───────────────────┘
                              │
                    ┌─────────▼──────────┐
                    │ api/bolt-inventory │
                    │ 1. Verify admin JWT│
                    │ 2. Call Bolt Open  │
                    │    API with token  │
                    │ 3. Return JSON     │
                    └─────────┬──────────┘
                              │
                    ┌─────────▼──────────┐
                    │ Bolt Open API      │
                    │ jobs / work_orders │
                    │ / statuses         │
                    └────────────────────┘
```

**Hard rule for the restyle:** Bolt credentials stay **server-side only**. The browser only sends the user’s Supabase access token. The serverless function (or local API) holds `BOLT_TOKEN` / `BOLT_TOKEN_NAME`.

---

## 3. Authentication & authorization

### 3.1 Browser → our API

```http
GET /api/bolt-inventory
Authorization: Bearer <supabase_session.access_token>
Accept: application/json
```

Locally (when `PORTAL_CONFIG.LOCAL_DEV` is true):

```http
GET http://127.0.0.1:8787/api/bolt-inventory
```

### 3.2 Server gate (`requireAdmin` in `api/bolt-inventory.js`)

1. Require `Authorization: Bearer …`.
2. `GET {SUPABASE_URL}/auth/v1/user` with that Bearer + anon `apikey`.
3. `GET {SUPABASE_URL}/rest/v1/profiles?id=eq.{user.id}&select=role`.
4. Allow only if `role === 'admin'`.
5. Otherwise `401 unauthorized` or `403 forbidden`.

Local API defaults Supabase to the **local** demo stack (`http://127.0.0.1:54321` + demo anon key) so JWT verification matches the local portal. Production uses the project URL/anon key (overridable via `SUPABASE_URL` / `SUPABASE_ANON_KEY`).

### 3.3 Our API → Bolt

```http
Authorization: Token token=<BOLT_TOKEN>, name=<BOLT_TOKEN_NAME>
Accept: application/json
Cookie: XSRF-TOKEN=<BOLT_XSRF_TOKEN>   # optional; some tenants need it; can expire
```

**Critical auth gotcha:** Do **not** wrap the token/name in extra quotes inside the header value. The working form is:

```text
Token token=ACTUAL_TOKEN, name=ACTUAL_NAME
```

Not `Token token="…"`. Wrong quoting caused silent auth failures during development.

If `BOLT_TOKEN` or `BOLT_TOKEN_NAME` is missing → `503 { "error": "bolt_not_configured" }`.

---

## 4. Business matching rules (the actual Bolt semantics)

We do **not** invent inventory from job titles or addresses. We count **checkbox statuses** on a specific work-order stage.

### 4.1 Scope

1. Load jobs belonging to office **`Mini Homes`** (`BOLT_OFFICE`).
2. For each job, list work orders.
3. Keep only work orders where stage/type canonicalizes to **`stage 6 - final`**.
4. For each Stage 6 WO, `GET work_orders/{id}/statuses`.
5. Inspect checked statuses (`status === true`).

### 4.2 Status matchers (schema v2)

| Logical count | Canonical description (after normalize) | Known `work_order_status_type_id` |
|---|---|---|
| Inventory / ready | `assign to inventory` | `116259` |
| Allocated to Boss | `allocated to boss containers` | `116262` |

Match if **either** the type id matches **or** the description matches after canonicalization. Prefer keeping both so renames in Bolt UI don’t silently break counts.

### 4.3 Canonicalization (must preserve)

Bolt UI labels include quotes, e.g. `Assign to "Inventory"`. Early matcher bugs returned **0** because the code compared against `assign to inventory` without stripping quotes.

```js
function canonical(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/["']/g, '')   // REQUIRED — strip quotes
    .replace(/\s+/g, ' ');
}
```

Apply the same normalize to `work_order_type`, `stage`, and status `description`.

### 4.4 Counting semantics

- Counts are **per Mini Homes job** (not per work order).
- One Stage 6 pass per job returns **both** flags (`inventory` and `allocated`) so we do not double-fetch statuses.
- A job can contribute to **both** counts if both checkboxes are checked.
- Verified sample (2026-08-02): **46** Mini Homes jobs scanned → **5** inventory, **3** allocated (including FW86 / WO 27747537, FW11 / WO 26057098, FW88 / WO 27869848).

---

## 5. Scan algorithm (server) — copy this logic on a new site

Implemented in `scanInventory()` / helpers in `api/bolt-inventory.js`.

### 5.1 Roster load (`loadMiniHomesJobs`)

Full `GET /jobs` pagination over the tenant can be **~40k+ jobs** and is expensive / 429-prone.

1. Try disk cache: OS temp file `cmac-bolt-mini-homes-roster.json` (override with `BOLT_ROSTER_CACHE`).
2. Cache shape: `{ office, fetched_at, jobs: [{ id, address }] }`.
3. TTL default **6 hours** (`BOLT_ROSTER_TTL_SEC=21600`). Set `0` to always rebuild.
4. On miss: `paginate('jobs', 'jobs')`, filter `job.office === BOLT_OFFICE`, write cache.
5. Force rebuild: `GET /api/bolt-inventory?refresh_roster=1` (deletes cache file) or delete the temp file manually.

### 5.2 Per-job Stage 6 pass (`jobCheckboxFlags`)

For each roster job (intentionally **serial**):

1. `paginate('jobs/{id}/work_orders', 'work_orders')`
2. Filter Stage 6
3. For each Stage 6 WO: `GET work_orders/{id}/statuses`
4. Set `flags.inventory` / `flags.allocated` from checked statuses
5. Early-exit that job when both flags are already true

### 5.3 Pagination helper

Bolt list endpoints return `{ [listKey]: [...], next_batch?: token }`. Loop with `?next_batch=` until absent. Guard against repeated tokens.

### 5.4 Rate-limit hardening (learned the hard way)

Symptom: clicking Refresh too aggressively →  
`GET jobs/{id}/work_orders failed HTTP 429: Too many requests`.

Mitigations baked into the handler:

| Mechanism | Behavior |
|---|---|
| Global Bolt queue | All Bolt GETs serialize through one promise chain |
| Request gap | Default **400ms** between Bolt calls (`BOLT_REQUEST_GAP_MS`) |
| 429 / transient backoff | Retry up to 8×; honor `Retry-After` when present; exponential cap |
| Roster cache | Avoid re-walking full jobs feed every Refresh |
| No parallel job scans | Concurrency was a primary 429 cause |

**Porting tip:** If you “optimize” with `Promise.all` across jobs, expect 429s again. Keep serial unless you redesign around a prebuilt offline cache (there is a separate Bolt address-cache ecosystem under `bolt_api_stuff/`, but this site’s Live Board Refresh does **not** depend on it).

### 5.5 Vercel timeout

`vercel.json` sets `api/bolt-inventory.js` → `maxDuration: 60`. A cold roster rebuild + full Mini Homes status walk can be slow. Keep the timeout ≥ 60s or shorten work via cache / fewer jobs.

---

## 6. API contract (what the UI consumes)

### 6.1 Success — HTTP 200

```json
{
  "schema_version": 2,
  "count": 5,
  "inventory_count": 5,
  "allocated_count": 3,
  "counts": {
    "assigned_to_inventory": 5,
    "allocated_to_boss_containers": 3
  },
  "scanned_jobs": 46,
  "matched_jobs": 5,
  "checked_at": "2026-08-02T…Z",
  "office": "Mini Homes",
  "roster_source": "cache",
  "roster_fetched_at": "2026-08-02T…Z"
}
```

Notes:

- `count` / `inventory_count` / `counts.assigned_to_inventory` are the **same inventory number** (compat aliases).
- `allocated_count` / `counts.allocated_to_boss_containers` are the allocation number.
- `roster_source` is `"cache"` or `"full_jobs_feed"`.
- `Cache-Control: no-store` on the response.

### 6.2 Error shapes

| HTTP | `error` | Meaning |
|---|---|---|
| 401 | `unauthorized` | Missing/invalid JWT |
| 403 | `forbidden` | Authenticated but not `admin` |
| 405 | `method_not_allowed` | Non-GET (OPTIONS returns 204) |
| 503 | `bolt_not_configured` | Missing Bolt env |
| 502 | `bolt_scan_failed` | Bolt/network/scan exception; `detail` truncated |

### 6.3 Client parsing (must keep schema-aware)

From `portal/admin.html`:

```js
const inventoryValue = body.counts?.assigned_to_inventory ?? body.inventory_count ?? body.count;
const allocatedValue = body.counts?.allocated_to_boss_containers ?? body.allocated_count;
if (allocatedValue == null) {
  throw new Error('Bolt API server is out of date — restart the local dev server…');
}
```

If an old local Node process is still running schema v1 (no allocation fields), the UI **refuses to show a silent zero** and tells the admin to restart. Preserve that guard on the new site.

---

## 7. UI wiring (map these IDs/keys on the restyle)

You can change CSS completely. Keep the **data contracts** (or update both sides together).

### 7.1 DOM hooks used today

| Element ID | Role |
|---|---|
| `#bolt-refresh` | Button that triggers scan |
| `#bolt-status` | Status line under Live Board subhead |
| `#lv-avail` | Available now |
| `#lv-ready` | Built & ready (same Bolt inventory count) |
| `#lv-alloc` | Allocated (Bolt allocation count when refreshed) |

Demo mode (`?demo`) disables Refresh.

### 7.2 sessionStorage keys (tab-scoped)

| Key | Stores |
|---|---|
| `boss_bolt_ready_count` | Last inventory count |
| `boss_bolt_allocated_count` | Last allocated count |
| `boss_bolt_checked_at` | ISO timestamp of last successful scan |

On page load, read these into `boltReadyCount` / `boltAllocatedCount`. On `render()`, if Bolt values exist, prefer them over Supabase summary; otherwise use DB math.

Closing the tab clears the override (sessionStorage). A brand-new session falls back to Supabase until Refresh again.

### 7.3 URL selection

```js
function boltInventoryUrl() {
  return (window.PORTAL_CONFIG && window.PORTAL_CONFIG.LOCAL_DEV)
    ? 'http://127.0.0.1:8787/api/bolt-inventory'
    : '/api/bolt-inventory';
}
```

`LOCAL_DEV` is set in `portal/config.js` when the host is localhost / 127.0.0.1.

### 7.4 What Refresh does not change

Pipeline board rows stay order-status driven. Do not overwrite Awaiting Agreement / Awaiting Wire from Bolt.

---

## 8. Environment variables

Copy from [`.env.local.example`](.env.local.example). Never commit `.env.local`.

| Variable | Required | Default / notes |
|---|---|---|
| `BOLT_TOKEN` | **Yes** | Bolt Open API token |
| `BOLT_TOKEN_NAME` | **Yes** | Token name (e.g. tenant-issued name) |
| `BOLT_XSRF_TOKEN` | No | Cookie value if tenant requires it; expires |
| `BOLT_BASE_URL` | No | `https://app.bolttech.net/open/v1` |
| `BOLT_OFFICE` | No | `Mini Homes` |
| `BOLT_REQUEST_GAP_MS` | No | `400` |
| `BOLT_ROSTER_TTL_SEC` | No | `21600` (6h); `0` = always rebuild |
| `BOLT_ROSTER_CACHE` | No | Absolute path for roster JSON cache |
| `SUPABASE_URL` | No | JWT verify URL (local API defaults to local Supabase) |
| `SUPABASE_ANON_KEY` | No | Anon key for auth/user + profiles lookup |
| `LOCAL_API_PORT` | No | `8787` |
| `LOCAL_API_CORS` | No | `http://127.0.0.1:8080,http://localhost:8080` |

**Production:** set at least `BOLT_TOKEN` and `BOLT_TOKEN_NAME` on the Vercel project. Same-origin `/api/bolt-inventory` — no CORS needed in prod.

**Secrets hygiene:** Conversation dumps under `bolt_api_stuff/ChatGPT-Bolt*.md` historically contained live tokens and are **gitignored**. Do not paste tokens into markdown, HTML, or client config. Public Supabase anon keys are intentionally public; Bolt tokens are not.

---

## 9. Local development path

Static HTML cannot run Vercel functions. Local Refresh requires the companion API.

### One-command (preferred)

```bash
cp .env.local.example .env.local   # fill BOLT_TOKEN + BOLT_TOKEN_NAME
./scripts/dev.sh                   # Supabase (if needed) + API :8787 + site :8080
# open http://127.0.0.1:8080/portal/login.html
# sign in as admin → Ops Board → Refresh
```

```bash
./scripts/dev.sh stop       # site + API
./scripts/dev.sh stop-all   # also stop Supabase
```

### Manual pieces

```bash
./scripts/supabase-local.sh start
node scripts/local-api-server.js    # :8787
node scripts/local-static-server.js # :8080
```

Local API CORS must allow **both** `http://127.0.0.1:8080` and `http://localhost:8080` (browsers treat them as different origins). That bug already bit once.

Admin page should be served with `Cache-Control: no-store` (see `vercel.json` + local static server) so an old inline script doesn’t survive a soft refresh after you change Refresh logic.

---

## 10. Porting checklist for the next site / restyle agent

Use this when cloning the feature into a new visual design (same or sibling repo).

### Must keep (behavior)

1. **Server-side Bolt token** — never expose in frontend bundles.
2. **Admin JWT gate** before any Bolt call.
3. **Stage 6 + checkbox matching** with quote-stripping canonicalization and type IDs `116259` / `116262`.
4. **Serial Bolt calls** + gap + 429 backoff + roster cache.
5. **Schema v2 JSON** (inventory + allocated) and client guard if `allocated` missing.
6. **Manual Refresh** (no aggressive auto-poll that hammers Bolt).
7. **sessionStorage** (or equivalent) so a tab keeps last Bolt numbers without rescanning on every navigation.
8. **Fallback to DB inventory** when no Bolt refresh has happened yet.
9. **Env-based config** + `.env.local` gitignored; example file with empty placeholders only.

### May change

- CSS, layout, typography, colors, component structure.
- Button placement / copy (“Refresh”, status line wording).
- Element IDs (if you update the JS selectors together).
- sessionStorage key names (if you migrate old keys carefully).
- Hosting (still needs a serverless or Node endpoint equivalent to `api/bolt-inventory.js`).

### Suggested file map to copy / re-implement

| Current path | Purpose |
|---|---|
| `api/bolt-inventory.js` | Core scan + auth + rate limits — **prefer copying this file** |
| `scripts/local-api-server.js` | Local CORS wrapper |
| `.env.local.example` | Env documentation without secrets |
| `vercel.json` (`functions.maxDuration`) | Prod timeout |
| Relevant slice of `portal/admin.html` | `refreshBoltInventory`, `applyBoltCountsToDom`, `render()` override logic |

### Acceptance test (run before calling the port done)

1. Admin signed in → Refresh succeeds → status line shows scanned job count + inventory + allocated.
2. `#lv-avail` and `#lv-ready` show inventory count; `#lv-alloc` shows allocated count.
3. Non-admin JWT → 403; logged-out → 401.
4. Missing Bolt env → 503 `bolt_not_configured`.
5. Reload same tab → sessionStorage values still override DB until tab close.
6. New tab / cleared session → DB fallback until Refresh.
7. Rapid double-click Refresh does not crash the process (may still take time; should not instantly 429 if gap/queue intact).
8. `?refresh_roster=1` forces roster rebuild when cache is stale/wrong office.
9. Confirm matcher still finds jobs when Bolt descriptions include quotes (`Assign to "Inventory"`).

---

## 11. Known pitfalls (read before “improving” the pipeline)

1. **Quotes in status descriptions** → always strip in `canonical()`.
2. **Quoted Authorization header** → do not add extra `"` around token/name.
3. **Parallelizing job scans** → 429 storm.
4. **Skipping roster cache** → multi-minute cold scans + rate limits on every Refresh.
5. **Stale local API process** after schema changes → UI correctly errors; restart `local-api-server` / `dev.sh`.
6. **CORS only allowing one of localhost vs 127.0.0.1** → Refresh fails in the browser with a network error while curl works.
7. **Using ChatGPT dumps or skill docs as secret sources in git** → rotate tokens if leaked; keep dumps gitignored.
8. **Confusing Allocated tile with pipeline Awaiting Wire** — different systems: Bolt checkbox vs Postgres order status.
9. **Assuming counts persist server-side** — they don’t; only sessionStorage + whatever you display. There is no “save Bolt count to Supabase” step today.
10. **XSRF cookie expiry** — if scans start failing after they worked, re-copy a fresh `BOLT_XSRF_TOKEN` from a logged-in Bolt browser session (only if your tenant requires it).

---

## 12. Minimal mental model for the next agent

> One admin-only GET endpoint holds the Bolt token, walks Mini Homes jobs carefully, counts two Stage 6 checkboxes, returns JSON. The admin page’s Refresh button authenticates with Supabase, calls that endpoint, and paints three Live Board numbers (inventory twice + allocated once), remembering them in sessionStorage for the tab.

If the restyle preserves that sentence, the feature is ported correctly.

---

## 13. Reference implementation locations (this repo)

```
api/bolt-inventory.js          # production + local shared handler
scripts/local-api-server.js    # :8787 CORS host for the handler
scripts/dev.sh                 # one-command local stack
.env.local.example             # env template (empty secrets)
vercel.json                    # maxDuration 60 for bolt-inventory
portal/admin.html              # Refresh UI + DOM + sessionStorage
portal/config.js               # LOCAL_DEV flag → :8787 URL
DOCUMENTATION.md               # shorter session changelog
```

Deeper Bolt domain docs (optional reading, not the Live Board contract):

- `bolt_api_stuff/agent_detail_for_minihomes/`
- `bolt_api_stuff/bolt_api_stuff/eci-bolt-openclaw-skill/`

Those packs include playbooks, OpenAPI subsets, and examples. The **Live Board feature only needs the Stage 6 status scan described above**; do not expand scope to writes/schedules/crews unless product asks.

---

*Document generated for handoff / restyle work. Keep secrets out of this file and out of the next repo’s client bundle.*
