import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import {
  calculatePosition,
  calculateResizedSizeAndPosition,
  COLLAPSED_SIZE,
  getBestCorner,
  getCollapsedPosition,
  MIN_HEIGHT,
  MIN_WIDTH,
  SAFE_AREA,
} from "../position.ts";
import { PaneStore } from "../store.ts";
import type {
  CollapsedState,
  Corner,
  PaneValue,
  PanelState,
} from "../types.ts";
import { Panel } from "./Panel.tsx";
import { PresetBar } from "./Preset.tsx";

const LS_KEY = "uipane-widget";
const LS_COLLAPSED_KEY = "uipane-collapsed";

function loadLS<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function saveLS(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore quota errors */
  }
}

type ShellState = {
  corner: Corner;
  width: number;
  height: number;
};

// =========================================================================
// Settings icon SVG
// =========================================================================
function SettingsIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none">
      <path
        opacity="0.5"
        d="M6.85 11.75C6.79 11.99 6.75 12.24 6.75 12.5s.04.51.1.75H2a.75.75 0 010-1.5h4.85zM14 11.75a.75.75 0 010 1.5h-1.35c.06-.24.1-.49.1-.75s-.04-.51-.1-.75H14zM3.1 7.25C3.04 7.49 3 7.74 3 8s.04.51.1.75H2a.75.75 0 010-1.5h1.1zM14 7.25a.75.75 0 010 1.5H8.9c.06-.24.1-.49.1-.75s-.04-.51-.1-.75H14zM7.6 2.75c-.06.24-.1.49-.1.75s.04.51.1.75H2a.75.75 0 010-1.5h5.6zM14 2.75a.75.75 0 010 1.5h-.6c.06-.24.1-.49.1-.75s-.04-.51-.1-.75H14z"
        fill="currentColor"
      />
      <circle cx="6" cy="8" r="1" fill="currentColor" stroke="currentColor" stroke-width="1.25" />
      <circle cx="10.5" cy="3.5" r="1" fill="currentColor" stroke="currentColor" stroke-width="1.25" />
      <circle cx="9.75" cy="12.5" r="1" fill="currentColor" stroke="currentColor" stroke-width="1.25" />
    </svg>
  );
}

// =========================================================================
// App — orchestrates expanded/collapsed panel
// =========================================================================

export function App({ portalContainer, childrenSlot }: { portalContainer: HTMLElement | null; childrenSlot: HTMLDivElement | null }) {
  const adoptSlot = useCallback(
    (el: HTMLDivElement | null) => {
      if (el && childrenSlot && childrenSlot.parentNode !== el) {
        el.appendChild(childrenSlot);
      }
    },
    [childrenSlot],
  );
  const shellRef = useRef<HTMLDivElement>(null);

  // Panels from store
  const [panels, setPanels] = useState<PanelState[]>([]);
  const [values, setValues] = useState<Record<string, Record<string, PaneValue>>>({});
  const [activeTab, setActiveTab] = useState(0);

  // Shell geometry
  const savedShell = loadLS<ShellState>(LS_KEY);
  const savedCollapsed = loadLS<CollapsedState>(LS_COLLAPSED_KEY);

  const [corner, setCorner] = useState<Corner>(savedShell?.corner ?? "bottom-right");
  const [width, setWidth] = useState(savedShell?.width ?? 320);
  const [height, setHeight] = useState(savedShell?.height ?? 420);
  const [collapsed, setCollapsed] = useState<CollapsedState | null>(savedCollapsed);

  // Subscribe to store
  useEffect(() => {
    const update = () => {
      const p = PaneStore.getPanels();
      setPanels(p);
      const v: Record<string, Record<string, PaneValue>> = {};
      for (const panel of p) v[panel.id] = PaneStore.getValues(panel.id);
      setValues(v);
    };
    update();
    return PaneStore.subscribeGlobal(update);
  }, []);

  useEffect(() => {
    const unsubs: (() => void)[] = [];
    for (const panel of panels) {
      unsubs.push(
        PaneStore.subscribe(panel.id, () => {
          setValues((prev) => ({
            ...prev,
            [panel.id]: PaneStore.getValues(panel.id),
          }));
        }),
      );
    }
    return () => unsubs.forEach((u) => u());
  }, [panels]);

  // Persist
  useEffect(() => {
    saveLS(LS_KEY, { corner, width, height });
  }, [corner, width, height]);

  useEffect(() => {
    if (collapsed) saveLS(LS_COLLAPSED_KEY, collapsed);
    else localStorage.removeItem(LS_COLLAPSED_KEY);
  }, [collapsed]);

  // Position
  const pos = collapsed
    ? getCollapsedPosition(collapsed.corner, collapsed.orientation)
    : calculatePosition(corner, width, height);

  // ------- Drag (expanded) -------
  const handleDrag = useCallback(
    (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest("button")) return;
      e.preventDefault();
      const shell = shellRef.current;
      if (!shell) return;

      const initMX = e.clientX;
      const initMY = e.clientY;
      const initX = pos.x;
      const initY = pos.y;
      let lastMX = initMX;
      let lastMY = initMY;
      let hasMoved = false;
      let rafId: number | null = null;

      shell.classList.add("up-shell-dragging");

      const onMove = (ev: MouseEvent) => {
        if (rafId) return;
        hasMoved = true;
        lastMX = ev.clientX;
        lastMY = ev.clientY;

        rafId = requestAnimationFrame(() => {
          const cx = initX + (lastMX - initMX);
          const cy = initY + (lastMY - initMY);
          shell.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;

          // Check collapse threshold (35% area off-screen)
          const r = cx + width;
          const b = cy + height;
          const outL = Math.max(0, -cx);
          const outR = Math.max(0, r - window.innerWidth);
          const outT = Math.max(0, -cy);
          const outB = Math.max(0, b - window.innerHeight);
          const hOut = Math.min(width, outL + outR);
          const vOut = Math.min(height, outT + outB);
          const areaOut = hOut * height + vOut * width - hOut * vOut;

          if (areaOut > width * height * 0.35) {
            const wcx = cx + width / 2;
            const wcy = cy + height / 2;
            const scx = window.innerWidth / 2;
            const scy = window.innerHeight / 2;
            const tCorner: Corner =
              wcx < scx
                ? wcy < scy ? "top-left" : "bottom-left"
                : wcy < scy ? "top-right" : "bottom-right";
            const orientation =
              Math.max(outL, outR) > Math.max(outT, outB)
                ? ("horizontal" as const)
                : ("vertical" as const);

            setCorner(tCorner);
            setCollapsed({ corner: tCorner, orientation });
            cleanup();
          }
          rafId = null;
        });
      };

      const onUp = () => {
        cleanup();
        shell.classList.remove("up-shell-dragging");

        const totalMove = Math.sqrt(
          (lastMX - initMX) ** 2 + (lastMY - initMY) ** 2,
        );
        if (!hasMoved || totalMove < 60) {
          shell.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`;
          return;
        }

        const newCorner = getBestCorner(lastMX, lastMY, initMX, initMY);
        const snapped = calculatePosition(newCorner, width, height);

        shell.style.transition =
          "transform 0.25s cubic-bezier(0, 0, 0.2, 1)";
        shell.style.transform = `translate3d(${snapped.x}px, ${snapped.y}px, 0)`;

        const onEnd = () => {
          shell.style.transition = "";
          shell.removeEventListener("transitionend", onEnd);
        };
        shell.addEventListener("transitionend", onEnd);

        setCorner(newCorner);
      };

      const cleanup = () => {
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        if (rafId) cancelAnimationFrame(rafId);
      };

      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
    },
    [pos.x, pos.y, width, height],
  );

  // ------- Drag (collapsed) -------
  const handleCollapsedDrag = useCallback(
    (e: MouseEvent) => {
      if (!collapsed) return;
      e.preventDefault();
      const initMX = e.clientX;
      const initMY = e.clientY;
      const threshold = 50;

      const onMove = (ev: MouseEvent) => {
        const dx = ev.clientX - initMX;
        const dy = ev.clientY - initMY;
        let expand = false;

        if (collapsed.orientation === "horizontal") {
          if (collapsed.corner.endsWith("left") && dx > threshold) expand = true;
          if (collapsed.corner.endsWith("right") && dx < -threshold) expand = true;
        } else {
          if (collapsed.corner.startsWith("top") && dy > threshold) expand = true;
          if (collapsed.corner.startsWith("bottom") && dy < -threshold) expand = true;
        }

        if (expand) {
          setCollapsed(null);
          setCorner(collapsed.corner);
          done();
        }
      };

      const onUp = () => done();
      const done = () => {
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
      };

      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
    },
    [collapsed],
  );

  // ------- Resize -------
  const handleResize = useCallback(
    (handle: string, e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const initMX = e.clientX;
      const initMY = e.clientY;
      const initW = width;
      const initH = height;
      const initPos = calculatePosition(corner, width, height);
      const shell = shellRef.current;
      if (!shell) return;

      shell.classList.add("up-shell-dragging");

      const onMove = (ev: MouseEvent) => {
        const dx = ev.clientX - initMX;
        const dy = ev.clientY - initMY;
        const result = calculateResizedSizeAndPosition(
          handle,
          initW,
          initH,
          initPos.x,
          initPos.y,
          dx,
          dy,
        );
        setWidth(result.width);
        setHeight(result.height);
        shell.style.transform = `translate3d(${result.x}px, ${result.y}px, 0)`;
      };

      const onUp = () => {
        shell.classList.remove("up-shell-dragging");
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
      };

      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
    },
    [width, height, corner],
  );

  // ------- Resize handles -------
  const resizeHandles = (() => {
    const [v, h] = corner.split("-") as [string, string];
    const handles: string[] = [];
    if (v === "top") handles.push("bottom");
    else handles.push("top");
    if (h === "left") handles.push("right");
    else handles.push("left");
    handles.push(`${v === "top" ? "bottom" : "top"}-${h === "left" ? "right" : "left"}`);
    return handles;
  })();

  if (panels.length === 0) return null;

  // ------- Collapsed state -------
  if (collapsed) {
    const cPos = getCollapsedPosition(collapsed.corner, collapsed.orientation);
    return (
      <div
        class="up-collapsed"
        style={{ transform: `translate3d(${cPos.x}px, ${cPos.y}px, 0)` }}
        onPointerDown={handleCollapsedDrag}
      >
        <SettingsIcon />
      </div>
    );
  }

  // ------- Expanded state -------
  const currentPanel = panels[activeTab] ?? panels[0];
  const currentValues = currentPanel ? (values[currentPanel.id] ?? {}) : {};

  useEffect(() => {
    if (currentPanel) PaneStore.setActiveTab(currentPanel.name);
  }, [currentPanel?.name]);

  return (
    <div
      ref={shellRef}
      class="up-shell"
      style={{
        width: `${width}px`,
        height: `${height}px`,
        transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`,
      }}
    >
      {/* Header */}
      <div class="up-header" onPointerDown={handleDrag}>
        <div class="up-header-left">
          <span class="up-header-title">
            {panels.length === 1 ? currentPanel?.name ?? "uipane" : "uipane"}
          </span>
        </div>
      </div>

      {/* Tabs */}
      {panels.length > 1 && (
        <div class="up-tabs">
          {panels.map((panel, i) => (
            <button
              key={panel.id}
              class={`up-tab ${i === activeTab ? "up-tab-active" : ""}`}
              onClick={() => setActiveTab(i)}
            >
              {panel.name}
            </button>
          ))}
        </div>
      )}

      {/* Panel content */}
      <div class="up-content">
        {/* React children slot — inside scrollable content */}
        <div ref={adoptSlot} />
        {currentPanel && (
          <Panel
            panel={currentPanel}
            values={currentValues}
            portalContainer={portalContainer}
          />
        )}
      </div>

      {/* Resize handles */}
      {resizeHandles.map((h) => (
        <div
          key={h}
          class={`up-resize up-resize-${h}`}
          onPointerDown={(e: PointerEvent) => handleResize(h, e)}
        />
      ))}
    </div>
  );
}
