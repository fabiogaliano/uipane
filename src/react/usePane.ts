import {
  useEffect,
  useId,
  useRef,
  useSyncExternalStore,
} from "react";
import { PaneStore } from "../store.ts";
import type {
  ActionConfig,
  ControlConfig,
  EasingConfig,
  FolderConfig,
  PaneConfig,
  PaneValue,
  ResolvedValues,
  SelectConfig,
  SpringConfig,
} from "../types.ts";

type UsePaneOptions = {
  onAction?: (path: string) => void;
};

export function usePane<const T extends PaneConfig>(
  name: string,
  config: T,
  options?: UsePaneOptions,
): ResolvedValues<T> {
  const instanceId = useId();
  const panelId = `${name}-${instanceId}`;

  const configRef = useRef(config);
  configRef.current = config;

  const serialized = JSON.stringify(config);

  const onActionRef = useRef(options?.onAction);
  onActionRef.current = options?.onAction;

  useEffect(() => {
    PaneStore.registerPanel(panelId, name, configRef.current);
    return () => PaneStore.unregisterPanel(panelId);
  }, [panelId, name]);

  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    PaneStore.updatePanel(panelId, name, configRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelId, name, serialized]);

  useEffect(() => {
    return PaneStore.subscribeActions(panelId, (action) => {
      onActionRef.current?.(action);
    });
  }, [panelId]);

  const values = useSyncExternalStore(
    (cb) => PaneStore.subscribe(panelId, cb),
    () => PaneStore.getValues(panelId),
    () => PaneStore.getValues(panelId),
  );

  return buildResolved(config, values, "") as ResolvedValues<T>;
}

function buildResolved(
  config: PaneConfig,
  flat: Record<string, PaneValue>,
  prefix: string,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, entry] of Object.entries(config) as [string, ControlConfig][]) {
    const path = prefix ? `${prefix}.${key}` : key;

    switch (entry.type) {
      case "action":
        break;
      case "slot":
        break;
      case "slider":
        result[key] = flat[path] ?? entry.value;
        break;
      case "toggle":
        result[key] = flat[path] ?? entry.value;
        break;
      case "select": {
        const cfg = entry as SelectConfig;
        const first = cfg.options[0];
        const firstVal = typeof first === "string" ? first : (first?.value ?? "");
        result[key] = flat[path] ?? cfg.value ?? firstVal;
        break;
      }
      case "color":
        result[key] = flat[path] ?? entry.value ?? "#000000";
        break;
      case "text":
        result[key] = flat[path] ?? entry.value ?? "";
        break;
      case "spring":
        result[key] = flat[path] ?? (entry as SpringConfig);
        break;
      case "easing":
        result[key] = flat[path] ?? (entry as EasingConfig);
        break;
      case "folder":
        result[key] = buildResolved(
          (entry as FolderConfig).children,
          flat,
          path,
        );
        break;
    }
  }

  return result;
}
