import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { animateSpring, type AnimationHandle } from "../anim.ts";

type SliderProps = {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
};

const CLICK_THRESHOLD = 3;
const DEAD_ZONE = 32;
const MAX_CURSOR_RANGE = 200;
const MAX_STRETCH = 8;

function decimalsForStep(step: number): number {
  const s = step.toString();
  const dot = s.indexOf(".");
  return dot === -1 ? 0 : s.length - dot - 1;
}

function roundValue(val: number, step: number): number {
  const raw = Math.round(val / step) * step;
  return parseFloat(raw.toFixed(decimalsForStep(step)));
}

function snapToDecile(rawValue: number, min: number, max: number): number {
  const normalized = (rawValue - min) / (max - min);
  const nearest = Math.round(normalized * 10) / 10;
  if (Math.abs(normalized - nearest) <= 0.03125) {
    return min + nearest * (max - min);
  }
  return rawValue;
}

export function Slider({ label, value, onChange, min, max, step }: SliderProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [isValueEditable, setIsValueEditable] = useState(false);
  const [isValueHovered, setIsValueHovered] = useState(false);

  const interacting = useRef(false);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const isClick = useRef(true);
  const animHandle = useRef<AnimationHandle | null>(null);
  const rectRef = useRef<DOMRect | null>(null);

  const fillRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  const percentage = ((value - min) / (max - min)) * 100;

  useEffect(() => {
    if (!interacting.current && !animHandle.current) {
      if (fillRef.current) fillRef.current.style.width = `${percentage}%`;
      if (handleRef.current)
        handleRef.current.style.left = `max(5px, calc(${percentage}% - 9px))`;
    }
  }, [percentage]);

  const setFillPercent = useCallback(
    (pct: number) => {
      if (fillRef.current) fillRef.current.style.width = `${pct}%`;
      if (handleRef.current)
        handleRef.current.style.left = `max(5px, calc(${pct}% - 9px))`;
    },
    [],
  );

  const positionToValue = useCallback(
    (clientX: number): number => {
      const rect = rectRef.current;
      if (!rect) return value;
      const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      return Math.max(min, Math.min(max, min + pct * (max - min)));
    },
    [min, max, value],
  );

  const computeStretch = useCallback(
    (clientX: number, sign: number): number => {
      const rect = rectRef.current;
      if (!rect) return 0;
      const dist =
        sign < 0 ? rect.left - clientX : clientX - rect.right;
      const overflow = Math.max(0, dist - DEAD_ZONE);
      return sign * MAX_STRETCH * Math.sqrt(Math.min(overflow / MAX_CURSOR_RANGE, 1));
    },
    [],
  );

  const handlePointerDown = useCallback(
    (e: PointerEvent) => {
      if (isEditing) return;
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      pointerStart.current = { x: e.clientX, y: e.clientY };
      isClick.current = true;
      interacting.current = true;

      if (wrapRef.current) {
        rectRef.current = wrapRef.current.getBoundingClientRect();
      }
    },
    [isEditing],
  );

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (!interacting.current || !pointerStart.current) return;

      const dx = e.clientX - pointerStart.current.x;
      const dy = e.clientY - pointerStart.current.y;
      if (isClick.current && Math.sqrt(dx * dx + dy * dy) > CLICK_THRESHOLD) {
        isClick.current = false;
        setIsDragging(true);
      }

      if (!isClick.current) {
        const rect = rectRef.current;
        if (rect && trackRef.current) {
          if (e.clientX < rect.left) {
            const stretch = computeStretch(e.clientX, -1);
            trackRef.current.style.width = `calc(100% + ${Math.abs(stretch)}px)`;
            trackRef.current.style.transform = `translateX(${stretch}px)`;
          } else if (e.clientX > rect.right) {
            const stretch = computeStretch(e.clientX, 1);
            trackRef.current.style.width = `calc(100% + ${stretch}px)`;
            trackRef.current.style.transform = "translateX(0)";
          } else {
            trackRef.current.style.width = "100%";
            trackRef.current.style.transform = "translateX(0)";
          }
        }

        const newVal = positionToValue(e.clientX);
        const pct = ((newVal - min) / (max - min)) * 100;
        if (animHandle.current) {
          animHandle.current.stop();
          animHandle.current = null;
        }
        setFillPercent(pct);
        onChange(roundValue(newVal, step));
      }
    },
    [positionToValue, onChange, min, max, step, setFillPercent, computeStretch],
  );

  const handlePointerUp = useCallback(
    (e: PointerEvent) => {
      if (!interacting.current) return;

      if (isClick.current) {
        const rawVal = positionToValue(e.clientX);
        const discreteSteps = (max - min) / step;
        const snapped =
          discreteSteps <= 10
            ? Math.max(min, Math.min(max, min + Math.round((rawVal - min) / step) * step))
            : snapToDecile(rawVal, min, max);
        const targetPct = ((snapped - min) / (max - min)) * 100;
        const currentPct = ((value - min) / (max - min)) * 100;

        if (animHandle.current) animHandle.current.stop();
        animHandle.current = animateSpring(
          currentPct,
          targetPct,
          { stiffness: 300, damping: 25, mass: 0.8 },
          (v) => setFillPercent(v),
          () => {
            animHandle.current = null;
          },
        );
        onChange(roundValue(snapped, step));
      }

      if (trackRef.current) {
        trackRef.current.style.transition =
          "width 0.3s cubic-bezier(0,0,0.2,1), transform 0.3s cubic-bezier(0,0,0.2,1)";
        trackRef.current.style.width = "100%";
        trackRef.current.style.transform = "translateX(0)";
        setTimeout(() => {
          if (trackRef.current) trackRef.current.style.transition = "";
        }, 300);
      }

      interacting.current = false;
      setIsDragging(false);
      pointerStart.current = null;
    },
    [positionToValue, onChange, min, max, step, value, setFillPercent],
  );

  // Hover-to-edit value
  const hoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (isValueHovered && !isEditing && !isValueEditable) {
      hoverTimeout.current = setTimeout(() => setIsValueEditable(true), 800);
    } else if (!isValueHovered && !isEditing) {
      if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
      setIsValueEditable(false);
    }
    return () => {
      if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
    };
  }, [isValueHovered, isEditing, isValueEditable]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const submitEdit = useCallback(() => {
    const parsed = parseFloat(editValue);
    if (!isNaN(parsed)) {
      onChange(roundValue(Math.max(min, Math.min(max, parsed)), step));
    }
    setIsEditing(false);
    setIsValueHovered(false);
    setIsValueEditable(false);
  }, [editValue, onChange, min, max, step]);

  const isActive = isHovered || isDragging;
  const displayValue = value.toFixed(decimalsForStep(step));

  const discreteSteps = (max - min) / step;
  const hashCount = discreteSteps <= 10 ? discreteSteps - 1 : 9;
  const hashMarks = Array.from({ length: Math.max(0, hashCount) }, (_, i) => {
    const pct =
      discreteSteps <= 10
        ? ((i + 1) * step) / (max - min) * 100
        : (i + 1) * 10;
    return <div key={i} class="up-slider-hashmark" style={{ left: `${pct}%` }} />;
  });

  const cls = [
    "up-slider",
    isActive ? "up-slider-active" : "",
    isDragging ? "up-slider-dragging" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div ref={wrapRef} class="up-slider-wrap">
      <div
        ref={trackRef}
        class={cls}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div class="up-slider-hashmarks">{hashMarks}</div>
        <div
          ref={fillRef}
          class="up-slider-fill"
          style={{
            width: `${percentage}%`,
            background: isActive
              ? "rgba(255,255,255,0.15)"
              : "rgba(255,255,255,0.08)",
          }}
        />
        <div
          ref={handleRef}
          class="up-slider-handle"
          style={{ left: `max(5px, calc(${percentage}% - 9px))` }}
        />
        <span class="up-slider-label">{label}</span>
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            class="up-slider-input"
            value={editValue}
            onInput={(e) => setEditValue((e.target as HTMLInputElement).value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitEdit();
              if (e.key === "Escape") {
                setIsEditing(false);
                setIsValueHovered(false);
              }
            }}
            onBlur={submitEdit}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          />
        ) : (
          <span
            class={`up-slider-value ${isValueEditable ? "up-slider-value-editable" : ""}`}
            onMouseEnter={() => setIsValueHovered(true)}
            onMouseLeave={() => setIsValueHovered(false)}
            onClick={(e) => {
              if (isValueEditable) {
                e.stopPropagation();
                e.preventDefault();
                setIsEditing(true);
                setEditValue(displayValue);
              }
            }}
            onMouseDown={(e) => {
              if (isValueEditable) e.stopPropagation();
            }}
          >
            {displayValue}
          </span>
        )}
      </div>
    </div>
  );
}
