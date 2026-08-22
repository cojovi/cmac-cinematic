# CMAC Sales Portal production setup

The application is production-capable but intentionally reports external services as **not configured** until CMAC supplies credentials. Never place secrets in `.env` files committed to source control.

## Configuration status — August 22, 2026

| Area | Status | Next checkpoint |
| --- | --- | --- |
| Dedicated CRM Supabase | Deployed | `cmac_crm` (`gxiluyvhrrctslnhjkmc`) has the CRM schema, RLS, private Storage buckets, legacy-contact archive, and database hardening migrations. |
| Google service account | Locally validated | JSON and `.env` identity, client ID, and private key match; the key parses successfully. |
| Google employee sign-in | Provider and domain gate active | New verified Container-domain users are provisioned as sales representatives. Cody Viveiros is the sole bootstrapped administrator, with his Roofing-domain Google primary email mapped privately to his Container business identity. |
| Bolt-Data aggregate | Validated | The configured project and key return HTTP 200 with the expected aggregate schema. |
| Lead intake hashing | Active | Uses the built-in server-only service-role secret as its HMAC salt; an optional dedicated `LEAD_RATE_LIMIT_SECRET` can be supplied for independent rotation. |
| CRM Edge Functions | Partially deployed | `submit-lead`, `admin-manage-employee`, `complete-unit-sale`, and `send-marketing-email` are active. Provider-dependent calls report not configured until their secrets are supplied. |
| Vercel | Public production alias active | Vercel Authentication was removed from the project so the public site and CMAC auth boundary are reachable at `https://cmac-cinematic.vercel.app`. |
| DocuSign | Deferred | The portal presents a Coming Soon state and no envelope action is deployed for this release. |

## 1. CRM Supabase project

1. Use the dedicated `cmac_crm` project. Do not reuse Bolt-Data.
2. The migration set in `supabase/migrations` is applied. The incompatible legacy `public.contacts` table was preserved as `private.legacy_contacts_20260822`; valid-email rows were copied into the production CRM table and rows without email remain archived for manual reconciliation.
3. Database/security advisors were run after deployment. Private tables have RLS enabled and foreign-key ownership paths are indexed. The remaining leaked-password advisory is not exercised by this Google-only UI; enable it as defense in depth when finalizing Auth settings and keep password login out of the application.
4. Configure the browser values `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in Vercel.
5. Configure `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` as server-only Vercel values.

### First administrator bootstrap

The first administrator was bootstrapped manually as Cody Viveiros (`codyv@cmaccontainers.com`). For a new environment, run this once before enabling signups, replacing the example identity:

```sql
insert into public.employees (email, first_name, last_name, display_name, role)
values ('first.admin@cmaccontainers.com', 'First', 'Admin', 'First Admin', 'admin');
```

Do not hardcode a real employee in a schema migration. If the administrator's Google primary address differs from the CRM business address, add one private mapping after the employee row exists:

```sql
insert into private.employee_google_identities (employee_id, google_email)
select id, 'codyv@cmacroofing.com'
from public.employees
where email = 'codyv@cmaccontainers.com'
on conflict (employee_id) do update
set google_email = excluded.google_email;
```

After the administrator signs in with Google, the Auth identity trigger links `auth_user_id` through this mapping while preserving the Container business email, administrator role, and active status. The mapping table is private and unavailable through the browser Data API. An old email-only Auth record is not enough to grant portal access; the link occurs only after Supabase receives an actual Google identity.

## 2. Google Workspace sign-in

The checked-in application uses two separate Google integrations:

- The supplied service account is for server-side Gmail delegation. Its local JSON and `.env` values have been validated and the credential files are Git-ignored.
- Employee login requires a Google OAuth **Web application** client ID and client secret configured in Supabase Auth. The service-account client ID cannot be used for interactive employee sign-in.

1. In Google Cloud, create an OAuth 2.0 Client ID with application type **Web application**. The installed-app credential and Gmail service account are not valid substitutes.
2. Add these **Authorized JavaScript origins** in Google Cloud:

   - `https://cmac-cinematic.vercel.app`
   - `http://localhost:5173`

3. Add this **Authorized redirect URI** in Google Cloud:

   `https://gxiluyvhrrctslnhjkmc.supabase.co/auth/v1/callback`

4. Configure the resulting Web client ID and client secret under Supabase Auth → Providers → Google, then enable Google.
5. Set the Supabase Site URL to `https://cmac-cinematic.vercel.app` and allow these redirects:

   - `https://cmac-cinematic.vercel.app/auth/callback`
   - `http://localhost:5173/auth/callback`

6. Bootstrap the first administrator row before opening domain signup.
7. The Before User Created hook is configured at `pg-functions://postgres/private/before_user_created_hook`. It admits Google identities in the exact `cmaccontainers.com` domain plus server-managed exceptional mappings in `private.employee_google_identities`. A first-time Container-domain user is automatically created as an active `sales_rep`; Google profile metadata cannot set roles or active status. An exceptional identity only links its preselected employee and cannot create a role. Existing rows preserve their administrator-managed role and status, and an explicitly deactivated employee remains blocked.
8. Request identity only: OpenID, email, and profile.
9. Confirm a new Container-domain account is provisioned as `sales_rep`, Cody's mapped `codyv@cmacroofing.com` identity links only to his administrator record, another Roofing-domain account is rejected, a deactivated employee is rejected, and every non-Google account is rejected.

Sales representatives must use actual Google Workspace accounts whose primary address ends in `@cmaccontainers.com`; a Gmail alias does not authenticate as a separate Google identity. Live sessions query the active `employees` row, so deactivation removes business-data access on the next check without waiting for OAuth token expiry. New users cannot promote themselves; only an authenticated administrator can intentionally manage employee roles through server-controlled workflows.

## 3. Bolt-Data aggregate inventory

The configured Bolt-Data URL resolves to the existing `bolt-data` project. A protected read of `public.mini_homes_inventory` returned HTTP 200 and the expected `available_inventory`, `allocated_boss`, and `last_synced_at` fields. No raw Bolt tables were queried.

Set these as server-only Vercel values:

- `BOLT_DATA_SUPABASE_URL`
- `BOLT_DATA_SUPABASE_SERVICE_ROLE_KEY`

The identity must be read-only in practice and `/api/inventory` must query only `public.mini_homes_inventory`. Never add Bolt credentials to a `VITE_` variable. Verify valid count, zero count, stale timestamp, Bolt failure, missing secret, invalid session, and deactivated employee behavior.

## 4. Gmail domain-wide delegation

1. The Google Cloud service account exists; confirm the Gmail API remains enabled.
2. Enable Workspace domain-wide delegation.
3. In the Workspace Admin console, authorize only `https://www.googleapis.com/auth/gmail.send`.
4. Set these as **Supabase Edge Function secrets** (local `.env` values do not configure the hosted functions):
   - `GOOGLE_WORKSPACE_SERVICE_ACCOUNT_EMAIL`
   - `GOOGLE_WORKSPACE_PRIVATE_KEY`
5. Verify the service account can impersonate each active employee sender.

The function creates MIME messages, enforces an 18 MB pre-encoding attachment ceiling, and records activity only after Gmail returns a message ID. Ambiguous transport outcomes are recorded as `unknown` and require checking Sent mail before retrying.

## 5. DocuSign — deferred

DocuSign is intentionally out of scope for the current release. The portal displays a Coming Soon banner and does not invoke envelope creation. Keep all DocuSign variables empty until this section is resumed.

### Later iteration

Use the central CMAC integration user and reusable approved templates. Set:

- `DOCUSIGN_INTEGRATION_KEY`
- `DOCUSIGN_USER_ID`
- `DOCUSIGN_ACCOUNT_ID`
- `DOCUSIGN_PRIVATE_KEY`
- `DOCUSIGN_BASE_URL`
- `DOCUSIGN_OAUTH_BASE_URL`
- `DOCUSIGN_WEBHOOK_HMAC_SECRET`
- Optional `DOCUSIGN_SIGNER_ROLE_NAME` (defaults to `Customer`)

Configure the Connect webhook at `/functions/v1/docusign-webhook` with HMAC enabled. Map approved `document_templates.provider_template_id` values only after legal review. Test invalid HMAC, duplicate events, unknown envelopes, decline/void, completion, PDF retrieval, certificate retrieval, and private Storage access.

## 6. Public lead intake

The function hashes network/email rate-limit identifiers with a server-only HMAC salt, never stores raw IP addresses, suppresses rapid duplicates, preserves active owners, and uses transaction-safe round-robin assignment. By default it uses Supabase's built-in `SUPABASE_SERVICE_ROLE_KEY` as that salt; set an optional cryptographically random `LEAD_RATE_LIMIT_SECRET` of at least 32 characters if independent salt rotation is preferred. Set `ALLOWED_ORIGINS` to the comma-separated production and approved preview origins.

## 7. Vercel deployment

`vercel.json` preserves `/api/*` functions and rewrites all other direct paths to Vite's `index.html`. Vercel Authentication must remain off for this public site; employee access is enforced by Supabase Auth, the exact Workspace domain gate, active employee status, and RLS. Before promotion, verify every route by direct URL and browser refresh, then test `/api/inventory` with valid, invalid, and deactivated employee sessions.

## 8. Local verification

Because this repository path contains spaces and current Supabase CLI releases have local secret-mount regressions under Colima, the included database script starts only the Postgres service needed by the migration and pgTAP checks:

```bash
npm run db:start
npm run db:test
npm run test
npm run lint
npm run build
```

Set `VITE_ENABLE_LOCAL_PORTAL_PREVIEW=true` only in an uncommitted local environment for visual review. The flag is gated by `import.meta.env.DEV`, is read-only, and cannot enable a production authentication bypass.
