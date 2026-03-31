import { flattenValues, parseConfig } from "./config.ts";
import type {
  PaneConfig,
  PaneValue,
  PanelState,
  Preset,
  TransitionMode,
} from "./types.ts";

type Listener = () => void;
type ActionListener = (action: string) => void;

const EMPTY_VALUES: Record<string, PaneValue> = Object.freeze({});

class PaneStoreClass {
  private panels = new Map<string, PanelState>();
  private listeners = new Map<string, Set<Listener>>();
  private globalListeners = new Set<Listener>();
  private snapshots = new Map<string, Record<string, PaneValue>>();
  private actionListeners = new Map<string, Set<ActionListener>>();
  private presets = new Map<string, Preset[]>();
  private activePreset = new Map<string, string | null>();
  private baseValues = new Map<string, Record<string, PaneValue>>();
  private transitionModes = new Map<string, TransitionMode>();
  private activeTabName: string | null = null;
  private activeTabListeners = new Set<Listener>();

  setActiveTab(name: string): void {
    if (this.activeTabName === name) return;
    this.activeTabName = name;
    this.activeTabListeners.forEach((fn) => fn());
  }

  getActiveTab(): string | null {
    return this.activeTabName;
  }

  subscribeActiveTab(listener: Listener): () => void {
    this.activeTabListeners.add(listener);
    return () => this.activeTabListeners.delete(listener);
  }

  registerPanel(id: string, name: string, config: PaneConfig): void {
    const controls = parseConfig(config, "");
    const values = flattenValues(config, "");
    this.initTransitionModes(config, "", id);
    this.panels.set(id, { id, name, controls, values });
    this.snapshots.set(id, { ...values });
    this.baseValues.set(id, { ...values });
    this.notifyGlobal();
  }

  updatePanel(id: string, name: string, config: PaneConfig): void {
    const existing = this.panels.get(id);
    if (!existing) {
      this.registerPanel(id, name, config);
      return;
    }

    const controls = parseConfig(config, "");
    const newDefaults = flattenValues(config, "");
    const nextValues: Record<string, PaneValue> = {};

    for (const [path, defaultValue] of Object.entries(newDefaults)) {
      const prev = existing.values[path];
      nextValues[path] =
        prev !== undefined && typeof prev === typeof defaultValue
          ? prev
          : defaultValue;
    }

    this.initTransitionModes(config, "", id);
    this.panels.set(id, { id, name, controls, values: nextValues });
    this.snapshots.set(id, { ...nextValues });
    this.notify(id);
    this.notifyGlobal();
  }

  unregisterPanel(id: string): void {
    this.panels.delete(id);
    this.listeners.delete(id);
    this.snapshots.delete(id);
    this.actionListeners.delete(id);
    this.baseValues.delete(id);
    this.notifyGlobal();
  }

  updateValue(panelId: string, path: string, value: PaneValue): void {
    const panel = this.panels.get(panelId);
    if (!panel) return;

    panel.values[path] = value;

    const activeId = this.activePreset.get(panelId);
    if (activeId) {
      const presets = this.presets.get(panelId) ?? [];
      const preset = presets.find((p) => p.id === activeId);
      if (preset) preset.values[path] = value;
    } else {
      const base = this.baseValues.get(panelId);
      if (base) base[path] = value;
    }

    this.snapshots.set(panelId, { ...panel.values });
    this.notify(panelId);
  }

  getValue(panelId: string, path: string): PaneValue | undefined {
    return this.panels.get(panelId)?.values[path];
  }

  getValues(panelId: string): Record<string, PaneValue> {
    return this.snapshots.get(panelId) ?? EMPTY_VALUES;
  }

  getPanels(): PanelState[] {
    return Array.from(this.panels.values());
  }

  getPanel(id: string): PanelState | undefined {
    return this.panels.get(id);
  }

  subscribe(panelId: string, listener: Listener): () => void {
    let set = this.listeners.get(panelId);
    if (!set) {
      set = new Set();
      this.listeners.set(panelId, set);
    }
    set.add(listener);
    return () => set.delete(listener);
  }

  subscribeGlobal(listener: Listener): () => void {
    this.globalListeners.add(listener);
    return () => this.globalListeners.delete(listener);
  }

  subscribeActions(panelId: string, listener: ActionListener): () => void {
    let set = this.actionListeners.get(panelId);
    if (!set) {
      set = new Set();
      this.actionListeners.set(panelId, set);
    }
    set.add(listener);
    return () => set.delete(listener);
  }

  triggerAction(panelId: string, path: string): void {
    this.actionListeners.get(panelId)?.forEach((fn) => fn(path));
  }

  // Presets
  savePreset(panelId: string, name: string): string {
    const panel = this.panels.get(panelId);
    if (!panel) throw new Error(`Panel ${panelId} not found`);

    const id = `preset-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const preset: Preset = { id, name, values: { ...panel.values } };
    const existing = this.presets.get(panelId) ?? [];
    this.presets.set(panelId, [...existing, preset]);
    this.activePreset.set(panelId, id);
    this.snapshots.set(panelId, { ...panel.values });
    this.notify(panelId);
    return id;
  }

  loadPreset(panelId: string, presetId: string): void {
    const panel = this.panels.get(panelId);
    if (!panel) return;
    const presets = this.presets.get(panelId) ?? [];
    const preset = presets.find((p) => p.id === presetId);
    if (!preset) return;

    panel.values = { ...preset.values };
    this.snapshots.set(panelId, { ...panel.values });
    this.activePreset.set(panelId, presetId);
    this.notify(panelId);
  }

  deletePreset(panelId: string, presetId: string): void {
    const presets = this.presets.get(panelId) ?? [];
    this.presets.set(
      panelId,
      presets.filter((p) => p.id !== presetId),
    );
    if (this.activePreset.get(panelId) === presetId) {
      this.activePreset.set(panelId, null);
    }
    const panel = this.panels.get(panelId);
    if (panel) this.snapshots.set(panelId, { ...panel.values });
    this.notify(panelId);
  }

  clearActivePreset(panelId: string): void {
    const panel = this.panels.get(panelId);
    const base = this.baseValues.get(panelId);
    if (panel && base) {
      panel.values = { ...base };
      this.snapshots.set(panelId, { ...panel.values });
    }
    this.activePreset.set(panelId, null);
    this.notify(panelId);
  }

  getPresets(panelId: string): Preset[] {
    return this.presets.get(panelId) ?? [];
  }

  getActivePresetId(panelId: string): string | null {
    return this.activePreset.get(panelId) ?? null;
  }

  // Transition modes
  getTransitionMode(panelId: string, path: string): TransitionMode {
    return this.transitionModes.get(`${panelId}:${path}`) ?? "simple";
  }

  setTransitionMode(
    panelId: string,
    path: string,
    mode: TransitionMode,
  ): void {
    this.transitionModes.set(`${panelId}:${path}`, mode);
    this.notify(panelId);
  }

  private initTransitionModes(
    config: PaneConfig,
    prefix: string,
    panelId: string,
  ): void {
    for (const [key, entry] of Object.entries(config)) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (entry.type === "easing") {
        this.transitionModes.set(`${panelId}:${path}`, "easing");
      } else if (entry.type === "spring") {
        const hasPhysics =
          entry.stiffness !== undefined ||
          entry.damping !== undefined ||
          entry.mass !== undefined;
        const hasTime =
          entry.visualDuration !== undefined || entry.bounce !== undefined;
        this.transitionModes.set(
          `${panelId}:${path}`,
          hasPhysics && !hasTime ? "advanced" : "simple",
        );
      } else if (entry.type === "folder") {
        this.initTransitionModes(entry.children, path, panelId);
      }
    }
  }

  private notify(panelId: string): void {
    this.listeners.get(panelId)?.forEach((fn) => fn());
  }

  private notifyGlobal(): void {
    this.globalListeners.forEach((fn) => fn());
  }
}

export const PaneStore = new PaneStoreClass();
