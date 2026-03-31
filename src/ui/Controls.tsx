import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";

// ---------------------------------------------------------------------------
// Toggle (segmented On/Off)
// ---------------------------------------------------------------------------

type ToggleProps = {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
};

export function Toggle({ label, checked, onChange }: ToggleProps) {
  return (
    <div class="up-labeled-row">
      <span class="up-labeled-row-label">{label}</span>
      <SegmentedControl
        options={[
          { value: "off", label: "Off" },
          { value: "on", label: "On" },
        ]}
        value={checked ? "on" : "off"}
        onChange={(v) => onChange(v === "on")}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Segmented Control (shared by Toggle, TransitionControl mode picker)
// ---------------------------------------------------------------------------

type SegOption = { value: string; label: string };

type SegmentedControlProps = {
  options: SegOption[];
  value: string;
  onChange: (v: string) => void;
};

export function SegmentedControl({
  options,
  value,
  onChange,
}: SegmentedControlProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [pillStyle, setPillStyle] = useState<{
    left: number;
    width: number;
  } | null>(null);

  useLayoutEffect(() => {
    const btn = btnRefs.current.get(value);
    const container = containerRef.current;
    if (btn && container) {
      const cr = container.getBoundingClientRect();
      const br = btn.getBoundingClientRect();
      setPillStyle({ left: br.left - cr.left, width: br.width });
    }
  }, [value]);

  return (
    <div ref={containerRef} class="up-seg">
      {pillStyle && (
        <div
          class="up-seg-pill"
          style={{ left: `${pillStyle.left}px`, width: `${pillStyle.width}px` }}
        />
      )}
      {options.map((opt) => (
        <button
          key={opt.value}
          ref={(el) => {
            if (el) btnRefs.current.set(opt.value, el);
          }}
          class={`up-seg-btn ${value === opt.value ? "up-seg-btn-active" : ""}`}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Action button
// ---------------------------------------------------------------------------

type ActionProps = {
  label: string;
  onClick: () => void;
};

export function Action({ label, onClick }: ActionProps) {
  return (
    <button class="up-action" onClick={onClick}>
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Text input
// ---------------------------------------------------------------------------

type TextInputProps = {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
};

export function TextInput({ label, value, onChange, placeholder }: TextInputProps) {
  return (
    <div class="up-text-row">
      <span class="up-text-label">{label}</span>
      <input
        type="text"
        class="up-text-input"
        value={value}
        onInput={(e) => onChange((e.target as HTMLInputElement).value)}
        placeholder={placeholder}
        spellcheck={false}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Color picker
// ---------------------------------------------------------------------------

type ColorPickerProps = {
  label: string;
  value: string;
  onChange: (v: string) => void;
};

const HEX_RE = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/;

export function ColorPicker({ label, value, onChange }: ColorPickerProps) {
  const nativeRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  const submit = useCallback(() => {
    setEditing(false);
    if (HEX_RE.test(draft)) onChange(draft);
    else setDraft(value);
  }, [draft, onChange, value]);

  const expandHex = (hex: string) =>
    hex.length === 4
      ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
      : hex;

  return (
    <div class="up-color-row">
      <span class="up-color-label">{label}</span>
      <div class="up-color-inputs">
        {editing ? (
          <input
            type="text"
            class="up-color-hex-input"
            value={draft}
            onInput={(e) => setDraft((e.target as HTMLInputElement).value)}
            onBlur={submit}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
              if (e.key === "Escape") {
                setEditing(false);
                setDraft(value);
              }
            }}
            // biome-ignore lint/a11y/noAutofocus: inline edit
            autoFocus
          />
        ) : (
          <span class="up-color-hex" onClick={() => setEditing(true)}>
            {(value ?? "").toUpperCase()}
          </span>
        )}
        <button
          class="up-color-swatch"
          style={{ backgroundColor: value }}
          onClick={() => nativeRef.current?.click()}
          title="Pick color"
        />
        <input
          ref={nativeRef}
          type="color"
          class="up-color-native"
          value={expandHex(value).slice(0, 7)}
          onInput={(e) => onChange((e.target as HTMLInputElement).value)}
        />
      </div>
    </div>
  );
}
