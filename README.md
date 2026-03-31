# uipane

Floating dev panel library — drag, corner-snap, edge-dock collapse, polished controls. Shadow DOM isolated.

## Install

```bash
pnpm add uipane
```

## Usage

```tsx
import { usePane, PaneRoot } from "uipane";

function App() {
  const values = usePane("My Panel", {
    opacity: { type: "slider", value: 0.5, min: 0, max: 1, step: 0.01 },
    enabled: { type: "toggle", value: true },
    mode: { type: "select", options: ["fast", "slow"], value: "fast" },
    timing: {
      type: "folder",
      open: false,
      children: {
        delay: { type: "slider", value: 100, min: 0, max: 1000, step: 10 },
      },
    },
    reset: { type: "action", label: "Reset All" },
  }, {
    onAction: (path) => {
      if (path === "reset") console.log("reset!");
    },
  });

  // values.opacity: number
  // values.enabled: boolean
  // values.mode: string
  // values.timing.delay: number
  // (actions are excluded from return type)

  return (
    <>
      <PaneRoot />
      <div style={{ opacity: values.opacity }}>
        {values.enabled ? "ON" : "OFF"} — {values.mode}
      </div>
    </>
  );
}
```

## Controls

| Control | Config | Resolved type |
|---------|--------|---------------|
| Slider | `{ type: "slider", value, min, max, step? }` | `number` |
| Toggle | `{ type: "toggle", value }` | `boolean` |
| Action | `{ type: "action", label? }` | excluded |
| Select | `{ type: "select", options, value? }` | `string` |
| Color | `{ type: "color", value? }` | `string` |
| Text | `{ type: "text", value?, placeholder? }` | `string` |
| Spring | `{ type: "spring", stiffness?, damping?, mass?, visualDuration?, bounce? }` | `TransitionValue` |
| Easing | `{ type: "easing", duration, ease: [n,n,n,n] }` | `TransitionValue` |
| Folder | `{ type: "folder", open?, children: {...} }` | recursive |

## Shell behavior

- **Drag** header → free drag, corner-snap on release
- **Edge-dock** → drag 35%+ off-screen → collapses to edge tab
- **Expand** → drag collapsed tab inward
- **Resize** → handles on edges opposite to docked corner
- **Tabs** → multiple `usePane()` calls create tabs in one panel
- **Presets** → save/load/delete named presets
- **Copy** → copies values as AI prompt to clipboard
- **Persist** → position and collapse state saved in localStorage

## Programmatic access

```ts
import { PaneStore } from "uipane";

PaneStore.updateValue(panelId, "opacity", 0.8);
PaneStore.triggerAction(panelId, "reset");
PaneStore.savePreset(panelId, "My Preset");
```

## Non-React usage

```ts
import { initPane, PaneStore } from "uipane";

const cleanup = initPane(); // mounts shadow DOM panel
PaneStore.registerPanel("my-panel", "Controls", { ... });
```

## Architecture

- **Shadow DOM** — fully isolated, never breaks host app styles
- **Preact** — renders inside shadow root (bundled, ~22KB gzip)
- **React adapter** — `usePane()` hook via `useSyncExternalStore`
- **Framework-agnostic core** — `PaneStore` works without React
