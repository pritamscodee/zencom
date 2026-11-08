# Motion Playbook

Use this playbook when a build adds, matches, tunes, or removes interaction and motion. In reference reconstruction, observed motion outranks every default below. Use the defaults only where evidence is silent.

## Contents

- Should it animate
- Pick the tool
- Pick the properties
- Easing, duration, and springs
- Interruption, origin, and exit
- Gestures
- Reduced motion and pointer gating
- Recipes
- Performance
- Restraint and removal
- Debugging
- Never ship
- Motion exit gate

## Should it animate

Decide before writing code. A decision to not animate is a valid result.

| How often the user sees it | Decision |
|---|---|
| 100+ times a day (keyboard shortcuts, command palette, focus jumps) | No animation |
| Tens of times a day (hover, list navigation, frequent toggles) | Near-imperceptible or none |
| Occasional (modals, drawers, toasts, menus) | Standard animation |
| Rare or first-time (onboarding, success, empty states, marketing hero) | Room for delight |

Never animate keyboard-initiated actions.

Name the purpose in one word before continuing:

- **Feedback:** the interface heard the user.
- **Spatial consistency:** where something came from or went.
- **State indication:** a state change made legible.
- **Preventing a jarring change:** content would otherwise teleport.
- **Explanation:** shows how something works (marketing and onboarding).
- **Delight:** only at the rare or first-time tier.

If no purpose can be named, do not build it. Data the user is reading or acting on should not move for style.

## Pick the tool

Use the cheapest tool that works. Extend the project's existing motion tokens and library instead of adding a parallel system.

| Need | Tool |
|---|---|
| Hover, press, color, class or attribute toggles | CSS transition |
| Entry on mount without JS state | CSS `@starting-style` (fallback: a `data-mounted` attribute) |
| Predetermined motion that must stay smooth while the page is busy | CSS animation |
| Programmatic control with CSS performance, no dependency | Web Animations API (`element.animate()`) |
| Springs, layout animation, exit animation, gesture-driven values | The project's motion library, or Motion when one is justified |

If the task needs a component rather than an animation (dialog, popover, menu, select, toast, drawer, command menu), use the project's accessible primitive or a proven headless library instead of hand-rolling focus and dismissal.

## Pick the properties

- Animate `transform` and `opacity` by default. `clip-path` and `filter` are acceptable with testing. Animate `height` only for accordions, where no transform equivalent exists.
- Never animate from `scale(0)`. Start from `scale(0.9)` to `scale(0.97)` combined with `opacity: 0`.
- Use percentage translates (`translateY(100%)`) for elements of unknown size.
- Swap expensive properties for cheaper equivalents:

| Instead of | Animate |
|---|---|
| `width`, `height`, `padding` to grow or shrink | `scale()` |
| `top`, `left`, `margin` to move | `translate()` |
| `display` or `visibility` swaps | `opacity` |
| `box-shadow` | `filter: drop-shadow()`, or opacity on a pseudo-element shadow layer |

- Never use `transition: all`. List the exact properties.

## Easing, duration, and springs

### Easing

| Situation | Easing |
|---|---|
| Entering or exiting | ease-out |
| Moving or morphing on screen | ease-in-out |
| Hover or color change | ease |
| Constant motion (marquee, progress fill) | linear |
| Default | ease-out |

Never use ease-in for UI motion. It delays the first frames, which is the moment the user watches most closely.

Built-in CSS curves are weak. Default tokens when the project has none:

```css
:root {
  --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
  --ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);
  --ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);
}
```

Do not invent curves. Take additional curves from a curated source such as easing.dev or easings.co.

### Duration

| Element | Duration |
|---|---|
| Button press feedback | 100 to 160ms |
| Tooltips, small popovers | 125 to 200ms |
| Dropdowns, selects | 150 to 250ms |
| Modals, drawers | 200 to 500ms |
| Marketing and explanatory motion | Can be longer |

Keep product UI motion under 300ms unless the reference proves otherwise. Make exits faster than entrances.

### Springs

Use springs for drag with momentum, gestures the user can reverse, elements that should feel alive, and decorative pointer tracking.

```js
{ type: "spring", duration: 0.4, bounce: 0 }    // default UI: no overshoot
{ type: "spring", duration: 0.4, bounce: 0.2 }  // only after a flick or throw
```

Keep bounce between 0 and 0.3. Add overshoot only when the gesture itself carried momentum.

## Interruption, origin, and exit

- Use CSS transitions, not keyframes, for anything a user can trigger twice in a second. Transitions retarget from the current value; keyframes restart.
- Use springs for gestures. They carry velocity through interruption.
- Never lock out input during a transition. Start new motion from the current on-screen value.
- Set `transform-origin` at the trigger for popovers, dropdowns, menus, and tooltips. Modals stay centered.
- Exit along the same path as the entrance.
- Use asymmetric timing where the user is deciding: slow on a deliberate press (hold to confirm, 2s linear), fast on release (200ms ease-out).
- Stagger group entrances by 30 to 80ms per item. Never block interaction while a stagger plays.
- After the first tooltip in a group opens, open neighbors instantly with no delay or animation.

## Gestures

- Give feedback on pointer-down, and update 1:1 with the pointer during the drag. Respect the grab offset.
- Use `setPointerCapture` once a drag starts. Ignore extra touch points mid-drag.
- Dismiss on velocity as well as distance, so a quick flick works.
- Apply increasing resistance past boundaries instead of a hard stop.
- Write drag values directly to the element's `transform`. Do not route them through a CSS variable on a parent or through React state.
- Use native scroll snapping (`scroll-snap-type`) for carousels before building a custom gesture.

## Reduced motion and pointer gating

Ship these with the animation, not as follow-ups.

```css
@media (hover: hover) and (pointer: fine) {
  .card:hover { transform: translateY(-2px); }
}

@media (prefers-reduced-motion: reduce) {
  .sheet { transition: opacity 200ms ease; transform: none; }
}

@media (prefers-reduced-transparency: reduce) {
  .toolbar { background: var(--surface); backdrop-filter: none; }
}
```

- Reduced motion means fewer and gentler animations, not zero. Keep opacity and color changes that aid comprehension. Remove slides, springs, parallax, and overshoot.
- Respect `prefers-reduced-transparency` and `prefers-contrast: more` on translucent surfaces.
- Avoid full-viewport moving backgrounds and slow looping oscillations.
- Content must stay visible if animation setup or JavaScript fails.

## Recipes

Adapt these starting points to the project's tokens.

```css
/* Press feedback for any pressable element */
.button { transition: transform 160ms var(--ease-out); }
.button:active { transform: scale(0.97); }

/* Popover, dropdown, menu */
.popover {
  transform-origin: var(--transform-origin);
  transition: opacity 200ms var(--ease-out), transform 200ms var(--ease-out);
}
.popover[data-starting-style],
.popover[data-ending-style] { opacity: 0; transform: scale(0.95); }

/* Modal: centered, backdrop fades with it */
.modal { transition: opacity 250ms var(--ease-out), transform 250ms var(--ease-out); }
.modal[data-starting-style],
.modal[data-ending-style] { opacity: 0; transform: scale(0.96); }

/* Drawer or sheet */
.drawer { transition: transform 500ms var(--ease-drawer); }
.drawer[data-closed] { transform: translateY(100%); }

/* Toast entry without JS */
.toast {
  transition: opacity 400ms ease, transform 400ms ease;
  @starting-style { opacity: 0; transform: translateY(100%); }
}

/* Marketing scroll reveal: fire once */
.reveal { clip-path: inset(0 0 100% 0); transition: clip-path 600ms var(--ease-in-out); }
.reveal[data-visible] { clip-path: inset(0 0 0 0); }
```

- When a crossfade shows two overlapping states, add `filter: blur(2px)` during the transition. Keep animated blur under 20px.
- For tab indicators with color changes, clip a duplicated active-state layer with `clip-path` instead of timing separate color transitions.
- For hold-to-confirm, fill a `clip-path` overlay with linear timing on press and snap back on release.

## Performance

The frame budget is 16.7ms at 60Hz and about 8ms at 120Hz. Design against the smaller number.

| Tier | Properties | Cost |
|---|---|---|
| Composite | `transform`, `opacity` (often `filter`, `clip-path`) | Cheapest |
| Paint | `box-shadow`, `border-radius`, `color`, `background` | Redraw every frame |
| Layout | `width`, `height`, `padding`, `margin`, `top`, `left`, `border-width` | Most expensive, moves neighbors |

- JavaScript `requestAnimationFrame` animation runs on the main thread and drops frames during navigation, hydration, or data loading. Use CSS or WAAPI for motion that plays while the page is busy.
- In Motion (Framer Motion), the `x`, `y`, and `scale` shorthands are not hardware-accelerated. Use a full `transform` string when the animation must survive a busy main thread.
- Never call `setState` every frame. Write to `ref.current.style` or a motion value.
- Changing an inherited CSS variable recalculates styles for every descendant. Suspect it when an animation degrades as content grows.
- Add `will-change: transform` only to the animating element and only after observing a one-pixel shift or measured dropped frames.
- Virtualize long lists instead of animating thousands of nodes.
- Confirm with a Performance panel recording, not by feel, and on a mid-range device when possible.

## Restraint and removal

Every animation must defend its place. Remove or reduce:

- Motion on keyboard actions and 100+ per-day surfaces.
- Fade-in-on-scroll applied to every section. On marketing pages, keep one hero entrance and reveals that explain something, fired once.
- Hover scale or lift on cards that are not the primary action.
- Infinite loops (pulsing badges, glowing borders, gradient orbs) on persistent elements.
- Charts that redraw from zero or numbers that count up on every mount instead of on a real change.
- Spinners and skeleton shimmer for operations that resolve in under 300ms.

Before deleting motion, also delete its hidden start state (`opacity: 0` initial values, reveal classes) and any code waiting on it (`transitionend`, `onAnimationEnd`, timeouts, exit callbacks), and move focus logic that ran after the animation.

## Debugging

- Play motion at 2 to 5 times its duration or in the DevTools Animations panel to check easing, origin, and property sync.
- Step frame by frame when a crossfade or coordinated property looks wrong.
- Test touch gestures on real hardware. Device emulation does not reproduce gesture feel.

## Never ship

| Never | Instead |
|---|---|
| `transition: all` | Named properties |
| `scale(0)` entrance | `scale(0.95)` with `opacity: 0` |
| ease-in on UI | ease-out or a strong custom curve |
| Animation on keyboard actions | No animation |
| Product UI motion over 300ms without a reason | 150 to 250ms |
| `transform-origin: center` on trigger-anchored popovers | Origin at the trigger (modals exempt) |
| Keyframes on rapidly triggered elements | Transitions |
| Layout-property animation | `transform` and `opacity` |
| Ungated `:hover` motion | `(hover: hover) and (pointer: fine)` |
| No reduced-motion path | Gentler variant, not zero |
| Content hidden until JavaScript animates it | Visible-by-default start state |

## Motion exit gate

Confirm:

- Every animation has a frequency tier and a named purpose, or was removed.
- Observed reference motion was matched before defaults were applied.
- Properties, easing, and durations follow this playbook or the project's existing tokens.
- Rapid triggers retarget smoothly, and gestures can be interrupted and reversed.
- Hover motion is pointer-gated, and reduced-motion and reduced-transparency paths exist.
- No new frame drops appear in a recording during navigation or loading.
- Content remains visible and usable with animation disabled or JavaScript failing.

Adapted from Emil Kowalski's design-engineering skills (github.com/emilkowalski/skills, MIT license) and Apple's fluid-interface guidance.
