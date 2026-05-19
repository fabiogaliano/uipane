import { useEffect, useRef, useState } from "preact/hooks";
import { PaneStore } from "../store.ts";

type SlotProps = {
  panelId: string;
  path: string;
  label: string;
};

export function Slot({ panelId, path, label }: SlotProps) {
  const slotRef = useRef<HTMLDivElement>(null);
  const [isEmpty, setIsEmpty] = useState(true);

  useEffect(() => {
    const el = slotRef.current;
    if (!el) return;
    PaneStore.setSlotNode(panelId, path, el);

    setIsEmpty(el.childNodes.length === 0);
    const observer = new MutationObserver(() => {
      setIsEmpty(el.childNodes.length === 0);
    });
    observer.observe(el, { childList: true });

    return () => {
      observer.disconnect();
      PaneStore.setSlotNode(panelId, path, null);
    };
  }, [panelId, path]);

  return (
    <div class={`up-slot-wrap ${isEmpty ? "up-slot-wrap-empty" : ""}`}>
      {label ? <div class="up-slot-label">{label}</div> : null}
      <div ref={slotRef} class="up-slot" />
    </div>
  );
}
