# CMAC Sales Portal production setup

The application is production-capable but intentionally reports external services as **not configured** until CMAC supplies credentials. Never place secrets in `.env` files committed to source control.

## Configuration status — August 21, 2026

| Area | Status | Next checkpoint |
| --- | --- | --- |
| Dedicated CRM Supabase | Awaiting approval | Create `cmac_containers_crm` in the only available organization after the $10/month project cost is confirmed. |
| Google service account | Locally validated | JSON and `.env` identity, client ID, and private key match; the key parses successfully. |
| Google employee sign-in | Needs OAuth web client | A service account supports Gmail delegation but does not replace the Google OAuth Web client ID/secret required by Supabase Auth. |
| Bolt-Data aggregate | Validated | The configured project and key return HTTP 200 with the expected aggregate schema. |
| Lead intake secret | Missing | Add a random `LEAD_RATE_LIMIT_SECRET` of at least 32 characters before deploying `submit-lead`. |
| DocuSign | Deferred | The portal presents a Coming Soon state and no envelope action is deployed for this release. |

## 1. CRM Supabase project

1. Create the dedicated `cmac_containers_crm` Supabase project. Do not reuse Bolt-Data. The project is awaiting explicit confirmation of Supabase's $10/month charge.
2. Apply the migrations in `supabase/migrations` with the Supabase CLI.
3. Run database/security advisors and resolve findings before production promotion.
4. Configure the browser values `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in Vercel.
5. Configure `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` as server-only Vercel values.

### First administrator bootstrap

Run this once in the Supabase SQL editor **before enabling the Before User Created hook**, replacing the example identity:

```sql
insert into public.employees (email, first_name, last_name, display_name, role)
values ('first.admin@cmaccontainers.com', 'First', 'Admin', 'First Admin', 'admin');
```

Do not hardcode a real employee in a migration. After the administrator signs in with the same Google email, the `auth.users` trigger links `auth_user_id` automatically.

## 2. Google Workspace sign-in

The checked-in application uses two separate Google integrations:

- The supplied service account is for server-side Gmail delegation. Its local JSON and `.env` values have been validated and the credential files are Git-ignored.
- Employee login requires a Google OAuth **Web application** client ID and client secret configured in Supabase Auth. The service-account client ID cannot be used for interactive employee sign-in.

1. Configure Google OAuth in Supabase Auth using the project callback URL.
2. Request identity only: OpenID, email, and profile.
3. Add the production `/auth/callback` URL to Supabase redirect allowlists.
4. Enable the Before User Created hook at `pg-functions://postgres/private/before_user_created_hook` after the first admin allowlist row exists.
5. Confirm an unlisted CMAC account and every non-CMAC account are rejected.

Live sessions query the active `employees` row. Deactivation therefore removes business-data access on the next check without waiting for OAuth token expiry.

## 3. Bolt-Data aggregate inventory

The configured Bolt-Data URL resolves to the existing `bolt-data` project. A protected read of `public.mini_homes_inventory` returned HTTP 200 and the expected `available_inventory`, `allocated_boss`, and `last_synced_at` fields. No raw Bolt tables were queried.

Set these as server-only Vercel values:

- `BOLT_DATA_SUPABASE_URL`
- `BOLT_DATA_SUPABASE_SERVICE_ROLE_KEY`

The identity must be read-only in practice and `/api/inventory` must query only `public.mini_homes_inventory`. Never add Bolt credentials to a `VITE_` variable. Verify valid count, zero count, stale timestamp, Bolt failure, missing secret, invalid session, and deactivated employee behavior.

## 4. Gmail domain-wide delegation

1. Create a Google Cloud service account and enable the Gmail API.
2. Enable Workspace domain-wide delegation.
3. In the Workspace Admin console, authorize only `https://www.googleapis.com/auth/gmail.send`.
4. Set Supabase Edge Function secrets:
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

Set `LEAD_RATE_LIMIT_SECRET` to a long random value and `ALLOWED_ORIGINS` to the comma-separated production and preview origins. The function hashes network/email rate-limit identifiers, never stores raw IP addresses, suppresses rapid duplicates, preserves active owners, and uses transaction-safe round-robin assignment.

## 7. Vercel deployment

`vercel.json` preserves `/api/*` functions and rewrites all other direct paths to Vite's `index.html`. Before promotion, verify every route by direct URL and browser refresh, then test `/api/inventory` with valid, invalid, and deactivated employee sessions.

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
