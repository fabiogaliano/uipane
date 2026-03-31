// React adapter
export { usePane } from "./react/usePane.ts";
export { PaneRoot } from "./react/PaneRoot.ts";
export { useActiveTab } from "./react/useActiveTab.ts";

// Core store (for programmatic access)
export { PaneStore } from "./store.ts";

// Core mount (for non-React usage)
export { initPane } from "./mount.ts";

// Types
export type {
  SliderConfig,
  ToggleConfig,
  ActionConfig,
  SelectConfig,
  SelectOption,
  ColorConfig,
  TextConfig,
  SpringConfig,
  EasingConfig,
  FolderConfig,
  ControlConfig,
  PaneConfig,
  ResolvedValues,
  TransitionValue,
  PaneValue,
  PanelState,
  Preset,
  Corner,
  ControlMeta,
  ControlType,
} from "./types.ts";
