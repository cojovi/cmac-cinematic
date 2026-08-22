# Build Sales Portal

**User:** Anonymous  
**Created:** 8/20/2026 16:17:08  
**Updated:** 8/20/2026 18:44:03  
**Exported:** 8/21/2026 17:20:53  
**Link:** [https://chatgpt.com/c/6a876ed3-8bbc-83ea-be0b-bb46575303bc](https://chatgpt.com/c/6a876ed3-8bbc-83ea-be0b-bb46575303bc)  

## Prompt:
8/20/2026, 4:17:07 PM

this is a voice transcription below of me explaining what i want to do with the new cmaccontainers.com site.  there is still the temporary site up right now , but i built a new upgrade i have not deployed yet, but i want to include this featuer below, plaese help:

[Speaker A]: This is a test for the Um, figuring out of CMAC containers website and how we're gonna do it. Okay, so I'm sure of course we're gonna use Supa base but we need to be able to have multiple logins the the main Page, of course, is going to be for advertising and marketing, but there needs to be a employee log in page in which I can add as many users as I want. Essentially every user is going to have the same page, we don't need a custom The user page. I'm sorry, the employee login page. It's all going to be the same thing. It just needs to be um contextually changed to their name. Because once the employee salesman logs in They're gonna have the ability to send a customer a contract, see how many units we have available, um if they do to use this portal to send a contract, if there's a way for us to keep track of that, who they've sent contracts to, and if it's come back.

[Speaker A]: Um or if the contract document has been signed so if we were to outsource with DocuSign I'm sure there's a DocuSign method that could either web hook or API back to keep the status of that um of each sent out contract. I do know Google has the um signature capabilities now.

[Speaker A]: In the event we can keep it inside Google that would be great, because we use workspaces is

[Speaker A]: But this portal is mainly just for the salesmen to help them sell these products. So again, uh multiple several different salesmen logins, but essentially it it's gonna be the same portal.

[Speaker A]: Just um s uh uh specialise and customise per user. Um

[Speaker A]: All of the employee users that we'll be making accounts for will have CMAC container domain email which is our domain and it's in our work spaces. Um no out I don't think I want any outside domains. So right now let's just plan plan for that.

[Speaker A]: So And any other ideas or tips or advice that you think we could um integrate into this employee sales portal, please tell me.

[Speaker A]: your thoughts, ideas and or implement them.

[Speaker A]: I'm dropping the link below to the CMac containers um temporary page this is a just really quick temp page I made right when we bought the domain just so it had a landing but just in case you need to brief yourself with what this is what we're selling and you just get some information about it It has quite a bit of information there.

[Speaker A]: And again, Any and all ideas you have to make this better, more efficient, please let me know.

## Response:
8/20/2026, 4:17:08 PM

Yes — this is very doable, and the cleanest version is **one shared sales portal with role-based data**, not separate pages per salesman. I’m going to map the portal architecture, authentication, contract/signature workflow, inventory, tracking, and the extra sales tools I’d add so you can build it into the new site without painting yourself into a corner.

The big architectural decision is already clear: **use Google Workspace for identity, Supabase for authorization/data, and treat contracts as tracked objects inside the portal**. That gives each salesman the same interface while the database automatically scopes “my leads / my contracts / my activity” to the logged-in employee.

One important finding on the signature piece: **Google Workspace eSignature is good for humans using Drive/Docs, but it is not the integration I’d choose for this portal.** Google supports signature requests, reminders, status viewing and audit trails, but there still isn’t a documented public eSignature webhook/API workflow for reliably feeding those status changes back into your app. 

**DocuSign fits your exact automation idea much better:** create/send envelopes from templates via API, save the envelope ID in Supabase, and let DocuSign Connect webhook events update the portal when it is delivered, signed, completed, declined, etc.

> **Planning the integration**
>
> I’m checking current Supabase, Google Workspace eSignature, and DocuSign capabilities before proposing the architecture. I’ll compare authentication, signing workflows, webhooks, and account restrictions to keep the design practical.
>
> **Planned the integration**
>
> 
>
> **Searching the web**
>
> [Custom Access Token Hook | Supabase Docs](https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook)
> [Send signature requests & sign documents with eSignature - Google Docs Editors Help](https://support.google.com/docs/answer/12315692?hl=en)
> [CMAC Containers — Coming Soon](https://cmaccontainers.com/)
>
> **Searched 3 websites**
>
> 
>
> **Searching the web**
>
> [Request access to the eSignature feature in Google Workspace - Google Docs Editors Help](https://support.google.com/docs/answer/16704506?hl=en)
>
> **Comparing platform capabilities**
>
> I’m verifying DocuSign, Google Workspace eSignature, and Supabase documentation so I can distinguish supported features from assumptions. I’m especially checking authentication controls, signing APIs, event notifications, and whether Google’s eSignature tools offer the needed developer access.
>
> **Choosing a signing workflow**
>
> I’m leaning toward DocuSign for portal-driven contracts because templates, envelope status, webhooks, and completed documents fit automation better. Google Workspace eSignature appears better for manual workflows unless its developer access meets the project’s needs.
>
> **Compared platform capabilities and chose a signing workflow**
>
> 
>
> **Searched 1 website**
>
> 
>
> Worked for 53s

Yes. I would absolutely build this into the new CMAC Containers site, and I would treat it as a **small purpose-built sales CRM**, not merely an “employee login page.”

I reviewed the current temporary site too. You already have several things that should feed directly into this system: general inquiries/waitlist leads, rental inquiries, financing interest, and eventually customers interested in the container mini-homes themselves. ([CMAC Containers](https://cmaccontainers.com/))

### The overall structure I'd build

```text
cmaccontainers.com
│
├── PUBLIC WEBSITE
│   ├── Products / Models
│   ├── Financing
│   ├── Rentals
│   ├── Contact / Request Info
│   └── Marketing content
│
└── portal.cmaccontainers.com
    │
    ├── Google Workspace Login
    │
    └── CMAC Sales Portal
        ├── Dashboard
        ├── Leads / Customers
        ├── Inventory
        ├── Quotes
        ├── Contracts
        ├── Follow-Ups / Tasks
        ├── Documents / Sales Material
        └── Admin
```

I actually prefer **`portal.cmaccontainers.com`** over `/employee`. It keeps the internal application logically separate from the marketing site even if they ultimately live in the same repo.

## Employee login

Since everybody already has a CMAC Google Workspace account, I would **not give employees another password to remember**.

Use:

**Continue with Google → CMAC Workspace account → Supabase session**

Supabase officially supports Google authentication. ([Supabase](https://supabase.com/docs/guides/auth/social-login/auth-google?utm_source=chatgpt.com))

But I would make it stricter than merely checking for `@cmaccontainers.com`.

You said **you want to choose who gets an account**, so we'd have an `employees`/allowlist table:

| Employee | Email | Role | Active |
|---|---|---|---|
| John Smith | john@cmaccontainers.com | Sales | Yes |
| Jane Doe | jane@cmaccontainers.com | Sales | Yes |
| Jeffery | ...@cmaccontainers.com | Admin | Yes |

When someone tries to sign in:

```text
Google Login
     ↓
Is email @cmaccontainers.com?
     ↓
Is email in CMAC Employees table?
     ↓
Is employee ACTIVE?
     ↓
YES → Portal
NO  → Access denied
```

Supabase's current **Before User Created Auth Hook** is specifically designed for this kind of restriction and can reject users based on email domain or other custom rules. ([Supabase](https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook?utm_source=chatgpt.com))

So even another legitimate Workspace user doesn't automatically become a portal user just because they have a CMAC email.

---

# The dashboard

Everybody gets essentially the **same application**, exactly like you described.

It just becomes:

> **Good afternoon, John**

And John's information is shown.

I'd make the home screen something roughly like:

```text
┌────────────────────────────────────────────────────────┐
│ Good afternoon, John                         [Profile] │
├─────────────┬─────────────┬─────────────┬──────────────┤
│ 12          │ 7           │ 3           │ 2            │
│ My Leads    │ Active      │ Awaiting    │ Signed       │
│             │ Quotes      │ Signature   │ This Month   │
├─────────────┴─────────────┴─────────────┴──────────────┤
│                                                        │
│ QUICK ACTIONS                                          │
│ [+ New Lead] [Create Quote] [Send Contract]            │
│ [Check Inventory] [Send Brochure]                      │
│                                                        │
├────────────────────────────────────────────────────────┤
│ FOLLOW UPS DUE TODAY                                   │
│                                                        │
│ Bill Johnson    Call regarding 40ft model     10:00AM │
│ Acme Builders   Follow up on quote            1:00PM  │
│ Susan Smith     Contract awaiting signature            │
└────────────────────────────────────────────────────────┘
```

That turns it into something a salesman could actually live inside during the day.

---

# Leads / customers

This is one of the biggest things I would add.

Don't make them keep customer information in their email, notebooks, text messages, etc.

Every potential buyer gets a **customer/lead record**.

A lead could contain name, company, phone, email, assigned salesman, what they're interested in, quantity, model, expected purchase date, financing interest, source, notes, next follow-up date, and status.

Then use a simple pipeline:

**New Lead → Contacted → Qualified → Quote Sent → Contract Sent → Signed → Financing/Payment → Sold**

If they disappear:

**Lost / Not Interested / Follow Up Later**

And every interaction becomes a timeline:

```text
ACME Construction
────────────────────────────

Aug 20  Jeff created lead
Aug 20  Customer requested pricing for 6 units
Aug 21  Jeff emailed brochure
Aug 22  Quote #CMAC-1042 sent
Aug 24  Customer viewed quote
Aug 25  Contract sent
Aug 25  Customer viewed contract
Aug 26  CONTRACT SIGNED ✓
```

That will become extremely valuable once several salespeople are working leads simultaneously.

---

# Your existing website should automatically create leads

This is where combining the public site and portal gets powerful.

Right now the temporary site already has rental reservation/inquiry forms and launch-interest forms. ([CMAC Containers](https://cmaccontainers.com/))

On the new site:

```text
Customer submits website form
             ↓
          Supabase
             ↓
     New Lead automatically
             ↓
   Assigned to salesperson
             ↓
Salesperson sees notification
```

You could later do round-robin:

```text
Lead #1 → John
Lead #2 → Steve
Lead #3 → Mike
Lead #4 → John
```

Or admin manually assigns them.

This also prevents the nightmare of **three salespeople accidentally calling the same lead.**

---

# Inventory

I wouldn't make this merely:

> 14 containers available.

Make every physical unit an actual record.

For example:

```text
CMAC-0042
40' Container Home
Status: AVAILABLE
Location: Abilene Yard
Interior: Completed
Exterior: Black / Wood
Price: $XX,XXX
```

Statuses could be:

**In Production → Available → Reserved → Under Contract → Sold → Delivered**

A salesman could click a unit and immediately see its photos, specifications, options, location, price, and availability.

Even better, when a contract is being created:

```text
Customer: ACME Construction
Quantity: 4
Units:

✓ CMAC-0042
✓ CMAC-0048
✓ CMAC-0051
✓ CMAC-0053
```

Those units could automatically become **Reserved / Under Contract**, preventing another salesman from selling the same inventory.

---

# Contracts: I would use DocuSign

This is one place where I would **not choose Google simply because you're already a Workspace customer**.

Google Workspace eSignature itself is actually pretty decent. It supports signatures, multiple signers, reminders, status tracking and an audit trail. ([Google Support](https://support.google.com/docs/answer/16704506?hl=en&utm_source=chatgpt.com))

The problem is automation.

For this system you really want:

```text
CMAC Portal
     ↓
Send Contract
     ↓
DocuSign
     ↓
Customer receives contract
     ↓
Customer views/signs
     ↓
WEBHOOK
     ↓
Supabase updated automatically
     ↓
John's dashboard:
"ACME CONTRACT SIGNED ✓"
```

DocuSign has exactly this infrastructure. Their eSignature API supports reusable templates, envelopes and programmatic sending, and **DocuSign Connect** can push envelope events back into your application instead of us repeatedly polling them. ([Docusign Developer Center](https://developers.docusign.com/docs/esign-rest-api/reference/envelopes/envelopetemplates/?utm_source=chatgpt.com))

So your Contracts page becomes:

| Customer | Salesman | Contract | Sent | Status |
|---|---|---|---|---|
| ACME | John | CMAC-1048 | Aug 19 | 🟡 Awaiting Signature |
| Smith Construction | John | CMAC-1032 | Aug 18 | 🟢 Signed |
| ABC Data Center | Steve | CMAC-1029 | Aug 17 | 🔵 Viewed |
| Jones LLC | Mike | CMAC-1015 | Aug 15 | 🔴 Declined |

Clicking one opens its complete history.

The final signed PDF and completion certificate could then be automatically archived in a **CMAC Google Shared Drive** if you want Google Workspace to remain the permanent document repository.

That's the Google/DocuSign combination I'd use.

---

# Quotes should probably be separate from contracts

This wasn't in your transcription, but I would add it immediately.

A salesman should be able to hit:

**Create Quote**

Select:

```text
Customer
Model
Quantity
Options
Delivery
Discount
Taxes
Additional charges
```

And get:

**Quote CMAC-Q-00128**

Then email a professional CMAC-branded PDF directly from the portal.

If they accept it:

**Convert Quote → Contract**

Most information carries forward automatically.

That removes a ton of repetitive typing.

---

# A few other features I'd put on the roadmap

These are the additions I think would give you the most value without turning this into Salesforce 2.0:

- **Follow-up reminders** - "Call Bill Thursday", "Follow up three days after quote."
- **Sales notes/customer timeline** - permanent history of calls, emails, quotes and contracts.
- **Sales material library** - brochures, spec sheets, floor plans, photos, warranty PDFs; salesman clicks **Send to Customer**.
- **Price/discount permissions** - salesman can discount to X%; anything greater requires manager approval.
- **Lead ownership** - prevents salesmen stepping on each other's customers.
- **Contract templates** - residential sale, commercial sale, bulk order, rental, etc.
- **Inventory reservations** - optionally expire after 24/48 hours if no contract progresses.
- **Manager dashboard** - same application, but an admin can see everyone's pipeline instead of only their own.
- **Sales analytics** - leads received, quotes sent, close rate, contracts signed, revenue and performance by salesman.
- **Commission tracking** - easy to add later because every sale already has a salesperson attached.
- **Activity/audit log** - who changed pricing, reserved a unit, reassigned a lead, canceled a contract, etc.
- **Financing status** - customer interested / application sent / approved / declined. Your current site already directs customers to First Citizens Equipment Finance, so I'd surface that workflow directly in the sales portal. ([CMAC Containers](https://cmaccontainers.com/))
- **Mobile-first design** - extremely important because a salesman will inevitably be standing beside a customer with his phone wanting inventory/pricing immediately.

One thing I would **not** store is financing-sensitive information like SSNs or detailed credit application information. Let First Citizens handle that; CMAC only needs status/reference information.

---

# Supabase database

The first version would probably only require something around these core tables:

```text
employees
customers
leads
lead_notes
lead_activities

inventory_units

quotes
quote_items

contracts
contract_events

tasks
documents
notifications

audit_log
```

Relationships would give us:

```text
employee
   │
   ├── leads
   │     ├── notes
   │     ├── tasks
   │     ├── quotes
   │     └── contracts
   │
   └── sales
          └── inventory units
```

And Supabase RLS handles the important part:

```text
Salesman:
    Can see/manage his leads
    Can see/manage his contracts
    Can see shared inventory
    Cannot administer employees

Admin:
    Can see everybody
    Can manage employees
    Can manage inventory
    Can reassign leads
    Can view company-wide analytics
```

Supabase currently recommends custom access-token claims for RBAC rather than trusting editable user metadata, so I'd put `sales_rep`, `manager`, `admin`, etc. into proper authorization claims and build RLS around those. ([Supabase](https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook?utm_source=chatgpt.com))

Also, there's a **2026 Supabase change worth accounting for during development**: new tables aren't necessarily automatically exposed to the Data API anymore, so the migrations should explicitly grant required table access in addition to enabling RLS. ([Supabase](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically?utm_source=chatgpt.com))

---

## What I'd build for V1

I wouldn't try to build every bell and whistle immediately.

**V1 should be:**

```text
Google Workspace authentication
        ↓
Employee dashboard
        ↓
Customer / lead management
        ↓
Inventory
        ↓
Quote generation
        ↓
DocuSign contract sending
        ↓
Automatic contract status tracking
        ↓
Follow-ups/tasks
        ↓
Admin employee + inventory management
```

That alone would turn the new CMAC site from a marketing website into an actual **sales operating system**.

And importantly, the design doesn't require separate employee pages. It's **one portal, one codebase, one interface; Supabase determines who the logged-in person is and dynamically scopes the information around them.**

If you give me the **new site's repo/ZIP or GitHub URL**, I can take this one level deeper and lay out the actual Supabase schema, RLS policies, auth flow, routes/components, DocuSign webhook architecture, and implementation plan against the code you've already built rather than designing it abstractly.

---

**Sources:**

- [CMAC Containers — Coming Soon](https://cmaccontainers.com/)
- [Login with Google | Supabase Docs](https://supabase.com/docs/guides/auth/social-login/auth-google?utm_source=chatgpt.com)
- [Request access to the eSignature feature in Google Workspace - Google Docs Editors Help](https://support.google.com/docs/answer/16704506?hl=en&utm_source=chatgpt.com)
- [EnvelopeTemplates Resource | REST API | Docusign](https://developers.docusign.com/docs/esign-rest-api/reference/envelopes/envelopetemplates/?utm_source=chatgpt.com)

## Prompt:
8/20/2026, 4:20:30 PM

ok, just to be clear, and for you to see what already exists, this is the NEW containers site that i want this feature to be built into:

https://cmac-cinematic.vercel.app/
https://github.com/cojovi/cmac-cinematic/tree/minihomes

so after you thoroughlly review those, let me know if that changes anything from this current response you sent me

## Response:
8/20/2026, 4:20:32 PM

I’m reviewing both the deployed preview and the actual `minihomes` branch so I can compare my earlier architecture against what you already built, not against assumptions. The main things I’m checking are your framework, routing structure, existing forms/data flows, whether Supabase is already present, and where the employee portal fits cleanly without disrupting the cinematic public site.

There’s an important difference from what I assumed earlier: your `minihomes` branch **already contains `LoginPage.tsx`, `EmployeePortalPage.tsx`, and a dedicated `portal.css`**. So you’ve already got the beginnings of the exact internal portal concept — I’m checking now whether it’s just a visual prototype or whether any auth/data behavior is wired behind it.

The code review is already showing this is much farther along than a blank-slate portal: the current employee page has a 4-step sale workflow, demo inventory, customer/site capture, a configurable document package, deposit controls, preview/send simulation, and a customer portal placeholder. I’m also checking the live Vercel build so I can verify the UX you actually see, not just infer it from JSX.

> **Inspected live site and repository branch**
>
> 
>
> **Searching the web**
>
>
> **Searching the web**
>
> 
>
> **Fetched GitHub packages, source files, directories, and portal components**
>
> 
>
> **Inspected EmployeePortal routing, source code, forms, and GitHub references**
>
> 
>
> **Checking agent-browser availability**
>
>
> **Checked agent-browser availability**
>
> 
>
> **Fetched Vercel deployment HTML**
>
> 
>
> **Inspected portal architecture, submission code, login, and design specifications**
>
> 
>
> **Adapting the deployment plan**
>
> I’m revising my recommendation after seeing the existing app structure. I’d keep the current login and employee-portal shells, connect them to Supabase, replace demo state, and use SPA routing rather than splitting into a separate portal initially.
>
> **Adapted the deployment plan**
>
> 
>
> **Verified employee portal deployment and direct route availability**
>
> 
>
> **Refining the build approach**
>
> I’m keeping the existing React/Vite site and portal shell rather than splitting projects. I’ll replace demo authentication and mock data with real services, add deployment rewrites, and postpone a separate portal subdomain until it’s genuinely useful.
>
> **Refined the build approach**
>
> 
>
> **Verified Supabase and DocuSign references**
>
> 
>
> Worked for 1m 50s

Yes - after reviewing the actual `minihomes` branch and testing the Vercel deployment, I would **change a few parts of my previous recommendation**, mostly because you have already built a surprisingly large portion of the *front-end concept*.

The overall Supabase + Google Workspace + DocuSign architecture **does not change**. What changes is **how I would integrate it into what already exists.**

### The biggest discovery

You already have:

- `/login`
- `/employee-portal`
- `/client-portal`
- A fully designed sales-portal UI
- Inventory/unit selection
- Customer/site information collection
- Document-package selection
- Deposit percentage controls
- Delivery estimate controls
- Package review
- Simulated email/send
- A future client portal concept

Your design spec explicitly describes the employee portal as a prototype sales workspace, with the four-step transaction process and fake send/storage behavior. 

The actual employee portal is already structured around:

**Select Unit → Customer → Package → Review** 

So I would **absolutely not rebuild the employee portal from scratch.**

I'd turn what you already built into the real system.

---

## 1. I would change my recommendation about `portal.cmaccontainers.com`

Earlier I recommended:

`portal.cmaccontainers.com`

Seeing the new site, I don't think that's necessary anymore.

I'd keep:

```text
cmaccontainers.com/
cmaccontainers.com/login
cmaccontainers.com/employee-portal
```

Your public site already has a dedicated Login link integrated into its navigation. 

Everything visually feels like one product, and the portal already has its own completely separate design language/styles through `portal.css`. 

We could always alias:

```text
portal.cmaccontainers.com
```

to the same application later, but I wouldn't split this into another repo/application.

---

# 2. The current "New Sale" portal becomes one module

This is probably the biggest conceptual adjustment.

Right now logging in essentially takes the employee directly into:

> **Prepare a Sale**

That's excellent functionality, but it shouldn't ultimately be the portal homepage.

I'd change the flow to:

```text
LOGIN
  ↓
OVERVIEW
  │
  ├── New Sale
  ├── My Leads
  ├── Customers
  ├── Inventory
  ├── Quotes
  ├── Contracts
  └── Documents
```

And your existing `EmployeePortalPage.tsx` effectively becomes:

```text
New Sale
```

The sidebar is actually **already designed for this architecture**:

```text
Overview
New sale
Inventory
Documents
Customers
```

Those buttons just aren't implemented yet. 

I'd expand that slightly to:

```text
Overview

SALES
├── Leads
├── Customers
├── New Sale
├── Quotes
└── Contracts

OPERATIONS
├── Inventory
└── Documents
```

That gets you extremely close to what you described in your transcription.

---

# 3. The existing New Sale wizard is worth KEEPING

I actually like this considerably more after seeing it.

It already gathers:

- Unit
- Customer name
- Email
- Phone
- Company
- Project address
- Billing address
- Delivery timeframe
- Sales representative
- Project notes 

Then it generates the conceptual package:

- Purchase Agreement
- Invoice & Deposit Schedule
- Configuration & Finish Schedule
- Site Readiness Checklist
- Warranty
- Change Order Policy
- Permit/Zoning Acknowledgement
- Payment Instructions
- Bill of Sale 

That's basically the skeleton I would have told you to build.

So instead of replacing this, we're mostly doing this:

```text
CURRENT

React State
    ↓
fake inventory
fake customer
fake documents
fake send

PRODUCTION

Supabase
    ↓
real inventory
real customer
real salesman
real pricing
real documents
    ↓
DocuSign
    ↓
real contract
```

That's a much easier project than starting over.

---

# 4. Supabase is currently completely absent

This is important.

Your site is currently:

**Vite + React 19 + TypeScript + Tailwind**. 

There isn't currently a Supabase client/auth dependency in `package.json`. 

So the existing portal is basically an extremely nice interactive mockup.

Even the login page explicitly says no credentials are verified, and currently **any email/password combination enters the portal**. 

That actually gives us a clean starting point.

---

# 5. I would REMOVE employee passwords entirely

The current UI has:

```text
Work email
Password
```

I would replace that with:

```text
┌────────────────────────────────────┐
│                                    │
│       Employee Access              │
│                                    │
│   [ G  Continue with Google ]      │
│                                    │
│   CMAC employees only              │
│                                    │
└────────────────────────────────────┘
```

Because you already use Google Workspace.

Then:

```text
Google Workspace
       ↓
Supabase Auth
       ↓
@cmaccontainers.com?
       ↓
employee exists?
       ↓
employee.active = true?
       ↓
Portal
```

No CMAC password database.

No password reset system.

No employee wondering which password he used.

Google handles authentication; **CMAC controls authorization**.

---

# 6. Your public consultation form should become the lead generator

This jumped out at me immediately.

Your beautiful public consultation form currently doesn't actually submit anywhere.

It constructs an email and launches:

```text
mailto:info@cmaccontainers.com
```

That is the **first thing I would replace when Supabase is added.**

Instead:

```text
CUSTOMER
fills out:

Name
Phone
Email
Project Type
Location
Timing

        ↓

SUPABASE

        ↓

lead created
status = NEW

        ↓

assigned salesman

        ↓

appears immediately:

EMPLOYEE PORTAL
"New Lead"
```

This is a beautiful opportunity because the marketing site and CRM are literally already the same application.

No Zapier gymnastics required.

---

# 7. Your existing inventory prototype maps directly into Supabase

You already represent units with things like:

```text
CH-104
CMAC Living 40
Available now
$50,000
Ready for site review
```

Instead of this being a hard-coded TypeScript array, it becomes:

```text
inventory_units
```

For example:

| ID | Model | Status | Price | Location |
|---|---|---|---:|---|
| CH-104 | Living 40 | Available | $50K | Abilene |
| CH-112 | Studio 40 | Production | $50K | Abilene |
| CH-118 | Crew 40 | Finishing | $50K | Abilene |

Your existing unit cards barely have to change visually.

They just change from:

```typescript
units.map(...)
```

against hard-coded data to Supabase data.

---

# 8. Same thing with the salesman identity

Right now:

```text
Jordan Davis
Sales representative
```

is hard-coded. 

That becomes:

```text
Supabase Auth user
       ↓
employees table
       ↓
Jordan Davis
Sales Representative
JD
```

Therefore exactly what you originally wanted happens automatically:

```text
John logs in
→ John

Mike logs in
→ Mike

Steve logs in
→ Steve
```

Same interface.

Different contextual data.

---

# 9. One thing I WOULD add before DocuSign: a true `sale/deal` record

Your prototype currently assembles everything temporarily inside React state.

We should introduce an actual object such as:

```text
deals
```

A deal connects:

```text
Salesman
   ↓
Customer
   ↓
Inventory Unit
   ↓
Quote
   ↓
Contract
   ↓
Documents
```

Something like:

```text
CM-2026-0042

Customer:
Acme Construction

Sales rep:
Jeff Smith

Unit:
CH-104

Value:
$50,000

Stage:
CONTRACT_SENT

Contract:
DocuSign Envelope abc123

Created:
August 20, 2026
```

Your existing interface is already generating a fake transaction number like `CM-2026-0042`, so conceptually you're already headed that direction. 

---

# 10. DocuSign still remains my recommendation

Nothing I saw changes that.

Your existing UI even describes the preview as representing the eventual:

> generated PDF and e-signature envelope

That's exactly where DocuSign slots in.

```text
Employee clicks SEND CONTRACT
          ↓
Supabase Edge Function / server API
          ↓
DocuSign API
          ↓
Envelope created
          ↓
envelope_id stored in Supabase
          ↓
Customer signs
          ↓
DocuSign webhook
          ↓
Supabase
          ↓
Portal changes:

Awaiting Signature
        ↓
SIGNED ✓
```

And importantly:

**DocuSign secrets never go into the React/Vite frontend.**

Those calls happen through a trusted server function.

---

# 11. There is one actual technical problem I found

This needs fixing regardless of Supabase.

Your routing currently uses a handmade History API router. 

Inside the website:

```text
Home → click Login
```

works.

But I tested these directly against the live deployment:

```text
https://cmac-cinematic.vercel.app/login
```

and:

```text
https://cmac-cinematic.vercel.app/employee-portal
```

Both currently return:

**404 NOT_FOUND**

That's because Vercel doesn't know those are SPA routes.

This becomes particularly important with OAuth because Google will redirect back to actual URLs.

We need a Vercel rewrite essentially equivalent to:

```text
/* → /index.html
```

while preserving things such as assets/API endpoints.

Very easy fix, but definitely needs to happen.

---

# 12. I'd probably introduce a real router now

The little router you wrote is perfectly reasonable for four prototype pages:

```typescript
type AppRoute =
  | 'home'
  | 'login'
  | 'employee'
  | 'client'
```

But the real portal is going to grow.

Eventually you'll have things conceptually like:

```text
/employee-portal
/employee-portal/leads
/employee-portal/leads/:id
/employee-portal/customers
/employee-portal/customers/:id
/employee-portal/inventory
/employee-portal/sales/new
/employee-portal/deals/:id
/employee-portal/contracts
/employee-portal/contracts/:id
```

At that point I'd introduce **React Router** instead of continuing to enlarge the custom `routeByPath` object.

This is one of the few technical refactors I'd do **before** we pile lots of portal functionality onto it.

---

# 13. I would keep the Client Portal OUT of V1

You've already designed the placeholder for:

- signatures
- invoices
- payments
- delivery updates
- handover documents 

That's a great future feature.

But I'd build this in order:

```text
PHASE 1

Employee Authentication
        ↓
Leads
        ↓
Customers
        ↓
Inventory
        ↓
New Sale
        ↓
Quotes
        ↓
Contracts / DocuSign
        ↓
Tracking

PHASE 2

Customer Portal
```

Otherwise scope creep will come barreling through the wall like the Kool-Aid Man.

---

# So does my original architecture change?

**Conceptually: almost not at all.**

**Implementation-wise: yes, significantly - and mostly in a good way.**

Originally I thought we needed to build:

```text
Marketing Website
+
Sales Portal
```

After examining this repository, what you actually have is:

```text
Marketing Website
+
~80% of the visual Sales Portal
+
Client Portal foundation
```

What you're missing is primarily the **real backend and business logic**.

### My revised architecture

```text
                    CMACCONTAINERS.COM
                           │
              ┌────────────┴────────────┐
              │                         │
         PUBLIC SITE               EMPLOYEE PORTAL
              │                         │
     Consultation Form             Google Workspace
              │                         │
              └──────────┐     ┌────────┘
                         ↓     ↓
                       SUPABASE
                           │
       ┌───────────┬───────┼─────────┬───────────┐
       ↓           ↓       ↓         ↓           ↓
     Leads      Customers Inventory Quotes      Deals
                                              │
                                              ↓
                                          Contracts
                                              │
                                              ↓
                                           DocuSign
                                              │
                                           Webhook
                                              │
                                              ↓
                                           Supabase
```

And **your existing New Sale UI sits right in the middle of all of it.**

### The database I'd now expect

```text
employees
leads
customers
lead_activities
tasks

inventory_units

deals
quotes
quote_items

contracts
contract_events

document_templates
deal_documents

notifications
audit_log
```

One additional change from my previous response: I'd make **`deals`** a central concept because your existing portal is already organized around constructing a transaction.

---

## Bottom line

Seeing the actual new site makes me **more confident in the idea**, not less.

I would **preserve the public site, preserve the visual employee portal, preserve the New Sale wizard, preserve your current CMAC design language**, and essentially start replacing every place where the code currently says:

> demo / fake / not saved / simulate

with real Supabase-backed functionality.

Your design spec literally says:

> “Replace `submitConsultation` when a production lead endpoint is available.” 

Well... **this is that production lead endpoint.**

The next useful step would be for me to turn this specific repo into a **complete implementation blueprint for your coding agent**: exact routes, Supabase tables/columns/relationships, RLS rules, Google OAuth flow, component changes, Edge Functions, DocuSign integration, webhook behavior, and a phased build order referencing the existing filenames in `minihomes`. That would be substantially more useful now than the generic architecture I gave you before.

## Prompt:
8/20/2026, 4:46:48 PM

![CleanShot 2026-08-20 at 16.39.51@2x.png](https://chatgpt.com/backend-api/estuary/content?id=file_000000006aa08230a3aff428c4ebf23b&fn=CleanShot+2026-08-20+at+16.39.51%402x.png&cd=attachment&ts=496486&p=fs&cid=1&sig=ad3e3b86e5705a959d0fdcfeea021ab34857195e07d56d92be99d76be61f47d3&v=0)

you said "I would REMOVE employee passwords entirely" and i totally agree, we definitly need to only allow the "Login with Google" since our workspaces is google.

you also mentioned the "Your public consultation form should become the lead generator", your modification plan, after supabase is implemented is perfect and id 100% agree we need to do that!

and about "7. Your existing inventory prototype maps directly into Supabase", lets put this on hold for now, im working on finishing up the API structure from our project management system, so the "inventory" can always be live, and accurate to the day. so lets not over think that now. once i get my side done, we can just use API calls or some sort of webhook system to supply that inventory number (which will also include what model/product type)

but we do NOT have to wait on your updates to "salesman identity", that can definitly be configred/added now.

and for the "One thing I WOULD add before DocuSign",  im fine with using Docusign if you feel thats the better route to go, but i did want to entertain the idea of (and i dont even know if this is feasible) using google esignature ([https://workspace.google.com/resources/esignature/](https://workspace.google.com/resources/esignature/)).  i dont even know if that is an options for this workflow, but i just wanted to put it out there.  if its an option lets talk about it, if not, then docusign it is!

next. when you mentioned: "But I tested these directly against the live deployment: [https://cmac-cinematic.vercel.app/login](https://cmac-cinematic.vercel.app/login)  and: [https://cmac-cinematic.vercel.app/employee-portal](https://cmac-cinematic.vercel.app/employee-portal)   Both currently return: 404 NOT\_FOUND", could that be because ist deplyoed from a different branch then "main" or "master"?  if so i can merge.  just an idea. if that is not the problem, lets just do whatever we need to do to fix it.

and for "12. I'd probably introduce a real router now", i agree and ill follow whatever you think is best for this, you take charge here.

## Response:
8/20/2026, 4:46:48 PM

> **Searching the web**
>
> [Electronic Signature for Online Documents | Google Workspace](https://workspace.google.com/resources/esignature/?authuser=0)
> [Request access to the eSignature feature in Google Workspace - Google Docs Editors Help](https://support.google.com/docs/answer/16704506?hl=en)
>
> **Assessing eSignature options**
>
> I’m distinguishing manual Google eSignature from a fully automated send. Google could support document creation and status tracking, but DocuSign remains necessary if the portal must initiate signing directly.
>
> **Assessed eSignature options**
>
> 
>
> **Searching the web**
>
> [Drive Audit Activity Events  |  Admin console  |  Google for Developers](https://developers.google.com/workspace/admin/reports/v1/appendix/activity/drive)
>
> **Planning the next steps**
>
> I’m treating the route issue as a deployment rewrite problem, not a branch problem. I’ll preserve readable URLs, add SPA fallback handling, then finalize the eSignature choice around automation needs and Workspace plan support.
>
> **Planned the next steps**
>
> 
>
> **Searched 2 websites**
>
> 
>
> Worked for 50s

Yes - and after checking Google’s current eSignature developer surface, I’d make one important revision to what I told you earlier:

**Google eSignature is more viable for CMAC than I initially gave it credit for.** It still has one major limitation, but we can absolutely design around it.

### What we’re locking in now

We can move forward immediately with these pieces:

- **Google-only employee login** through Supabase Auth. No CMAC passwords.
- **Employee identity/profile** from Supabase: name, initials, role, active/inactive, etc.
- **Public consultation form → Supabase lead** instead of the current `mailto:` behavior.
- **Real router** using React Router.
- **Vercel SPA route fix** so `/login`, `/employee-portal`, etc. work when opened directly.
- **Inventory integration stays abstracted/placeholder for now** until your project-management API is ready.
- Build contracts/deals in a way that does **not lock us into DocuSign or Google**.

That last part is important.

---

## Google eSignature: yes, it can work - with one catch

Google Workspace eSignature itself is legitimate for this use case. It supports external signers, reusable templates, reminders, status tracking, completed PDFs, and an audit trail. ([Google Workspace](https://workspace.google.com/resources/esignature/?authuser=0&utm_source=chatgpt.com))

And I found something very useful that changes the equation:

Google exposes eSignature activity through the **Admin SDK Reports API**.

There are actual events for:

```text
request_esignature
review_esignature
complete_esignature
```

The completion event even reports whether the final status was:

```text
signed
declined
```

and associates it with the Google `doc_id`. ([Google for Developers](https://developers.google.com/workspace/admin/reports/v1/appendix/activity/drive))

Even better, the Admin Reports API supports **push notifications/webhooks**, so we don't necessarily have to continuously poll Google. ([Google for Developers](https://developers.google.com/workspace/admin/reports/reference/rest/v1/activities/watch?authuser=108&utm_source=chatgpt.com))

So this portion is possible:

```text
Google eSignature
       ↓
customer signs
       ↓
Google Workspace event
       ↓
CMAC webhook
       ↓
Supabase
       ↓
Contract: SIGNED ✓
```

That's excellent.

---

## The catch

I cannot find a documented Google API that allows our portal to do:

```text
POST /esignature/request
```

and programmatically initiate the signature request.

Google's documented workflow is still:

**Docs/Drive → Tools/eSignature → Request signature**. ([Google Support](https://support.google.com/docs/answer/12315692?hl=en&utm_source=chatgpt.com))

That's the piece DocuSign does considerably better.

So there are basically two workflows available to us.

### Google workflow

```text
CMAC PORTAL
    ↓
Create Deal
    ↓
Generate contract from Google template
    ↓
Save Google doc_id into Supabase
    ↓
[ Open Contract in Google ]
    ↓
Salesman clicks:
Tools → eSignature → Request Signature
    ↓
Google sends to customer
    ↓
Google Reports webhook
    ↓
CMAC automatically tracks:
REQUESTED
SIGNED
DECLINED
COMPLETED
```

That is **quite workable**.

But there is one manual Google step.

### DocuSign workflow

```text
CMAC PORTAL
    ↓
Create Deal
    ↓
[ SEND CONTRACT ]
    ↓
DocuSign API does everything
    ↓
Customer signs
    ↓
DocuSign webhook
    ↓
Supabase updated
```

That gives us the sexy one-click experience.

---

# What I recommend for CMAC now

I **wouldn't commit to DocuSign yet**.

Since you're already paying for Google Workspace, I think Google deserves a proper shot.

We should architect contracts like:

```text
contracts

id
deal_id
customer_id
sales_rep_id

provider
provider_document_id

status
sent_at
viewed_at
signed_at
declined_at
completed_at

document_url
signed_document_url
```

Where:

```text
provider = google
```

today could later become:

```text
provider = docusign
```

without rewriting the CRM.

I'd build the first contract integration around **Google Workspace eSignature**, provided that you're okay with the salesman having one manual step inside Google.

If that manual step starts annoying everybody, we switch the provider implementation to DocuSign.

Everything else stays the same.

That saves you from paying DocuSign before we've established that we actually need it.

### One thing to verify

Google eSignature is currently included with Workspace Business Standard/Plus and several Enterprise editions, but **not every Workspace plan**. ([Google Support](https://support.google.com/docs/answer/16704506?hl=en&utm_source=chatgpt.com))

So we just need to verify which CMAC Workspace edition you're on before investing much effort there.

---

# About inventory

Agreed completely: **stop there.**

I wouldn't build a Supabase inventory management system if you already have an authoritative operational system that will soon expose inventory properly.

That's exactly how duplicated data turns into:

> Website says 7 units.  
> Project management says 4.  
> Bob says 5.  
> Nobody knows where unit #6 went. 😂

Instead we'll define an abstraction like:

```text
InventoryProvider
       ↓
Your PM API
       ↓
CMAC Portal
```

The portal only needs to care about receiving something conceptually like:

```json
{
  "model": "40ft Duo",
  "available": 8
}
```

or individual inventory records if your API provides them.

We can plug that in later.

---

# Salesman identity: let's absolutely do it now

This becomes one of the first Supabase tables:

```text
employees
──────────────────────────
id
auth_user_id
email
first_name
last_name
display_name
role
active
created_at
```

Example:

```text
Jeff Smith
jeff@cmaccontainers.com

role:
sales_rep

active:
true
```

After Google login:

```text
Google
  ↓
Supabase Auth user
  ↓
employees.auth_user_id
  ↓

Jeff Smith
Sales Representative
JS
```

Then the existing hardcoded:

```text
Jordan Davis
JD
Sales representative
```

disappears.

Every screen becomes contextual automatically.

And authorization shouldn't rely on editable user metadata; we'll enforce roles/ownership through Supabase RLS and proper app metadata/authorization state.

---

# Consultation form: confirmed

I'd actually make this one of the earliest backend features because there's an immediate business benefit.

Current:

```text
Website Form
    ↓
mailto:
    ↓
opens customer's mail app
```

New:

```text
Website Form
     ↓
Supabase Edge Function
     ↓
leads
     ↓
NEW
     ↓
assign salesperson
     ↓
Employee Dashboard
```

And importantly, the visitor doesn't have to actually send an email anymore.

They click:

**START MY PROJECT**

and they're done.

We should also put spam/rate protection on that public endpoint rather than exposing unrestricted database inserts directly from the browser.

---

# The 404 problem is NOT because of the branch

Your thought was reasonable, but no - merging `minihomes` into `main` won't fix this particular issue.

I know because the deployed `/` is already serving the new CMAC Container Homes application.

The problem is this:

```text
Browser visits:

/
```

Vercel knows:

```text
index.html
```

Good.

But when someone directly requests:

```text
/employee-portal
```

Vercel looks for an actual server resource named:

```text
/employee-portal
```

It doesn't exist.

So:

```text
404
```

When you navigate from inside React, React intercepts it, which is why it appears to work.

---

## We're fixing routing properly

Since you gave me the wheel here, my choice is:

**React Router using clean BrowserRouter URLs + a Vercel SPA rewrite.**

Not hash URLs like:

```text
/#/employee-portal
```

Those are gross. We're not building MySpace in 2007.

We'll have:

```text
/
/login

/employee-portal
/employee-portal/leads
/employee-portal/leads/:id
/employee-portal/customers
/employee-portal/customers/:id
/employee-portal/sales/new
/employee-portal/deals/:id
/employee-portal/contracts
```

And Vercel gets a rewrite so requests that aren't real static assets are served through the SPA.

Conceptually:

```text
/anything → /index.html
```

Then React Router determines which screen to render.

This also becomes essential for Google OAuth:

```text
Google Login
     ↓
redirect back
     ↓
cmaccontainers.com/...
```

We need those direct URL requests to resolve correctly.

---

# Revised build sequence

I now think this is the cleanest order:

```text
PHASE 1 - FOUNDATION

React Router
Vercel SPA rewrite
Supabase client/configuration
Database foundation
Google Workspace authentication
Employee allowlist
Employee identity
Protected routes
RLS

PHASE 2 - LEADS

Public consultation → Supabase
Lead assignment
Employee Overview
My Leads
Lead detail
Notes/activity
Follow-up dates

PHASE 3 - SALES

Customers
Deals
Convert Lead → Deal
Existing New Sale wizard → real data
Pricing
Document package

PHASE 4 - CONTRACTS

Google document templates
Generate contract
Store Google doc ID
Google eSignature workflow
Google Admin Reports webhook
SIGNED / DECLINED tracking

PHASE 5 - INVENTORY

Connect your PM API
Live models
Live availability

PHASE 6 - OPTIONAL

If Google's one manual eSignature step sucks:

Google provider → DocuSign provider
```

That's now the direction I would take.

And the Google discovery is actually good news: **we don't have to choose between "Google with zero integration" and "DocuSign."** We can automate most of Google's lifecycle; Google just doesn't currently appear to give us the API call needed to initiate the signature request itself.

For where CMAC is right now, I think that's worth trying before adding another paid service.

---

**Sources:**

- [Electronic Signature for Online Documents | Google Workspace](https://workspace.google.com/resources/esignature/?authuser=0&utm_source=chatgpt.com)
- [Drive Audit Activity Events  |  Admin console  |  Google for Developers](https://developers.google.com/workspace/admin/reports/v1/appendix/activity/drive)
- [Send signature requests & sign documents with eSignature - Google Docs Editors Help](https://support.google.com/docs/answer/12315692?hl=en&utm_source=chatgpt.com)

## Prompt:
8/20/2026, 6:08:54 PM

in response to "Google eSignature: yes, it can work — with one catch", lets not do the slow down of using google esignature.  instead. lets add the ability for the Employee/salesman to also have the option to send their leads/customers/potential clients premade or templated marketing flyers, detail PDF's, etc etc (all these will me templates or premade).  those will act as the line to pull the potentiual customer in, so when we do get to the part where we do need a legal digital signature (docusign) the odds of it getting signed and returned would be much higher since there was more and longer corrospondance.  also can I make one dedicated and paid DocuSign account for all employees so when a docusign is getting sent out (from any employee) , it will be coming from that one dedicated CMACcontainers.com  email address, but will be prefilled with the logged in employees name and hopefully some sort of "affiliate number" so we know how to delegate profits

## Response:
8/20/2026, 6:09:01 PM

> **Designing the signing workflow**
>
> I’m checking how DocuSign accounts, sender identities, templates, and custom fields can support this setup. I’ll distinguish a shared login from a central sending user, then map employee names and affiliate numbers for profit tracking.
>
> **Designed the signing workflow**
>
> 
>
> **Searching the web**
>
> [DSU Catalog V090619](https://support.docusign.com/resource/DSU_Customer_Training_Catalog)
> [How to set document visibility for envelope recipients | Docusign](https://developers.docusign.com/docs/esign-rest-api/how-to/set-document-visibility/)
>
> **Checking account details**
>
> I’m verifying DocuSign’s current account, sender, branding, and custom-field capabilities. I’m also distinguishing a central service account from shared employee credentials, since that affects security, licensing, and how affiliate attribution should be stored.
>
> **Checked account details**
>
> 
>
> **Searching the web**
>
> [Postman collections | Docusign](https://developers.docusign.com/tools/postman/)
> [Transforming](https://investor.docusign.com/files/doc_presentations/2021/03/1/Updated-DocuSign-IR-Presentation-2021-v5-Final.pdf)
>
> **Mapping the setup**
>
> I’m confirming that a central DocuSign sending identity can be paired with templates, employee attribution, and affiliate metadata. I’m also accounting for the email-sending side, where sender branding and employee identity may need separate handling.
>
> **Separating sender roles**
>
> I’m distinguishing DocuSign’s central signing identity from Gmail outreach. DocuSign can use one service sender with employee names and affiliate numbers attached as metadata, while marketing emails can use each employee’s mailbox or a branded shared address with replies routed appropriately.
>
> **Mapped the setup and separated sender roles**
>
> 
>
> **Searching the web**
>
> [CLM Go-Live | Docusign](https://developers.docusign.com/docs/clm-api/go-live/)
> [Docusign Developer API | Plans & Pricing](https://ecom.docusign.com/plans-and-pricing/developer?ipbr=1)
> [Electronic Signature: Fast & Easy e-Signature | Docusign](https://www.docusign.com/products/electronic-signature)
>
> **Verifying implementation choices**
>
> I’m checking current DocuSign and Google Workspace options before recommending purchases. The cleanest design appears to be one central DocuSign sender, with employee attribution captured separately and outreach sent through the appropriate mailbox identity.
>
> **Verified implementation choices**
>
> 
>
> **Searching the web**
>
> [How to set document visibility for envelope recipients | Docusign](https://developers.docusign.com/docs/esign-rest-api/how-to/set-document-visibility/)
>
> **Searched 2 websites**
>
> 
>
> Worked for 37s

Yes - I like this direction better.

Instead of jumping from **lead → contract**, we build the portal to help the salesman *work the lead first*. Then DocuSign becomes the closing tool, not the opening move.

## Add a Sales Materials / Marketing Library

I would add this directly to the employee portal:

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

Inside **Marketing Library**, we'd have approved CMAC material such as:

```text
Container Homes
├── General CMAC Brochure
├── 40ft Model Flyer
├── Floor Plan PDF
├── Specifications Sheet
├── Finish Options
├── Warranty Overview
└── Financing Information

Commercial
├── Workforce Housing Flyer
├── Bulk Housing Overview
├── Data Center / Jobsite Housing
└── Custom Commercial Spaces
```

Each item could have:

**Preview | Download | Send to Customer**

And from the customer/lead page:

```text
ACME Construction
John Smith
john@acme.com

[ Send Sales Material ]

Select:
☑ CMAC Overview
☑ Workforce Housing Flyer
☑ 40ft Specifications

Optional message:
"John, here are the materials we discussed..."

[ SEND ]
```

Then we record it in the customer's timeline:

```text
Aug 20
Jeff sent:
• CMAC Overview
• 40ft Specifications

Aug 22
Jeff sent:
• Financing Information
```

That history is exactly the kind of information that will make the CRM useful instead of decorative.

---

## I would have those marketing emails come from the salesman

This is where Google Workspace is extremely useful.

For normal sales correspondence, I'd prefer:

```text
FROM:
Jeff Smith <jeff@cmaccontainers.com>

TO:
customer@example.com
```

rather than everything coming from one generic address.

That way the customer develops an actual relationship with Jeff, replies go back to Jeff, and the correspondence remains naturally associated with the salesperson.

We can make the portal send those approved documents while still using the employee's Google Workspace identity.

So the salesman never has to:

> download PDF → open Gmail → attach PDF → find customer's email → type repetitive message → send

It's just:

**Customer → Send Material → Choose files → Send.**

---

# Then DocuSign becomes centralized

And yes - your idea here is basically exactly how I would do it.

I would **NOT buy DocuSign accounts for every salesman and have each person operate DocuSign individually.**

Instead, create one dedicated CMAC DocuSign sender identity, something like:

```text
agreements@cmaccontainers.com
```

or:

```text
contracts@cmaccontainers.com
```

with a display identity like:

**CMAC Containers Agreements**

Then the architecture becomes:

```text
Jeff logs into CMAC Portal
        ↓
Jeff works his lead
        ↓
Jeff sends brochures/spec sheets/etc.
        ↓
Customer progresses
        ↓
Jeff clicks SEND CONTRACT
        ↓
CMAC backend
        ↓
Dedicated DocuSign integration
        ↓
agreements@cmaccontainers.com
        ↓
Customer signs
```

The employees **never need the DocuSign password**.

The portal authenticates to DocuSign server-side through OAuth/API credentials and creates the envelope using that centralized sender. DocuSign explicitly supports internal application integrations, reusable envelope templates and API-driven sending. ([Docusign Developer Center](https://developers.docusign.com/get-started/api-integration/?utm_source=chatgpt.com))

That's cleaner and safer than six people sharing a DocuSign login.

---

# Yes, we can absolutely attach the salesman identity

This part is easy.

Every employee gets an internal ID such as:

```text
Jeff Smith

Employee ID:
8a719...

Sales Rep Code:
CMAC-JS-017
```

I would probably call it a **Sales Rep Code** rather than affiliate number since they're employees.

Then every important record carries that identity:

```text
Lead
sales_rep_id = Jeff

Customer
assigned_rep_id = Jeff

Deal
sales_rep_id = Jeff

Quote
sales_rep_id = Jeff

Contract
sales_rep_id = Jeff

DocuSign Envelope
sales_rep_code = CMAC-JS-017
```

DocuSign supports reusable templates and custom envelope/document data, so we can pass our internal tracking information along with the envelope. ([Docusign Developer Center](https://developers.docusign.com/html/newsletter/202401.html?utm_source=chatgpt.com))

The customer-facing contract could even contain:

```text
Your CMAC Representative

Jeff Smith
jeff@cmaccontainers.com
(555) 555-1234

Representative Code:
CMAC-JS-017
```

And the DocuSign email could say something like:

```text
CMAC Containers has prepared your agreement.

Sales Representative:
Jeff Smith

Project:
40ft Container Home

Reference:
CM-2026-00482
```

So even though **CMAC Containers** is the centralized legal sender, the transaction remains clearly Jeff's.

---

# But I would NOT use the rep code alone for commissions

This is worth designing correctly from day one.

I'd make Supabase the source of truth for sales attribution.

Something like:

```text
deals

id
customer_id

originating_rep_id
current_rep_id
closing_rep_id

commission_status
commission_amount
commission_percent

docusign_envelope_id
```

Why three rep fields?

Imagine:

```text
Jeff originally brings in lead
        ↓
Jeff goes on vacation
        ↓
Mike works the deal
        ↓
Jeff returns
        ↓
Mike actually closes it
```

If we only store:

```text
rep_code = Jeff
```

we've created ourselves a future argument.

Instead we have:

**Originating Rep** - who generated/received the opportunity  
**Current Owner** - who's responsible for it now  
**Closing Rep** - who actually closed the deal

Later, if CMAC decides:

```text
Originator = 25%
Closer = 75%
```

or:

```text
Original salesman always gets 100%
```

we can calculate it properly.

The DocuSign rep code is therefore an **audit/reference value**, not the only accounting mechanism.

---

# There is one DocuSign licensing caveat

The centralized architecture is technically fine, but we need to buy the **right DocuSign plan**.

A normal consumer/business eSignature subscription isn't automatically the same thing as production API access.

DocuSign currently has separate developer/API production plans. Their Starter developer plan begins around **$50/month billed annually and includes 40 API envelopes/month**, with higher tiers offering more volume/features. ([DocuSign E-commerce](https://ecom.docusign.com/plans-and-pricing/developer?ipbr=1&utm_source=chatgpt.com))

DocuSign specifically states that developer plans are intended for organizations sending envelopes through API calls and that a production plan with API access is required to move an integration live. ([DocuSign E-commerce](https://ecom.docusign.com/plans-and-pricing/developer?ipbr=1&utm_source=chatgpt.com))

So I would **not buy anything yet**.

We'll develop against DocuSign's free sandbox first.

When we're close to production, we determine:

```text
Expected contracts/month
        ↓
required API envelope volume
        ↓
cheapest appropriate production plan
```

No point paying $50-$300/month while we're still building.

---

# One small distinction about the email itself

I wouldn't promise that the customer's inbox will literally show:

```text
From: agreements@cmaccontainers.com
```

the exact same way a normal Gmail message does.

DocuSign delivers its own signing notification infrastructure.

What we *can* control is the CMAC sender account/branding, envelope subject/message, templates, sales representative information, project reference, and the actual contract contents.

So conceptually they'll see something equivalent to:

> **CMAC Containers has sent you an agreement through DocuSign**

rather than Jeff personally emailing an attachment.

That's actually what I prefer for legal documents.

It separates:

```text
SALES COMMUNICATION
Jeff Smith
jeff@cmaccontainers.com
```

from:

```text
LEGAL AGREEMENT
CMAC Containers
via DocuSign
```

Much cleaner.

---

# This creates a better sales funnel

The portal is now becoming:

```text
NEW WEBSITE LEAD
      ↓
Assigned to Jeff
      ↓
Jeff contacts customer
      ↓
Sends CMAC brochure
      ↓
Sends model specification
      ↓
Sends floor plan
      ↓
Adds notes / follow-up
      ↓
Creates quote
      ↓
Customer interested
      ↓
Creates deal
      ↓
SEND CONTRACT
      ↓
CMAC DocuSign account
      ↓
Customer signs
      ↓
SIGNED ✓
      ↓
Deal attributed to Jeff
```

That is considerably better than immediately turning every website submission into a pseudo-contract workflow.

And now we can actually measure the sales process:

```text
Jeff Smith

34 New Leads
28 Contacted
19 Marketing Packages Sent
14 Quotes Sent
8 Contracts Sent
6 Signed

Close Rate: 17.6%
```

That's where this portal starts becoming extremely useful to management.

---

## So I'd modify our roadmap slightly

```text
PHASE 1
✓ React Router
✓ Vercel routing
✓ Supabase
✓ Google-only login
✓ Employee identity / Rep Code
✓ Protected routes / RLS

PHASE 2
✓ Website → Leads
✓ Lead assignment
✓ Customers
✓ Notes
✓ Follow-ups
✓ Customer timeline

PHASE 3
NEW: Marketing Library
NEW: Send approved collateral
NEW: Email from salesperson
NEW: Track collateral sent

PHASE 4
✓ Quotes
✓ Deals
✓ Existing New Sale workflow
✓ Sales attribution

PHASE 5
✓ Dedicated CMAC DocuSign integration
✓ Templates
✓ Rep info populated automatically
✓ Rep Code / Deal ID metadata
✓ Webhook status tracking
✓ Signed contract archive

LATER
Your live inventory API
```

I think this is now a much stronger plan. The **marketing library becomes the bridge between acquiring the lead and asking them to sign a $50,000+ agreement**, while DocuSign stays centralized, professional, and trackable.

---

**Sources:**

- [API Integrations | Docusign](https://developers.docusign.com/get-started/api-integration/?utm_source=chatgpt.com)
- [Docusign Developer API | Plans & Pricing](https://ecom.docusign.com/plans-and-pricing/developer?ipbr=1&utm_source=chatgpt.com)

## Prompt:
8/20/2026, 6:38:55 PM

you said "I would have those marketing emails come from the salesman" and yes i 100% agree with you there, so lets do that!

you also said: "Later, if CMAC decides: Originator = 25% , Closer = 75%", which might be a thing later, but right now all we need to track is who sells what, we dont need to track or calculate the profits number and/or margins, just unit by unit..... "John Doe sold unit FW105".  thats all we need to know.

everything else looks spectacular!  if this is the plan you want to finalize, can you turn it into a really detailed, in depth, thorough and robust markdown instructional i can pass on to codex to get this done?

## Response:
8/20/2026, 6:39:03 PM

> **Creating a Codex brief**
>
> I’m turning the product description into a self-contained Markdown implementation plan. I’ll preserve the requested stack, screens, workflows, data model, validation rules, and deployment expectations so Codex can build from one precise source.
>
> **Created a Codex brief**
>
> 
>
> **Drafting the implementation guide**
>
> I’m structuring a rigorous Codex-ready brief with architecture, schema, routes, components, validation, DocuSign integration, security, testing, deployment, and acceptance criteria. I’ll make assumptions explicit and keep the existing design intact.
>
> **Finalizing Codex instructions**
>
> I’m defining the exact stack additions, architecture, database schema, authentication and access rules, lead lifecycle, Gmail/DocuSign workflows, routing, testing, and phased delivery plan so Codex can implement the app without altering the existing visual design.
>
> **Drafted implementation guide and finalized Codex instructions**
>
> 
>
> **Searching the web**
>
> [Postman collections | Docusign](https://developers.docusign.com/tools/postman/)
>
> **Refining data architecture**
>
> I’m keeping `contacts` as the canonical person record rather than creating duplicate lead or customer tables. I’m also adding a separate sales-record model so closed-unit attribution works even before inventory integration exists.
>
> **Defining sales attribution**
>
> I’m modeling one `unit_sales` record per sold unit, linking the deal, employee, external unit ID, and sale date. DocuSign will use one integration sender while preserving employee attribution within each deal.
>
> **Refined data architecture and defined sales attribution**
>
> 
>
> **Searching the web**
>
> [DocuSign](https://developers.docusign.com/html/newsletter/202011.html)
>
> **Validating email sending**
>
> I’m ensuring the server derives the sender from the authenticated employee, verifies contact ownership and active materials, sends through the employee’s Workspace identity, and records success or failure with message metadata.
>
> **Planning outbound email scope**
>
> I’m limiting version one to outbound Gmail sending and delivery records, not mailbox synchronization. I’ll include approved-material management, private attachments, employee signatures, and a setup guide for Workspace delegation.
>
> **Assembling the Codex brief**
>
> I’m consolidating the implementation requirements into one actionable Markdown specification, including current architecture, data contracts, workflows, integration boundaries, deployment steps, and acceptance tests.
>
> **Validated email sending and assembled the Codex outbound email brief**
>
> 
>
> **Searching the web**
>
> [Rewrite to index.html ignored for React + Vite SPA (404 on routes) - #3 by jacobparis - Help - Vercel Community](https://community.vercel.com/t/rewrite-to-index-html-ignored-for-react-vite-spa-404-on-routes/8412/3)
> [Programmatic Configuration with vercel.ts](https://examples.vercel.com/docs/project-configuration/vercel-ts)
>
> **Searched 1 website**
>
> 
>
> Worked for 2m 34s

Yes. I’ve locked the final decisions to match exactly what you just clarified: **marketing email comes from the logged-in salesman, no inventory database for now, and sales tracking is strictly unit attribution like “John Doe sold FW105” - no commissions, margins, or profit math.**

For the email system, I’m specifying **Google Workspace domain-wide delegation with only the `gmail.send` scope**. That lets the backend send as the authenticated employee without giving the browser Gmail credentials or making every salesman separately authorize Gmail access. Google explicitly supports Workspace domain-wide delegation for sending mail on behalf of organizational users, and Gmail exposes `users.messages.send` for this. ([Google Developers](https://developers.google.com/workspace/guides/create-credentials?utm_source=chatgpt.com))

I’m also basing the production pieces on current Supabase guidance around Google OAuth, RLS, Edge Function secrets, and protected server-side integrations; DocuSign’s internal-application/JWT/template/Connect model; and Vercel’s SPA rewrite requirement. ([Supabase](https://supabase.com/docs/guides/auth/social-login/auth-google?utm_source=chatgpt.com))

**document: **

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
> The current website design is approved and must be preserved. This is primarily a backend, routing, authentication, CRM, email, document, and workflow implementation project - **not a redesign project**.

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
Thanks - your project request has been received.
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

## Phase 1 - Infrastructure

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

## Phase 2 - Authentication

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

## Phase 3 - Leads

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

## Phase 4 - Marketing

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

## Phase 5 - Customers and Deals

1. Customers/contact pages.
2. Deals.
3. Deal units.
4. Refactor existing New Sale wizard.
5. Quotes.
6. Quote items.
7. Deal activities.

---

## Phase 6 - DocuSign

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

## Phase 7 - Sales Attribution

1. Mark Deal Sold action.
2. Require unit reference(s).
3. Create one `unit_sales` row per unit.
4. Units Sold dashboard.
5. Simple sales report.

---

## Phase 8 - Hardening

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
Demo complete - nothing was sent
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

The final system should feel like the existing CMAC website grew its own purpose-built sales operating system - not like a third-party CRM was bolted onto it.

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

---

**Sources:**

- [Create access credentials  |  Google Workspace  |  Google for Developers](https://developers.google.com/workspace/guides/create-credentials?utm_source=chatgpt.com)
- [Login with Google | Supabase Docs](https://supabase.com/docs/guides/auth/social-login/auth-google?utm_source=chatgpt.com)



---
Powered by [ChatGPT Exporter](https://www.chatgptexporter.com)