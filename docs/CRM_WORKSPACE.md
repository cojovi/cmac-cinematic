# CRM workspace

The employee portal's lead, customer, follow-up, deal, and quote screens were rebuilt in November 2026 into a working CRM. This guide covers what each screen does, the one permission change behind it, and how to release it.

## What changed for the team

| Area | Before | Now |
| :--- | :--- | :--- |
| Leads | A flat list. Only an administrator could change a lead after intake. | A drag-and-drop pipeline board plus a sortable table. The owner moves their own leads, closes them as lost with a reason, and converts them to deals. |
| Activity | Free-text notes only. | Log a call, email, text, meeting, or note with an outcome — and book the next follow-up in the same save. |
| Follow-ups | Complete or cancel. | Grouped by Overdue / Today / Tomorrow / Next 7 days / Later; snooze, edit, reprioritise, reassign (admin), reopen, and create without leaving the queue. |
| Customers | Read-only record. | Create and edit customers; one page shows every lead, deal, quote, follow-up, marketing email, and timeline entry for that person. |
| Deals | A list and a read-only record. | A stage board with pipeline value and weighted forecast; edit price and terms, hold/resume, close as lost, confirm real unit IDs, start quotes, and mark sold from the record. |
| Quotes | A list of totals. | A line-item editor with tax, delivery, and notes; status flow (draft → sent → accepted / declined / expired); a clean print / save-as-PDF layout. |
| Dashboard | Four counts. | What to do next: today's follow-ups, new leads still waiting on a first contact, pipeline by stage, lead sources, and (admin) workload by person. |
| Reports | — | Weekly intake, funnel, conversion by source, logged activity, results by person (admin), and lost reasons. Period filter and CSV export. |
| Everywhere | — | `⌘K` / `Ctrl+K` search across customers, leads, and deals; CSV export on every list; bulk stage moves and (admin) bulk ownership transfer; one-tap call / text / email. |
| QR inquiries | Reported separately from the pipeline. | **Create lead in pipeline** on any inquiry opens lead intake with the answers carried over, under the new *On-site QR code* source. |

## Permissions

Row-level security and the audited server functions remain the source of truth; the interface only decides which controls to show.

| Action | Sales representative | Administrator |
| :--- | :--- | :--- |
| Move a lead between New / Contacted / Nurturing / Qualified | Own leads | Any lead |
| Close a lead as lost (reason required) | Own leads | Any lead |
| Convert a lead to a deal | Own open leads — the deal is always theirs | Any lead, to any active employee |
| Archive a lead; reopen a lost or archived lead | No | Yes |
| Edit a lead's customer/project details; reassign a lead | No | Yes |
| Transfer a customer and their open work | No | Yes |
| Log activity, manage follow-ups, edit deals and quotes | Own records | Any record |
| Delete a lead (not one that became a deal) | Own leads | Any lead |
| Delete a customer (none with deals, quotes, contracts, or sent marketing) | Own customers | Any customer |

**This is the one deliberate policy change in the release.** Before it, a representative could create a lead but never record progress on it, so every lead stayed at *New* until an administrator edited it. Ownership and detail edits are still administrator-only. To keep the old behaviour, release the frontend without the migration and function below: representatives will then see a clear "administrator access is required" message when they try to move a lead, and everything else still works.

## Deleting records

Delete is on the lead record, the board card's **Move…** menu, the customer record, and the bulk bar of both tables. Every delete confirms first.

- A lead takes its follow-ups and timeline entries with it; the customer stays and gets a "Lead deleted" entry.
- A customer takes their leads, follow-ups, and timeline entries.
- A lead that became a deal, and a customer with deals, quotes, contracts, or sent marketing, cannot be deleted. The customer record offers **Mark inactive** instead.
- Before deleting, the server writes a full copy to `private.audit_log` (`lead_deleted` / `contact_deleted`). There is no undo in the portal; an administrator restores from that copy.

Browser roles still hold no delete privilege on `leads` or `contacts`. Deletion goes through `manage-lead` → `public.delete_crm_record`, which is executable only by the service role.

## How activity is stored

Calls, emails, texts, and meetings are saved as ordinary `note_added` activities with `metadata.kind` and `metadata.outcome`. That keeps them inside the existing activity-type constraint and insert policy — no schema change — while the timeline and reports can still tell them apart. Notes written before this release display as notes.

"Last contact" and "Needs first contact" count real touches only: intake, ownership changes, and follow-up bookkeeping are excluded. Lead *heat* (Hot / Warm / Cool) is a display hint calculated from timing, stage, recency, and multi-unit potential. It is never stored; hover the badge to see why.

Reports and list signals are calculated in the browser from the records RLS returns. The Data API returns at most 1,000 rows per request, so lists and reports work from the newest 1,000 records of each kind and say so on screen when that limit is reached. At the current data volume nothing is truncated; server-side aggregation is the next step when a table approaches it.

## Release

Backend steps 1–3 were applied to `cmac_crm` on November 16, 2026. The order matters if they are ever replayed on another project.

1. **Migration** `supabase/migrations/20261115203000_crm_pipeline_workspace.sql` — replaces `public.manage_lead` with the same function plus a `set_status` action, owner conversion, and the `qr_code` source. No tables, grants, or policies change; the function remains executable only by the service role.
2. **Migration** `supabase/migrations/20261116054500_crm_record_deletion.sql` — adds `public.delete_crm_record` and the service-role grants it needs (`delete` on leads and contacts; `select` on contracts, marketing sends, activities).
3. **Edge Function** `manage-lead` (with `_shared`) — accepts `set_status`, `delete_lead`, and `delete_contact`, and lets owners reach `convert`; `update` stays administrator-only. The actor is still derived from the session, never from the request body.
4. **Frontend** — no new environment variables.

Rolling back is the reverse: redeploy the previous function and re-run the `manage_lead` definition from `20260917172254_team_management.sql`. No data migration is involved either way.

## Local preview

With `VITE_ENABLE_LOCAL_PORTAL_PREVIEW=true` the portal now behaves like the real thing: moves, notes, follow-ups, deals, and quotes update an in-memory copy of the sample data, so a whole workflow can be rehearsed or demonstrated. Nothing is sent to Supabase and a refresh resets it. The preview employee is an administrator.

The sample data is deliberately tiny — the preview account, **one** sample sales representative (Demo Sales Rep), and **one** sample customer (Taylor Morgan) with an open lead, a converted lead, a deal, a quote, and two follow-ups. It lives only in `src/lib/portal-fixtures.ts` and is never written to any database; the production CRM shows real records only. `npm run dev:crm` starts this preview with the Supabase settings blanked so it cannot reach production.

## Verification

- `npm run lint`, `npm test`, `npm run build`.
- `npm run test:e2e` — `tests/e2e/crm.spec.ts` drives the board, table, bulk actions, activity logging, follow-up queue, customer create/edit, command palette, deal → quote, sale completion, and lead/customer deletion at 375 / 768 / 1024 / 1440 px, and asserts the production requests a representative's stage move and deletes send.
- `npm run db:test` — `supabase/tests/crm_pipeline_workspace.test.sql` covers the new server rules (ownership boundary, lost reason, archive/reopen, owner conversion, idempotent repeats, audit entries) and `supabase/tests/crm_record_deletion.test.sql` covers deletion (ownership, the sales-history guard, cascades, audit snapshots), alongside the existing suites.

Not exercised with live services: real Google sign-in, Gmail delivery, and the deferred DocuSign flow.
