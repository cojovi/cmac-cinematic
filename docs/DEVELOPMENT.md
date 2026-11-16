# Development and operations

Technical setup and behavior reference for CMAC Cinematic. For the product walkthrough, see the [project README](../README.md).

<a name="quickstart"></a>
## Bring up the frontend

**Prerequisites:** Git, npm, and a Node.js release compatible with the locked tools. Node **22.13+ within the 22.x line** satisfies the Vite, ESLint, and Vitest engine declarations inspected here; that is not a claim of an executed compatibility test.

### 1. Install the application

```bash
git clone https://github.com/cojovi/cmac-cinematic.git
cd cmac-cinematic
npm ci
cp .env.example .env.local
```

### 2. Choose the environment before starting

For a disconnected public-site review, leave the Supabase URL/key blank. Sign-in and submissions will need configuration; this is not a complete local backend.

For CRM development, use an **isolated development project** and set the browser URL and publishable key in `.env.local`. Review the [configuration boundary](#configuration) before adding provider credentials.

```bash
npm run dev -- --host 127.0.0.1
```

Open the local URL printed by Vite, normally **http://127.0.0.1:5173**. Allow-list the exact origin and `/auth/callback` you actually use when configuring development OAuth.

### 3. Optional portal layout preview

Set `VITE_ENABLE_LOCAL_PORTAL_PREVIEW=true` in the uncommitted local file, restart Vite, and visit `/employee-portal`. The flag requires Vite development mode and supplies a preview employee. CRM actions in preview edit an in-memory copy of the sample data so workflows can be rehearsed; nothing is saved to a database and a refresh resets it.

**Preview is not a network sandbox.** Keep real service credentials out of visual-review environments. Public intake and configured integrations have their own code paths; do not submit forms against production merely to inspect the interface.

> [!NOTE]
> `npm run dev` serves the frontend, not the Vercel `/api/inventory` function or Supabase Edge Functions. Missing backend services are expected to show unavailable/configuration states. A complete integration environment needs those services separately.

<a name="configuration"></a>
## Separate public from private

Use [`.env.example`](../.env.example) as a variable inventory, not a production-ready configuration. Local environment files do not configure hosted Supabase Edge secrets or Vercel automatically.

| Location | Variables / setup | Boundary |
| :--- | :--- | :--- |
| Browser build | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | CRM public endpoint/key only; access still depends on Auth and RLS. |
| Browser auth routing | `VITE_CANONICAL_SITE_URL` | Stable origin used to begin production OAuth. |
| Local visual review | `VITE_ENABLE_LOCAL_PORTAL_PREVIEW` | Development-only flag; keep false for deployment. |
| Vercel inventory function | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Server-side CRM session/employee validation. |
| Vercel inventory function | `BOLT_DATA_SUPABASE_URL`, `BOLT_DATA_SUPABASE_SERVICE_ROLE_KEY` | Separate Bolt-Data credentials; never use a `VITE_` prefix. |
| Supabase Edge secrets | `GOOGLE_WORKSPACE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_WORKSPACE_PRIVATE_KEY` | Gmail delegation; authorize only the required `gmail.send` scope. |
| Supabase Edge secrets | `ALLOWED_ORIGINS` | Approved browser origins for CORS; not authentication. |
| Supabase Edge secrets | `LEAD_RATE_LIMIT_SECRET`, `QR_RATE_LIMIT_SECRET` | Optional dedicated HMAC salts; server service-role fallback exists. |
| Supabase Auth dashboard | Google OAuth Web client, redirects, signup hook | Exact Workspace domain gate and active employee mapping. |

The example also lists `SUPABASE_PUBLISHABLE_KEY` and `GOOGLE_WORKSPACE_CLIENT_ID` as setup values. They are not read by the inventory handler or a replacement for interactive OAuth configuration. Supabase supplies built-in server values such as `SUPABASE_ANON_KEY` to its hosted functions.

> [!WARNING]
> **The checked-in example still sets `VITE_CANONICAL_SITE_URL=https://cmac-cinematic.vercel.app`.** The auth code defaults to `https://www.cmaccontainers.com`, and the production setup guide explicitly supersedes the old Vercel origin. Review and set the intended canonical origin; do not copy that example value blindly into production.

Generated CMAC Vercel previews can redirect sign-in toward the canonical production origin. Isolate preview Auth and databases deliberately; a branch does not create a separate CRM. Do not move an in-progress PKCE callback between origins.

For a new backend, follow [production setup](../docs/PRODUCTION_SETUP.md): review migrations, bootstrap an administrator, configure Google Auth and its exact-domain hook, deploy the required functions, and provision private Storage and provider secrets. Keep DocuSign variables empty while signing is deferred.

<a name="usage"></a>
## Work the pipeline

| Route / workflow | Expected behavior |
| :--- | :--- |
| `/` | Public showcase and lead inquiry; authenticated employees may be redirected to their workspace. |
| `/qr` | Public three-step questionnaire; required contact fields and financing-dependent credit answer. |
| `/login` → `/auth/callback` | Google PKCE sign-in and active-employee lookup. |
| `/employee-portal` | Dashboard and navigation for leads, customers, tasks, inventory, marketing, deals, quotes, and documents. |
| `/employee-portal/leads` · `/customers` · `/tasks` · `/deals` · `/quotes` · `/reports` | The CRM workspace: pipeline board, customer records, follow-up queue, deal board, quote editor, and reports. See the [CRM workspace guide](CRM_WORKSPACE.md). |
| `/employee-portal/sales/new` | Select a model reference, record customer/site details, save a draft, and create quote records. |
| `/employee-portal/admin/employees` | Administrator team overview, access controls, and deliberate ownership management. |
| `/employee-portal/admin/qr` | Administrator inquiry reporting, notification status, and controlled retries. |
| `/client-portal` | Coming Soon—not an implemented customer workspace. |

### Failure states are part of the workflow

- **Inventory:** missing configuration, invalid sessions, inactive employees, and upstream failures are distinct responses. The UI flags aggregate timestamps older than one hour; failed reads do not become invented availability.
- **QR notifications:** saved inquiry does not mean delivered email. `sent` means Gmail accepted the message and its result was recorded—not that it reached the inbox or was read.
- **Uncertain sends:** `unknown` or stranded `sending` states require mailbox verification before intervention. There is no automatic queue worker or blind resend loop.
- **Ownership:** deactivating an employee does not transfer their work. Administrators transfer it explicitly; historical closed records retain their attribution.

For detailed limits, reporting definitions, and retry rules, use the [QR guide](../docs/QR_INTAKE.md) and [team-management guide](../docs/TEAM_MANAGEMENT.md).

<a name="validation"></a>
## Check before you ship

The repository provides these commands. Unit/API tests and the production build passed on November 14, 2026. See [the verification record](SHOWCASE_VERIFICATION.md) for the tested revision and scope; browser and database suites were not run during the showcase refresh.

```bash
npm run lint
npm test
npm run build
npm run test:e2e
```

Vitest covers `src` and `tests/api`; Playwright runs browser scenarios at 375, 768, 1024, and 1440 pixels. Its configuration starts development and production-preview servers with fixture Supabase values. Browser fixtures do not certify real OAuth, database policy deployment, or Gmail delivery.

For database checks, install a supported Docker environment and `psql`, then use a **disposable local database**:

```bash
npm run db:start
npm run db:reset
npm run db:test
```

`db:start` intentionally starts a reduced Postgres-focused Supabase stack, not a complete local portal backend. `db:reset` resets local data. The test script rejects non-loopback `DATABASE_TEST_URL` hosts, checks pgTAP assertion results, and runs QR concurrency fixtures.

### Deployment checklist

- [ ] Browser configuration contains no service-role, Gmail, or DocuSign secrets.
- [ ] CRM migrations, Auth hooks, RLS, Storage, and required Edge Functions match the frontend.
- [ ] Google origins, redirect allow-list, and canonical site URL agree.
- [ ] Bolt credentials remain server-only; mock model cards are not presented as verified units.
- [ ] Direct navigation and refresh work on public, callback, employee, and admin routes.
- [ ] Public intake and authorized email acceptance are tested only with approved test contacts.
- [ ] Inactive employee, representative/admin boundary, stale inventory, and failure paths are checked.

[`vercel.json`](../vercel.json) rewrites non-API paths to `/index.html` while preserving `/api/*`. A static frontend build alone does not deploy the inventory function or Supabase services.

<a name="security"></a>
## Draw the boundary

**Route guards improve navigation; server authentication, live employee checks, and database policies enforce data access.** Public `submit-lead` and `qr-intake` endpoints intentionally allow unauthenticated intake. QR retry separately validates an active administrator.

Keep `.env.local`, service-account material, private keys, customer records, and provider responses out of commits and public issues. The repository ignores `.env*` except `.env.example`; ignore rules do not remove secrets already tracked elsewhere.

QR answers include self-reported financing information and are restricted to administrators. The questionnaire does not perform a credit check or collect SSNs or credit documents. Decide customer-data retention explicitly; the feature does not automatically delete inquiry records.

Public intake includes validation, honeypots, and hashed rate-limit identifiers. These are baseline abuse controls, not a guarantee against distributed bots. Review HTTPS, origin configuration, provider permissions, and retention before exposure.

<a name="documentation"></a>
## Keep the context

| Reference | Read it for |
| :--- | :--- |
| [Production setup](../docs/PRODUCTION_SETUP.md) | Auth, environment boundaries, migrations, deployment, and historical release notes. |
| [QR intake](../docs/QR_INTAKE.md) | Reporting semantics, email failure handling, privacy, and acceptance checklist. |
| [Team management](../docs/TEAM_MANAGEMENT.md) | Roles, ownership transfers, activity scope, and rollout order. |
| [Bolt unit-feed proposal](../docs/BOLT_INVENTORY_UNIT_FEED.md) | Deferred per-unit contract—not an implemented live feed. |
| [Design specification](../DESIGN_SPEC.md) | Visual reference for the cinematic public experience. |

Historical deployment and test results in these guides are project records, not fresh verification of the current checkout. No repository license file was found at the audited revision; do not assume an MIT or other open-source license.

