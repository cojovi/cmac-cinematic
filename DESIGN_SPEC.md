# CMAC Container Homes — Design & Implementation Spec

This branch is the public marketing and prototype sales workspace for **CMAC Container Homes**. Roofing is intentionally outside its product and navigation scope.

## Product Position

- Texas-built container homes and modular spaces.
- Primary audiences: residential buyers, workforce-housing operators, and commercial/custom-space clients.
- Primary conversion: start a project consultation.
- Secondary conversion: direct phone or email contact.
- Internal prototype goal: let sales representatives assemble a customer-ready unit sale package.

## Routing

- `/` is the canonical landing page.
- `/login` is the employee/client role gateway.
- `/employee-portal` is the demo sales-preparation workspace.
- `/client-portal` is the client experience coming-soon page.
- Legacy and unknown client-side paths normalize to `/` for backward compatibility.
- A lightweight History API view router handles these four routes; landing-page sections still use native anchors.

## Page Structure

1. Floating navigation with the active **Container Homes** home state.
2. Hero with the flagship lifestyle image, core positioning, quick specs, and consultation form.
3. Flagship 40ft model feature using the dedicated three-quarter product image.
4. Residential, workforce, and custom-space solution cards with embedded CMAC imagery.
5. Eight-state service area with a geographically accurate highlighted U.S. map.
6. Five-step container build process.
7. Flagship specification ledger.
8. Six-layer construction anatomy.
9. Real-world use cases.
10. Final project CTA and direct contact paths.
11. Compact brand/contact footer.

## Portal Structure

1. The public header exposes a dedicated **Login** tab on desktop and mobile.
2. The login gateway separates employee and client entry paths and labels the environment as a prototype.
3. Employee access accepts any non-empty email/password during testing and opens the sales workspace.
4. The employee workflow has four stages: unit selection, customer/site details, document package, and final review.
5. The review includes editable deposit and delivery assumptions, base pricing, customer data, and selected documents.
6. Preview and email actions are simulations; neither generates a PDF, stores customer data, nor transmits email.
7. The client route is a designed coming-soon page for future signatures, invoices, payments, and build updates.
8. The employee sidebar and compact mobile tab rail expose five working destinations: Overview, New Sale, Inventory, Documents, and Customers.
9. Overview presents a mock pipeline and actionable follow-ups; Inventory supports availability filters and unit-to-sale handoff; Documents supports search, category filters, previews, and package handoff; Customers supports search, record details, and customer-to-sale handoff.
10. Portal records, metrics, activity, availability, document versions, and customer values are intentionally fictional prototype data.

### Proposed sales document bundle

- Purchase Agreement
- Invoice & Deposit Schedule
- Configuration & Finish Schedule
- Site Readiness & Delivery Checklist
- Limited Warranty
- Change Order Policy
- Permit & Zoning Acknowledgment
- Payment Instructions
- Bill of Sale

All templates are placeholders until reviewed by legal counsel, accounting, insurance, and operations for every state served.

## Visual Direction

Premium industrial/editorial. The system combines cold charcoal steel, restrained red signal lighting, blueprint geometry, fine rules, and translucent metal/glass surfaces. Typography is deliberately split between:

- `Pirulen` for brand/display moments.
- `Outfit` for readable UI and body copy.
- System monospace for section coordinates, counts, and technical labels.

The signature gesture is a **blueprint/coordinate language**: section indices, corner marks, technical grids, outlined headline type, and measured red signal accents. Red is reserved for active states and conversion paths.

## Core Tokens

- Canvas: `#030506`
- Surface: `#0a0f12`
- Raised surface: `#11181d`
- Primary red: `#f22929`
- Light red: `#ff6260`
- Primary text: `#f4f6f7`
- Muted text: `#aeb9c0`
- Metallic border: `rgba(205, 224, 234, 0.16)`
- Panel radius: `18px` desktop, `13px` mobile

## Color Modes

- Dark mode remains the first-visit default and preserves the original cinematic CMAC presentation.
- Light mode uses architectural white, pale steel, graphite text, technical grid lines, and the same CMAC signal red.
- The hero, flagship model, and final CTA remain dark image-led anchor sections in both modes so photography and conversion contrast stay intentional.
- A machined two-position **Light / Dark** control appears in the public navigation, access headers, and employee portal. Mobile headers use the same control in a compact icon treatment; the public mobile menu exposes the fully labeled version.
- An explicit choice is stored under `cmac-color-theme`. System color preference is intentionally ignored so new visitors always begin in dark mode.
- The HTML theme attribute is applied before React loads to prevent a flash of the wrong color mode on returning visits.

## Interaction & Accessibility

- Semantic landmarks and one page-level `h1`.
- A keyboard-visible skip link and focus rings on every interactive control.
- Native, controlled input/select fields with explicit labels and appropriate mobile input modes.
- Mobile navigation exposes `aria-expanded` and `aria-controls` state.
- The portal stepper exposes current and completed states without relying on color alone.
- Demo action feedback uses an `aria-live` status message and the package preview uses a labeled modal dialog.
- Motion is limited to the hero image/copy/form entrance and is disabled by `prefers-reduced-motion`.
- Hover effects do not shift surrounding layout.
- Responsive targets: 375px, 768px, 1024px, and 1440px with no horizontal overflow.

## Consultation Behavior

The current site has no form API. Submission validates all fields and opens a prefilled email to `info@cmaccontainers.com`; the UI explains that behavior instead of implying a silent backend submission. Replace `submitConsultation` when a production lead endpoint is available.

## Product Images

- `public/minihomes-hero.png` — clean text-free container home photo (2048×876), used as the full-bleed landing hero.
- `public/minihomes-flagship.png` — the same 40ft Duo unit at a low three-quarter night angle, used only in the flagship model section so the two major image moments remain distinct.

Do not replace or cosmetically regenerate these two product images without explicit product approval. Current visual lock: dark horizontal wood siding, black metal frame, two black six-panel doors, high horizontal windows, red vertical corner LEDs, warm ground uplights, dual end-wall AC units, wet dark patio reflections, and a night setting.

The pre-black-door versions are preserved as `public/minihomes-hero-before-black-doors.png` and `public/minihomes-flagship-before-black-doors.png`.

### Solution card imagery

- `public/solutions/turnkey-living.jpg` - finished sleeping/living interior.
- `public/solutions/workforce-housing.jpg` - CMAC container production floor.
- `public/solutions/custom-spaces.jpg` - completed wood-clad exterior.

These are web-optimized derivatives of the supplied CMAC marketing library. The cards use real images, legible gradient overlays, compact icon badges, and a restrained hover sheen.

## Service Area Map

The map uses U.S. Census geography from `us-atlas`, rendered with `topojson-client` and `d3-geo`. Exactly eight states are active: Texas, Louisiana, Florida, Tennessee, Arkansas, Ohio, Oklahoma, and California. The state list remains the primary readable reference on small screens; the SVG supplies the geographic overview and labeled highlights.

## Verification

- `npm run lint`
- `npm run build`
- Browser checks at 375, 768, 1024, and 1440px.
- Verify mobile menu, login navigation, browser history, all employee workflow stages, demo feedback, legacy path normalization, no broken images, correct metadata, no runtime errors, and zero horizontal overflow.
