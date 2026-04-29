import { render, h } from "preact";
import { STYLES } from "./styles.ts";
import { App } from "./ui/App.tsx";

let mounted = false;
let cleanup: (() => void) | null = null;
let childrenSlotEl: HTMLDivElement | null = null;

export function getChildrenSlot(): HTMLDivElement | null {
  return childrenSlotEl;
}

export function initPane(): () => void {
  if (mounted && cleanup) return cleanup;

  const host = document.createElement("div");
  host.id = "uipane-root";
  host.style.cssText = "position:fixed;top:0;left:0;width:0;height:0;overflow:visible;z-index:2147483645;pointer-events:none;";
  document.documentElement.appendChild(host);

  const shadow = host.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = STYLES;
  shadow.appendChild(style);

  const portalContainer = document.createElement("div");
  portalContainer.className = "up-portal";
  shadow.appendChild(portalContainer);

  childrenSlotEl = document.createElement("div");
  childrenSlotEl.className = "up-children";

  const container = document.createElement("div");
  container.className = "up-root";
  container.style.cssText = "pointer-events:auto;";
  shadow.appendChild(container);

  render(h(App, { portalContainer, childrenSlot: childrenSlotEl }), container);

  mounted = true;
  cleanup = () => {
    render(null, container);
    host.remove();
    mounted = false;
    cleanup = null;
    childrenSlotEl = null;
  };

  return cleanup;
}
