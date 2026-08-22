# CMAC Containers Sales Portal
## Production Implementation Specification for Codex

> **Primary repository:** `cojovi/cmac-cinematic`  
> **Base branch:** `minihomes`  
> **Current preview:** `https://cmac-cinematic.vercel.app/`
>
> This specification describes the production conversion of the existing CMAC Containers employee sales-portal prototype into a real authenticated, Supabase-backed sales system.
>
> **Read this entire specification before modifying code.**
>
> The current website design is approved and must be preserved. This is primarily a backend, routing, authentication, CRM, email, document, and workflow implementation project — **not a redesign project**.

---

# 1. High-Level Objective

The existing CMAC Containers website currently contains:

- A public CMAC Container Homes marketing site.
- A public consultation form.
- A `/login` page.
- An `/employee-portal` prototype.
- A `/client-portal` future placeholder.
- A four-step "Prepare a Sale" workflow.
- Demo inventory.
- Demo customer data collection.
- Demo document-package selection.
- Demo pricing/deposit controls.
- Demo preview/send behavior.

The objective is to preserve those designs while replacing the prototype/fake behavior with a real production architecture using:

- React
- TypeScript
- Vite
- React Router
- Supabase Auth
- Supabase Postgres
- Supabase Storage
- Supabase Edge Functions
- Google Workspace authentication
- Gmail API for salesman-originated sales emails
- DocuSign eSignature API for legal agreements
- DocuSign Connect webhooks for contract status
- Vercel hosting

The resulting application should function as a lightweight purpose-built CMAC sales CRM.

---

# 2. Non-Negotiable Business Decisions

These decisions are final unless explicitly changed later.

## 2.1 Employee authentication

Employees must **NOT** have separate CMAC portal passwords.

Remove the existing email/password prototype login.

Employees must authenticate using:

> **Continue with Google**

Only authorized CMAC Google Workspace users may enter the employee portal.

Authentication and authorization are different:

- Google proves who the employee is.
- Supabase determines whether that Google account is allowed to use the CMAC portal.

An employee must satisfy ALL of the following:

1. Authenticated successfully through Google.
2. Email belongs to the CMAC Workspace domain.
3. Employee email exists in the CMAC `employees` allowlist.
4. Employee record is active.
5. Employee has a recognized portal role.

Do not rely solely on checking the email domain.

Having a CMAC email address does **not** automatically grant portal access.

---

## 2.2 Employee identity

The current prototype hardcodes:

- Jordan Davis
- JD
- Sales representative

Replace all hardcoded employee identity with authenticated employee data.

Example:

```text
Google account:
john.doe@cmaccontainers.com

↓

Supabase employee:
John Doe
Sales Representative
Rep Code: CMAC-0007

↓

Portal:
JD
John Doe
Sales Representative
```

The same employee portal must dynamically contextualize itself for each authenticated employee.

Do not create separate frontend pages per employee.

---

## 2.3 Public consultation form

The existing public consultation form currently opens a `mailto:` message.

That behavior must be replaced.

New flow:

```text
Website Visitor
      ↓
Public Consultation Form
      ↓
Supabase Edge Function
      ↓
Contact Created/Updated
      ↓
Lead Created
      ↓
Lead Assigned
      ↓
Employee Portal
```

The visitor should submit the form without needing an email client.

Successful submission should show an on-page confirmation.

Do not expose unrestricted anonymous database inserts from the browser.

Use a server-side Edge Function.

---

## 2.4 Inventory

**DO NOT build a production inventory database at this time.**

CMAC is separately building an API layer from its existing project-management system.

That system will eventually be the authoritative inventory source.

The future inventory feed will contain information such as:

- Unit identifier
- Product/model type
- Availability
- Status
- Possibly other operational metadata

Do not duplicate this operational data in Supabase.

For now:

- Preserve existing demo inventory for UI development.
- Encapsulate demo inventory behind an inventory service/provider abstraction.
- Do not build inventory administration.
- Do not build stock calculations.
- Do not pretend demo inventory is real.
- Make replacing the mock provider with an external API easy later.

Create something conceptually similar to:

```ts
export interface InventoryUnit {
  externalId: string
  model: string
  status: string
  available: boolean
  price?: number
  image?: string
}

export interface InventoryProvider {
  listAvailableUnits(): Promise<InventoryUnit[]>
  getUnit(externalId: string): Promise<InventoryUnit | null>
}
```

Current implementation:

```text
MockInventoryProvider
```

Future implementation:

```text
CMACProjectManagementInventoryProvider
```

Do not attempt to implement the future provider yet.

---

# 3. Sales Attribution Requirement

CMAC does **NOT** currently need:

- Commission calculations
- Margin calculations
- Profit calculations
- Originator percentages
- Closer percentages
- Compensation calculations

Do not create that complexity.

The business requirement is simply:

> **Who sold which individual unit?**

Example:

```text
John Doe sold unit FW105.
```

Another deal could contain multiple units:

```text
John Doe sold:
FW105
FW106
FW110
```

Each individual unit must be attributable to the employee who sold it.

Create a dedicated `unit_sales` record for this purpose.

Example conceptual data:

```text
unit_sales

id
deal_id
employee_id
external_unit_id
external_product_type
sold_at
created_at
```

Example:

```text
employee:
John Doe

external_unit_id:
FW105

external_product_type:
40ft Container Home

sold_at:
2026-08-20
```

One deal containing three units should create three `unit_sales` rows.

Do not calculate monetary compensation from these records.

---

# 4. Marketing Correspondence Strategy

The salesman should nurture the lead before sending a contract.

The employee portal needs a centralized library of approved CMAC marketing collateral.

Examples:

```text
CMAC General Brochure
40ft Container Home Flyer
40ft Specifications
Floor Plan
Finish Options
Financing Information
Workforce Housing Overview
Commercial Housing Flyer
Data Center Housing Flyer
Warranty Overview
Delivery Information
Site Preparation Guide
```

Employees should be able to send these directly from:

- A lead
- A contact/customer
- The Marketing Library

The email must originate from the logged-in employee's actual Google Workspace mailbox.

Example:

```text
From:
John Doe <john.doe@cmaccontainers.com>

To:
customer@example.com
```

Replies should naturally return to John Doe.

---

# 5. Gmail / Google Workspace Architecture

Do **NOT** request Gmail permissions from every salesman during Google login.

Do **NOT** store each salesman's Google OAuth refresh token.

Do **NOT** expose Gmail credentials to the frontend.

Instead use:

## Google Workspace Domain-Wide Delegation

Create a dedicated Google Cloud service account with domain-wide delegation.

Authorize only the minimum Gmail scope required:

```text
https://www.googleapis.com/auth/gmail.send
```

The Edge Function will impersonate the authenticated employee's Workspace email address and call Gmail API:

```text
users.messages.send
```

Architecture:

```text
John logs into CMAC using Google
        ↓
Supabase verifies John
        ↓
John opens lead
        ↓
John selects marketing PDFs
        ↓
John clicks Send
        ↓
Supabase Edge Function
        ↓
Verify John owns/accesses lead
        ↓
Look up John's employee record SERVER-SIDE
        ↓
Google Workspace service account
        ↓
Impersonate john.doe@cmaccontainers.com
        ↓
Gmail API
        ↓
Email sent FROM John Doe
```

### Critical security requirement

The frontend must NEVER be allowed to submit:

```text
fromEmail = "john@cmaccontainers.com"
```

and have the server blindly trust that value.

The Edge Function must derive the sender from:

```text
Supabase authenticated user
        ↓
employees.auth_user_id
        ↓
employees.email
```

The authenticated employee determines the Gmail impersonation identity.

---

# 6. Gmail Message Requirements

Marketing emails should support:

- Customer name
- Customer email
- Editable subject
- Editable message
- One or multiple approved attachments
- Standard CMAC salesman footer
- Logged-in employee identity

Example generated footer:

```text
John Doe
Sales Representative
CMAC Containers
john.doe@cmaccontainers.com
cmaccontainers.com
```

If employee phone numbers are added to employee profiles, include phone as well.

Record successful sends.

At minimum retain:

```text
employee_id
contact_id
lead_id
subject
body
gmail_message_id
gmail_thread_id
sent_at
status
```

Also retain which marketing materials were sent.

Do not attempt to synchronize the employee's entire Gmail mailbox in V1.

Do not read private mailbox contents.

This integration is outbound sales correspondence only.

---

# 7. Marketing Library

Create a production Marketing Library.

## Marketing material fields

Create a `marketing_materials` table containing approximately:

```text
id
title
slug
description
category
storage_path
file_name
mime_type
file_size
default_subject
default_body
is_active
display_order
created_by
created_at
updated_at
```

Recommended categories:

```text
general
residential
workforce
commercial
financing
technical
delivery
warranty
other
```

Use Supabase Storage.

Create a private bucket such as:

```text
marketing-materials
```

Approved authenticated employees can read active materials.

Admins can:

- Upload material
- Replace material
- Edit metadata
- Activate/deactivate material
- Change category
- Change default subject/body
- Reorder materials

Sales representatives should not be able to alter approved marketing documents.

---

# 8. Marketing Send Records

Create:

```text
marketing_sends
```

Suggested fields:

```text
id
employee_id
contact_id
lead_id
subject
body
recipient_email
gmail_message_id
gmail_thread_id
status
error_message
sent_at
created_at
```

Create a join table:

```text
marketing_send_items
```

Fields:

```text
id
marketing_send_id
marketing_material_id
```

When Gmail succeeds:

1. Create/update the successful send record.
2. Create send-item records.
3. Add customer timeline activity.
4. Return success to frontend.

Timeline example:

```text
August 20, 2026

John Doe sent:
• CMAC Overview
• 40ft Specifications
```

If Gmail fails:

- Do not falsely mark the material as sent.
- Store failure state/error.
- Display a useful UI message.
- Allow retry.

---

# 9. Canonical Customer / Contact Model

Avoid duplicating the same person's identity across separate `leads` and `customers` tables.

Use a canonical:

```text
contacts
```

table for the person/company.

A lead represents a sales opportunity/inquiry related to a contact.

This allows the same contact to have multiple projects later.

## `contacts`

Recommended fields:

```text
id UUID PK

first_name
last_name
display_name
email
phone
company

project_address
billing_address

city
state
postal_code

lifecycle_stage
assigned_employee_id

created_by
created_at
updated_at
```

Suggested lifecycle values:

```text
lead
prospect
customer
inactive
```

---

# 10. Leads

Create:

```text
leads
```

Recommended fields:

```text
id
contact_id
assigned_employee_id

source
status

project_type
project_location
desired_timing

summary
lost_reason

created_at
updated_at
converted_at
```

Suggested statuses:

```text
new
contacted
nurturing
qualified
converted
lost
archived
```

Public consultation form submissions should create:

1. Contact
2. Lead

Do not automatically create a contract or deal from every web form.

---

# 11. Lead Assignment

Implement lead assignment as an isolated service, not scattered logic.

For V1 use round-robin assignment among:

```text
employees.role = sales_rep
employees.active = true
```

Store assignment on the lead.

Admin must be able to manually reassign a lead later.

The round-robin implementation must be transaction-safe enough that two simultaneous leads do not consistently go to the same salesman.

Keep assignment logic modular so another strategy can replace it later.

---

# 12. Lead Timeline / Activity System

Create one general-purpose activity table.

Example:

```text
activities
```

Fields:

```text
id
contact_id
lead_id
deal_id
employee_id

activity_type
title
description
metadata JSONB

created_at
```

Activity types may include:

```text
lead_created
lead_assigned
status_changed
note_added
marketing_sent
follow_up_created
quote_created
quote_sent
deal_created
contract_created
contract_sent
contract_viewed
contract_signed
contract_declined
unit_sold
```

The timeline displayed on a lead/contact page should be chronological and human-readable.

---

# 13. Follow-Up Tasks

Create:

```text
tasks
```

Suggested fields:

```text
id
employee_id
contact_id
lead_id
deal_id

title
description

due_at
completed_at

status
priority

created_at
updated_at
```

Statuses:

```text
open
completed
cancelled
```

Portal Overview should show:

```text
Follow-ups due today
Overdue follow-ups
Upcoming follow-ups
```

---

# 14. Employee Table

Create:

```text
employees
```

Recommended schema:

```text
id UUID PK

auth_user_id UUID UNIQUE NULLABLE
email CITEXT UNIQUE NOT NULL

first_name
last_name
display_name

role
rep_code

phone

active BOOLEAN DEFAULT TRUE

created_at
updated_at
```

Roles for V1:

```text
admin
sales_rep
```

Do not create manager/commission hierarchies unless needed later.

---

# 15. Sales Rep Code

Every employee should have a stable internal representative code.

Example:

```text
CMAC-0001
CMAC-0002
CMAC-0003
```

This is NOT a commission calculation mechanism.

It is an internal correlation/reference identifier.

Use it in:

- Deals
- DocuSign metadata
- Contract templates if helpful
- Audit records
- Reporting

The UUID employee ID remains the database identity.

---

# 16. Employee Administration

Admin users need an Employee Management interface.

Admin should be able to:

- Add employee
- Edit employee
- Activate/deactivate employee
- Set employee role
- Set display name
- Set phone
- Assign/change rep code

Creating an employee does not need to create a Google account.

The Google Workspace account already exists separately.

Workflow:

```text
Admin adds:
john.doe@cmaccontainers.com

↓

employees row exists
auth_user_id = null

↓

John logs in with Google for first time

↓

Auth user created

↓

Employee row linked to auth user
```

If there is no active matching employee allowlist record:

```text
ACCESS DENIED
```

---

# 17. Supabase Google Authentication

Use Supabase Google OAuth.

Login page:

```text
Employee Login

[ Continue with Google ]

CMAC Workspace account required
```

Remove:

- Password field
- Show password button
- Fake credentials
- Demo credential text

Google login should request only identity scopes necessary for authentication:

```text
openid
email
profile
```

Do not mix Gmail-send authorization into the login flow.

Optionally pass Google's hosted-domain hint for UX, but do not treat that hint as authorization.

Authorization must be enforced server/database-side.

---

# 18. Employee Allowlist Enforcement

Use a Supabase Auth Before User Created hook or equivalent secure mechanism.

A new Supabase user should only be accepted if:

```text
email domain == CMAC domain
AND
employees.email matches
AND
employees.active == true
```

Case normalize email addresses.

Do not trust frontend checks.

When the auth user is created, link:

```text
employees.auth_user_id
```

to:

```text
auth.users.id
```

Use a safe database trigger/function if needed.

Any `SECURITY DEFINER` database function must:

- Live outside the exposed `public` schema where possible.
- Have a fixed search path.
- Validate `auth.uid()` where applicable.
- Have EXECUTE revoked from PUBLIC.
- Receive only the minimum required grants.

---

# 19. Supabase Security Architecture

Every user-data table in an exposed schema must have RLS enabled.

Never rely on:

```text
TO authenticated
```

alone.

Authenticated does not mean authorized.

Create ownership/admin policies.

Conceptually:

```text
Sales Rep
    ↓
Own leads
Own contacts
Own tasks
Own deals
Own quotes
Own contracts
Own marketing send history
Own unit sales

Admin
    ↓
Everything
```

All authenticated employees may read active approved marketing materials.

---

# 20. RLS Helper Functions

Avoid fragile recursive RLS.

A clean pattern is to create private helper functions:

```text
private.current_employee_id()
private.current_employee_is_admin()
```

`current_employee_id()` should determine the employee from:

```text
auth.uid()
```

and require:

```text
employees.active = true
```

This provides an important benefit:

If an employee is deactivated, their existing Supabase token cannot continue reading business data merely because stale role claims remain in the token.

Example policy concept:

```sql
assigned_employee_id = private.current_employee_id()
OR
private.current_employee_is_admin()
```

Implement securely and verify against current Supabase RLS recommendations.

---

# 21. Public Lead Submission Security

Do not allow:

```text
anon → INSERT directly into contacts
anon → INSERT directly into leads
```

Instead create a public Edge Function:

```text
submit-lead
```

Function responsibilities:

1. Validate payload.
2. Normalize email and phone.
3. Validate required fields.
4. Reject obvious bot/honeypot submissions.
5. Apply reasonable duplicate/rate protection.
6. Find existing contact when appropriate.
7. Create/update contact.
8. Create lead.
9. Assign salesperson.
10. Create activity.
11. Return generic successful response.

Do not disclose internal lead IDs unnecessarily to the public browser.

---

# 22. Public Form Fields

Current form contains:

```text
Full Name
Phone
Email
Project Type
Project Location
Ideal Timing
```

Preserve these.

Map them into:

```text
contacts
+
leads
```

After successful submission:

Replace current:

```text
Opening a prefilled message in your email app…
```

with something such as:

```text
Thanks — your project request has been received.
A CMAC representative will be in touch.
```

Do not expose internal salesman assignment to the public unless CMAC later requests it.

---

# 23. Routing Refactor

Replace the handmade History API router in `src/App.tsx`.

Use React Router.

Prefer nested routing.

Recommended structure:

```text
/
├── /
├── /login
├── /auth/callback
│
├── /employee-portal
│   ├── index
│   ├── leads
│   ├── leads/:leadId
│   ├── customers
│   ├── customers/:contactId
│   ├── marketing
│   ├── sales/new
│   ├── deals/:dealId
│   ├── quotes
│   ├── contracts
│   └── admin
│       ├── employees
│       └── marketing
│
└── /client-portal
```

The existing `/employee-portal` should become the Overview screen.

Move the existing four-step "Prepare a Sale" workflow to:

```text
/employee-portal/sales/new
```

Refactor rather than rewrite it.

---

# 24. Protected Routes

Everything under:

```text
/employee-portal/*
```

must require:

- Valid Supabase session
- Active employee record

If session missing:

```text
→ /login
```

If authenticated Google user is not authorized:

Show:

```text
Access Denied

Your Google account is not authorized for the CMAC employee portal.
```

Then sign them out from the application.

Admin routes require:

```text
role = admin
```

Do not hide an admin navigation button and call that security.

Enforce access in route logic AND database/server logic.

---

# 25. Vercel SPA Routing

Current production issue:

Direct requests such as:

```text
/login
/employee-portal
```

return a Vercel 404.

This is not fundamentally a branch issue.

Add the appropriate Vercel SPA rewrite configuration so browser-refresh/direct requests resolve to `index.html` and React Router handles the route.

Create root-level:

```text
vercel.json
```

Use Vercel's current recommended SPA rewrite pattern.

Conceptually:

```json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

Verify after deployment that:

```text
/
 /login
 /employee-portal
 /employee-portal/leads
 /employee-portal/sales/new
```

all load directly.

Also verify that JS/CSS/image assets still resolve correctly.

Do not consider this complete merely because client-side navigation works.

Refresh every important route.

---

# 26. Employee Portal Layout

Extract the existing sidebar/header structure into a reusable:

```text
EmployeePortalLayout
```

Recommended navigation:

```text
OVERVIEW

SALES
├── Leads
├── Customers
├── New Sale
├── Quotes
└── Contracts

SALES TOOLS
├── Marketing Library
└── Documents
```

For admins add:

```text
ADMIN
├── Employees
└── Marketing Materials
```

Inventory may remain visible as:

```text
Inventory
```

but clearly use the mock/current provider until the external API is implemented.

---

# 27. Overview Dashboard

Create an employee-specific dashboard.

Example:

```text
Good afternoon, John
```

Cards:

```text
My New Leads
Follow-Ups Due
Quotes Open
Contracts Awaiting Signature
Units Sold
```

Sections:

```text
Follow-Ups Due Today
Recent Leads
Recent Activity
Contracts Requiring Attention
Recent Units Sold
```

Admin dashboard may additionally show company-wide counts.

Do not display profit/margin metrics.

---

# 28. Customers / Contacts Interface

Build:

```text
/employee-portal/customers
```

Functions:

- Search
- Filter
- Sort
- Open contact
- View contact details
- View associated leads
- View deals
- View sent marketing
- View notes
- View contracts
- Add follow-up
- Send marketing materials

Sales reps only see their own assigned contacts.

Admin sees all.

---

# 29. Lead Detail Interface

Route:

```text
/employee-portal/leads/:leadId
```

Include:

```text
Contact information
Lead status
Assigned salesman
Project information
Timeline
Notes
Follow-ups
Marketing correspondence
Quotes
Deal information
Contracts
```

Primary actions:

```text
Add Note
Schedule Follow-Up
Send Marketing Material
Change Status
Create Quote
Convert to Deal
```

---

# 30. Marketing Material Sending UX

From a lead/customer:

```text
[ Send Sales Material ]
```

Open modal/drawer.

Step 1:

```text
Select material

☑ CMAC Overview
☑ 40ft Specifications
☐ Financing Information
☐ Floor Plan
```

Step 2:

```text
To:
customer@example.com

From:
John Doe <john.doe@cmaccontainers.com>

Subject:
Information from CMAC Containers
```

Step 3:

Editable message.

Step 4:

```text
[ Send ]
```

After successful send:

```text
Sent successfully from john.doe@cmaccontainers.com
```

Timeline updated.

---

# 31. Email Attachment Handling

Only attach active approved marketing assets.

Do not accept arbitrary browser-supplied file paths.

The server should:

1. Receive marketing material IDs.
2. Query records.
3. Verify active status.
4. Fetch files from Supabase Storage.
5. Construct MIME email.
6. Send through Gmail API.

Enforce practical attachment limits.

If selected attachments exceed Gmail-safe message limits:

- Block send.
- Explain which files caused the problem.
- Do not silently drop attachments.

---

# 32. Quotes

Create a quote system.

Tables:

```text
quotes
quote_items
```

Suggested quote fields:

```text
id
quote_number
contact_id
lead_id
deal_id
employee_id

status

subtotal
tax
delivery_amount
total

notes

created_at
sent_at
accepted_at
expired_at
```

Statuses:

```text
draft
sent
accepted
declined
expired
cancelled
```

It is acceptable to store sale pricing.

The prohibition is against building commission/profit/margin accounting.

---

# 33. Deals

Create:

```text
deals
```

This becomes the central sales transaction.

Suggested fields:

```text
id
deal_number

contact_id
lead_id
sales_rep_id

stage
status

project_name
project_address

notes

created_at
updated_at
signed_at
closed_at
```

Recommended stages:

```text
draft
quote
negotiation
contract
signed
closed_won
closed_lost
```

A deal should retain exactly one primary salesman for V1.

Do not implement originator/closer split logic.

---

# 34. Deal Unit References

Because production inventory is not available yet, create:

```text
deal_units
```

Fields:

```text
id
deal_id

external_unit_id
external_product_type

created_at
```

This does NOT represent CMAC inventory.

It only stores which external unit identifiers are associated with this deal.

When the real inventory API is available, these identifiers can be validated/resolved against that system.

---

# 35. Unit Sales

When a deal truly becomes a completed sale, create one `unit_sales` row per unit.

Example:

```text
Deal:
CM-2026-0042

Sales Rep:
John Doe

Units:
FW105
FW106
```

Creates:

```text
unit_sale #1:
John Doe → FW105

unit_sale #2:
John Doe → FW106
```

Expose this data in a simple report:

```text
Sales Rep     Unit      Product              Sold
John Doe      FW105     40ft Container Home  Aug 20
John Doe      FW106     40ft Container Home  Aug 20
```

No financial attribution calculations.

---

# 36. Existing New Sale Wizard

Preserve and productionize the existing four-step wizard:

```text
1. Select Unit
2. Customer
3. Package
4. Review
```

Refactor it into reusable components.

Do not redesign it unless necessary for functional integration.

Replace React-only temporary state with database-backed deal/draft state where appropriate.

The current wizard already collects useful information.

Integrate it into:

```text
contacts
leads
deals
deal_units
quotes
contracts
```

---

# 37. Document Package

The existing prototype contains:

```text
Purchase Agreement
Invoice & Deposit Schedule
Configuration & Finish Schedule
Site Readiness & Delivery Checklist
Limited Warranty
Change Order Policy
Permit & Zoning Acknowledgment
Payment Instructions
Bill of Sale
```

Preserve these concepts.

Create a production:

```text
document_templates
```

table for CMAC-managed template metadata where appropriate.

Do not create legally binding final contract wording.

Use placeholder/demo templates until CMAC supplies approved legal documents.

Clearly separate:

```text
MARKETING DOCUMENTS
```

from:

```text
LEGAL / TRANSACTION DOCUMENTS
```

---

# 38. DocuSign Decision

Use DocuSign rather than Google eSignature for legal signature workflow.

Do not implement Google eSignature.

Use DocuSign for:

- Purchase contracts
- Legal agreements
- Other documents requiring formal electronic signature

---

# 39. Centralized DocuSign Sender

Use one dedicated CMAC DocuSign service/sender identity.

Example:

```text
agreements@cmaccontainers.com
```

or:

```text
contracts@cmaccontainers.com
```

The final address will be supplied during configuration.

Employees must NOT share the account password.

Employees do not log into DocuSign to send normal contracts.

Architecture:

```text
Employee Portal
      ↓
Supabase Edge Function
      ↓
Dedicated CMAC DocuSign Integration User
      ↓
DocuSign API
      ↓
Customer
```

Use a DocuSign production plan that supports the required API envelope volume when the application goes live.

Develop against the DocuSign developer/demo environment first.

---

# 40. DocuSign Authentication

For this internal application pattern, use the appropriate server-side OAuth mechanism.

JWT Grant is preferred for the dedicated integration/service-user pattern if supported by the selected production configuration.

Credentials must stay server-side.

Supabase Edge Function secrets may include concepts such as:

```text
DOCUSIGN_INTEGRATION_KEY
DOCUSIGN_USER_ID
DOCUSIGN_ACCOUNT_ID
DOCUSIGN_PRIVATE_KEY
DOCUSIGN_BASE_URI
DOCUSIGN_AUTH_SERVER
```

Never place these in:

```text
VITE_*
```

environment variables.

Never send them to the browser.

---

# 41. DocuSign Templates

Use reusable DocuSign templates.

Maintain a mapping between CMAC template records and DocuSign template IDs.

Example:

```text
Purchase Agreement
→ DocuSign template ID ABC123
```

Populate template roles dynamically.

Customer:

```text
name
email
```

CMAC rep:

```text
display name
email
phone
rep code
```

Deal:

```text
deal number
unit references
project information
```

---

# 42. DocuSign Salesman Attribution

Even though the envelope comes from the centralized CMAC DocuSign identity, preserve salesman identity in the envelope.

Include internal metadata such as:

```text
CMAC_DEAL_ID
CMAC_EMPLOYEE_ID
CMAC_REP_CODE
CMAC_UNIT_IDS
```

Where supported use DocuSign envelope custom fields / internal metadata.

Also populate visible contract fields where appropriate:

```text
CMAC Representative:
John Doe

Email:
john.doe@cmaccontainers.com

Representative Code:
CMAC-0007
```

The centralized DocuSign sender and individual salesman identity are separate concerns.

---

# 43. Contracts Table

Create:

```text
contracts
```

Suggested fields:

```text
id
deal_id
contact_id
employee_id

provider
template_id

provider_envelope_id

status

sent_at
delivered_at
signed_at
completed_at
declined_at
voided_at

signed_document_path
completion_certificate_path

created_at
updated_at
```

Provider initially:

```text
docusign
```

Recommended statuses:

```text
draft
sent
delivered
signed
completed
declined
voided
error
```

---

# 44. Contract Events

Create:

```text
contract_events
```

Fields:

```text
id
contract_id

provider
provider_event_id
event_type

occurred_at

payload JSONB

created_at
```

Webhook processing must be idempotent.

Duplicate DocuSign notifications must not duplicate business events.

Use a provider event ID or deterministic unique fingerprint.

---

# 45. DocuSign Connect Webhook

Create Edge Function:

```text
docusign-webhook
```

Responsibilities:

1. Accept DocuSign Connect notification.
2. Verify webhook authenticity using DocuSign-supported HMAC validation.
3. Reject invalid requests.
4. Identify envelope.
5. Find local contract.
6. Store event.
7. Update contract status.
8. Add activity to contact/deal timeline.
9. On completion, fetch/store final documents if configured.
10. Return quickly.

Follow DocuSign's recommendation not to perform unnecessarily heavy synchronous webhook work.

If document processing is heavy, separate acknowledgment from processing.

---

# 46. Signed Documents

Create private Supabase Storage bucket:

```text
signed-contracts
```

When a contract completes, store:

- Final signed PDF
- Completion certificate if required/available

Path example:

```text
signed-contracts/
  {deal_id}/
    agreement.pdf
    certificate.pdf
```

Only:

- Assigned sales rep
- Admin

should be able to access those files.

---

# 47. Send Contract Flow

UI:

```text
Lead / Deal
   ↓
Prepare Contract
   ↓
Review Customer
   ↓
Review Units
   ↓
Review Terms
   ↓
[ SEND FOR SIGNATURE ]
```

Server:

```text
Authenticated employee
      ↓
Verify deal ownership
      ↓
Fetch contact
      ↓
Fetch employee
      ↓
Fetch deal units
      ↓
Create contract record
      ↓
Create DocuSign envelope from template
      ↓
Store envelope ID
      ↓
Mark contract sent
      ↓
Create activity
```

Customer receives DocuSign email.

---

# 48. Contract Status UI

Contracts page:

```text
Customer           Unit      Rep       Status
ABC Construction   FW105     John Doe  Awaiting Signature
Smith Holdings     FW112     Mike Lee  Completed
Jones LLC          FW119     John Doe  Declined
```

Status badges should clearly distinguish:

```text
Draft
Sent
Delivered
Awaiting Signature
Signed
Completed
Declined
Voided
Error
```

---

# 49. Sale Completion

A completed DocuSign signature should update the deal to at least:

```text
signed
```

Do not automatically assume every signed agreement equals final sale unless CMAC explicitly defines that.

Provide:

```text
[ Mark Deal Sold ]
```

for authorized users.

When marked sold:

1. Require at least one unit reference.
2. Set deal `closed_won`.
3. Create `unit_sales` rows.
4. Set contact lifecycle to customer if appropriate.
5. Add timeline activities.

This gives CMAC accurate:

```text
John Doe sold FW105.
```

without prematurely counting unsigned/unpaid/cancelled transactions.

---

# 50. Audit Log

Create:

```text
audit_log
```

Track sensitive actions such as:

```text
employee_added
employee_deactivated
lead_reassigned
contact_updated
deal_marked_sold
contract_sent
contract_voided
marketing_material_uploaded
marketing_material_deleted
```

Suggested fields:

```text
id
actor_employee_id
action
entity_type
entity_id
metadata
created_at
```

Do not record secrets.

---

# 51. Supabase Storage Buckets

At minimum:

```text
marketing-materials
signed-contracts
```

Potential future:

```text
quote-documents
deal-documents
```

Keep legal/customer documents private.

---

# 52. Edge Functions

Expected Edge Functions approximately:

```text
submit-lead
send-marketing-email
send-docusign-envelope
docusign-webhook
complete-unit-sale
admin-manage-employee
```

Potential helper functions can be added if appropriate.

Do not create dozens of tiny Edge Functions without reason.

---

# 53. Edge Function Authentication

Functions used by employees must validate Supabase JWT.

Do not trust:

```text
employee_id
sales_rep_id
sender_email
role
```

provided by the browser.

Derive identity server-side.

Public functions such as:

```text
submit-lead
docusign-webhook
```

need separate security models:

`submit-lead`:
input validation + abuse protections.

`docusign-webhook`:
DocuSign HMAC verification.

---

# 54. Environment Variables

Frontend-safe:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

Server-only Supabase secrets:

```text
Google Workspace service-account credentials
Google Workspace domain
DocuSign credentials/private key
DocuSign account identifiers
DocuSign webhook HMAC secret
```

Never expose a Supabase secret/service-role key in browser code.

Never prefix secrets with:

```text
VITE_
```

---

# 55. Google Workspace Manual Setup Documentation

Codex cannot complete Google Admin configuration automatically without administrative credentials.

Create:

```text
docs/GOOGLE_WORKSPACE_SETUP.md
```

Explain the exact human steps required:

1. Google Cloud project.
2. Enable Gmail API.
3. Create service account.
4. Enable domain-wide delegation.
5. Obtain service account client ID.
6. Google Workspace Admin Console.
7. Security.
8. API Controls.
9. Domain-wide delegation.
10. Add service-account client ID.
11. Grant only:

```text
https://www.googleapis.com/auth/gmail.send
```

12. Store credentials as Supabase secrets.
13. Test using a designated CMAC test employee.
14. Confirm message appears in that employee's Gmail Sent folder if expected by API behavior/configuration.
15. Confirm customer sees employee as sender.

Do not grant broader scopes unless required and explicitly documented.

---

# 56. Supabase Setup Documentation

Create:

```text
docs/SUPABASE_SETUP.md
```

Document:

- Project creation/linking
- Environment variables
- Google provider
- OAuth redirect URIs
- Site URL
- Redirect allowlist
- Local development URL
- Production URL
- Auth hook setup
- Storage buckets
- Edge Function deployment
- Secrets
- Database migrations
- RLS testing

---

# 57. DocuSign Setup Documentation

Create:

```text
docs/DOCUSIGN_SETUP.md
```

Include:

- Developer/demo account setup
- Integration key
- Dedicated service user
- JWT consent process if used
- RSA keypair handling
- Account ID
- User ID
- Demo base URI
- Template IDs
- Connect webhook configuration
- HMAC
- Production Go-Live
- Required paid API-capable account
- Production secret replacement

Never commit the DocuSign private key.

---

# 58. Preserve Existing Visual Design

Do not redesign:

- Public site
- Hero
- Navigation styling
- Typography
- Color system
- Blueprint/industrial visual language
- Portal visual style
- Existing sale wizard aesthetic

The current site uses a deliberate CMAC visual design.

Extend it.

Do not replace it with generic:

- shadcn dashboard
- Bootstrap dashboard
- white SaaS UI
- Material Design
- random admin theme

New portal pages must visually belong to the existing CMAC portal.

---

# 59. File/Component Refactor

Refactor large pages into logical components.

Potential organization:

```text
src/
├── app/
│   ├── router.tsx
│   └── auth/
│
├── components/
│   ├── portal/
│   ├── marketing/
│   ├── leads/
│   ├── contacts/
│   ├── contracts/
│   └── shared/
│
├── pages/
│   ├── ContainerHomesPage.tsx
│   ├── LoginPage.tsx
│   ├── ClientComingSoonPage.tsx
│   └── employee/
│       ├── OverviewPage.tsx
│       ├── LeadsPage.tsx
│       ├── LeadDetailPage.tsx
│       ├── CustomersPage.tsx
│       ├── CustomerDetailPage.tsx
│       ├── MarketingLibraryPage.tsx
│       ├── NewSalePage.tsx
│       ├── QuotesPage.tsx
│       ├── ContractsPage.tsx
│       └── admin/
│
├── lib/
│   ├── supabase.ts
│   ├── auth.ts
│   └── inventory/
│
└── portal.css
```

Use judgment.

Do not create abstraction for abstraction's sake.

---

# 60. Database Migrations

All schema changes must be migration-based.

Use the current Supabase CLI.

Before assuming commands:

```bash
supabase --version
supabase --help
```

Create named migrations.

Example conceptual sequence:

```text
001_employee_auth
002_contacts_leads
003_activities_tasks
004_marketing_library
005_deals_quotes
006_contracts
007_unit_sales
008_rls
009_storage
```

Actual filenames should be generated by Supabase CLI, not manually invented timestamps.

---

# 61. Explicit Data API Grants

Do not assume new Supabase tables are automatically available through the Data API.

Explicitly configure/grant required access to:

```text
authenticated
```

where needed.

Then rely on RLS for row authorization.

Do not expose private/internal-only tables to `anon`.

---

# 62. Supabase RLS Testing

Create explicit test cases.

Test users:

```text
Admin A
Sales Rep A
Sales Rep B
Unauthorized Workspace User
Anonymous Visitor
```

Verify:

### Sales Rep A

Can:

- Read own leads.
- Read own contacts.
- Read own deals.
- Read own contracts.
- Read own marketing sends.
- Read active marketing materials.

Cannot:

- Read Rep B leads.
- Update Rep B contacts.
- View Rep B contracts.
- Manage employees.
- Manage marketing templates.

### Admin

Can view/manage appropriate company records.

### Anonymous

Cannot read CRM data.

Can only access explicitly public functions/content.

### Deactivated employee

Cannot access portal business data even with an existing browser session.

---

# 63. Marketing Email Security Tests

Test:

1. Rep A sends to own lead → succeeds.
2. Rep A attempts Rep B lead ID → rejected.
3. Browser spoofs another sender email → ignored/rejected.
4. Browser requests inactive material → rejected.
5. Oversized attachments → rejected.
6. Invalid recipient → handled.
7. Gmail API failure → logged without false success.
8. Deactivated employee → rejected.

---

# 64. DocuSign Tests

Use DocuSign demo environment.

Test:

```text
Send envelope
Delivered
Signer views
Signer signs
Envelope completes
Signer declines
Envelope voided
Duplicate webhook
Invalid HMAC
Unknown envelope ID
```

Verify database state and timeline events after each.

---

# 65. E2E Tests

Playwright already exists in the project dependencies.

Use it.

Create E2E coverage for major browser workflows.

At minimum:

### Public

```text
Homepage loads
Navigation works
Consultation validates
Consultation submits against test backend
```

### Auth

```text
Unauthenticated employee URL redirects login
Unauthorized account denied
Authorized session enters portal
```

Where actual OAuth cannot be automated safely, support test/session fixtures.

### Employee portal

```text
Overview
Lead list
Lead detail
Create note
Create follow-up
Open marketing sender
New Sale wizard
Customers
Contracts
```

### Routing

Directly load every important route.

Refresh page.

Verify no Vercel-style 404 behavior in production preview.

---

# 66. Responsive Requirements

Preserve existing responsive support.

Test:

```text
375px
768px
1024px
1440px
```

Employee portal must be usable on phone because salespeople may use it while talking to customers.

No horizontal overflow.

---

# 67. Accessibility

Preserve existing accessibility work.

Requirements:

- Semantic headings.
- Labels.
- Keyboard navigation.
- Focus indicators.
- Dialog focus management.
- ARIA live regions for sends/status.
- Color not sole status indicator.
- Accessible error messages.

---

# 68. Loading / Error States

Every server-backed page should have:

```text
Loading
Empty
Success
Error
```

Do not leave blank panels.

Examples:

```text
No leads assigned yet.
No follow-ups due today.
No contracts awaiting signature.
No marketing materials available.
```

---

# 69. Optimistic UI

Use optimistic UI cautiously.

Do not optimistically display:

```text
Email sent
Contract sent
Unit sold
```

until the server operation succeeds.

These are business-critical state changes.

---

# 70. Logging

Server functions should log useful operational context but never:

- OAuth tokens
- Private keys
- Service-account JSON
- DocuSign private keys
- Entire legal documents
- Sensitive customer data unnecessarily

Include correlation IDs where useful.

---

# 71. No Client Portal Expansion Yet

Keep:

```text
/client-portal
```

as the existing coming-soon experience.

Do NOT build customer authentication in this project phase.

Do NOT allow client-portal work to delay employee CRM launch.

---

# 72. No Inventory API Work Yet

Do not:

- Guess endpoints.
- Scrape the project management system.
- Create fake webhook endpoints.
- Invent inventory schemas.
- Build redundant Supabase inventory management.

Only create the provider abstraction needed to replace mock data later.

---

# 73. No Commission System

Do not create:

```text
commission_rate
commission_percentage
profit
margin
originator_share
closer_share
payout
```

The required report is:

```text
Employee → Unit
```

Example:

```text
John Doe → FW105
```

Nothing more.

---

# 74. Implementation Order

Work in this order.

## Phase 1 — Infrastructure

1. Audit current branch.
2. Create feature branch from `minihomes`.
3. Install React Router.
4. Install/configure Supabase JS.
5. Add Vercel SPA routing.
6. Replace custom router.
7. Create nested portal routes.
8. Preserve existing UI.
9. Verify production/direct routing.

---

## Phase 2 — Authentication

1. Supabase Google provider.
2. Employee schema.
3. Employee allowlist.
4. Employee/admin roles.
5. Google-only login.
6. Auth callback.
7. Route guards.
8. Employee identity.
9. Logout.
10. Admin employee UI.
11. RLS.

---

## Phase 3 — Leads

1. Contacts.
2. Leads.
3. Activities.
4. Tasks.
5. Round-robin assignment.
6. Public consultation Edge Function.
7. Replace `mailto:`.
8. Leads list.
9. Lead detail.
10. Timeline.
11. Follow-ups.
12. Notes.

---

## Phase 4 — Marketing

1. Supabase Storage bucket.
2. Marketing material schema.
3. Admin marketing UI.
4. Marketing library.
5. Google Workspace DWD documentation.
6. `send-marketing-email` Edge Function.
7. MIME attachments.
8. Gmail API.
9. Send modal.
10. Send logging.
11. Timeline integration.

---

## Phase 5 — Customers and Deals

1. Customers/contact pages.
2. Deals.
3. Deal units.
4. Refactor existing New Sale wizard.
5. Quotes.
6. Quote items.
7. Deal activities.

---

## Phase 6 — DocuSign

1. DocuSign developer integration.
2. Dedicated service sender.
3. Templates.
4. Contracts schema.
5. Send Envelope Edge Function.
6. Sales-rep metadata.
7. Connect webhook.
8. HMAC validation.
9. Status updates.
10. Signed PDF storage.
11. Completion certificate.
12. Timeline integration.

---

## Phase 7 — Sales Attribution

1. Mark Deal Sold action.
2. Require unit reference(s).
3. Create one `unit_sales` row per unit.
4. Units Sold dashboard.
5. Simple sales report.

---

## Phase 8 — Hardening

1. RLS tests.
2. Edge Function auth tests.
3. Gmail tests.
4. DocuSign tests.
5. Playwright.
6. Responsive tests.
7. Accessibility.
8. Supabase advisors.
9. Production deployment verification.
10. Documentation.

---

# 75. Deliverables

Do not consider the project complete without all applicable deliverables.

Expected code:

```text
React Router implementation
Supabase client
Supabase migrations
RLS policies
Storage configuration
Edge Functions
Portal pages/components
Google login
Marketing email integration
DocuSign integration
Sales attribution
```

Expected documentation:

```text
README updates
docs/SUPABASE_SETUP.md
docs/GOOGLE_WORKSPACE_SETUP.md
docs/DOCUSIGN_SETUP.md
docs/DEPLOYMENT.md
.env.example
```

---

# 76. `.env.example`

Create a safe example containing names only.

Example:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

Server secrets should be documented but never populated with actual values.

Example documentation:

```text
GOOGLE_SERVICE_ACCOUNT_EMAIL
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
GOOGLE_WORKSPACE_DOMAIN

DOCUSIGN_INTEGRATION_KEY
DOCUSIGN_USER_ID
DOCUSIGN_ACCOUNT_ID
DOCUSIGN_PRIVATE_KEY
DOCUSIGN_BASE_URI
DOCUSIGN_HMAC_SECRET
```

---

# 77. Final Verification Checklist

Before declaring completion:

- [ ] Public site visually unchanged except intentional form behavior.
- [ ] `/login` works via direct URL.
- [ ] `/employee-portal` works via direct URL.
- [ ] Nested portal routes survive browser refresh.
- [ ] Employee password fields removed.
- [ ] Google login works.
- [ ] Unauthorized Workspace account denied.
- [ ] Inactive employee denied.
- [ ] Employee name is no longer hardcoded.
- [ ] Rep code loads correctly.
- [ ] Admin can add/deactivate employee.
- [ ] Public consultation creates real lead.
- [ ] `mailto:` behavior removed.
- [ ] Lead assigned.
- [ ] Rep A cannot access Rep B records.
- [ ] Lead notes work.
- [ ] Follow-ups work.
- [ ] Marketing library displays approved assets.
- [ ] Marketing email is sent FROM logged-in salesman's Workspace email.
- [ ] Email send logged.
- [ ] Marketing send appears on customer timeline.
- [ ] Existing New Sale wizard preserved.
- [ ] Inventory remains mock/provider-based.
- [ ] No Supabase inventory-management system created.
- [ ] Quotes work.
- [ ] Deals work.
- [ ] DocuSign uses centralized CMAC service sender.
- [ ] Salesman's name/rep code associated with envelope.
- [ ] DocuSign webhook HMAC validated.
- [ ] Contract statuses update automatically.
- [ ] Signed documents stored privately.
- [ ] Deal can be marked sold.
- [ ] One `unit_sales` record generated per unit.
- [ ] "John Doe sold FW105" can be reported.
- [ ] No commission/profit/margin system exists.
- [ ] Client portal remains out of scope.
- [ ] `npm run lint` passes.
- [ ] `npm run build` passes.
- [ ] Playwright critical flows pass.
- [ ] Supabase database/security advisors reviewed.
- [ ] No secrets committed.
- [ ] No service-role/secret key exposed to browser.
- [ ] Mobile layouts tested.
- [ ] Production Vercel deployment tested.

---

# 78. Important Existing Files

Review these before modifying architecture:

```text
src/App.tsx
src/main.tsx
src/index.css
src/portal.css

src/pages/ContainerHomesPage.tsx
src/pages/LoginPage.tsx
src/pages/EmployeePortalPage.tsx
src/pages/ClientComingSoonPage.tsx

src/components/AccessHeader.tsx
src/components/SiteHeader.tsx
src/components/ui.tsx

DESIGN_SPEC.md
package.json
```

The existing `EmployeePortalPage.tsx` contains valuable production-worthy UI.

Do not discard it.

Refactor it.

---

# 79. Coding Standards

Use strict TypeScript.

Avoid:

```text
any
```

unless unavoidable and documented.

Create typed database models/types.

Centralize API access.

Validate Edge Function inputs.

Do not put large amounts of business logic inside React components.

Prefer:

```text
UI
↓
service/hooks
↓
Supabase / Edge Function
```

Server-only external integrations belong on the server.

---

# 80. Dependency Policy

Before adding dependencies ask:

> Is this actually necessary?

Use existing capabilities where practical.

For all security-sensitive dependencies:

- Use stable releases.
- Pin versions appropriately.
- Commit lockfile.
- Avoid unmaintained packages.
- Verify current vendor documentation.

Do not blindly copy outdated examples.

---

# 81. Supabase-Specific Security Requirements

Follow current Supabase guidance.

Particularly:

- RLS on every exposed business table.
- Never expose secret/service role keys.
- Do not use editable `user_metadata` for authorization.
- Do not treat `TO authenticated` as authorization.
- Ensure UPDATE policies include proper ownership checks.
- Protect privileged database functions.
- Explicitly configure Data API access.
- Run database advisors.
- Verify every policy with multiple users.

---

# 82. Human Configuration Checkpoints

When implementation reaches a step requiring external credentials, do NOT invent them.

Pause that integration cleanly and provide the exact required setup instructions.

Human setup will be required for:

```text
Supabase production project
Google OAuth client
Google Workspace Super Admin domain-wide delegation
Google service account
DocuSign developer credentials
DocuSign templates
DocuSign production account
DocuSign webhook configuration
```

The application should fail gracefully while an optional external integration is unconfigured.

---

# 83. Development Modes

Use explicit integration status.

Examples:

```text
Google Mail: Not configured
DocuSign: Demo environment
Inventory: Mock provider
```

Do not silently simulate successful production actions.

The current prototype says "nothing was sent or saved."

As pieces become real, update those notices accurately.

Example:

Before Gmail configuration:

```text
Marketing email integration is not configured.
```

Not:

```text
Email sent successfully.
```

---

# 84. Migration from Prototype State

Remove or replace prototype-specific behavior including:

```text
sales@cmaccontainers.com
cmac-demo
Any credentials work during testing
Jordan Davis
Demo inventory pretending to be production
simulateSend()
Demo complete — nothing was sent
Draft / not saved
```

Only remove each demo marker once its replacement is genuinely connected.

---

# 85. Desired End-State User Experience

## New Salesman

```text
John receives CMAC Workspace account.
Admin adds John to portal.
John opens cmaccontainers.com/login.
John clicks Continue with Google.
John signs into Workspace.
Portal recognizes John.
John sees his dashboard.
```

---

## New Lead

```text
Customer visits cmaccontainers.com.
Customer submits consultation.
Lead enters Supabase.
Lead assigned to John.
John sees new lead.
John contacts customer.
```

---

## Nurturing

```text
John opens customer.
John chooses Send Sales Material.
John selects:
- CMAC Overview
- Floor Plan
- 40ft Specifications

John edits message.
John clicks Send.

Customer receives email FROM:
John Doe <john.doe@cmaccontainers.com>

Timeline records send.
```

---

## Quote / Deal

```text
Customer shows interest.
John creates quote.
Customer continues.
John converts opportunity into deal.
Units are associated using external references.
```

---

## Contract

```text
John prepares agreement.
John clicks Send for Signature.
CMAC backend creates DocuSign envelope.
DocuSign sends using dedicated CMAC sender.
Contract identifies John as CMAC representative.
DocuSign events update Supabase.
Customer signs.
Contract becomes Signed/Completed.
```

---

## Sale

```text
Authorized user marks deal sold.
Deal contains:
FW105

System creates:

John Doe → FW105

Dashboard:
Units Sold = +1
```

That is the complete V1 business lifecycle.

---

# 86. Final Architectural Model

```text
                      CMACCONTAINERS.COM
                              │
              ┌───────────────┴───────────────┐
              │                               │
        PUBLIC WEBSITE                 EMPLOYEE PORTAL
              │                               │
      Consultation Form                Google Workspace
              │                               │
              └─────────────┐   ┌─────────────┘
                            ↓   ↓
                          SUPABASE
                              │
      ┌─────────────┬─────────┼──────────┬─────────────┐
      │             │         │          │             │
   Contacts       Leads     Deals      Tasks       Activities
                              │
               ┌──────────────┼──────────────┐
               │              │              │
             Quotes       Contracts       Deal Units
                              │              │
                              ↓              ↓
                           DocuSign      Unit Sales
                              │
                           Connect
                              │
                              ↓
                           Supabase


Salesman Marketing:
Employee Portal
      ↓
Marketing Library
      ↓
Supabase Edge Function
      ↓
Google Workspace DWD
      ↓
Gmail API
      ↓
Email sent FROM salesman
```

---

# 87. Core Principle

This application is not intended to become Salesforce.

Keep it focused on CMAC's actual sales workflow:

```text
Lead
→ Relationship
→ Marketing
→ Follow-Up
→ Quote
→ Deal
→ Contract
→ Signature
→ Unit Sold
```

Every feature should support that lifecycle.

Do not introduce unnecessary enterprise CRM complexity.

The final system should feel like the existing CMAC website grew its own purpose-built sales operating system — not like a third-party CRM was bolted onto it.

---

# 88. Completion Instruction

Implement this project incrementally.

After every major phase:

1. Lint.
2. Build.
3. Test.
4. Visually inspect.
5. Verify authorization.
6. Verify direct routes.
7. Commit coherent changes.

Do not perform a giant untested rewrite.

Do not merge to the production branch until the implementation passes the verification checklist.

When finished, provide:

1. Summary of implementation.
2. Migration list.
3. New environment variables.
4. Manual configuration still required.
5. Test results.
6. Known limitations.
7. Exact deployment instructions.
8. Any decisions that differed from this specification and why.