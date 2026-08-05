# Session documentation — Boss Container Homes

## 2026-08-04 — Bolt pipeline handoff doc

Full agent handoff for rewiring / restyling the live Bolt inventory feature:
[`Eci_Bolt_Site_Data.md`](Eci_Bolt_Site_Data.md). Covers auth, Stage 6 matching
(quote stripping), schema v2 response, rate-limit hardening, local `:8787` API,
sessionStorage UI wiring, env vars, and a porting checklist. Prefer that file over
this short changelog when building the next site iteration.

## 2026-08-01 — Bolt Live Board Refresh

### Goal
Manual **Refresh** on the Ops Board Live Board pulls a count from ECI Bolt (Mini Homes office) and writes it into **Available Now** and **Built & Ready** (same number for both). **In Production** is deferred.

### Matching rule
Count distinct Mini Homes jobs where a Stage 6 - Final work order has:
1. **Inventory (Available Now / Built & Ready):** `Assign to "Inventory"` (`work_order_status_type_id = 116259`) checked
2. **Allocated tile:** `Allocated to Boss Containers` (`work_order_status_type_id = 116262`) checked

Both counts are collected in the **same** Stage 6 statuses pass (no extra Bolt round-trips).

### What was added
- [`api/bolt-inventory.js`](api/bolt-inventory.js) — Vercel serverless GET; verifies Supabase admin JWT; scans Bolt server-side
- [`scripts/local-api-server.js`](scripts/local-api-server.js) — local `:8787` proxy of the same handler (static site on `:8080` cannot run Vercel functions)
- [`.env.local.example`](.env.local.example) — `BOLT_TOKEN` / `BOLT_TOKEN_NAME` (copy to `.env.local`, never commit)
- Ops Board UI: Refresh control in [`portal/admin.html`](portal/admin.html) tab bar; sessionStorage keeps the last Bolt count for the browser tab

### Env vars
| Var | Where | Notes |
|---|---|---|
| `BOLT_TOKEN` | Vercel env or `.env.local` | Required |
| `BOLT_TOKEN_NAME` | same | Required |
| `BOLT_BASE_URL` | optional | Default `https://app.bolttech.net/open/v1` |
| `BOLT_OFFICE` | optional | Default `Mini Homes` |
| `BOLT_XSRF_TOKEN` | optional | Cookie some tenants need (can expire) |
| `BOLT_REQUEST_GAP_MS` | optional | Pause between Bolt GETs (default `400`) |
| `BOLT_ROSTER_TTL_SEC` | optional | Cache Mini Homes job list (default `21600` = 6h) |

Refresh is rate-limit aware: Bolt calls run **serially** with spacing + 429 backoff, and the Mini Homes job roster is **cached** so each Refresh does not re-walk the full ~44k job feed. Force a roster rebuild with `GET /api/bolt-inventory?refresh_roster=1` (or delete the cache file under the OS temp dir).

The allocation result is returned through API schema version 2. The dashboard
refuses to display a silent zero when an old API process is still running and
instead instructs the administrator to restart the dev server. After a
successful Refresh, the top Allocated tile is rerendered immediately. The
pipeline rows are deliberately independent: **Awaiting Agreement** and
**Awaiting Wire** are sums of real order quantities in those database states.

The local static server and deployed admin page both use `Cache-Control:
no-store`, preventing an older inline dashboard script from surviving a normal
page refresh.

### 2026-08-02 verification

A complete authenticated refresh scanned 46 Mini Homes jobs and returned:

- 5 with `Assign to "Inventory"` checked.
- 3 with `Allocated to Boss Containers` checked.

The verified allocation set includes FW86 / WO 27747537, FW11 / WO 26057098,
and FW88 / WO 27869848. Rendered desktop and mobile checks confirmed the value
`3` appears in the Allocated tile after Refresh. The local seed creates one
three-unit allocation order in Awaiting Agreement; signing its purchase
agreement moves the complete quantity to Awaiting Wire.

Do **not** paste tokens from `bolt_api_stuff/ChatGPT-*.md` into the repo.

### Local run (one command)
```bash
# First time only: copy Bolt secrets
cp .env.local.example .env.local   # fill BOLT_TOKEN + BOLT_TOKEN_NAME (+ optional BOLT_XSRF_TOKEN)

# Starts Colima/Supabase (if needed) + Bolt API :8787 + static site :8080
./scripts/dev.sh

# Later
./scripts/dev.sh stop       # site + API only
./scripts/dev.sh stop-all   # also stop local Supabase
```

Sign in as admin → Ops Board → **Refresh**. Expect a scan status under the Live Board subhead; Available Now and Built & Ready update to the inventory count, while Allocated updates to the Bolt allocation count. Awaiting Agreement and Awaiting Wire remain database-backed lifecycle counts. A full new browser session falls back to Supabase inventory math until Refresh is clicked again.

---

## 2026-08-02 — Multi-unit electronic agreement execution

### Local scenario

`scripts/seed-local-admin.sh` creates one local-only order:

- Reference: `BOSS-LOCAL-3UNIT`
- Quantity: 3
- Agreement plan: `purchase_only`
- Initial status: `awaiting_agreement`

One purchase agreement covers all three units. It states the exact order
reference and `Quantity covered: 3`. When executed, all three units move in one
database transaction from Awaiting Agreement to Awaiting Wire.

### Signing controls

Migration 015 (`sql/015_electronic_agreement_execution.sql`) adds:

- A server-side `sign_order_agreement()` RPC that locks the order and performs
  signature insertion plus the status transition atomically.
- Server recomputation of the SHA-256 document fingerprint.
- Authenticated signer identity/email, server timestamp, typed-name method,
  exact consent disclosure, IP/device metadata, document version and byte size.
- One executed document per order/kind and an append-only
  `agreement_events` audit record.
- No direct authenticated insert/update/delete permission on `agreements`.
- Server-enforced document order and waiver rules for the existing full
  three-document workflow.

The investor modal includes electronic-record consent, access/retention
disclosure, a pre-sign Print/Save action, typed full legal name, and permanent
post-sign PDF/print access. The Ops Awaiting Agreement chip is clickable when
the count is positive and opens the pending agreement.

### Important legal boundary

The purchase and rental documents remain clearly marked **DRAFT TEMPLATE — for
review by legal counsel before first live use**. Electronic execution mechanics
do not make unreviewed contract language legally sufficient. Have Texas counsel
approve the exact agreement text, counterparty names, notice procedure,
retention policy, and production deployment before using it with customers.

### Verification

At 2026-08-02 11:24 PM CDT, an authenticated local execution test confirmed:

- The RPC moved a two-unit test fixture to Awaiting Wire atomically.
- The stored SHA-256 matched a fresh database-side digest.
- Exactly one append-only execution event was created.
- Direct browser-table insertion was rejected with HTTP 403.
- The fixture was removed and `BOSS-LOCAL-3UNIT` was restored unsigned at
  `awaiting_agreement` with zero agreement/event rows.

The in-app browser could not access localhost because its administrative
security policy was unavailable, so visual automation was not used. Inline
JavaScript syntax, authenticated REST/RPC behavior, RLS denial, database state,
and static server delivery were tested directly.

Manual pieces (if you prefer not to use `dev.sh`): `./scripts/supabase-local.sh start`, `node scripts/local-api-server.js`, `node scripts/local-static-server.js`.

### Deploy
Set `BOLT_TOKEN` and `BOLT_TOKEN_NAME` on the Vercel project. Production Refresh hits `/api/bolt-inventory` on the same origin.

---

## 2026-07-31 — Local Supabase stack

### Goal
Run a full local Supabase database for the static portal so login/roles/RLS can be exercised without the remote project. Seed an administrator account.

### What was added
- `supabase/` — CLI project (`config.toml`, migrations copied from `sql/schema.sql` + `sql/002`–`015`, empty `seed.sql`)
- `scripts/supabase-local.sh` — start/stop/reset/status wrapper
- `scripts/seed-local-admin.sh` — creates `admin@localhost.com` with password `12345678`, grants the local admin role, and safely seeds the unsigned three-unit mock allocation
- `portal/config.js` — when hostname is `localhost` / `127.0.0.1`, points at `http://127.0.0.1:54321` with the standard CLI demo anon JWT; production keys unchanged for deployed hosts
- `portal/login.html` — on local, bare usernames (no `@`) resolve to `user@localhost`

### Local auth credentials
| Field | Value |
|---|---|
| Login | `admin@localhost.com` |
| Password | `12345678` |
| Role | `admin` (SQL-granted; never set from the client) |

> Note: the login form enforces `minlength="8"` on the password field, so shorter passwords are blocked in the browser before Auth runs.

### How to run
```bash
# Docker via Colima must be up
colima start   # if needed

# Start local Supabase + seed admin (from the FastSSD repo)
./scripts/supabase-local.sh start

# Serve the static site
python3 -m http.server 8080

# Portal
open http://127.0.0.1:8080/portal/login.html
```

`./scripts/supabase-local.sh start` now starts the complete stack: Supabase,
the Bolt companion API on `8787`, and the website on `8080`. Its `stop` command
stops the complete stack. Other database-oriented commands are
`./scripts/supabase-local.sh status|reset`.

Studio: http://127.0.0.1:54323 · Mailpit: http://127.0.0.1:54324

### Colima / FastSSD caveat (important)
`supabase start` bind-mounts a single-file secret (`pgsodium_root.key`) from `supabase/.temp/…`. On this machine Colima uses **virtiofs**, and file bind-mounts from `/Volumes/FastSSD` arrive inside the container as **directories**, so Postgres dies with `pgsodium_root.key: Is a directory`.

**Workaround baked into `scripts/supabase-local.sh`:** rsync `supabase/` to `~/dev/cmac-containers-site-local/` (internal APFS) and run the CLI from there. Container/project id stays `cmac-containers-site` via `config.toml`, so the API remains on `127.0.0.1:54321` for the FastSSD-hosted site.

Do **not** run `supabase start` directly from the FastSSD path on this Mac/Colima setup unless mount type changes.

### CLI note
Homebrew’s `supabase` formula (npm wrapper) failed with `No matching … binary … darwin-arm64`. Working binary installed at `~/.local/bin/supabase` (v2.111.0). Scripts prepend that path.

### Schema source of truth
Numbered files under `sql/` remain the human-readable history. `supabase/migrations/` is the same SQL with timestamps for the local CLI. When adding a new `sql/0xx_*.sql`, also copy it into `supabase/migrations/` with the next timestamp and re-run `./scripts/supabase-local.sh reset`.
