import { useCallback } from "preact/hooks";
import { PaneStore } from "../store.ts";
import type { EasingConfig, SpringConfig, TransitionMode } from "../types.ts";
import { SegmentedControl } from "./Controls.tsx";
import { Folder } from "./Folder.tsx";
import { Slider } from "./Slider.tsx";

// ---------------------------------------------------------------------------
// Spring Visualization
// ---------------------------------------------------------------------------

function generateSpringCurve(
  stiffness: number,
  damping: number,
  mass: number,
  duration: number,
): [number, number][] {
  const points: [number, number][] = [];
  const steps = 100;
  const dt = duration / steps;
  let position = 0;
  let velocity = 0;

  for (let i = 0; i <= steps; i++) {
    const time = i * dt;
    points.push([time, position]);
    const springForce = -stiffness * (position - 1);
    const dampForce = -damping * velocity;
    velocity += ((springForce + dampForce) / mass) * dt;
    position += velocity * dt;
  }
  return points;
}

function SpringViz({
  spring,
  isSimple,
}: {
  spring: SpringConfig;
  isSimple: boolean;
}) {
  const W = 256;
  const H = 140;

  let stiffness: number;
  let damping: number;
  let mass: number;

  if (isSimple) {
    const vd = spring.visualDuration ?? 0.3;
    const bounce = spring.bounce ?? 0.2;
    mass = 1;
    stiffness = Math.pow((2 * Math.PI) / vd, 2);
    damping = 2 * (1 - bounce) * Math.sqrt(stiffness * mass);
  } else {
    stiffness = spring.stiffness ?? 400;
    damping = spring.damping ?? 17;
    mass = spring.mass ?? 1;
  }

  const pts = generateSpringCurve(stiffness, damping, mass, 2);
  const vals = pts.map(([, v]) => v);
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const range = hi - lo || 1;

  const d = pts
    .map(([t, v], i) => {
      const x = (t / 2) * W;
      const y = H - (((v - lo) / range) * H * 0.6 + H * 0.2);
      return `${i === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} class="up-viz">
      <line
        x1={0} y1={H / 2} x2={W} y2={H / 2}
        stroke="rgba(255,255,255,0.15)"
        stroke-width="1"
        stroke-dasharray="4,4"
      />
      <path
        d={d}
        fill="none"
        stroke="rgba(255,255,255,0.6)"
        stroke-width="2"
        stroke-linecap="round"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Easing Visualization
// ---------------------------------------------------------------------------

function EasingViz({ easing }: { easing: EasingConfig }) {
  const S = 200;
  const pad = 10;
  const unit = (S - pad * 2) / 2;
  const toSvg = (nx: number, ny: number) => ({
    x: pad + (nx + 0.5) * unit,
    y: pad + (1.5 - ny) * unit,
  });

  const start = toSvg(0, 0);
  const end = toSvg(1, 1);
  const p1 = toSvg(easing.ease[0], easing.ease[1]);
  const p2 = toSvg(easing.ease[2], easing.ease[3]);

  return (
    <svg viewBox={`0 0 ${S} ${S}`} preserveAspectRatio="xMidYMid slice" class="up-viz" style={{ aspectRatio: "256/140" }}>
      <line
        x1={start.x} y1={start.y} x2={end.x} y2={end.y}
        stroke="rgba(255,255,255,0.15)"
        stroke-width="1"
        stroke-dasharray="4,4"
      />
      <path
        d={`M ${start.x} ${start.y} C ${p1.x} ${p1.y}, ${p2.x} ${p2.y}, ${end.x} ${end.y}`}
        fill="none"
        stroke="rgba(255,255,255,0.6)"
        stroke-width="2"
        stroke-linecap="round"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Transition Control (Spring + Easing unified)
// ---------------------------------------------------------------------------

type TransitionControlProps = {
  panelId: string;
  path: string;
  label: string;
  value: SpringConfig | EasingConfig;
  onChange: (v: SpringConfig | EasingConfig) => void;
};

export function TransitionControl({
  panelId,
  path,
  label,
  value,
  onChange,
}: TransitionControlProps) {
  const mode = PaneStore.getTransitionMode(panelId, path);
  const isEasing = mode === "easing";
  const isSimple = mode === "simple";

  const spring: SpringConfig =
    value.type === "spring"
      ? value
      : { type: "spring", visualDuration: 0.3, bounce: 0.2 };
  const easing: EasingConfig =
    value.type === "easing"
      ? value
      : { type: "easing", duration: 0.3, ease: [1, -0.4, 0.5, 1] };

  const handleModeChange = useCallback(
    (newMode: string) => {
      PaneStore.setTransitionMode(panelId, path, newMode as TransitionMode);
      if (newMode === "easing") {
        const dur =
          value.type === "spring" ? (value.visualDuration ?? 0.3) : (value as EasingConfig).duration;
        onChange({ type: "easing", duration: dur, ease: easing.ease });
      } else if (newMode === "simple") {
        onChange({
          type: "spring",
          visualDuration:
            spring.visualDuration ??
            (value.type === "easing" ? value.duration : 0.3),
          bounce: spring.bounce ?? 0.2,
        });
      } else {
        onChange({
          type: "spring",
          stiffness: spring.stiffness ?? 200,
          damping: spring.damping ?? 25,
          mass: spring.mass ?? 1,
        });
      }
    },
    [panelId, path, value, spring, easing, onChange],
  );

  const updateSpring = useCallback(
    (key: string, val: number) => {
      if (isSimple) {
        const { stiffness: _s, damping: _d, mass: _m, ...rest } = spring;
        onChange({ ...rest, [key]: val } as SpringConfig);
      } else {
        const { visualDuration: _v, bounce: _b, ...rest } = spring;
        onChange({ ...rest, [key]: val } as SpringConfig);
      }
    },
    [spring, isSimple, onChange],
  );

  const updateEase = useCallback(
    (index: number, val: number) => {
      const newEase = [...easing.ease] as [number, number, number, number];
      newEase[index] = val;
      onChange({ ...easing, ease: newEase });
    },
    [easing, onChange],
  );

  return (
    <Folder title={label} defaultOpen>
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        {isEasing ? (
          <EasingViz easing={easing} />
        ) : (
          <SpringViz spring={spring} isSimple={isSimple} />
        )}

        <div class="up-labeled-row">
          <span class="up-labeled-row-label">Type</span>
          <SegmentedControl
            options={[
              { value: "easing", label: "Easing" },
              { value: "simple", label: "Time" },
              { value: "advanced", label: "Physics" },
            ]}
            value={mode}
            onChange={handleModeChange}
          />
        </div>

        {isEasing ? (
          <>
            <Slider label="x1" value={easing.ease[0]} onChange={(v) => updateEase(0, v)} min={0} max={1} step={0.01} />
            <Slider label="y1" value={easing.ease[1]} onChange={(v) => updateEase(1, v)} min={-1} max={2} step={0.01} />
            <Slider label="x2" value={easing.ease[2]} onChange={(v) => updateEase(2, v)} min={0} max={1} step={0.01} />
            <Slider label="y2" value={easing.ease[3]} onChange={(v) => updateEase(3, v)} min={-1} max={2} step={0.01} />
            <Slider label="Duration" value={easing.duration} onChange={(v) => onChange({ ...easing, duration: v })} min={0.1} max={2} step={0.05} />
          </>
        ) : isSimple ? (
          <>
            <Slider label="Duration" value={spring.visualDuration ?? 0.3} onChange={(v) => updateSpring("visualDuration", v)} min={0.1} max={1} step={0.05} />
            <Slider label="Bounce" value={spring.bounce ?? 0.2} onChange={(v) => updateSpring("bounce", v)} min={0} max={1} step={0.05} />
          </>
        ) : (
          <>
            <Slider label="Stiffness" value={spring.stiffness ?? 400} onChange={(v) => updateSpring("stiffness", v)} min={1} max={1000} step={10} />
            <Slider label="Damping" value={spring.damping ?? 17} onChange={(v) => updateSpring("damping", v)} min={1} max={100} step={1} />
            <Slider label="Mass" value={spring.mass ?? 1} onChange={(v) => updateSpring("mass", v)} min={0.1} max={10} step={0.1} />
          </>
        )}
      </div>
    </Folder>
  );
}
