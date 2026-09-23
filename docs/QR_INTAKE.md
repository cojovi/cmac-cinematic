# CMAC QR inquiry flow

## Customer and admin experience

- Intended public URL: **https://www.cmaccontainers.com/qr** (also works on the apex domain after release). QR artwork should encode the HTTPS URL exactly; no customer data belongs in the code.
- Public, mobile-first three-step form using the current CMAC dark palette, typography, and existing home photograph. No login required, including for employees visiting the form.
- All six supplied questions, with credit shown/required only for Financing. Required contact fields: full name, email, phone. Cash clears any previously selected credit answer.
- Explicit disclosure that responses are stored and emailed to Charley for follow-up. No credit score, SSN, income, credit documents, credit check, or approval decision is collected/performed.
- Admin navigation: **QR Code**, route `/employee-portal/admin/qr`. Sales reps and inactive admins cannot access its records or metrics. The questionnaire's self-reported credit response is admin-only.
- Reports support 7/30/90 days or all time, 25 inquiries per page, full answers/contact details, notification status, and controlled retry. Click **Refresh** for fresh counts; there is no polling.
- QR inquiries are a dedicated admin inbox, not automatically added to the round-robin lead pipeline. This avoids changing existing customer ownership or distributing financing answers to sales reps. Charley receives every notification independently of lead assignment.

## What the numbers mean

| Metric | Definition |
| --- | --- |
| QR-page visits | A successful server-recorded page open, deduplicated within a 30-minute browser-tab session. Refreshing that session does not add a visit. |
| Saved inquiries | Valid completed submissions committed to the database, including those still waiting on email. Retries using the same request ID do not add another submission. |
| Emails sent | Gmail returned a message ID and the confirmed outcome was recorded. This does not prove inbox delivery or that Charley read the email. |
| Visit conversion | Tracked visits in the period with at least one submitted inquiry / tracked visits in the period. A visit counts once even if it has several inquiries. Untracked submissions are excluded from this ratio. |

Visits are not physical scans or unique people. A direct link also counts; scanners that do not open the website cannot be counted. Blocking, browser storage restrictions, bots, and network failures affect accuracy. Intake still works if visit tracking fails. All date filters use a rolling period; all-time is unbounded. Email totals reflect the current delivery state of inquiries created in the selected period. No historical scans can be reconstructed.

## Email and failure behavior

The single `qr-intake` Edge Function supports public `visit` / `submit` actions and a session-validated **admin-only** `retry` action. It reuses the Workspace service account's `gmail.send` delegation to send **from and to `charleyc@cmaccontainers.com`**, with the prospective customer's address in Reply-To. The browser cannot select or override the sender or recipient. The email includes every answer, name, email, phone, and an inquiry reference.

Save occurs before email. Missing Gmail authorization is recorded as `not_configured`; rejected sends as `failed`. The customer sees an honest saved-but-notification-unconfirmed message. The admin can retry pending, failed, or not-configured notifications after correcting the problem (60-second cooldown, maximum five attempts).

Atomic claims prevent concurrent sends. `sent` is never resent automatically. Timeouts, network disconnections, uncertain server errors, and malformed success responses become `unknown`. A process crash can leave `sending`; do not assume it failed. Both states require checking Charley's Gmail Sent folder for the reference/Message-ID before an operator can safely change the state. There is no automatic queue worker or unsafe timed lease reclamation. If outcome persistence fails after Gmail accepted the message, the public response remains unconfirmed and the record is not automatically resent.

## Security

- RLS + explicit grants: admins read; only the server writes. Anonymous users have no direct QR table/RPC access. Private idempotency keys and rate-limit counters are not exposed.
- Enum and field validation on the server and database; request size cap; honeypot; hashed network/email rate identifiers; atomic hourly limits of 60 new visits / 10 new submissions per network identifier and 3 submissions per email identifier. Network grouping can affect shared-location traffic and should be tuned after observing real use. This is baseline abuse protection, not a guarantee against distributed bots; add a managed challenge/WAF if abuse appears.
- Raw IPs and user agents are not stored. Rate-window counters older than two days are pruned during later rate-limited requests. Inquiry/visit retention requires a CMAC policy; no customer records are automatically deleted by this feature.
- No secrets, full customer responses, financial answers, or provider payloads are logged. Email body is MIME-encoded. Recipient is a server constant. Only Google identity and the live active admin row authorize retry.

## Release status — September 23, 2026

- Owner approved the complete `admintest` release, conditional on passing checks.
- Applied `team_management`, `qr_intake`, and `deduplicate_task_owner_index` to **cmac_crm**. The last migration removes only a duplicate of the existing task-owner/status/due index; no customer data is removed. Bolt-Data was not changed.
- Deployed `admin-manage-employee` version 3 and `qr-intake` version 2. Verified live admin reporting and that anonymous table access and browser email-claim access are denied.
- Initial live testing found missing Supabase email secrets and missing Workspace delegation. After the owner's explicit approval, the existing service-account identity/key were saved as encrypted `cmac_crm` Edge secrets and client `104117358876373263474` was granted **only `gmail.send`** in Workspace. Saved secret fingerprints were verified against the local source. No credentials were committed. Google delegation is domain-wide; the QR implementation fixes sender and recipient to Charley and does not request mailbox-reading scopes.
- **Live Gmail acceptance passed at 20:50 UTC on September 23.** Inquiry `71509816-1639-4f2a-81b5-dbbd394b0721` was saved and Gmail returned a message ID. Repeating the identical public submission returned the same result without another send: the database still shows exactly one attempt. This proves Gmail acceptance, not recipient read/inbox placement.
- The earlier setup-test inquiry `60dd5a49-52f4-45d8-bdb7-7f35d1394ae6` remains honestly marked `not_configured` from before the fix. Both records are clearly labeled release tests; no real prospective-customer data was used and no status was fabricated. The live-email gate for the owner-approved `admintest` → `main` release is satisfied; verify Vercel's exact production commit and routes as the final publication check.
- Latest automated checks: lint, build, both Edge Function type checks, **56 unit/API tests**, **140 pgTAP assertions**, duplicate-request concurrency tests, and **76 browser tests** at 375/768/1024/1440 pixels. Browser authentication and successful Gmail responses use controlled test fixtures, not real employee credentials.
- Post-migration advisors show no new security warnings or remaining duplicate-index warning. Intentional private-table deny-by-default notices and unused-index information remain; the pre-existing [leaked-password protection warning](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) relates to password authentication, not this Google-only sign-in.

## Release checklist

The QR feature is built on `admintest`. A Git branch alone does **not** create an isolated CRM database. Do not print/distribute the production QR code before the public route and end-to-end email delivery pass acceptance.

1. The owner approved releasing the entire tested `admintest` branch to production on September 23, 2026, including earlier admin improvements and this QR feature.
2. The reviewed migrations are `20260917172254_team_management.sql`, `20260923194545_qr_intake.sql`, and `20260923202256_deduplicate_task_owner_index.sql`. They are already installed in **cmac_crm**; do not reapply them there. The QR migration adds QR-specific tables/functions/policies without changing existing CRM roles or policies. Run Supabase security/performance advisors. Keep the matching `admin-manage-employee` deployment's JWT verification enabled.
3. Deploy `qr-intake` with `verify_jwt=false` (public endpoint; admin retry performs its own live authentication). Bundle `_shared/auth.ts`, `http.ts`, `jwt.ts`, `google.ts`, `qr.ts`, and `qr-delivery.ts`. Do not replace the existing marketing function as part of this release.
4. Configure Supabase Edge secrets `GOOGLE_WORKSPACE_SERVICE_ACCOUNT_EMAIL` and `GOOGLE_WORKSPACE_PRIVATE_KEY`. Workspace domain-wide delegation must permit only `https://www.googleapis.com/auth/gmail.send` and be usable for Charley's actual primary Workspace account. Gmail API must be enabled. Built-in CRM Supabase secrets are used; an optional `QR_RATE_LIMIT_SECRET` may replace the server-only service-role fallback. **No new Vercel variables are required** beyond the existing CRM public URL/key. Do not put Gmail secrets in `VITE_*` values or source control.
5. Existing preview OAuth canonical routing redirects toward production. Configure isolated preview authentication/database access before real-admin preview acceptance; fixture browser tests do not validate live OAuth. Never weaken production auth or silently share a live database to work around this.
6. Publish the frontend after release approval. Verify direct navigation/refresh on `/qr` and the admin route. Make one clearly labeled test submission using an authorized test contact, check Charley's mailbox, verify saved=1/sent=1, confirm all six answers and contact details, and verify a public retry doesn't duplicate the email.
7. Test a real Google admin, sales rep denial, admin deactivation, failed Gmail configuration, and controlled retry. Confirm `main` and the production site are intentionally promoted before distributing the QR URL.

## Verification

`npm run lint`, `npm run build`, `npm test`, `npm run db:test` (local-only, rollback SQL + disposable concurrency fixtures), and `npm run test:e2e -- --workers=4`.

Tests cover valid/invalid choices, conditional credit, no provider/configuration false success, hardcoded recipient and MIME, retry identity spoofing, atomic rate limits and claims, idempotency, admin/rep/anonymous/deactivated RLS, accurate counts, failure recovery, responsive layouts, and direct route loads. Playwright and unit email checks mock external services and never email actual people. Local DB verification does not replace production Gmail/Google acceptance.
