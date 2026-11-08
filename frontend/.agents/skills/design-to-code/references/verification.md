# Verification Playbook

Use this playbook for every nontrivial implementation and any claim of exact, pixel-close, production-ready, or Awwwards-level output.

## Contents

- Verification manifest
- Deterministic capture
- Visual correction loop
- Responsive and state validation
- Accessibility, performance, and build gates
- Readiness verdict
- Failure recovery
- Evidence handoff

## Verification manifest

Create one row per authoritative target:

| Route | Viewport/DPR | Theme/locale | State/scroll | Reference | Implementation | Diff/overlay | Largest mismatch | Result |
|---|---|---|---|---|---|---|---|---|
| `/` | `1440×900 / 1` | light/en | default/top | `<path>` | `<path>` | `<path>` | `<issue>` | pass/fail |

Do not compare screenshots taken under different routes, widths, DPRs, fonts, themes, content, or animation states.

## Deterministic capture

Stabilize:

- Browser engine and version when controllable.
- CSS viewport width and height.
- Device-pixel ratio and browser zoom.
- Font availability and completed font loading.
- Theme, color scheme, contrast mode, and reduced-motion setting.
- Locale, timezone, direction, and canonical content.
- Authentication/mock data and network-dependent states.
- Route, query, scroll position, open overlays, selections, and focus.
- Animation timeline, cursor position, caret, timers, random values, and current time.

Wait only for the actual app-ready condition. Avoid arbitrary sleeps when a deterministic element, font, asset, or state signal exists.

Capture:

- Full page for macro rhythm.
- First viewport for primary hierarchy.
- Component crops for typography, controls, and stubborn local differences.
- Before/after states for interaction and motion.

## Visual correction loop

Repeat for each authoritative target:

1. Render at the exact manifest conditions.
2. Capture the implementation.
3. Compare side by side.
4. Use transparent overlay, blink comparison, pixel diff, or heatmap when available.
5. Ignore isolated antialiasing noise; investigate coherent shapes and repeated offsets.
6. Classify the largest mismatch.
7. Measure the suspected root cause.
8. Fix one high-impact cause.
9. Recapture under identical conditions.
10. Update the manifest.

Correct in this order:

1. Wrong route, content, data, theme, or state.
2. Canvas, page shell, section order, section height, and container geometry.
3. Grid, alignment anchors, overlaps, sticky offsets, and dominant image placement.
4. Font files, real weights/styles, scale, measure, line height, tracking, baselines, and wrapping.
5. Image bounds, crop, focal point, mask, frame, and quality.
6. Spacing rhythm and repeated gaps.
7. Semantic colors, surfaces, borders, radii, shadows, texture, and depth.
8. Icons, dividers, optical offsets, and minor decoration.
9. Interaction states and motion timing.

Fix global causes before local symptoms. A wrong font, container, or asset crop can create dozens of apparent spacing errors.

Complete at least two deliberate comparison-and-correction passes for every nontrivial reconstruction. Continue while a normal viewer can immediately identify a material difference at the target size.

Do not require an arbitrary universal pixel-diff percentage. Browser rasterization, fonts, subpixel layout, and generated substitutions need project-specific tolerance. Record the remaining coherent differences instead.

## Responsive and state validation

Match supplied viewports first. Then test representative widths around the inferred system:

- Narrow mobile.
- Typical mobile.
- Tablet.
- Small laptop.
- Target desktop.
- One intermediate width.
- One ultra-wide width when relevant.
- Immediately below and above every breakpoint.
- One short viewport height.

At each applicable width verify:

- No unintended horizontal overflow.
- No clipped, covered, or unreachable content.
- Logical reading and focus order.
- Navigation transformation and safe-area behavior.
- Text wrapping, long labels, localized content, RTL, and zoom/reflow.
- Media crop and focal point.
- Sticky/fixed offsets and anchor links.
- Touch target size and coarse-pointer behavior.
- Mobile platform baseline from [interface-craft.md](interface-craft.md): no stuck hover, no tap flash, no input zoom, correct `svh`/`dvh`, safe-area padding. Mark hardware-only items as unverified when no real device is available.
- Container-query component behavior inside narrow and wide parents.

Exercise applicable states:

- Default, hover, focus, pressed, selected, disabled.
- Loading, skeleton, empty, partial, error, success.
- Open/closed, expanded/collapsed, active/inactive.
- Permission denied, offline, expired, destructive, and recovery.
- Long/short content, no image, slow media, and failed media.
- Reduced motion, high contrast/forced colors, and both themes.

### Worst-case content

Swap in realistic worst-case values, then re-check layout at the narrowest width and inside narrow parent containers. Use `example.com` or `.test` domains for fixtures.

| Field type | Values to try | Usually breaks |
|---|---|---|
| Names | `Aleksandra Wiśniewska-Kowalczyk`, `Jo`, `王秀英`, `نور الهدى عبد الرحمن`, missing name | Wrapping, initials, RTL, fallback |
| Unbreakable strings | `bartholomew.fitzgerald@northwind-industries-holdings.example.com`, long URLs, UUIDs, long file names | Row overflow without `overflow-wrap: anywhere` or deliberate truncation |
| Labels and copy | `Benachrichtigungseinstellungen`, French or German translations (about 30% longer), 12 tags, empty title, pasted 2,000-character text, `<script>` text | Label overflow, tag walls, collapsed rows, escaping |
| Numbers | `0`, `1`, `1284`, `1000000`, `-42.5`, `142%`, `null`, a live value changing `99` to `100` | Plurals, separators, badge width, bounds, jitter without `tabular-nums` |
| Collections | 0, 1, exactly a page, page plus one, 1,000+ items, one oversized item | Empty states, off-by-one pagination, render cost, stretched grids |
| Time | now, 12 days ago, 3 years ago, a future date, a timezone boundary | Relative-time thresholds, wrong day |
| Media | 404 avatar, no avatar, 4000×200 and 200×4000 images, dark logo on dark theme, slow image | Broken images, distortion, invisible logos, layout shift |
| Environment | 320px container, 280px sidebar placement, 2560px wide, 200% zoom, `dir="rtl"`, touch only | Overflow, stranded content, clipped text, mirrored icons, hover-only actions |

Fix what breaks, keeping the reference composition at its canonical content. Report anything left unhandled.
### Navigation

- Pointer, keyboard, and touch access.
- Active/current location.
- Mobile menu open/close, focus, scroll lock, and resize.
- Deep links, refresh, back/forward, and anchor offsets.

### Forms

- Labeling, input, validation, Enter submission, and inline errors.
- Double-submit protection.
- Input preservation after validation/network failure.
- Loading, success, failure, retry, and focus movement.
- No sensitive data exposed in logs or client-only mocks.

### Dialogs and drawers

- Open via pointer and keyboard.
- Initial focus, focus containment, Escape, explicit close, and focus return.
- Background isolation and scroll lock.
- Short-height and mobile reachability.

### Data and optimistic actions

- Loading, empty, partial, pagination, sorting, filtering, and no-result behavior.
- Stale-response protection under rapid changes.
- Pending state without visual jitter.
- Rollback or recovery after failure.
- Destructive consequence and undo where applicable.

## Accessibility gate

Verify applicable WCAG 2.2 AA behavior:

- Semantic landmarks and logical headings.
- Native interactive elements and accurate accessible names.
- Visible focus and logical tab order.
- Keyboard and touch completion of primary tasks.
- Form labels, descriptions, required state, errors, and status announcements.
- Dialog naming, containment, and focus return.
- Meaningful alternative text and decorative-image handling.
- Text/control contrast and non-color communication.
- Zoom, reflow, text resizing, long content, and orientation.
- Reduced motion, forced colors/high contrast, and media controls.
- No essential information available only through hover, motion, sound, or imagery.

Use automated checks as assistance, not proof. Complete a manual keyboard and primary-task pass.

## Performance and robustness gate

- Reserve image/video dimensions and inspect layout shift.
- Verify responsive image sizes and below-fold loading.
- Prioritize the real LCP asset without preloading everything.
- Confirm fonts, weights, styles, and subsets; prevent faux styles and avoidable font shift.
- Confirm through `document.fonts` that the intended faces rendered at every verified viewport, and that the fallback is metric-adjusted.
- Inspect script and dependency cost introduced by the implementation.
- Record a Performance trace during navigation, loading, and the main interactions. Check for dropped frames, long tasks, and per-frame re-renders, following [motion.md](motion.md).
- Inspect motion at 2 to 5 times duration or in the Animations panel for easing, origin, and property sync.
- Check layout thrashing, resize behavior, and reduced-motion and reduced-transparency setup.
- Check slow-loading, failed-asset, and no-JavaScript behavior when relevant.
- Confirm no runtime errors, hydration warnings, missing keys, or failed local requests.
- Check current Chromium and one Firefox or WebKit path when available and relevant.

## Project validation gate

Discover and run only relevant repository commands:

- Formatter or style validation.
- Lint.
- Typecheck.
- Unit/component tests.
- Integration/end-to-end tests.
- Production build.
- Repository-specific validation.

Fix failures caused by the implementation. Record unrelated baseline failures separately; do not weaken checks or rewrite unrelated work to manufacture a green result.

## Readiness verdict

Use exactly one:

### READY

All required targets, states, interactions, responsive checks, accessibility gates, project checks, and visual comparisons pass. Remaining differences are immaterial and intentional.

### READY WITH SUBSTITUTIONS

All implementation and validation gates pass, but authorized substitutions remain for assets, fonts, copy, browser behavior, or inaccessible source states. List each substitution and visible consequence.

### NOT READY

A required route, state, interaction, build check, accessibility requirement, or material visual mismatch remains. State the exact blocker and next action.

### UNVERIFIED

Implementation exists, but mandatory browser comparison or another evidence source was unavailable. Do not describe the result as exact or pixel-perfect.

## Failure recovery

When a target cannot be matched:

1. Identify whether the blocker is evidence, asset, font, content, browser, data, access, framework, or infrastructure.
2. Recheck supplied/project assets and the authoritative reference.
3. Repair the global cause before adding local overrides.
4. Use the closest authorized substitution while preserving visual role and layout metrics.
5. Keep a robust fallback for unsupported motion, effects, or media.
6. Record the remaining delta in the evidence ledger and manifest.
7. Downgrade the verdict honestly.

Do not hide defects with global `overflow: hidden`, screenshot overlays, excessive clipping, viewport-specific coordinate hacks, or vague handoff language.

## Evidence handoff

Return:

- Routes/components completed.
- Source mode and surface track.
- Manifest targets and comparison methods.
- Screenshot, overlay, or diff paths when available.
- Responsive widths, states, themes, and browser engines checked.
- Accessibility and primary-task checks completed.
- Exact repository commands and results.
- Asset/font/copy substitutions, including the font ledger.
- Checks that need real hardware and were not run.
- Readiness verdict and precise remaining deltas.

Keep the summary concise; preserve detailed evidence in artifacts or project notes when the task creates them.
