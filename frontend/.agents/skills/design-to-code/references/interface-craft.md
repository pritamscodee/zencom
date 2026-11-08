# Interface Craft

Use this playbook for nontrivial marketing or product surfaces, responsive recomposition, component/state design, typography, materials, dark mode, data-heavy controls, and interaction polish.

## Contents

- Track calibration
- Composition and semantics
- Typography
- Color, surface, and depth
- Component construction
- Polish details
- SVG-only iconography
- Responsive recomposition
- State and feature matrices
- Motion
- Dark mode and media
- Craft exit gate

## Track calibration

Apply these defaults only where the user and reference are silent.

### Marketing or brand

- Make identity and the primary action obvious in the first viewport.
- Give each section one job and one dominant visual idea.
- Keep headings scannable and supporting copy concise.
- Prefer open layouts, media, lists, dividers, and whitespace before cards.
- Use one primary CTA language across the page.
- Place authorized proof close enough to reduce conversion uncertainty.
- Preserve a strong finish; do not let quality collapse after the hero.

### Product or operational

- Make status, data, actions, and task context louder than chrome.
- Prefer compact utility copy and predictable controls.
- Keep information dense but calm and aligned.
- Use color for action, selection, status, and risk—not decoration everywhere.
- Separate global navigation, local navigation, view controls, page actions, and item actions.
- Avoid marketing heroes, campaign claims, testimonial furniture, and card mosaics inside work surfaces.
- Design loading, empty, error, permission, offline, destructive, and recovery states alongside the happy path.

## Composition and semantics

- Build one logical document order and change layout with CSS where possible.
- Use semantic landmarks, headings, lists, tables, forms, labels, links, and buttons.
- Use `<a>` for navigation/destinations and `<button>` for same-page actions.
- Use native behavior before recreating it with ARIA or JavaScript.
- Give every section a clear content purpose and alignment relationship.
- Use absolute positioning only for true layers, badges, overlays, and decorations.
- Keep decorative layers from intercepting pointer events or text selection.
- Treat embedded product screenshots, device screens, browser windows, charts, maps, and code editors as media unless internal reconstruction is explicitly in scope.
- Preserve route, URL, history, deep-link, and refresh behavior where interactions affect navigation.

## Typography

Follow [typography-and-fonts.md](typography-and-fonts.md) for font identification, licensing, substitution, selection, the Geist Serif default, loading, and per-role metrics. Core rules that apply on every surface:

- Use real supplied, licensed, or open-licensed font files for every weight and style. No faux bold or italic.
- Define display, heading, body, label, button, caption, code, and numeric roles as tokens.
- Set tracking and line height per role: tighten large text, keep body near zero, open small uppercase labels.
- Keep body copy at 16 CSS pixels or larger on mobile, and inputs at 16 CSS pixels or larger to avoid iOS zoom.
- Cap prose measure near `65ch`.
- Use tabular figures for changing metrics, prices, timers, and aligned data.
- Retest every wrap point after changing fonts, weights, tracking, or container width.

## Color, surface, and depth

Define semantic roles rather than isolated hex values:

- Canvas.
- Primary and secondary surfaces.
- Elevated surface.
- Recessed surface.
- Primary, secondary, and muted text.
- Border and divider.
- Accent and primary action.
- Success, warning, danger, and information.
- Focus and selection.

Prefer near-black and near-white over harsh extremes when inventing a palette. Tint neutrals toward the visual world instead of defaulting to framework gray/indigo scales.

Use the lightest grouping that communicates the relationship:

1. Whitespace and alignment.
2. Divider or subtle border.
3. Recessed well or tonal change.
4. Card or elevated surface.

Reserve cards for independent, interactive, selectable, elevated, or fundamentally distinct content. Do not card-wrap ordinary page sections for convenience.

Choose one primary depth strategy per view:

- Border-led.
- Tonal/tint-led.
- Soft shadow-led.
- Layered shadow-led.

Do not mix hard gray borders with heavy elevation indiscriminately. For elevated surfaces needing edge definition, prefer a subtle inset edge or ring consistent with the palette.

For nested rounded surfaces, preserve concentric geometry. Derive the inner radius from the outer radius and intervening padding rather than choosing unrelated values. Keep outer container padding at least as large as the gap between its children unless the reference proves otherwise.

Use inset outlines on photos/screenshots when edge separation is needed without changing layout dimensions.

For translucent materials (`backdrop-filter`), never stack a light translucent surface on another, give larger surfaces stronger blur and deeper shadow than small chips, raise text contrast and weight over blurred backgrounds, and provide a solid fallback under `prefers-reduced-transparency: reduce` and `prefers-contrast: more`.

## Component construction

- Reuse existing project components and design tokens first.
- Build dialogs, popovers, menus, selects, toasts, and command menus on the project's accessible primitives or a proven headless library. Do not hand-roll focus trapping and dismissal.
- Virtualize long lists and large tables instead of rendering every row.
- Extract repeated structure, behavior owners, and stable primitives.
- Keep one-off art-directed fragments local when abstraction would hide the composition.
- Keep external margins at call sites; reusable components should not secretly control page placement.
- Support the project's normal class/style override mechanism.
- Parameterize repeated structures by content and state rather than creating type-specific clones.
- Keep repeated visual states in one source of truth.
- Preserve stable dimensions when labels, counts, hover styles, errors, or loading text change.
- Avoid button text that shifts when an icon appears; reserve the state space or use an accessible overlay.
- Keep icons and fixed media from shrinking; allow flexible text/content to shrink and wrap correctly.
- If the project already uses Tailwind, use its existing formatter/canonicalizer for touched classes when available. Do not add or fetch a cleanup tool solely for this task.

## Polish details

Apply these where the reference is silent. They are small, but they compound.

- Give every pressable element press feedback on `:active` (for example `transform: scale(0.97)`), not only on hover.
- Keep avatars, icons, and logos at fixed size with `flex-shrink: 0`; use `object-fit: cover` for user images.
- Let long unbreakable strings (emails, URLs, IDs) wrap with `overflow-wrap: anywhere` or truncate deliberately, with the full value available.
- Pluralize with `Intl.PluralRules` ("1 member", "2 members"). Format numbers, currency, and dates with `Intl` for the active locale.
- Show relative time for recent events and switch to an absolute date after about a week.
- Fade gradients with eased color stops so the edge of the fade is invisible.
- Prefer a semi-transparent shadow or ring over a solid gray border for elevated surfaces.
- Prefer a scroll-edge fade or mask under sticky chrome over a hard 1px divider when floating UI overlaps content.
- Render user-generated data that contains emoji safely as data; the zero-emoji rule governs authored interface content and iconography.

## SVG-only iconography

Treat SVG icons and the absence of emoji as hard release requirements:

- Reuse the project’s SVG icon set before introducing new shapes. Libraries are acceptable only when they render real SVG markup.
- When an icon is missing, create a compatible inline SVG, `.svg` file, sprite symbol, or component with a stable `viewBox`.
- Keep stroke width, fill strategy, optical size, caps, joins, corners, and directional mirroring consistent across the set.
- Use `currentColor` for themeable monochrome icons. Reserve multicolor icons for intentional semantic or brand needs.
- Give decorative icons `aria-hidden="true"` and keep them unfocusable. Put the accessible name on an icon-only button or link; do not rely only on `<title>` inside the SVG.
- Keep unfamiliar, destructive, or high-consequence icons paired with visible text.
- Do not use emojis anywhere in the rendered website: not in copy, controls, bullets, navigation, badges, statuses, alerts, empty states, placeholders, cursors, metadata, or decoration.
- Do not use Unicode symbols/pictographs, icon fonts, CSS pseudo-element glyphs, raster files, or generated images as icon replacements.
- Replace emoji present in a reference with a semantically correct SVG or plain text, then document the substitution in the evidence ledger.
- Search source and rendered output for violations and replace them before the readiness verdict.

This rule covers interface icons. It does not require converting photographs or approved non-icon brand imagery to SVG.

## Responsive recomposition

For every section, record one or more transformations:

| Element | Narrow behavior |
|---|---|
| Layout | preserve / reflow / collapse / reorder |
| Media | crop / swap / simplify / hide |
| Navigation | disclosure / drawer / horizontal scroll |
| Density | reduce columns / increase touch spacing |
| Type | fluid / step down / constrain measure |

Rules:

- Choose breakpoints where content fails, not from device names alone.
- Use container queries when a component responds to allocated width; place the container close to that component.
- Collapse sidebars, filters, and secondary navigation instead of squeezing desktop columns.
- Provide an accessible mobile navigation/disclosure when desktop navigation disappears.
- Let tab bars scroll horizontally when their contents cannot fit.
- Put wide tables in an explicit horizontally scrollable region; keep headers readable and important columns discoverable.
- Apply `min-width: 0` to flexible children that must shrink below intrinsic content width.
- Apply `flex-shrink: 0` to icons, logos, avatars, fixed controls, and media that must keep size.
- Enlarge touch controls on coarse pointers rather than making mobile UI smaller.
- Keep primary body and form text readable at narrow widths.
- Use `svh`/`dvh` for full-height mobile layouts as described in the mobile platform layer below.
- Subtract persistent header height from full-height hero calculations or intentionally overlay the header.
- Reconfigure dividers, padding, radii, and first/last-item rules when column counts change.
- Avoid uneven orphaned items in logo clouds, card grids, and galleries.
- Test long labels, localized text, RTL, browser zoom, and text resizing.

### Mobile platform layer

Ship this baseline on mobile-facing routes unless the project already handles it:

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content" />
<meta name="theme-color" media="(prefers-color-scheme: light)" content="<top-of-page light color>" />
<meta name="theme-color" media="(prefers-color-scheme: dark)" content="<top-of-page dark color>" />
```

```css
html {
  -webkit-tap-highlight-color: transparent;
  -webkit-text-size-adjust: 100%;
}
input, textarea, select { font-size: 16px; }
button, a, [role="button"] { touch-action: manipulation; }
button, [role="button"], .tab, .chip { user-select: none; -webkit-user-select: none; }
```

- Never disable zoom with `user-scalable=no` or `maximum-scale=1`. Fix input font size instead.
- Use `100svh` for heroes and first screens, `100dvh` for app shells and bottom-pinned UI. Avoid `100vh` for either.
- Pad fixed headers, bottom bars, sheets, and toasts with `env(safe-area-inset-*, 0px)`. The values are zero without `viewport-fit=cover`.
- Gate every `:hover` style behind `(hover: hover) and (pointer: fine)`, and give touch users `:active` feedback instead.
- Use `overscroll-behavior: contain` on inner scroll regions (sheets, chat lists, sidebars). Use `none` on the root only for app-like surfaces where pull-to-refresh is unwanted.
- Declare gesture axes with `touch-action` (`pan-y` on a horizontal carousel, `none` only on surfaces that own every axis). Prefer native `scroll-snap` carousels.
- Set the right keyboard with `type`, `inputmode`, `autocomplete`, `autocapitalize`, and `enterkeyhint`.
- Keep `user-select: none` off body content. Users copy addresses, codes, and error messages.
- Detect capability with media queries, never with user-agent sniffing.
- Device emulation does not reproduce sticky hover, tap highlight, URL-bar height changes, input zoom, safe areas, or the software keyboard. Verify on real hardware when available, and report what could not be verified.

## State and feature matrices

Create only the applicable rows.

### Universal state matrix

| State | Visual | Behavior | Accessibility | Recovery |
|---|---|---|---|---|
| Default | baseline | ready | name/role/value | n/a |
| Hover | pointer feedback | no hidden-only action | hover-capable only | n/a |
| Focus | visible focus | keyboard action | logical order | n/a |
| Pressed/selected | stable dimensions | correct state | state announced | toggle/reselect |
| Disabled | clear reason | blocked safely | disabled semantics | explain enablement |
| Loading | reserved space | prevent duplicate work | status announced | cancel/retry if needed |
| Empty | purposeful empty view | next action | readable structure | create/import/reset |
| Error | local and summary feedback | preserve input | error association | retry/correct |
| Success | confirmation | next logical action | status announced | undo when useful |
| Offline/permission | distinct limitation | safe degradation | clear explanation | reconnect/request access |
| Destructive | consequence visible | deliberate confirmation | focus restored | undo/rollback when possible |

### Forms

- Associate visible labels, descriptions, errors, and required state.
- Support Enter submission where conventional.
- Prevent accidental double submission.
- Preserve values through validation and recoverable network errors.
- Move focus to the first actionable error or provide a clear error summary.
- Never clear a form on failed submission.

### Dialogs and drawers

- Name the surface accessibly.
- Move focus inside on open, contain focus only while modal, and restore focus on close.
- Support Escape when safe and provide an explicit close action.
- Prevent background interaction and unwanted scroll only while open.
- Keep critical actions reachable at short viewport heights.

### Data lists and tables

- Design loading, empty, partial, error, pagination, filtering, sorting, long values, and no-result states.
- Avoid stale asynchronous results replacing newer user intent.
- Preserve selection and filters when recovery makes sense.
- Keep row/item actions discoverable by keyboard and touch.

### Optimistic and destructive actions

- Show the pending state without shifting layout.
- Roll back on failure or provide a clear recovery path.
- Distinguish reversible and irreversible consequences.
- Avoid optimistic behavior for actions whose failure would create dangerous ambiguity.

## Motion

Follow [motion.md](motion.md) for the animate-or-not decision, tool choice, properties, easing and duration tokens, springs, gestures, recipes, performance, and removal. Never ship `transition: all`, `scale(0)` entrances, ease-in on UI, animation on keyboard actions, ungated hover motion, or motion without a reduced path.

## Dark mode and media

- Derive dark semantic roles; do not mechanically invert colors.
- Reduce large bright surfaces and re-evaluate shadow/border depth.
- Preserve contrast, focus, status meaning, and brand identity in both themes.
- Check SVGs, logos, screenshots, photos, diagrams, and raster artwork for theme assumptions.
- When a raster asset needs a true dark variant, read and follow the `imagegen` skill; save the variant beside the original and wire it through the project's theme mechanism.
- Set `theme-color` per color scheme to match the top of the page, and ease large dark/light switches instead of flashing.
- Verify both themes at desktop and mobile, including loading/error states.

## Craft exit gate

Confirm:

- Track defaults fit the actual surface.
- Semantics, link/button choice, focus order, and embedded-media scope are correct.
- Typography passes the [typography-and-fonts.md](typography-and-fonts.md) exit gate.
- Surface hierarchy uses the lightest sufficient boundary and one coherent depth strategy.
- Cards, radii, shadows, and colors have explicit reasons.
- Components preserve layout and dimensions across states.
- Responsive behavior is intentional at component and page levels.
- Applicable failure, recovery, localization, RTL, and destructive states exist.
- Motion passes the [motion.md](motion.md) exit gate.
- Mobile platform baseline is in place and hardware-only checks are reported.
- Dark mode and media variants are verified where requested.
