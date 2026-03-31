import { useCallback, useEffect, useRef, useState } from "preact/hooks";
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
    const above = spaceBelow < ddHeight && rect.top > spaceBelow;
    setPos({ top: above ? rect.top - 4 : rect.bottom + 4, left: rect.left, width: rect.width, above });
  }, [normalized.length]);

  useEffect(() => {
    if (!isOpen) return;
    updatePos();
  }, [isOpen, updatePos]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (
        triggerRef.current?.contains(t) ||
        dropdownRef.current?.contains(t)
      )
        return;
      setIsOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  return (
    <div>
      <button
        ref={triggerRef}
        class={`up-select-trigger ${isOpen ? "up-select-trigger-open" : ""}`}
        onClick={() => setIsOpen(!isOpen)}
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

      {isOpen && pos && portalContainer && (
        <div
          ref={dropdownRef}
          class="up-select-dropdown"
          style={{
            position: "fixed",
            left: `${pos.left}px`,
            width: `${pos.width}px`,
            ...(pos.above
              ? { bottom: `${window.innerHeight - pos.top}px` }
              : { top: `${pos.top}px` }),
          }}
        >
          {normalized.map((opt) => (
            <button
              key={opt.value}
              class={`up-select-option ${opt.value === value ? "up-select-option-selected" : ""}`}
              onClick={() => {
                onChange(opt.value);
                setIsOpen(false);
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
