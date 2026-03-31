import { useSyncExternalStore } from "react";
import { PaneStore } from "../store.ts";

export function useActiveTab(): string | null {
  return useSyncExternalStore(
    (cb) => PaneStore.subscribeActiveTab(cb),
    () => PaneStore.getActiveTab(),
    () => PaneStore.getActiveTab(),
  );
}
