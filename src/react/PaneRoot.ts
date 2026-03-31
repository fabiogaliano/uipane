import { createElement, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { getChildrenSlot, initPane } from "../mount.ts";

type PaneRootProps = {
  children?: ReactNode;
};

export function PaneRoot(props: PaneRootProps): ReturnType<typeof createElement> {
  const [slot, setSlot] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    const cleanup = initPane();
    setSlot(getChildrenSlot());
    return cleanup;
  }, []);

  if (props.children && slot) {
    return createPortal(props.children, slot);
  }

  return null;
}
