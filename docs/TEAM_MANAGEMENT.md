# Team management

## For administrators

Open **Employees** to see the team directory, assigned customers, active leads, open deals, follow-ups, overdue work, and recorded unit sales. Counts are calculated across all matching database records, not the first page of results.

- Select an employee card to inspect their activity and ownership. The selection is kept in the URL, so it survives refresh and can be bookmarked.
- Open a workload link to see that employee's customers, leads, deals, or follow-ups. Lists also have an **Assigned employee** filter, including inactive staff and unassigned customers/leads.
- Use **Manage access** to update the employee's name, phone, or role, deactivate access, or reactivate an account. Google identity/email stays fixed. You cannot demote or deactivate your own admin account.
- To transfer work, open a customer and use **Assign customer**. The transfer moves the contact, active leads, open/on-hold deals, open follow-ups, and draft/sent quotes on those open deals. Closed leads/deals, completed tasks, accepted quotes, contracts, and unit-sale attribution keep their original history.
- Deactivation does not automatically transfer records. Review the inactive person's assigned customers and transfer them deliberately.

**Created by** and **Assigned employee** show names, with links to the employee's management view. Missing/restricted names are not replaced with UUIDs. Dates are formatted for the browser's local time zone.

## Activity and freshness

The activity feed shows recorded business actions, not online presence or a time-tracking system. Notes, lead changes, customer transfers, follow-up lifecycle changes, direct portal deal saves, quote saves, confirmed marketing sends, and recorded sales are included. Website submissions are identified as automated events, including legacy entries that stored the assignee as the actor.

The new task/deal/quote logging applies to future actions. Historical events are displayed as recorded; missing historical actions are not invented or backfilled. Contract signing remains coming soon.

Employee counts and activity load on page entry. **Refresh** requests a new snapshot; there is no background team-activity polling. Activity loads newest first with **Show older activity**. Record lists support **Load more records** and disclose that text/status search applies to the loaded records. Owner filtering occurs server-side before the limit. Inventory keeps its separate existing refresh policy.

## Security and deployment

Migration: `20260917172254_team_management.sql`.

- `admin_team_overview()` checks the live administrator row and runs with invoker rights.
- `portal_dashboard_summary()` checks active employment and relies on table RLS for representative scope.
- Employee mutations and customer transfers go through `admin-manage-employee`, which validates the session and derives the acting employee server-side. Their database contracts can only be executed by the service role.
- Direct browser writes to employee access and customer ownership are revoked. Explicit service grants are migration-managed.
- Access/ownership changes are serialized. Transfers compare the previously viewed owner and are retry-safe. They write timeline/audit records in the same transaction.
- Lead ownership accepts active administrators as well as reps, so promoting a rep does not break their existing work. Automatic round-robin assignment still selects sales representatives only.
- Browser activity inserts must use the real signed-in actor. Follow-ups cannot reference another rep's inaccessible customer, lead, or deal.

Apply the migration, deploy the updated `admin-manage-employee` function with its shared modules, then release the frontend. No new Vercel environment variables, Google scopes, or provider credentials are required. Bolt-Data is untouched.

September 23 release update: the owner approved the full `admintest` release. This migration and `admin-manage-employee` version 3 are now installed in `cmac_crm`. The QR feature's live Gmail acceptance and duplicate-send check passed; see [QR intake release status](QR_INTAKE.md#release-status--september-23-2026). The follow-up `deduplicate_task_owner_index` migration retains the existing equivalent index without changing any task data.

## Verification

- `npm run lint`, `npm run build`, `npm test`.
- `npm run db:test` executes the original CRM suite and the team-management suite. It uses a local-only connection, rolls back fixture data, and fails the process on pgTAP assertion failures as well as SQL errors.
- `npm run test:e2e` verifies the public site, OAuth handoff behavior, portal routes, team selection, owner filters, readable employee names, role controls, recoverable API errors, and admin-route denial at 375/768/1024/1440 pixels.
- Browser tests use non-production fixture credentials and intercepted requests. They never log in as an actual employee, change real permissions, or send customer messages.

Scope note: these checks are not a guarantee about every possible production interaction. Google account consent, external Gmail delivery, and deferred DocuSign workflows are not exercised with real customer data.

The Supabase security advisor's pre-existing leaked-password-protection warning is unrelated to this Google-only login. Revisit [password security](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) before enabling password authentication. Private-schema RLS/no-policy notices are intentional deny-by-default tables, not public access grants.
