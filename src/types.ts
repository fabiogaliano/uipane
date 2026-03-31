// ---------------------------------------------------------------------------
// Config types — what the user declares
// ---------------------------------------------------------------------------

export type SliderConfig = {
  type: "slider";
  value: number;
  min: number;
  max: number;
  step?: number;
};

export type ToggleConfig = {
  type: "toggle";
  value: boolean;
};

export type ActionConfig = {
  type: "action";
  label?: string;
};

export type SelectOption = string | { value: string; label: string };

export type SelectConfig = {
  type: "select";
  value?: string;
  options: SelectOption[];
};

export type ColorConfig = {
  type: "color";
  value?: string;
};

export type TextConfig = {
  type: "text";
  value?: string;
  placeholder?: string;
};

export type SpringConfig = {
  type: "spring";
  stiffness?: number;
  damping?: number;
  mass?: number;
  visualDuration?: number;
  bounce?: number;
};

export type EasingConfig = {
  type: "easing";
  duration: number;
  ease: [number, number, number, number];
};

export type TransitionValue = SpringConfig | EasingConfig;

export type FolderConfig<C extends PaneConfig = PaneConfig> = {
  type: "folder";
  open?: boolean;
  children: C;
};

export type ControlConfig =
  | SliderConfig
  | ToggleConfig
  | ActionConfig
  | SelectConfig
  | ColorConfig
  | TextConfig
  | SpringConfig
  | EasingConfig
  | FolderConfig;

export type PaneConfig = Record<string, ControlConfig>;

// ---------------------------------------------------------------------------
// Resolved value types — what usePane() returns
// ---------------------------------------------------------------------------

type ResolveControl<T extends ControlConfig> = T extends SliderConfig
  ? number
  : T extends ToggleConfig
    ? boolean
    : T extends SelectConfig
      ? string
      : T extends ColorConfig
        ? string
        : T extends TextConfig
          ? string
          : T extends SpringConfig
            ? TransitionValue
            : T extends EasingConfig
              ? TransitionValue
              : T extends FolderConfig<infer C>
                ? ResolvedValues<C>
                : never;

export type ResolvedValues<T extends PaneConfig> = {
  [K in keyof T as T[K] extends ActionConfig ? never : K]: ResolveControl<
    T[K]
  >;
};

// ---------------------------------------------------------------------------
// Internal control metadata (produced by config parser)
// ---------------------------------------------------------------------------

export type ControlType =
  | "slider"
  | "toggle"
  | "action"
  | "select"
  | "color"
  | "text"
  | "spring"
  | "easing"
  | "transition"
  | "folder";

export type ControlMeta = {
  type: ControlType;
  path: string;
  label: string;
  min?: number;
  max?: number;
  step?: number;
  children?: ControlMeta[];
  defaultOpen?: boolean;
  options?: SelectOption[];
  placeholder?: string;
};

// ---------------------------------------------------------------------------
// Store types
// ---------------------------------------------------------------------------

export type PaneValue =
  | number
  | boolean
  | string
  | SpringConfig
  | EasingConfig
  | ActionConfig;

export type PanelState = {
  id: string;
  name: string;
  controls: ControlMeta[];
  values: Record<string, PaneValue>;
};

export type Preset = {
  id: string;
  name: string;
  values: Record<string, PaneValue>;
};

// ---------------------------------------------------------------------------
// Shell types
// ---------------------------------------------------------------------------

export type Corner =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

export type CollapseOrientation = "horizontal" | "vertical";

export type CollapsedState = {
  corner: Corner;
  orientation: CollapseOrientation;
};

export type WidgetDimensions = {
  width: number;
  height: number;
  position: { x: number; y: number };
  isFullWidth: boolean;
  isFullHeight: boolean;
};

export type WidgetState = {
  corner: Corner;
  dimensions: WidgetDimensions;
  lastDimensions: WidgetDimensions;
  collapsed: CollapsedState | null;
};

export type TransitionMode = "easing" | "simple" | "advanced";
