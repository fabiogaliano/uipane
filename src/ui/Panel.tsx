import { PaneStore } from "../store.ts";
import type {
  ControlMeta,
  EasingConfig,
  PaneValue,
  PanelState,
  SpringConfig,
} from "../types.ts";
import { Action, ColorPicker, TextInput, Toggle } from "./Controls.tsx";
import { Folder } from "./Folder.tsx";
import { Select } from "./Select.tsx";
import { Slider } from "./Slider.tsx";
import { TransitionControl } from "./Transition.tsx";

type PanelProps = {
  panel: PanelState;
  values: Record<string, PaneValue>;
  portalContainer: HTMLElement | null;
};

export function Panel({ panel, values, portalContainer }: PanelProps) {
  const renderControl = (control: ControlMeta) => {
    const value = values[control.path];

    switch (control.type) {
      case "slider":
        return (
          <Slider
            key={control.path}
            label={control.label}
            value={value as number}
            onChange={(v) => PaneStore.updateValue(panel.id, control.path, v)}
            min={control.min ?? 0}
            max={control.max ?? 100}
            step={control.step ?? 1}
          />
        );

      case "toggle":
        return (
          <Toggle
            key={control.path}
            label={control.label}
            checked={value as boolean}
            onChange={(v) => PaneStore.updateValue(panel.id, control.path, v)}
          />
        );

      case "action":
        return (
          <Action
            key={control.path}
            label={control.label}
            onClick={() => PaneStore.triggerAction(panel.id, control.path)}
          />
        );

      case "select":
        return (
          <Select
            key={control.path}
            label={control.label}
            value={value as string}
            options={control.options ?? []}
            onChange={(v) => PaneStore.updateValue(panel.id, control.path, v)}
            portalContainer={portalContainer}
          />
        );

      case "text":
        return (
          <TextInput
            key={control.path}
            label={control.label}
            value={value as string}
            onChange={(v) => PaneStore.updateValue(panel.id, control.path, v)}
            placeholder={control.placeholder}
          />
        );

      case "color":
        return (
          <ColorPicker
            key={control.path}
            label={control.label}
            value={value as string}
            onChange={(v) => PaneStore.updateValue(panel.id, control.path, v)}
          />
        );

      case "transition":
        return (
          <TransitionControl
            key={control.path}
            panelId={panel.id}
            path={control.path}
            label={control.label}
            value={value as SpringConfig | EasingConfig}
            onChange={(v) => PaneStore.updateValue(panel.id, control.path, v)}
          />
        );

      case "folder":
        return (
          <Folder
            key={control.path}
            title={control.label}
            defaultOpen={control.defaultOpen}
          >
            {control.children?.map(renderControl)}
          </Folder>
        );

      default:
        return null;
    }
  };

  return (
    <div class="up-panel-section">{panel.controls.map(renderControl)}</div>
  );
}
