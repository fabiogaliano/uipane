import { useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { PaneStore } from "../store.ts";

type PaneSlotProps = {
  panel: string;
  path: string;
  children?: ReactNode;
};

export function PaneSlot({ panel, path, children }: PaneSlotProps) {
  const panelId = useSyncExternalStore(
    (cb) => PaneStore.subscribeGlobal(cb),
    () => PaneStore.getPanels().find((p) => p.name === panel)?.id ?? null,
    () => null,
  );

  const slotNode = useSyncExternalStore(
    (cb) => (panelId ? PaneStore.subscribeSlot(panelId, path, cb) : () => {}),
    () => (panelId ? PaneStore.getSlotNode(panelId, path) : null),
    () => null,
  );

  if (!slotNode || !children) return null;
  return createPortal(children, slotNode);
}
