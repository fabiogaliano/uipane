import * as react from "react";
import { ReactNode, createElement } from "react";

//#region src/types.d.ts
type SliderConfig = {
  type: "slider";
  value: number;
  min: number;
  max: number;
  step?: number;
};
type ToggleConfig = {
  type: "toggle";
  value: boolean;
};
type ActionConfig = {
  type: "action";
  label?: string;
};
type SlotConfig = {
  type: "slot";
  label?: string;
};
type SelectOption = string | {
  value: string;
  label: string;
};
type SelectConfig = {
  type: "select";
  value?: string;
  options: SelectOption[];
};
type ColorConfig = {
  type: "color";
  value?: string;
};
type TextConfig = {
  type: "text";
  value?: string;
  placeholder?: string;
};
type SpringConfig = {
  type: "spring";
  stiffness?: number;
  damping?: number;
  mass?: number;
  visualDuration?: number;
  bounce?: number;
};
type EasingConfig = {
  type: "easing";
  duration: number;
  ease: [number, number, number, number];
};
type TransitionValue = SpringConfig | EasingConfig;
type FolderConfig<C extends PaneConfig = PaneConfig> = {
  type: "folder";
  open?: boolean;
  children: C;
};
type ControlConfig = SliderConfig | ToggleConfig | ActionConfig | SlotConfig | SelectConfig | ColorConfig | TextConfig | SpringConfig | EasingConfig | FolderConfig;
type PaneConfig = Record<string, ControlConfig>;
type ResolveControl<T extends ControlConfig> = T extends SliderConfig ? number : T extends ToggleConfig ? boolean : T extends SelectConfig ? string : T extends ColorConfig ? string : T extends TextConfig ? string : T extends SpringConfig ? TransitionValue : T extends EasingConfig ? TransitionValue : T extends FolderConfig<infer C> ? ResolvedValues<C> : never;
type ResolvedValues<T extends PaneConfig> = { [K in keyof T as T[K] extends ActionConfig | SlotConfig ? never : K]: ResolveControl<T[K]> };
type ControlType = "slider" | "toggle" | "action" | "slot" | "select" | "color" | "text" | "spring" | "easing" | "transition" | "folder";
type ControlMeta = {
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
type PaneValue = number | boolean | string | SpringConfig | EasingConfig | ActionConfig;
type PanelState = {
  id: string;
  name: string;
  controls: ControlMeta[];
  values: Record<string, PaneValue>;
};
type Preset = {
  id: string;
  name: string;
  values: Record<string, PaneValue>;
};
type Corner = "top-left" | "top-right" | "bottom-left" | "bottom-right";
type TransitionMode = "easing" | "simple" | "advanced";
//#endregion
//#region src/react/usePane.d.ts
type UsePaneOptions = {
  onAction?: (path: string) => void;
};
declare function usePane<const T extends PaneConfig>(name: string, config: T, options?: UsePaneOptions): ResolvedValues<T>;
//#endregion
//#region src/react/PaneRoot.d.ts
type PaneRootProps = {
  children?: ReactNode;
};
declare function PaneRoot(props: PaneRootProps): ReturnType<typeof createElement>;
//#endregion
//#region src/react/PaneSlot.d.ts
type PaneSlotProps = {
  panel: string;
  path: string;
  children?: ReactNode;
};
declare function PaneSlot({
  panel,
  path,
  children
}: PaneSlotProps): react.ReactPortal | null;
//#endregion
//#region src/react/useActiveTab.d.ts
declare function useActiveTab(): string | null;
//#endregion
//#region src/store.d.ts
type Listener = () => void;
type ActionListener = (action: string) => void;
declare class PaneStoreClass {
  private panels;
  private listeners;
  private globalListeners;
  private snapshots;
  private actionListeners;
  private presets;
  private activePreset;
  private baseValues;
  private transitionModes;
  private slotNodes;
  private slotListeners;
  private activeTabName;
  private activeTabListeners;
  setActiveTab(name: string): void;
  getActiveTab(): string | null;
  subscribeActiveTab(listener: Listener): () => void;
  registerPanel(id: string, name: string, config: PaneConfig): void;
  updatePanel(id: string, name: string, config: PaneConfig): void;
  unregisterPanel(id: string): void;
  updateValue(panelId: string, path: string, value: PaneValue): void;
  getValue(panelId: string, path: string): PaneValue | undefined;
  getValues(panelId: string): Record<string, PaneValue>;
  getPanels(): PanelState[];
  getPanel(id: string): PanelState | undefined;
  subscribe(panelId: string, listener: Listener): () => void;
  subscribeGlobal(listener: Listener): () => void;
  setSlotNode(panelId: string, path: string, node: HTMLDivElement | null): void;
  getSlotNode(panelId: string, path: string): HTMLDivElement | null;
  subscribeSlot(panelId: string, path: string, listener: Listener): () => void;
  subscribeActions(panelId: string, listener: ActionListener): () => void;
  triggerAction(panelId: string, path: string): void;
  savePreset(panelId: string, name: string): string;
  loadPreset(panelId: string, presetId: string): void;
  deletePreset(panelId: string, presetId: string): void;
  clearActivePreset(panelId: string): void;
  getPresets(panelId: string): Preset[];
  getActivePresetId(panelId: string): string | null;
  getTransitionMode(panelId: string, path: string): TransitionMode;
  setTransitionMode(panelId: string, path: string, mode: TransitionMode): void;
  private initTransitionModes;
  private notify;
  private notifyGlobal;
}
declare const PaneStore: PaneStoreClass;
//#endregion
//#region src/mount.d.ts
declare function initPane(): () => void;
//#endregion
export { type ActionConfig, type ColorConfig, type ControlConfig, type ControlMeta, type ControlType, type Corner, type EasingConfig, type FolderConfig, type PaneConfig, PaneRoot, PaneSlot, PaneStore, type PaneValue, type PanelState, type Preset, type ResolvedValues, type SelectConfig, type SelectOption, type SliderConfig, type SlotConfig, type SpringConfig, type TextConfig, type ToggleConfig, type TransitionValue, initPane, useActiveTab, usePane };