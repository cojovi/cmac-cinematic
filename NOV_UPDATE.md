# November 2026 update — CRM workspace rebuild

Everything changed on the `mini_nov_upgrade` branch during the November 15–16, 2026 working session, in one place: what was built, how to use it, what changed underneath, what was verified, and what still has to be deployed.

Companion docs: [CRM workspace guide](docs/CRM_WORKSPACE.md) · [Production setup](docs/PRODUCTION_SETUP.md) · [Development](docs/DEVELOPMENT.md)

---

## 1. Status at a glance

| Item | State |
| :--- | :--- |
| Branch | `mini_nov_upgrade` (not merged to `main`) |
| Commits | `ee27e3b` CRM workspace · `8de0695` preview sign-in + sample-data trim |
| Size vs `main` | 66 files, about 5,700 lines added, 500 removed; 40 new files, 2 deleted |
| Frontend | Built and pushed; Vercel preview deployments build from the branch |
| Database migrations (2) | **Applied** to `cmac_crm` on Nov 16 (`20261116135854 crm_pipeline_workspace`, `20261116161858 crm_record_deletion`). Each live function body matches its repo file byte for byte |
| `manage-lead` Edge Function | **Deployed** Nov 16 (version 5), responding |
| Delete leads / customers | Built after `8de0695`; backend is live. The screens ship with the next push of this branch |
| Supabase redirect allow-list | **Needs one wildcard entry** for preview sign-in (section 7) |
| Production data | Untouched by the release. Row fingerprints of every contact and lead were identical before and after each migration. No demo rows |
| Production site (`main`) | Unchanged |

Nothing in this update writes to, migrates, or reshapes existing records. The new screens read the same tables the old ones did.

---

## 2. Why this was done

The CRM inside the employee portal worked as a record viewer, not as a tool a salesperson could run their day from:

- Leads, customers, deals, quotes, and follow-ups were all the same flat list with one status filter.
- Only an administrator could change a lead after it was created. A representative could add a lead but never record progress on it. In production, **all 15 leads were still at "New"**.
- The only thing that could be logged was a free-text note. No calls, emails, outcomes, or "what happens next".
- Follow-ups could be completed or cancelled, nothing else. No priority, rescheduling, or editing.
- Customers could not be created or edited outside the New Sale wizard.
- Deals and quotes were read-only after creation. A real unit ID could only be confirmed inside the wizard session that created the deal, so a deal could not be marked sold later.
- No pipeline view, no search across records, no exports, no reporting.

---

## 3. What was built, and how to use it

Every screen below is under **Employee portal** after sign-in. The sidebar is now grouped: **Pipeline** (Leads, Customers, Follow-ups), **Sales** (Deals, Quotes, New sale, Contracts, Documents), **Tools** (Inventory, Marketing, Reports), **Admin**.

### 3.1 Overview (dashboard)

*Sidebar → Overview*

- **Four tiles**: open leads (and how many are waiting on a first contact), follow-ups due, open pipeline value with weighted forecast, units sold. The first three are links.
- **Do next**: your own follow-ups that are overdue or due today. Tick the circle to complete, use **Snooze…** to push one out, the pencil to edit.
- **Waiting on first contact**: new leads nobody has contacted yet, oldest first, with one-tap call / text / email. This is the list to clear every morning.
- **Open leads by stage**, **Where leads come from**, **Latest movement**.
- **Workload by person** (administrators): open leads, deals, follow-ups, overdue, units sold, last activity per employee, plus a "Needs an owner" banner for unassigned records.
- Header buttons: **Follow-up**, **Add lead**, **Start new sale**.

### 3.2 Lead pipeline

*Sidebar → Leads*

**Board view** (default)
- Four columns: New → Contacted → Nurturing → Qualified.
- **Drag a card** to another column to change its stage. While dragging, drop zones appear underneath for **Convert to deal**, **Mark lost**, and (administrators) **Archive**.
- Every card also has a **Move…** menu that does the same thing — use it on a phone or with a keyboard.
- Each card shows: name, heat (Hot / Warm / Cool), project and location, timing, source, age, last contact, and the next follow-up. An amber left edge means it needs attention (never contacted, or a follow-up is overdue). "No contact yet" and "No next step" are called out in amber.
- Phone and email icons on the card start a call or email directly.

**Table view** (toggle top right)
- Sort by any column: lead, stage, heat, project, timing, source, owner, created, last contact, next step.
- Stage chips across the top include closed leads (Converted, Lost, Archived) that the board hides.
- Tick rows for the **bulk bar**: move to a stage, transfer owner (administrators), export selected.

**Both views**
- Search, a **Source** filter, and (administrators) an **Assigned employee** filter including "Unassigned".
- Focus chips: **Needs first contact**, **No next step**, **Hot**.
- **Export CSV** exports whatever is currently filtered.

**Heat** is a hint, not a stored score. It is calculated from the buyer's timing, the stage, how fresh the inquiry is, and multi-unit potential. Hover a heat badge to see the reasons.

### 3.3 A lead record

*Click any lead name*

- **Header**: stage and heat badges, email, phone, age; call / text / email / copy buttons.
- **Stage stepper**: click a stage to move the lead there. The last step is **Converted**.
- **Convert to deal**: creates a draft deal for the customer, locks the lead, and opens the deal.
- **Mark lost**: asks for a reason, which is saved on the lead and appears in Reports.
- **Edit lead** (administrators): a side drawer for customer details, project details, owner, and status. Changing the owner moves the customer and the lead's open follow-ups too.
- **Archive / Reopen** (administrators).
- **What just happened?** Pick Note, Call, Email, Text, or Meeting; choose an outcome (Connected, Left voicemail, No answer…); write the details; and use **Next step** to book the follow-up in the same save. This is the single most useful habit the new CRM enables.
- **History**: the full timeline, filterable by Calls & messages, Notes, or Record changes.
- **Follow-ups**: the next steps for this lead. Quick-add at the bottom; **More options** for priority, exact time, and (administrators) who it is assigned to.
- **Project** details and **Linked records** (the customer, and the deal once converted).

### 3.4 Customers

*Sidebar → Customers*

- Sortable table with lifecycle chips (Lead, Prospect, Customer, Inactive), search, owner filter, open-lead and open-deal counts, CSV export.
- **Add customer** creates a contact assigned to you.
- Tick rows for bulk actions: **Export selected** and **Delete selected** for everyone; **Transfer owner** for administrators.

**A customer record** shows everything about one person or company on one page: timeline across all their leads and deals, follow-ups, contact details, every lead, every deal and quote, and marketing emails sent. **Edit details** opens the contact form. **New lead** starts lead intake with their details filled in. Administrators also get **Assign customer** to transfer ownership with all open work.

### 3.5 Follow-up queue

*Sidebar → Follow-ups (the red badge is how many are due)*

- Grouped **Overdue → Today → Tomorrow → Next 7 days → Later**, most urgent first within each group.
- Per item: complete, **Snooze…** (2 hours, tomorrow 9 AM, 3 days, next Monday), edit, cancel. Closed items can be reopened under **Show closed**.
- **New follow-up** creates one that is optionally linked to a customer.
- Filters: search, priority, and (administrators) Me / Everyone / a specific person.

### 3.6 Deals

*Sidebar → Deals*

- **Tiles**: open pipeline, weighted forecast, won value, win rate.
- **Board** by stage (Draft → Quote → Negotiation → Contract → Signed) with the value of each column. Drag or use **Move…**; drop on **Mark lost** to close with a reason.
- **Table** view includes won and lost deals.

Weighted forecast multiplies each open deal by a stage likelihood: Draft 10%, Quote 30%, Negotiation 50%, Contract 75%, Signed 90%.

**A deal record**
- Stage stepper, **Hold / Resume**, **Mark lost**, **Reopen**, **New quote**.
- **Edit deal**: project name and address, base price, delivery, deposit %, delivery estimate, notes.
- **Units**: add and confirm the real unit / job ID here at any time, and remove the planning-only model reference. This used to be possible only inside the New Sale wizard.
- **Quotes** for the deal.
- **Mark deal sold**: enabled once every unit is confirmed and there is a completed contract (or an administrator enters an override reason). It runs the existing audited sale-completion step and is permanent.
- The same activity log, timeline, and follow-ups as a lead.

### 3.7 Quotes

*Sidebar → Quotes, or **New quote** on a deal*

- Line items with quantity and unit price, plus delivery, tax, and notes. Totals update as you type.
- **Save**, then **Mark sent**. Once sent, the lines lock; mark it **Accepted**, **Declined**, or **Expired**, or **Revise as draft** to change it.
- **Print / PDF** prints a clean customer-facing sheet (choose "Save as PDF" in the print dialog).
- "Sent" is a manual status. The portal does not email quotes.

### 3.8 Reports

*Sidebar → Reports*

- Period filter (30 days, 90 days, 12 months, all time).
- New leads, lead conversion, average time to convert, deals won.
- New leads per week (last 12 weeks), funnel, results by lead source, logged activity by type, results by person (administrators), and why leads were lost.
- CSV export on the source and team tables.

### 3.9 Everywhere

- **Search**: press `⌘K` (or `Ctrl+K`), or click Search in the top bar. Type a name, email, phone number, or deal number to jump straight to a customer, lead, or deal. It also runs actions: add a lead, add a customer, schedule a follow-up, start a sale.
- **CSV export** on leads, customers, deals, quotes, and reports.
- **Toasts** confirm every save and show the real error when something is refused.
- **QR inquiries → pipeline**: Admin → QR Code → open an inquiry → **Create lead in pipeline**. Lead intake opens with the answers carried over and the source set to *On-site QR code*.
- Every rebuilt screen works on a phone. Boards scroll sideways; tables scroll inside their own frame.

### 3.10 Deleting leads and customers

Added at the end of the session. Before this, nothing in the portal could be deleted by anyone.

**Where the controls are**

- **Lead record**: the red **Delete** button in the header.
- **Lead board**: the card's **Move…** menu → **Delete lead…**
- **Lead table**: tick rows → **Delete selected** in the bulk bar.
- **Customer record**: the red **Delete** button in the header.
- **Customer table**: tick rows → **Delete selected**.

Every delete asks for confirmation first and says exactly what goes with it.

**What gets removed**

- Deleting a **lead** removes the lead, its follow-ups, and its timeline entries. The customer stays, and their timeline gets a "Lead deleted" entry.
- Deleting a **customer** removes the customer and all of their leads, follow-ups, and timeline entries.

**What is refused, on purpose**

- A lead that **became a deal** cannot be deleted. It is the origin of that deal. The Delete control is not shown for it, and a bulk delete skips it and says so.
- A customer with **deals, quotes, contracts, or sent marketing** cannot be deleted. That history backs sales attribution. The record page explains why and offers **Mark inactive** instead, which drops them from active lists and keeps the history. A bulk delete keeps those customers and lists them by name.

**Who can delete**

Anyone with a login, on the records they can see: representatives on their own leads and customers, administrators on any. A representative cannot delete a customer who has a lead belonging to someone else.

**Recovery**

There is no undo in the portal. Every delete first writes a full copy of the record (lead or customer, plus its follow-ups and timeline) to the private audit log, with who did it and when. An administrator with database access can restore from that copy.

---

## 4. Permissions

Row-level security and the audited server functions decide what is allowed. The interface only decides which buttons to show.

| Action | Sales representative | Administrator |
| :--- | :--- | :--- |
| See records | Only their own | Everything |
| Move a lead between New / Contacted / Nurturing / Qualified | Own leads | Any lead |
| Close a lead as lost (reason required) | Own leads | Any lead |
| Convert a lead to a deal | Own open leads; the deal is theirs | Any lead, to any active employee |
| Archive a lead; reopen a lost or archived lead | No | Yes |
| Edit a lead's details; reassign a lead | No | Yes |
| Transfer a customer and their open work | No | Yes |
| Create and edit customers | Own | Any |
| Log activity, manage follow-ups | Own records | Any record |
| Edit deals, units, quotes | Own | Any |
| Mark a deal sold | Own, with a completed contract | Any; may override with a reason |

| Delete a lead | Own leads that have not become a deal | Any lead that has not become a deal |
| Delete a customer | Own customers with no deals, quotes, contracts, or sent marketing | Any customer with none of those |

**The one policy change:** representatives can now move, lose, and convert their own leads. Before this update those were administrator-only. Editing lead details and reassigning are still administrator-only.

---

## 5. Backend changes

### 5.1 Migration — `supabase/migrations/20261115203000_crm_pipeline_workspace.sql` (applied Nov 16)

Replaces `public.manage_lead` with the same function plus:

- A `set_status` action: the lead's owner or an administrator moves it between working stages or closes it as lost with a reason. Archiving, and reopening a closed lead, require an administrator. Repeating the same move is reported as unchanged and adds no second timeline entry.
- Owner conversion: a representative can convert their own open lead. The deal always stays with them, even if the request names someone else.
- An ownership check on every non-create action for representatives.
- `qr_code` as an accepted lead source.
- Every stage change writes a timeline entry and an audit-log row.

It was generated from the team-management version of the function so the existing branches stay identical: exactly five existing lines change; the rest is additions. **No tables, columns, grants, or policies change.** The function stays executable only by the service role.

One error message was reworded ("edit or convert leads" → "edit or reassign leads") and the two existing database tests that expected it were updated.

### 5.2 Edge Function — `supabase/functions/manage-lead/index.ts` (deployed Nov 16, version 5)

Accepts `set_status`, lets owners reach `convert`, keeps `update` administrator-only, and returns 403 instead of 400 for permission refusals. The acting employee is still derived from the session, never from the request body.

### 5.3 What needed no backend change

- **Calls, emails, texts, meetings** are stored as ordinary `note_added` timeline entries with `metadata.kind` and `metadata.outcome`. That fits the existing constraint and insert policy.
- Customers, follow-ups, deals, units, and quotes use table permissions that already existed.
- "Last contact", "needs first contact", heat, the funnel, and all report figures are calculated in the browser from the records RLS returns.

### 5.4 Resilience added along the way

- If an ownership transfer leaves a deal or lead pointing at a customer the employee can no longer access, a timeline entry or follow-up is saved against the record they do own instead of failing.
- A malformed list response no longer crashes the portal, and an error boundary keeps a fault on one screen from blanking the whole workspace.
- CSV export neutralises spreadsheet formulas in customer-entered text.

---

## 6. Sample data and local preview

- `npm run dev:crm` (new script) starts the portal at `http://127.0.0.1:5173/employee-portal` in local preview with the Supabase settings blanked, so it cannot reach production.
- Preview is now interactive: moves, notes, follow-ups, deals, and quotes update an in-memory copy and reset on refresh.
- **Sample-data rule:** preview data is limited to the signed-in preview account ("Local Preview"), **one** sample sales representative (Demo Sales Rep), and **one** sample customer (Taylor Morgan, with an open lead, a converted lead, a deal, a quote, and two follow-ups). It lives only in `src/lib/portal-fixtures.ts`. No demo data is written to any database.
- Plain `npm run dev` uses the real `.env` and signs in against the live CRM.

---

## 7. Preview deployments can now sign in (commit `8de0695`)

**Problem found during testing:** opening the branch's Vercel preview and signing in with Google landed on `cmaccontainers.com`, which runs `main`, so the new CRM was not visible. The sign-in code deliberately sent every preview deployment to production to authenticate.

**Change:** generated Vercel branch and preview deployments (`cmac-cinematic-…-cojovis-projects.vercel.app`) now complete sign-in on their own URL. Production aliases (www, apex, `cmac-cinematic.vercel.app`) are unchanged.

**One-time setting still required** — Supabase → `cmac_crm` → Auth → URL Configuration → Redirect URLs, add:

```
https://cmac-cinematic-*-cojovis-projects.vercel.app/**
```

Until it is added, Supabase falls back to the Site URL and preview sign-in ends on production as before.

**A preview is not a sandbox.** It runs the branch's frontend against the production database and Edge Functions. Edits made there are real.

---

## 8. Where the data lives

| What | Supabase project | Ref |
| :--- | :--- | :--- |
| CRM (leads, customers, deals, quotes, follow-ups, employees, QR inquiries) | `cmac_crm`, organization **CMAC Roofing** | `gxiluyvhrrctslnhjkmc` |
| Live "available mini homes" count (read-only) | `bolt-data`, same organization | `jlqvanrtzdhnjgrmmumc` |

---

### 5.5 Migration — `supabase/migrations/20261116054500_crm_record_deletion.sql` (applied Nov 16)

Adds one function, `public.delete_crm_record(actor, kind, record_id)`, executable only by the service role, and the grants it needs: `delete` on `leads` and `contacts`, and `select` on `contracts`, `marketing_sends`, and `activities`, all **to the service role only**. Browser roles still have no delete privilege on either table; the only way to delete is through the function.

The function checks the actor is an active employee, applies the owner-or-administrator rule, refuses the cases in section 3.10, writes the snapshot to `private.audit_log` (`lead_deleted` / `contact_deleted`), then deletes. It takes the same advisory lock as ownership changes so a delete cannot race a transfer.

The `manage-lead` Edge Function gains two actions, `delete_lead` and `delete_contact`, which call it. The actor is derived from the session, as with every other action.

## 9. Files

**New screens** (`src/pages/portal/`): `LeadsPage`, `LeadDetailPage`, `CustomersPage`, `CustomerDetailPage`, `TasksPage`, `DealsPage`, `DealDetailPage`, `QuotesPage`, `QuoteDetailPage`, `ReportsPage`.

**New shared pieces** (`src/components/crm/`): `Kanban`, `Timeline`, `ActivityComposer`, `FollowUps`, `ContactForm`, `CommandPalette`, `Dialog`, `ToastProvider`, `ErrorBoundary`, `SortHeader`, `primitives`.

**New logic** (`src/lib/crm/`): `pipeline.ts` (stages, permissions shown in the UI, heat, follow-up buckets, signals, report math, formatting), `activity.ts` (touch types and timeline classification), `api.ts` (every CRM write, with a preview branch), `csv.ts`, `bus.ts` (refresh after a write), `links.ts`, `qr-handoff.ts`.

**New hooks** (`src/hooks/`): `useCrmRows` (keeps data on screen while refreshing), `useCrm`, `useLeadMover`, `useSort`, `useToast`.

**New styles**: `src/crm.css` — all classes prefixed `crm-`, so the public site and untouched portal screens keep their styles.

**Rewritten**: `EmployeePortalLayout` (grouped navigation, badges, search), `DashboardPage`, `LeadCreatePage`, `LeadManagementPanel`, `ContactAssignmentPanel`, `portal-fixtures`.

**Edited**: `App.tsx` (routes), `QrAdminPage` (create-lead button), `lead-management.ts` and `lead-api.ts` (new source and action), `auth-flow.ts` (preview sign-in), `main.tsx`, `package.json` (`dev:crm`).

**Deleted**: `ResourceDetailPage.tsx` and `RecordFields.tsx`, replaced by the new record pages. `ResourceListPage` remains for Contracts only.

**Backend**: the two migrations and the `manage-lead` function above.

**Deletion**: `20261116054500_crm_record_deletion.sql`, `supabase/tests/crm_record_deletion.test.sql`, and edits to `manage-lead/index.ts`, `lead-api.ts`, `crm/api.ts`, `crm/pipeline.ts`, `useLeadMover.tsx`, `LeadsPage`, `LeadDetailPage`, `CustomersPage`, `CustomerDetailPage`, `crm.test.ts`, `crm.spec.ts`, `scripts/test-db.mjs`.

**Tests**: `src/lib/crm/crm.test.ts`, `tests/e2e/crm.spec.ts`, `supabase/tests/crm_pipeline_workspace.test.sql`; updates to `portal.spec.ts`, `team.spec.ts`, `team-management.test.ts`, `production.test.ts`, `production_crm.test.sql`, `team_management.test.sql`, and `scripts/test-db.mjs`.

**Docs**: `docs/CRM_WORKSPACE.md` (new), `docs/DEVELOPMENT.md`, `docs/PRODUCTION_SETUP.md`, `README.md`, and this file.

Not touched: the public site, the QR customer form, inventory, the marketing sender, DocuSign, and the New Sale wizard.

---

## 10. Verification

What was run, in a Linux sandbox copy of the repo:

| Check | Result |
| :--- | :--- |
| ESLint | Clean |
| TypeScript build | Clean |
| Production build (`vite build`) | Passes |
| Unit / API tests | 79 pass (20 new) |
| Browser tests at 375, 768, 1024, 1440 px | 117 pass, 3 skipped |
| Database assertions | 218 pass (70 new) |

Read these with their limits:

- **Checked on the live database after release:** both function bodies match the repo files (md5), both are executable only by the service role, browser roles hold no delete privilege on leads or contacts, and a rollback-only smoke test created a lead, deleted it, then deleted its customer, with both audit copies written, and left nothing behind. A real lead was also created through the new function by the team the same morning.
- **The full database suites ran on a stand-in, not real Supabase.** All migrations and all five SQL test files were run against an in-process Postgres (PGlite) with minimal Supabase scaffolding and a small pgTAP shim. `npm run db:test` with Docker remains the authoritative full run.
- **Browser tests use sample data and intercepted requests.** They cover the board, table, bulk actions, activity logging, follow-up queue, customer create/edit, search, deal → quote, sale completion, deleting leads and customers (including the refused cases), and the exact requests a representative's stage move and deletes send in production. They do not sign in to Google or touch the real database.
- The three skipped browser tests are the drag-and-drop case at the three narrower widths, where the board scrolls sideways; the Move menu is the tested path there.
- Running the existing QR browser tests in the sandbox needed their hard-coded macOS screenshot path redirected. That file is unchanged in the repo.
- **Not exercised with live services:** Google sign-in, the preview sign-in change end to end, Gmail delivery, DocuSign.
- The README's verification paragraph still cites the November 14 record (59 tests). It was left alone because it documents a specific earlier revision.

---

## 11. Release checklist

1. ~~Apply `20261115203000_crm_pipeline_workspace.sql`, then `20261116054500_crm_record_deletion.sql`, to `cmac_crm`.~~ Done Nov 16.
2. ~~Deploy the `manage-lead` Edge Function with its `_shared` modules.~~ Done Nov 16.
3. Push `mini_nov_upgrade` so the preview deployment picks up the delete screens.
4. Add the preview wildcard to the Supabase redirect allow-list (section 7) if branch previews should sign in.
5. Merge `mini_nov_upgrade` to `main` to release the frontend. No new environment variables.

The live site on `main` keeps working against the new backend: it sends only the create, update, and convert actions, which are unchanged.

Supabase records migrations under the time they were applied, so the versions in the project (`20261116135854`, `20261116161858`) differ from the repo file names, as they do for the earlier migrations.

Rollback: redeploy the previous `manage-lead` function and re-run the `manage_lead` definition from `20260917172254_team_management.sql`. To remove deletion, drop `public.delete_crm_record` and revoke the service-role grants it added. No data migration is involved either way.

---

## 12. Known limits

- The Data API returns at most 1,000 rows per request. Lists and reports work from the newest 1,000 records of each kind and say so on screen when the limit is reached. At today's volume nothing is truncated. Server-side aggregation is the next step when a table approaches it.
- Lost and archived leads count only toward the first funnel stage, because the stage they were lost from is not recorded.
- Quotes are not emailed from the portal; "Sent" is a manual status.
- Contract signing is still deferred, so marking a deal sold needs an administrator override reason.
- Lead heat is a heuristic and is not stored or reportable.
- Deleted records can only be restored by hand from the audit log; there is no trash or undo screen.
- A bulk customer delete runs one customer at a time, so a failure partway leaves the earlier ones deleted. The result message says how many went and which were kept.

---

## 13. Session log

1. Audited the portal code, all migrations, Edge Functions, and tests; checked production data shape read-only.
2. Built the CRM core: pipeline logic, write layer, refresh bus, shared components, styles.
3. Rebuilt leads (board, table, record), then customers, follow-ups, deals, quotes, dashboard, reports, navigation, and search.
4. Wrote the migration and Edge Function change for representative pipeline control; validated on a local Postgres stand-in.
5. Rewrote and extended the tests; fixed what they caught (a hidden-label overflow on mobile, a crash on malformed list responses, form-label accessibility).
6. Capped list sizes to the real 1,000-row API limit and added the insert fallback for transferred records.
7. Added `npm run dev:crm`.
8. Trimmed sample data to one demo representative and one demo customer at Cody's direction; confirmed production holds no demo rows.
9. Changed preview deployments to sign in on their own URL after branch testing redirected to production.
10. Wrote this file.
11. Added lead and customer deletion for every signed-in user, with the audit-log copy and the sales-history guard.
12. Applied both migrations and deployed `manage-lead` to production at Cody's direction; verified the live functions against the repo and confirmed existing rows were unchanged.
