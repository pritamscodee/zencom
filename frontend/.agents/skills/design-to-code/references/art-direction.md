# Art Direction Playbook

Use this playbook for greenfield art direction, hybrid expansion, controlled variants, or a request for a new premium/Awwwards-level visual direction without an authoritative composition.

## Contents

- Source-mode guard
- Direction brief
- Design DNA lock
- Image-first reference workflow
- Marketing and product direction
- Variant protocol
- Anti-generic design rules
- Art-direction exit gate

## Source-mode guard

Do not use this playbook to overwrite a supplied screenshot, Figma frame, or live reference.

- In **reference reconstruction**, derive art direction from evidence and skip generated page concepts.
- In **greenfield art direction**, generated visual references may define the composition after the brief is locked.
- In **hybrid expansion**, generate only missing sections, states, or viewports while preserving reference invariants.
- In **variant exploration**, hold content, data, route, viewport, and functional requirements constant while changing named visual decisions.

## Direction brief

Before generating or coding, lock:

- Purpose, audience, route, and desired user action.
- Canonical headings, supporting copy, labels, and primary CTA.
- Required sections, stateful components, media, proof, and final conversion or task outcome.
- Target viewports and the expected small-laptop first view.
- One-sentence visual thesis covering mood, material, and energy.
- One-sentence interaction thesis describing how motion should feel and what it should clarify.
- Rights and factual-identity constraints for people, products, locations, logos, and claims.

Do not generate copy as a way to avoid content decisions. Raster text is unreliable; canonical wording belongs in the brief and later in HTML.

## Design DNA lock

Choose one coherent answer for each axis, or define an equivalent direction. Avoid combining every option.

### Theme and atmosphere

- Light, dark, bold solid, or quiet neutral.
- Flat, softly graded, tactile, photographic, patterned, or material-rich background.
- Calm, energetic, editorial, technical, luxurious, playful, or austere tone.

### Typography character

- Grotesk, refined sans, expressive display, compressed statement, editorial serif/sans, or rational Swiss system.
- Maximum two type families by default.
- Define display/body contrast, weight range, line-length character, and numeral behavior.
- Avoid default system typography when inventing a premium direction unless utility or performance explicitly calls for it.

### Hero architecture

- Full-bleed visual plane.
- Asymmetric split.
- Editorial offset.
- Type-led statement.
- Image-led composition with restrained copy.
- Calm centered composition only when it is the intentional thesis, not the default.

### Section grammar

- Editorial alternation.
- Gallery-led cadence.
- Rational grid.
- Poster-like storytelling.
- Asymmetric marketing flow.
- Calm operational work surface.

Choose one dominant grammar and vary rhythm inside it. Do not repeat the same centered statement, identical card row, or left-copy/right-image split for every section.

### Signature system

Lock:

- One image grade and crop philosophy.
- One CTA family.
- One radius family.
- One depth strategy.
- One icon character.
- One spacing cadence.
- One to three signature visual motifs.
- One or two motion cues.

Signature motifs must support the concept. Do not add a fixed quota of marquees, floating cards, cursors, glows, or parallax effects.

## Image-first reference workflow

Use the `imagegen` skill for art-direction references when visual quality is central and no authoritative composition exists.

1. Establish canonical copy and the content plan.
2. Generate one readable overall direction or a representative first section.
3. Inspect composition, hierarchy, text-safe space, typography relationships, spacing, colors, material, media framing, component language, and inferred motion.
4. Reject the direction if it is generic, unreadable, internally inconsistent, or difficult to implement.
5. For a multi-section site, generate only as many additional references as improve decisions.
6. Use a large standalone reference for a visually distinct or complex section.
7. If a combined board makes text, buttons, or spacing too small to inspect, split it into section-level references.
8. If an important detail remains unclear, generate a fresh standalone rendering in the same design system.
9. Use crops for inspection only; do not promote a low-resolution crop into a new authoritative reference.
10. Keep palette, typography mood, CTA style, radii, spacing, icon character, image grade, and motifs consistent across every generated reference.
11. Record observed visual decisions and unresolved details.
12. Implement only when the references are readable, mutually consistent, and buildable.
13. Compare the coded result against the approved generated references using the normal verification workflow.

### Generated-reference rules

- Generate section compositions for decision-making, not as shippable page backgrounds.
- Keep page copy, controls, and navigation as real code in the implementation.
- Treat misspelled or invented raster text as noise.
- Prefer a fresh section render over endlessly regenerating the entire site.
- Use one consistent world across images rather than letting each call invent a new brand.
- Stop generating when the remaining decisions can be derived from the locked system.

## Marketing and brand direction

Use these defaults only when the brief/reference does not already decide the matter.

- Treat the first viewport as a poster: one dominant visual anchor, unmistakable identity, concise hierarchy, and one clear primary action.
- Keep the hero readable at the exact target and a representative small-laptop viewport.
- Prefer one focal point and a headline of roughly one to three lines.
- Count persistent header chrome against the hero's viewport budget.
- If using a full-height hero, account for `svh`/`dvh` behavior and persistent chrome.
- Give each section one job: explain, prove, deepen, demonstrate, compare, or convert.
- Default to cardless composition; use sections, columns, media, dividers, lists, and negative space before containers.
- Let brand, typography, cropping, rhythm, and contrast create distinction before decorative effects.
- Use one primary conversion path. Repeat the same CTA when helpful instead of inventing competing actions.
- Place credible proof near conversion points when authorized evidence exists.
- Never fabricate customers, logos, testimonials, metrics, awards, urgency, or product capabilities.
- Make mobile a separate composition with preserved identity and conversion intent, not merely a stacked desktop.

Create page rhythm by varying section density, scale, alignment, image-to-text ratio, background intensity, and visual tempo while keeping the design DNA locked.

## Product and operational direction

Use these defaults only when evidence is absent.

- Make the work surface louder than application chrome.
- Prefer utility copy over campaign language.
- Keep density calm, scan-friendly, and aligned to task frequency.
- Use color mainly for action, status, selection, and alert hierarchy.
- Separate location/context, view controls, page actions, and object actions.
- Avoid hero furniture, testimonial patterns, marketing CTAs, and decorative card mosaics inside authenticated work surfaces.
- Use cards only when the boundary communicates interaction, elevation, selection, or a distinct content type.
- Show loading, empty, error, permission, offline, destructive, and recovery behavior where applicable.
- Keep control dimensions stable and data comparable.
- Prefer boring, familiar controls for frequent work; place originality in composition, detail, and product-specific behavior.

## Variant protocol

Use variants only when the user requests options or selection would materially reduce risk.

1. Name the decision axis, such as `Hero composition`, `Surface depth`, or `Navigation model`.
2. Keep content, data, interactions, asset facts, and viewport identical.
3. Include the current design as the first baseline when one exists.
4. Vary one primary axis per comparison; do not make every option a different product.
5. Preview variants under identical browser conditions.
6. Summarize tradeoffs without declaring subjective taste as objective fact.
7. Ask for a selection when user preference is genuinely required.
8. Keep only the selected direction.
9. Delete rejected implementations, temporary switches, picker code, duplicate assets, and comparison-only comments.

## Anti-generic design rules

Unless the user or authoritative reference requires them, reject:

- Nested cards and box-inside-box hierarchy.
- Giant rounded wrappers around every section.
- Decorative pills, fake status tags, system markers, and technical jargon with no product meaning.
- Default blue-purple gradients, indiscriminate glow, and unstructured glassmorphism.
- Generic SaaS card grids as the first impression.
- Endless centered statements and cloned alternating split sections.
- Interchangeable stock imagery, meaningless abstract 3D objects, and imagery that competes with text.
- Excess font moods, random radii, mixed shadow strategies, and inconsistent image treatment.
- Generic claims such as `unleash`, `elevate`, `revolutionize`, `next-gen`, or `seamless` when concrete language exists.
- Fake metrics, names, testimonials, partner logos, dashboards, charts, or social proof.
- Motion added only to signal expense or novelty.

Delete aggressively. Use hierarchy, rhythm, contrast, alignment, crop, and whitespace before adding chrome.

## Art-direction exit gate

Proceed to implementation only when:

- Source mode is correct.
- Visual thesis and interaction thesis are coherent.
- Canonical copy and content sequence are locked.
- Design DNA decisions do not contradict each other.
- Generated references are large enough to inspect and mutually consistent.
- Unclear complex sections have a fresh standalone reference when needed.
- The first viewport works at the target and a small-laptop size.
- Marketing/product track rules match the actual surface.
- No generated page composition will ship as the interface.
- The design is distinctive without relying on generic AI decoration.
