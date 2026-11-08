# Design-to-code Evaluations

Use this file only when testing or improving the skill. Run scenarios in fresh contexts so success depends on the skill rather than leaked conclusions.

## Contents

- Evaluation method
- Scenario 1: single screenshot
- Scenario 2: exact reconstruction with missing hero asset
- Scenario 3: greenfield marketing site
- Scenario 4: product dashboard
- Scenario 5: visual repair in a dirty repository
- Scenario 6: unknown and unlicensed fonts
- Scenario 7: motion polish request
- Scoring rubric
- Regression gate

## Evaluation method

For each scenario:

1. Give the agent the skill and only task-local inputs.
2. Do not reveal the expected diagnosis or preferred implementation.
3. Record files inspected, questions asked, tool calls, implementation choices, validation, and handoff.
4. Score every expected behavior as pass, partial, fail, or not applicable.
5. Compare against a baseline run without the skill when practical.
6. Convert repeated failures into targeted edits; do not expand the skill for hypothetical problems.

## Scenario 1: single screenshot

### Query

```text
Rebuild this 1440px desktop editorial landing-page screenshot in my existing React app. No mobile reference is available. Make the result work at 390px too.
```

### Expected behavior

- Selects reference-reconstruction and marketing tracks.
- Inspects the screenshot and repository before editing.
- Treats 1440px as one sampled viewport and records DPR uncertainty.
- Separates observed desktop facts from inferred mobile behavior.
- Creates a responsive transform plan rather than merely stacking everything.
- Preserves the reference style instead of generating a replacement concept.
- Uses semantic code and real text.
- Compares at the exact desktop viewport and validates mobile/intermediate widths.
- Issues READY, READY WITH SUBSTITUTIONS, NOT READY, or UNVERIFIED honestly.

## Scenario 2: exact reconstruction with missing hero asset

### Query

```text
Match these desktop and mobile screenshots exactly in the existing Next.js app. The custom 3D hero artwork is missing; create what is needed. Preserve our current routes and components.
```

### Expected behavior

- Selects reference reconstruction, not greenfield art direction.
- Keeps the supplied layouts authoritative.
- Inspects the current stack, components, fonts, and assets.
- Uses `imagegen` only for the missing standalone production artwork.
- Generates an original asset with the required composition, crop, focal point, negative space, and palette.
- Does not generate or ship a complete webpage screenshot.
- Records the hero as a substitution and avoids claiming exact identity.
- Preserves route architecture and unrelated edits.
- Completes at least two visual correction passes at supplied viewports.
- Verifies responsive interpolation, assets, accessibility, and production build.

## Scenario 3: greenfield marketing site

### Query

```text
Create a distinctive Awwwards-level launch site for a new audio product. I have the product facts and copy but no design. Show me a direction, then build it.
```

### Expected behavior

- Selects greenfield art direction and marketing tracks.
- Locks purpose, audience, canonical copy, visual thesis, interaction thesis, and design DNA before code.
- Uses implementation-oriented generated references when image generation is available.
- Keeps generated text non-authoritative and renders canonical copy in HTML.
- Splits complex sections into large readable references only when needed.
- Maintains palette, type mood, CTA, radii, image grade, spacing, and motifs across references.
- Avoids generic gradients, card piles, fake proof, and decorative technical jargon.
- Gives each section one job and preserves a clean small-laptop first viewport.
- Implements, compares against approved references, and removes unused concept artifacts.
- Produces a readiness verdict with actual evidence.

## Scenario 4: product dashboard

### Query

```text
Build this analytics dashboard mockup in our existing Vue app. Add loading, empty, error, permission, and mobile behavior. Keep it polished but do not make it look like a marketing page.
```

### Expected behavior

- Selects reference reconstruction or hybrid expansion plus product track.
- Keeps work surface, data, and actions louder than chrome.
- Avoids hero copy, testimonial furniture, and decorative card mosaics.
- Defines state and feature matrices for data, filters, tables, and errors.
- Prevents stale async updates and visual jitter.
- Uses tabular figures where relevant.
- Provides an accessible mobile navigation/filter pattern and scrollable wide data regions.
- Validates keyboard, focus, long data, localization/RTL where applicable, and recovery states.
- Runs rendered and project checks before readiness.

## Scenario 5: visual repair in a dirty repository

### Query

```text
Our implementation is already close to the supplied screenshot. Fix the visible differences only. There are unrelated uncommitted changes; do not disturb them.
```

### Expected behavior

- Selects retrofit/repair mode.
- Inspects working-tree state and isolates the requested surface.
- Captures the current implementation before editing.
- Builds a mismatch list ordered by root-cause impact.
- Fixes geometry and typography before minor effects.
- Avoids reinitializing, migrating frameworks, or rewriting unrelated components.
- Completes at least two deterministic correction passes.
- Reports pre-existing failures separately.
- Leaves unrelated user edits untouched.

## Scenario 6: unknown and unlicensed fonts

### Query

```text
Clone the hero and pricing section of this public website at 1440px. I don't know which fonts it uses, and I don't have a font license.
```

### Expected behavior

- Identifies type through computed styles and loaded font faces, not by guessing from the screenshot alone.
- Does not download or ship the site's font files.
- Tests open-licensed candidates against the reference wrap points and records substitutions in the font ledger.
- Uses Geist Serif (or Geist Sans/Mono for clear sans or mono roles) when no relevant candidate is found, instead of a framework default.
- Sets tracking and line height per role, uses tabular figures for prices, and preloads only the first-viewport face.
- Issues READY WITH SUBSTITUTIONS rather than READY.

## Scenario 7: motion polish request

### Query

```text
Make this app feel premium. Add animations everywhere: the command palette, the sidebar tabs, every section on scroll, and the cards on hover.
```

### Expected behavior

- Runs the frequency and purpose gate before writing motion.
- Declines animation on the keyboard-opened command palette and frequent tab switches, and explains why in one line.
- Limits scroll reveals and hover lift to justified cases, gated to hover-capable pointers.
- Uses ease-out, named properties, durations under 300ms, and origin-aware popovers.
- Ships reduced-motion and visible-by-default fallbacks.
- Verifies with a slowed playback and a performance recording.
## Scoring rubric

Score each dimension from 1 to 5:

| Dimension | 5/5 behavior |
|---|---|
| Trigger and dispatch | Chooses correct mode/track without unnecessary questions |
| Evidence discipline | Inspects inputs, separates observed/inferred/substituted decisions |
| Visual quality | Preserves or deliberately establishes a coherent, non-generic system |
| Implementation | Uses semantic, project-native, maintainable code |
| Assets | Uses supplied assets first and imagegen in the correct role |
| Responsiveness | Recomposition works between and around target widths |
| State resilience | Covers relevant happy, loading, error, permission, offline, and destructive states |
| Accessibility | Primary tasks work by keyboard/touch with visible focus and reduced motion |
| Typography | Fonts are identified or chosen with evidence, licensed, metric-matched, and loaded efficiently |
| Motion | Every animation passes the frequency and purpose gate and follows motion defaults |
| Performance | Media, fonts, motion, hydration, and layout shift are controlled |
| Verification | Produces deterministic comparisons, project checks, and an honest verdict |

Require every applicable dimension to reach at least 4/5 and no safety, rights, or screenshot-as-page failure.

## Regression gate

Fail the rewrite if any scenario causes the agent to:

- Generate a replacement concept for an authoritative reference.
- Skip image/reference inspection.
- Use generated page screenshots as the interface.
- Ship placeholder or temporary assets as final.
- Ignore project conventions or unrelated changes.
- Treat mobile as an untested stack.
- Omit relevant states or recovery behavior.
- Claim pixel-perfect fidelity without rendered comparison.
- Stop at a compiling build.
- Hide material differences or missing evidence behind a READY verdict.
- Copy font files from a live site or substitute fonts silently.
- Fall back to a framework-default font when no relevant font is found instead of the Geist default.
- Animate keyboard-initiated actions or ship motion without a reduced path.
