# Typography and Fonts

Use this playbook whenever a build must identify, source, choose, substitute, load, or tune fonts. Type is usually the largest single source of visual mismatch: a wrong family, width, or fallback creates dozens of apparent spacing errors.

## Contents

- Font identification
- Licensing and sourcing
- Substitution workflow
- Greenfield font selection
- Default when no relevant font is found
- Candidate families
- Type system
- Loading and performance
- Font ledger
- Typography exit gate

## Font identification

Identify the real family before writing type CSS. Record the source of every answer.

### From Figma

Read exact values from the design context and variables: family, style name, weight, size, line height, letter spacing, paragraph spacing, text case, and OpenType features. Treat these as **observed**. Check whether the file uses local or licensed fonts the project does not have.

### From a live public site

Measure rather than guess:

- `getComputedStyle(el)` for `font-family`, `font-weight`, `font-style`, `font-size`, `line-height`, `letter-spacing`, `font-variation-settings`, `font-feature-settings`, and `text-transform` on each type role.
- `document.fonts` entries with `status === "loaded"` to see which faces actually rendered, as opposed to which were only declared.
- Network font requests to confirm family names, formats, and weights in use.
- The first family in the computed stack is not proof it rendered. Confirm with loaded faces.

Measuring computed styles is evidence gathering. Downloading the site's font files for reuse is not authorized unless the user owns or licenses them.

### From a screenshot or image

Compare distinguishing glyphs at the largest useful zoom:

- `a` and `g`: single-story or double-story.
- `G` spur, `R` leg, `Q` tail, `J` descender, `t` top, `y` tail, `f` hook.
- `1` flag, `0` shape, and whether numerals are lining or oldstyle.
- Terminals: horizontal, angled, or rounded. Aperture of `c`, `e`, `s`.
- Width, x-height relative to cap height, and stroke contrast.

Classify the family first (neo-grotesk, geometric, humanist, grotesk, slab, transitional serif, didone, monospace, compressed display), then narrow to candidates. Font-matching services can help, but only upload the image when the user has permitted sharing it.

State the result as **observed** only when the family is confirmed. Otherwise record it as **inferred** with the candidates considered.

## Licensing and sourcing

Use fonts in this order:

1. Fonts supplied by the user or already present in the project.
2. Fonts the user confirms they license (Adobe Fonts kit, commercial foundry license, brand package).
3. Open-licensed families (SIL OFL, Apache) from Google Fonts or Fontsource packages.
4. Free-license foundries (for example Fontshare) after reading the license file.
5. A system stack when performance or utility outweighs character.
6. Geist Serif as the default when nothing above is relevant (see below).

Never:

- Copy font files from a live site, a CDN the user does not control, or a design file export without a license.
- Ship a commercial font found online under a "free download" listing.
- Substitute silently. Every replacement is a **substitution** in the ledger.

Prefer self-hosting (`next/font`, Fontsource, or local `woff2` files) over third-party font CDNs when the project allows it.

## Substitution workflow

When the real family is unavailable:

1. Name the original family, classification, and the roles it fills.
2. Pick two or three open-licensed candidates that match classification, width, x-height, and the distinctive glyphs that appear in large display text. If no candidate is relevant, use the Geist default below.
3. Render each candidate in the actual headline, body paragraph, and navigation at the reference viewport.
4. Compare line breaks, line count, and measure first. Glyph shape matters less than wrap points.
5. Adjust `letter-spacing`, `font-size`, or `font-stretch` per role to restore the original wrap points. Record the adjustment.
6. Prefer a variable font with a width (`wdth`) or optical size (`opsz`) axis when width matching is hard.
7. Record the visible delta that remains and downgrade the verdict to READY WITH SUBSTITUTIONS.

Starting candidates for common commercial families. Always verify by wrap comparison:

| Original | Open-licensed starting candidates |
|---|---|
| Arial | Arimo, Liberation Sans (metric-compatible) |
| Helvetica, Neue Haas Grotesk | Inter, Inter Tight, Arimo |
| SF Pro | `system-ui` on Apple platforms, otherwise Inter |
| Times New Roman | Tinos, Liberation Serif (metric-compatible) |
| Georgia | Gelasio (metric-compatible) |
| Courier New | Cousine, Liberation Mono (metric-compatible) |
| Futura | Jost |
| Gotham | Montserrat |
| Garamond variants | EB Garamond, Cormorant Garamond |
| SF Mono, Menlo | JetBrains Mono, Geist Mono |

## Greenfield font selection

Choose type from the visual thesis, not from habit.

1. Decide the role set: display, heading, body, UI label, numeric, code. Most sites need two families at most, plus an optional monospace.
2. Choose the **body face first**. It carries reading, forms, and UI. Require a comfortable x-height, open apertures, real italics if the copy uses emphasis, tabular figures if the surface shows changing numbers, and the language coverage the content needs.
3. Choose a **display face** only if the body face cannot deliver the thesis. Create contrast on one axis (serif versus sans, width, or weight), not on all of them at once.
4. Match x-heights between paired families so mixed lines look aligned.
5. Use the display face only at sizes it was drawn for. Many display faces fall apart below 24px.
6. Check weight availability: the exact weights the design needs must exist as real files or variable-axis ranges.
7. Check language coverage (Latin Extended, Cyrillic, Greek, Vietnamese, CJK, Arabic) against current and planned locales.
8. Render the canonical headline and a body paragraph in two or three candidates before committing. Pick from rendered evidence, not specimen pages.

Product and operational surfaces default to one neutral sans plus a monospace for code or IDs. Use `system-ui` when speed and platform familiarity matter more than brand character.

Avoid when inventing a premium direction, unless the thesis calls for it:

- Default framework fonts used without a decision.
- Three or more expressive families on one page.
- A display face used for body copy or small UI labels.
- Fonts chosen only because they are trending.

## Default when no relevant font is found

When identification fails, no supplied or licensed font exists, and no candidate matches the reference or thesis, use **Geist Serif** as the default family. Do not fall back to framework defaults or a generic system stack.

- Use Geist Serif for display, headings, and body unless a role clearly needs another classification.
- When the reference clearly shows a sans or monospace role, keep the classification and use **Geist Sans** or **Geist Mono** from the same superfamily, so the system stays coherent.
- Record the choice as **substituted** (reconstruction) or as a deliberate default (greenfield) in the font ledger.

Installation:

- npm (recommended, full glyph set and `font-feature-settings`): `npm i geist`, then `import { GeistSerif } from 'geist/font/serif'` in the root layout. Apply its exported class name or CSS variable.
- Without npm or Next.js: self-host the `woff2` or variable files from the `vercel/geist-font` GitHub releases.
- Geist Serif is not on Google Fonts yet. Do not reference it through `next/font/google`.
- Geist Serif ships style variants (`GeistSerifRegular`, `GeistSerifSquare`, `GeistSerifTriangle`, `GeistSerifHeart`) and a variable file with the `ELSH` axis. Use the regular style unless the thesis calls for another.
- License: SIL OFL.
## Candidate families

Open-licensed or free-license starting points by character. Confirm the license and coverage before use.

| Character | Candidates |
|---|---|
| Neutral or neo-grotesk UI | Inter, Geist, Hanken Grotesk, Public Sans |
| Warm or geometric sans | Manrope, Figtree, Plus Jakarta Sans, DM Sans, Satoshi (Fontshare) |
| Grotesk with character | Space Grotesk, Schibsted Grotesk, Bricolage Grotesque, General Sans (Fontshare) |
| Expressive display | Syne, Unbounded, Clash Display (Fontshare), Familjen Grotesk |
| Compressed statement | Anton, Bebas Neue, Oswald, Big Shoulders Display, Archivo (width axis) |
| Editorial serif | Geist Serif, Fraunces, Newsreader, Instrument Serif, Source Serif 4, Playfair Display |
| Classical serif | EB Garamond, Cormorant, Libre Caslon Text, Crimson Pro |
| Monospace | JetBrains Mono, Geist Mono, IBM Plex Mono, Space Mono |

This list is a starting point, not a quota. The reference or brand always outranks it.

## Type system

Define roles as tokens: family, weight, size, line height, tracking, case, and feature settings per role.

When the reference is silent, start from these defaults and tune by rendering:

| Role | Line height | Tracking |
|---|---|---|
| Large display (48px and above) | 0.95 to 1.1 | -0.02em to -0.04em |
| Headings (24px to 48px) | 1.1 to 1.25 | -0.01em to -0.02em |
| Body | 1.45 to 1.7 | 0 |
| Dense product UI | 1.3 to 1.45 | 0 to 0.01em |
| Small uppercase labels | 1.2 to 1.4 | 0.02em to 0.08em |

Rules:

- Tracking is size-specific. One `letter-spacing` value for every size is wrong somewhere. Tighten large text, leave body near zero, open small uppercase text.
- Line height tightens as size grows.
- Build hierarchy from size, weight, and line height together. Emphasize with weight before adding size.
- Use a modular scale for marketing (ratio roughly 1.2 to 1.333) and a tighter scale for product UI (roughly 1.125 to 1.2). Preserve exact reference values over the scale in reconstruction.
- Use `clamp()` for fluid display sizes with a `rem` component so user text-size settings still scale.
- Cap body measure near `65ch` (45ch to 75ch range).
- Keep body text at 16px or larger on mobile, and form inputs at 16px or larger to avoid iOS zoom.
- Use `font-variant-numeric: tabular-nums` for changing numbers, prices, timers, and aligned columns.
- Use `font-optical-sizing: auto` with `opsz` fonts. Prefer `font-weight` and `font-stretch` over raw `font-variation-settings` for registered axes.
- Set `font-synthesis: none` (or per-axis equivalents) so missing weights and italics fail visibly instead of rendering faux styles.
- Use `text-wrap: balance` for short headings and `text-wrap: pretty` for prose where supported. Fix widows with measure and tracking, not `<br>`.
- Treat `text-box: trim-both cap alphabetic` as a progressive enhancement for optical vertical alignment where supported.
- Over translucent or busy backgrounds, raise contrast and weight slightly instead of using flat gray text.

## Loading and performance

- Ship `woff2`. Load only the families, weights, styles, and subsets the routes use.
- Prefer one variable font file over many static weights when three or more weights are used.
- Subset with `unicode-range` or tools such as `pyftsubset` or `glyphhanger` when the font is large and the content's character set is known.
- Preload only the one or two faces visible in the first viewport, with `crossorigin`. Preloading everything delays the LCP.
- Use `font-display: swap` with a metric-adjusted fallback for text that must appear immediately. Use `optional` for non-critical decorative faces.
- Build metric-adjusted fallbacks with `size-adjust`, `ascent-override`, `descent-override`, and `line-gap-override`. Compute the values with the framework (`next/font` does this automatically) or a tool such as Capsize or Fontaine. Do not guess them.
- Write the fallback stack with fonts that exist on target platforms, ending in a generic family.
- Verify no visible layout shift when the web font swaps in.

## Font ledger

Record one row per type role in the evidence ledger:

| Role | Reference family | Implemented family | Source/license | Weights/axes | Status | Wrap check |
|---|---|---|---|---|---|---|
| Display | `<family>` | `<family>` | `<source>` | `<weights>` | observed/inferred/substituted | pass/fail |

## Typography exit gate

Confirm:

- Every family is identified with a recorded source, or marked inferred with candidates.
- Every font is supplied, licensed, or open-licensed, and none was copied from a live site.
- When no relevant font was found, the Geist Serif default (or Geist Sans/Mono for clear sans or mono roles) was used instead of a framework default.
- Real files exist for every weight and style used. No faux bold or italic.
- Substitutions preserve wrap points at the reference viewport and are recorded.
- Tracking and line height are set per role, not globally.
- Only required faces load, the first-viewport face is preloaded, and the fallback is metric-adjusted.
- Rendered output uses the intended faces (`document.fonts` confirms them) at every verified viewport.
