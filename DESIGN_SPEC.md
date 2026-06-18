# CMAC Roofing Pixel Reconstruction Design Spec

Reference source: `/Users/cojovi/Downloads/Generated image 1.png`
Native reference size: `864 x 1821`
Verification target: browser screenshot at `974px` viewport width, desktop composition scaled from the reference.
-----
## Overall Layout

- Single long desktop page, centered on a black canvas.
- Reference has a compact poster rhythm: outer black gutters, then glass sections stacked with 10-14px vertical gaps.
- Main content width in the reference is roughly 790-820px inside an 864px image. At 974px verification width this becomes roughly 890-925px.
- Background is ultra-dark charcoal/black with dim blueprint/grid texture behind the hero and subtle smoky gradients between sections.
- All major sections are rounded dark glass panels with thin metallic borders, faint inner highlights, and soft red glows only around active CTAs or active process state.
- Desktop first. Mobile can stack gracefully, but the screenshot source of truth is the desktop/tall composition.

## Section Breakdown

| # | Section | Layout + Key Elements |
|---|---|---|
| 1 | Header/Nav | Rounded glass bar inset from top/left/right. CMAC ROOFING wordmark at left, nav links across center, phone pill, red Request Inspection button at right. |
| 2 | Hero | Left: giant two-line `CMAC ROOFING`, subtitle, body copy, two CTA buttons, trust badge row. Right/back: large roof/house render angled from upper center to lower right; inspection form card floats on far right. |
| 3 | Service Area | Glass panel. Left heading `Proudly Serving 6 States`, two-column state list. Center red-highlighted map. Right small local-teams card. |
| 4 | Services | Glass panel. Small label, headline, four equal image cards: Roofing, Gutters, Doors, Restoration. Each card has red outlined icon badge, dark image overlay, red link. |
| 5 | Process | Glass panel. Left label/title. Right five-step horizontal timeline with thin track line, circular numbered nodes, first node active with red glow, icons and captions below. |
| 6 | Credentials | Glass panel. Label/title and six compact logo cards: GAF, CertainTeed, IKO, Malarkey, Owens Corning, BBB. |
| 7 | Press Logos | Glass panel. Left title block `Recognized for Excellence`, right row of publication logos. |
| 8 | Reviews | Glass panel. Left title card, three review cards, small square carousel arrows at far left/right. Review cards use red stars, quote copy, circular avatar. |
| 9 | Final CTA | Wide stormy image panel. Left headline `Let's Protect What Matters.`, paragraph. Right dark floating benefit strip with three icons, button row. |
| 10 | Footer | Rounded glass footer. Logo, description, quick links, resources, contact, social circles, copyright/legal row. |

## Header/Nav Structure

- Header top offset: about 12px native, centered width about 810px native.
- Height: about 50px native.
- Border radius: 8px.
- Logo: red `CMAC`, white `ROOFING`, blocky sans.
- Nav links: `Services`, `Our Process`, `About Us`, `Locations`, `Resources`, `Careers`.
- Nav typography: very small, bold, white/gray, about 6-7px native; scaled to 8-9px at 974px.
- Phone pill: dark translucent rounded rectangle with phone icon and `(833) 262-3222`.
- Request button: red gradient rectangle, radius 9px, glow.

## Hero Layout

- Hero height from y ~68 to y ~465 native.
- Left content starts x ~43 native, y ~105 native.
- H1: `CMAC` and `ROOFING`, condensed/block uppercase, huge, white, slight shadow. Approx native 78px cap height, line-height ~0.82.
- Subtitle: bold white, 13px native, three short lines.
- Body: muted gray, 10px native, max width around 235px.
- Buttons: red primary and dark outlined secondary, same y, 126px/104px native widths.
- Hero visual: roofing house image fills center/right, dark edges blend into background, red roof accent visible.
- Form card: right side, x ~638 native, y ~112 native, w ~198 native, h ~343 native. Dark translucent blur, radius 10px, 6 stacked inputs and red full-width button.

## Inspection Form Layout

- Card background: rgba charcoal, frosted blur, bright top-left edge and darker bottom.
- Title uppercase `REQUEST INSPECTION`; subtitle `Fast. Free. No obligation.`
- Inputs: 166px native width, 31-33px height, 7px radius, semi-transparent charcoal, thin gray border, placeholder text gray.
- Service select has chevron. Date field has calendar glyph.
- Submit button: red gradient, 31px native height, radius 7px, strong red glow.
- Fine print centered under button.

## Badge Row

- Trust row at lower hero, x ~43 native, y ~404 native.
- Single dark glass strip, height ~48px native, width ~482px native.
- Four equal compact items separated by faint vertical lines.
- Each item has 27px outlined red icon square and two lines of small text.

## States/Map Section

- Panel x ~36, y ~474, w ~792, h ~193 native.
- Uses `states-section.jpg` as center/right visual layer.
- Left content overlays panel. Label red, title white.
- State list red bullet dots; two columns.
- Map labels `TX`, `OK`, `AR`, `TN`, `GA` are white over red states.
- Right card: narrow glass card with red outline location/teams icon, white copy, red link.

## Services Cards

- Panel x ~36, y ~678, w ~792, h ~239 native.
- Heading area inside panel, not separate page section.
- Four cards, each ~184x162 native, 8px radius, 1px border.
- Image fills card; text overlays bottom over black gradient.
- Red icon badge top-left, outlined/glowing, 34px native.
- Card copy is compact; links are red.

## Process Timeline

- Panel x ~36, y ~926, w ~792, h ~151 native.
- Left title block width ~190px.
- Timeline begins x ~243 native.
- Thin horizontal line through number circles.
- Five equal steps, active first node red with glow and a translucent red vertical panel behind first step.
- Icons are outline white/red inside circular dark rings.

## Credentials Row

- Panel x ~36, y ~1089, w ~792, h ~159 native.
- Heading at top-left.
- Six cards in a row, each ~121x81 native, dark surface, radius 5-6px.
- Logo text approximates brand colors and relative weight; do not replace order.

## Press Logo Row

- Panel x ~36, y ~1260, w ~792, h ~87 native.
- Left block title `Recognized for Excellence`; right aligned row of five white logos.
- Logos are large enough to be read but subdued, no card wrappers per logo.

## Reviews Section

- Panel x ~36, y ~1355, w ~792, h ~154 native.
- Left title card: label and `Real Reviews. Real Results.`
- Three review cards centered/right, each ~168x120 native.
- Cards have 5 red stars, quote, avatar/name/location.
- Carousel arrows are small rounded dark squares at left and right edge.

## Final CTA

- Panel x ~36, y ~1520, w ~792, h ~187 native.
- Background image storm/house/mountain fills panel with dark overlay.
- Left title and paragraph placed over image.
- Right floating glass strip: x ~389 native, y ~1544, w ~351, h ~124.
- Three benefits separated by vertical rules, red outline icons, then red and dark phone buttons.

## Footer

- Panel x ~36, y ~1718, w ~792, h ~103 native, rounded top/footer card.
- Logo at left, short description, link columns, contact, social icons.
- Bottom copyright and legal links separated by top border.

## Exact Color Palette

- Page black: `#020406`
- Main dark: `#070b0f`
- Panel dark: `#0c1217`
- Panel lighter glass: `rgba(27, 35, 42, 0.72)`
- Card dark: `rgba(15, 20, 25, 0.82)`
- Input dark: `rgba(35, 45, 53, 0.58)`
- White text: `#f7f8f8`
- Muted text: `#b8c0c7`
- Dim text: `#747f87`
- Red primary: `#f22929`
- Red deep: `#b81316`
- Red glow: `rgba(242, 41, 41, 0.46)`
- Border: `rgba(190, 209, 220, 0.18)`
- Strong border: `rgba(230, 240, 246, 0.28)`

## Approximate Font Choices

- Hero/logo/headlines: `Arial Black`, `Impact`, `Anton`-like condensed fallback. Use CSS `font-stretch` fallback where possible, heavy weight, tight line-height.
- Body/UI: `Inter`, `Arial`, system sans.
- Press logos: serif for Forbes/Entrepreneur/Inc approximations, bold sans for contractor/yahoo.

## Border Radius System

- Header/panels/footer: 8-10px native, scaled to 10-12px.
- Cards: 6-8px.
- Inputs: 7px.
- Buttons: 7-9px, not fully pill except phone/header secondary pills.
- Icon badges: 7-9px.

## Shadow/Glow System

- Global panel: inset white top highlight, dark outer shadow.
- Red buttons: red outer glow and subtle inset highlight.
- Active process node: red halo 0 0 18-24px.
- Cards: low black shadow, no bright lift.
- Background: dim blueprint/grid and radial red haze behind active areas.

## Card Background Styles

- All cards use semi-transparent charcoal with blur and a thin metallic border.
- Image cards use dark image with black bottom gradient and slight red highlight around icon.
- No bright clean surfaces, no large soft modern cards.

## Button Styles

- Primary red: linear gradient from bright red top-left to deeper red bottom, white bold compact text, small arrow icon, 7-9px radius, glow.
- Secondary dark: transparent charcoal fill, gray border, white text.
- Phone: dark translucent fill, white text, phone icon, rounded.

## Spacing Rules

- Outer page gutter at 974px: roughly 22-42px depending section.
- Section gaps: 10-14px, not large landing-page spacing.
- Inside panels: 20-26px.
- Cards gaps: 8-12px.
- Typography is dense; avoid extra leading and large margins.

## Responsive Notes

- Desktop reference is the source of truth. Build desktop first at 974px verification width.
- Below ~820px, stack hero/form/cards to avoid overflow while retaining the same dark/red visual system. Mobile is secondary and should not drive desktop spacing.

## Session: Mini-Homes Branch (2025-06-11)

### Routing
- Added `react-router-dom` with `/` (Roofing) and `/mini-homes` (Mini-Homes).
- Shared header component switches nav/CTA copy by variant.

### Header
- Roofing nav now includes **Mini-Homes** linking to `/mini-homes`.
- Mini-Homes nav uses mockup labels: Models, Our Process, About Us, Gallery, Resources, Contact.
- Mini-Homes phone/CTA: `(831) 262-3222`, Request Consultation.

### Mini-Homes Page Structure
Mirrors roofing section rhythm with container-specific content sourced from `minihomes-coming-soon.vercel.app`:
1. Hero — full-bleed `minihomes-hero.png`, consultation form, trust row (Texas Built, Flexible Layouts, Turnkey Quality, Delivery Available).
2. Flagship Model — 40ft modular specs panel (states-panel pattern).
3. Why CMAC — 3 service cards (Turn-Key Delivery, Workforce Housing, Modular Construction).
4. Process — 5-step build timeline.
5. Engineered Specs — 6 credential-style stat cards.
6. Anatomy — 6-layer build breakdown grid.
7. Coming Soon strip — 5-day build cycle + `cmaccontainers.com`.
8. Early Inquiries — review cards.
9. Launch CTA — waitlist CTA with mini-homes hero background.
10. Footer — Mini-Homes branding and contact.

### Assets
- `public/minihomes-hero.png` — clean text-free container home photo (1024×438). Full-bleed hero background with left/right readability gradients. Never use a UI mockup export that contains baked-in headline or form artwork.
