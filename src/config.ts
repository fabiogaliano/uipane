import type {
  ControlConfig,
  ControlMeta,
  PaneConfig,
  PaneValue,
  SelectOption,
} from "./types.ts";

export function parseConfig(
  config: PaneConfig,
  prefix: string,
): ControlMeta[] {
  const controls: ControlMeta[] = [];

  for (const [key, entry] of Object.entries(config)) {
    const path = prefix ? `${prefix}.${key}` : key;
    const label = formatLabel(key);
    const meta = controlToMeta(entry, path, label);
    if (meta) controls.push(meta);
  }
  return controls;
}

export function flattenValues(
  config: PaneConfig,
  prefix: string,
): Record<string, PaneValue> {
  const values: Record<string, PaneValue> = {};

  for (const [key, entry] of Object.entries(config)) {
    const path = prefix ? `${prefix}.${key}` : key;

    switch (entry.type) {
      case "slider":
        values[path] = entry.value;
        break;
      case "toggle":
        values[path] = entry.value;
        break;
      case "action":
        values[path] = entry;
        break;
      case "slot":
        break;
      case "select": {
        const first = entry.options[0];
        const firstValue =
          typeof first === "string" ? first : (first?.value ?? "");
        values[path] = entry.value ?? firstValue;
        break;
      }
      case "color":
        values[path] = entry.value ?? "#000000";
        break;
      case "text":
        values[path] = entry.value ?? "";
        break;
      case "spring":
        values[path] = entry;
        break;
      case "easing":
        values[path] = entry;
        break;
      case "folder":
        Object.assign(values, flattenValues(entry.children, path));
        break;
    }
  }
  return values;
}

function controlToMeta(
  entry: ControlConfig,
  path: string,
  label: string,
): ControlMeta | null {
  switch (entry.type) {
    case "slider":
      return {
        type: "slider",
        path,
        label,
        min: entry.min,
        max: entry.max,
        step: entry.step ?? inferStep(entry.min, entry.max),
      };
    case "toggle":
      return { type: "toggle", path, label };
    case "action":
      return { type: "action", path, label: entry.label ?? label };
    case "select":
      return { type: "select", path, label, options: entry.options };
    case "color":
      return { type: "color", path, label };
    case "text":
      return { type: "text", path, label, placeholder: entry.placeholder };
    case "slot":
      return { type: "slot", path, label: entry.label ?? "" };
    case "spring":
      return { type: "transition", path, label };
    case "easing":
      return { type: "transition", path, label };
    case "folder":
      return {
        type: "folder",
        path,
        label,
        defaultOpen: entry.open ?? true,
        children: parseConfig(entry.children, path),
      };
  }
}

function formatLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

function inferStep(min: number, max: number): number {
  const range = max - min;
  if (range <= 1) return 0.01;
  if (range <= 10) return 0.1;
  if (range <= 100) return 1;
  return 10;
}

export function normalizeSelectOptions(
  options: SelectOption[],
): { value: string; label: string }[] {
  return options.map((opt) =>
    typeof opt === "string"
      ? { value: opt, label: opt.replace(/\b\w/g, (c) => c.toUpperCase()) }
      : opt,
  );
}
