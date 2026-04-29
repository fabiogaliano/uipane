import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { createPortal } from "preact/compat";
import { normalizeSelectOptions } from "../config.ts";
import type { SelectOption } from "../types.ts";

type SelectProps = {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (v: string) => void;
  portalContainer: HTMLElement | null;
};

export function Select({
  label,
  value,
  options,
  onChange,
  portalContainer,
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [hoveredValue, setHoveredValue] = useState<string | null>(null);
  const [pos, setPos] = useState<{
    top: number;
    left: number;
    width: number;
    above: boolean;
  } | null>(null);

  const normalized = normalizeSelectOptions(options);
  const selected = normalized.find((o) => o.value === value);

  const updatePos = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const ddHeight = 8 + normalized.length * 36;
    const spaceBelow = window.innerHeight - rect.bottom - 4;
    const above = spaceBelow < ddHeight && rect.top > ddHeight;
    const nextPos = {
      top: above ? rect.top - 4 : rect.bottom + 4,
      left: rect.left,
      width: rect.width,
      above,
    };
    setPos(nextPos);
  }, [normalized.length]);

  useEffect(() => {
    if (!isOpen) { setPos(null); return; }
    updatePos();
  }, [isOpen, updatePos]);

  const portalTarget = typeof document !== "undefined" ? document.body : portalContainer;

  return (
    <div>
      <button
        type="button"
        ref={triggerRef}
        class={`up-select-trigger ${isOpen ? "up-select-trigger-open" : ""}`}
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen((v) => !v);
        }}
        onClick={(e) => {
          if (e.detail !== 0) return;
          e.preventDefault();
          e.stopPropagation();
          setIsOpen((v) => !v);
        }}
      >
        <span>{label}</span>
        <div class="up-select-right">
          <span class="up-select-value">{selected?.label ?? value}</span>
          <svg
            class={`up-select-chevron ${isOpen ? "up-select-chevron-open" : ""}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M6 9.5L12 15.5L18 9.5" />
          </svg>
        </div>
      </button>

      {isOpen && pos && portalTarget && createPortal(
        <>
          <div
            style={{ position: "fixed", inset: 0, zIndex: 2147483646 }}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsOpen(false);
            }}
          />
          <div
            ref={dropdownRef}
            class="up-select-dropdown"
            onMouseDown={(e) => e.stopPropagation()}
            // This menu is portaled to document.body to escape host clipping and
            // stacking issues. Shadow-root styles do not cross that boundary, so
            // the overlay keeps its visual styles inline until overlays move to
            // their own shadow-root host.
            style={{
              position: "fixed",
              zIndex: 2147483647,
              display: "flex",
              flexDirection: "column",
              gap: "0",
              padding: "4px",
              left: `${pos.left}px`,
              width: `${pos.width}px`,
              background: "#1a1a1a",
              border: "1px solid #2a2a2a",
              borderRadius: "8px",
              boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
              fontFamily: "system-ui, -apple-system, 'SF Pro Display', sans-serif",
              fontSize: "13px",
              ...(pos.above
                ? { bottom: `${window.innerHeight - pos.top}px` }
                : { top: `${pos.top}px` }),
            }}
          >
            {normalized.map((opt) => (
              <button
                type="button"
                key={opt.value}
                class={`up-select-option ${opt.value === value ? "up-select-option-selected" : ""}`}
                onMouseEnter={() => setHoveredValue(opt.value)}
                onMouseLeave={() => setHoveredValue((current) => (current === opt.value ? null : current))}
                onClick={() => { onChange(opt.value); setIsOpen(false); }}
                style={{
                  display: "block",
                  width: "100%",
                  padding: "8px 10px",
                  fontFamily: "inherit",
                  fontSize: "13px",
                  fontWeight: "500",
                  color: opt.value === value ? "#ffffff" : "#a3a3a3",
                  background: opt.value === value
                    ? "#1e1e1e"
                    : hoveredValue === opt.value
                      ? "#141414"
                      : "transparent",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  textAlign: "left",
                  appearance: "none",
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </>,
        portalTarget
      )}
    </div>
  );
}
