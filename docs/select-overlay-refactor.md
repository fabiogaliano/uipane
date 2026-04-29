# Select overlay refactor

## Context

`src/ui/Select.tsx` currently portals the select menu to `document.body` to avoid clipping and stacking issues in host apps.

Because the menu renders outside the pane's shadow root, it does not receive the shadow-scoped CSS from `src/styles.ts`. As a temporary fix, the overlay visuals are defined inline in `src/ui/Select.tsx`.

## Temporary TODO in code

See the inline comment above the dropdown `style={{ ... }}` block in:

- `src/ui/Select.tsx`

That comment explains why the inline styles exist and should remain until this refactor is done.

## Goal

Keep overlay rendering resilient across host apps **without** requiring inline visual styles.

## Preferred refactor

Introduce a dedicated overlay shadow host.

### Proposed structure

- primary host + shadow root
  - pane shell
  - panel content
  - normal shadow-scoped styles
- overlay host + shadow root
  - select dropdowns
  - future popovers / menus / tooltips
  - overlay-specific shadow-scoped styles

## Why this is cleaner

- preserves style encapsulation
- avoids global CSS leakage into `document.body`
- avoids inline style duplication
- keeps overlays free from panel clipping/overflow
- gives a clear place for all future floating UI

## Suggested implementation outline

1. Update `src/mount.ts` to create a second host for overlays.
2. Attach a shadow root to that overlay host.
3. Inject shared styles, or an overlay subset, into that shadow root.
4. Pass the overlay portal target through app state/props.
5. Render `Select` dropdowns into the overlay shadow root instead of `document.body`.
6. Move current inline dropdown/option visuals back into `src/styles.ts`.
7. Remove temporary inline-style comment from `src/ui/Select.tsx` once complete.

## Notes

- Keep current z-index ordering explicit between shell and overlays.
- Keep overlay positioning viewport-based.
- Consider reusing the same overlay host for presets and any future floating controls.
