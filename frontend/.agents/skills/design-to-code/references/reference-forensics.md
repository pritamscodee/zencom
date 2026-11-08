# Reference Forensics

Use this playbook for screenshots, Figma exports, live public websites, multiple viewport references, or repair work against a visual target.

## Contents

- Reference inventory
- Image and frame analysis
- Live-site analysis
- Evidence ledger
- Fidelity contract
- Ambiguity resolution
- Forensics exit gate

## Reference inventory

Map every source before editing:

| Source | Route | Viewport/DPR | Theme | State | Scroll | Authority |
|---|---|---|---|---|---|---|
| `<file or URL>` | `<route>` | `<w × h / DPR>` | `<mode>` | `<state>` | `<position>` | primary/supporting |

Record unknown values rather than inventing certainty.

Classify each reference as:

- Full page.
- Page section.
- Component.
- Embedded media.
- State or interaction sample.
- Motion sample.
- Design-system or brand reference.

Do not wrap a cropped section in page-level structure or rebuild the internal controls of embedded media unless the requested scope includes them.

## Image and frame analysis

Inspect every image at the highest useful detail.

### Canvas and composition

- Pixel dimensions, probable CSS viewport, device-pixel ratio, and browser chrome.
- Visible fold, page boundaries, full-bleed regions, and contained regions.
- Container edges, gutters, columns, grid gaps, and alignment axes.
- Section boundaries, approximate heights, and recurring vertical rhythm.
- Overlaps, fixed/sticky elements, clipping, masks, and z-order.
- Relationship of each element to viewport, container, grid, sibling, image edge, or baseline.

### Typography

- Family and classification.
- Real weight/style availability versus faux bold or italic.
- Variable font axes and OpenType features when visible or supplied.
- Size, line height, tracking, case, measure, wrap points, widows, and orphans.
- Cap-height, x-height, numeral style, and optical alignment clues.
- Display/body contrast and fallback metric risk.

Treat text as geometry. Repair font metrics and width constraints before inserting forced line breaks.

### Color and material

- Semantic roles: canvas, surface, elevated surface, text, muted text, border, accent, action, status, and destructive.
- Solid colors, gradients, tint, opacity, blend, texture, noise, blur, and backdrop effects.
- Border width/contrast, radius families, shadows, inset edges, and depth hierarchy.
- Whether apparent color differences come from overlays, compression, antialiasing, or true token changes.

### Imagery

- Asset role and likely source type.
- Aspect ratio, crop, focal point, negative space, object position, and masking.
- Edge treatment, frame, radius, outline, overlay, blend, tint, and responsive variant.
- Whether a screenshot/device/browser frame is media or part of the requested UI.

### Components and states

- Header, navigation, hero, lists, cards, forms, tables, media, CTA, and footer.
- Default, hover, focus, pressed, selected, disabled, loading, empty, error, success, and expanded states.
- Content length, count, validation, permission, and destructive-action clues.

## Live-site analysis

Read and follow the `control-browser` skill before browser interaction.

At each authoritative viewport:

1. Set 100% zoom and record viewport and DPR.
2. Capture the first viewport and full page.
3. Scroll through every requested section.
4. Record sticky thresholds, background transitions, and reveal triggers.
5. Exercise navigation, menus, dialogs, tabs, accordions, carousels, forms, and route transitions.
6. Inspect hover, focus, pressed, selected, loading, error, and success states.
7. Compare desktop, tablet, mobile, short-height, and wide behavior where available.
8. Record motion trigger, start/end, duration, easing, delay, sequence, loop, interruption, exit, and reduced-motion behavior.
9. Inspect representative short, long, empty, and failure content states when accessible.

Use the page only as visual and behavioral evidence. Do not copy minified implementation, private APIs, trackers, analytics, cookies, secrets, or unknown scripts.

## Evidence ledger

Maintain a compact ledger for material decisions:

| Element | Status | Source | Decision | Validation |
|---|---|---|---|---|
| Hero container | observed | desktop reference | `max-width: …` | overlay pass |
| Mobile nav | inferred | desktop only | disclosure menu | keyboard/mobile check |
| Display font | substituted | font unavailable | metric-compatible font | wrap comparison |

Use only these statuses:

- **Observed:** directly visible, measured, or supplied.
- **Inferred:** not visible but derived from relationships or conventional behavior.
- **Substituted:** replaced because of rights, availability, accessibility, or technical limits.

For each substitution, record why the original could not be used and what visible delta remains.

## Fidelity contract

Convert evidence into an implementation contract:

- Target routes, viewports, themes, states, and scroll positions.
- Semantic page regions and component ownership.
- Container, grid, section rhythm, and layer relationships.
- Type families, real files, scale, measures, line behavior, and fallbacks.
- Semantic color tokens, surface hierarchy, radii, borders, and one depth strategy.
- Asset list with rights, source, dimensions, crop, focal point, and responsive treatment.
- Responsive transform per section: preserve, reflow, collapse, reorder, crop, simplify, or hide.
- Functional and state requirements.
- Motion specification and reduced path.
- Acceptance evidence required for every authoritative target.

Do not begin detailed styling until the contract explains the major geometry and dominant visual system.

## Ambiguity resolution

Resolve missing detail in this order:

1. Preserve explicit requirements.
2. Preserve observed design invariants.
3. Preserve layout and spacing relationships.
4. Preserve component family and interaction meaning.
5. Preserve mood, material, and polish level.
6. Inspect another supplied source or visible live state.
7. In authorized hybrid work, generate a fresh detail/section reference.
8. Choose the most implementation-friendly faithful option.

Use a crop or zoom to inspect existing evidence. Do not treat a low-resolution crop as a newly authoritative design reference.

Ask the user only when the ambiguity changes scope, architecture, sensitive behavior, rights, or a subjective direction they must choose.

## Forensics exit gate

Before implementation, confirm:

- Every source has route, viewport, theme, state, and authority metadata where known.
- Images were inspected visually at useful detail.
- Live interactions were exercised when relevant and accessible.
- Major geometry, typography, material, imagery, states, and motion are understood.
- Embedded media is not accidentally in implementation scope.
- Observed, inferred, and substituted decisions are separated.
- The fidelity contract is concrete enough to build and later verify.
