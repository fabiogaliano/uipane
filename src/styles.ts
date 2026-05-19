export const STYLES = /* css */ `
:host {
  all: initial;
  font-family: system-ui, -apple-system, 'SF Pro Display', sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

/* ------------------------------------------------------------------ */
/* Variables                                                          */
/* ------------------------------------------------------------------ */

.up-root {
  --up-bg: #0A0A0A;
  --up-surface: #141414;
  --up-surface-hover: #1a1a1a;
  --up-surface-active: #1e1e1e;
  --up-border: #1e1e1e;
  --up-border-hover: #2a2a2a;
  --up-text-1: #ffffff;
  --up-text-2: #d4d4d4;
  --up-text-3: #a3a3a3;
  --up-text-4: #737373;
  --up-radius: 8px;
  --up-row-h: 36px;
  --up-transition: 0.15s ease;

  font-size: 13px;
  line-height: 1.4;
  color: var(--up-text-2);
}

/* ------------------------------------------------------------------ */
/* Shell                                                              */
/* ------------------------------------------------------------------ */

.up-shell {
  position: fixed;
  z-index: 2147483647;
  background: var(--up-bg);
  border: 1px solid var(--up-border);
  border-radius: 14px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.6);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  max-height: calc(100vh - 24px);
  transition: transform 0.25s cubic-bezier(0,0,0.2,1);
  user-select: none;
}

.up-shell-dragging {
  transition: none !important;
}

.up-content {
  overflow-y: auto;
  overflow-x: hidden;
  flex: 1;
  padding: 0 12px 12px;
  scrollbar-width: none;
}

.up-content::-webkit-scrollbar { display: none; }

/* ------------------------------------------------------------------ */
/* Header                                                             */
/* ------------------------------------------------------------------ */

.up-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px 8px;
  cursor: grab;
  border-bottom: 1px solid var(--up-border);
  flex-shrink: 0;
}

.up-header:active { cursor: grabbing; }

.up-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.up-header-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--up-text-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.up-header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.up-header-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: none;
  border: none;
  border-radius: 4px;
  color: var(--up-text-4);
  cursor: pointer;
  transition: color var(--up-transition), background var(--up-transition);
}

.up-header-btn:hover {
  color: var(--up-text-2);
  background: var(--up-surface);
}

.up-header-btn svg {
  width: 14px;
  height: 14px;
}

/* ------------------------------------------------------------------ */
/* Tabs                                                               */
/* ------------------------------------------------------------------ */

.up-tabs {
  display: flex;
  gap: 2px;
  padding: 6px 12px;
  border-bottom: 1px solid var(--up-border);
  flex-shrink: 0;
}

.up-tab {
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 500;
  color: var(--up-text-4);
  background: none;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: color var(--up-transition), background var(--up-transition);
}

.up-tab:hover { color: var(--up-text-3); background: var(--up-surface); }
.up-tab-active { color: var(--up-text-2); background: var(--up-surface-active); }

/* ------------------------------------------------------------------ */
/* Collapsed tab                                                      */
/* ------------------------------------------------------------------ */

.up-collapsed {
  position: fixed;
  z-index: 2147483647;
  width: 36px;
  height: 36px;
  background: var(--up-bg);
  border: 1px solid var(--up-border);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: grab;
  transition: transform 0.25s cubic-bezier(0,0,0.2,1), opacity 0.15s;
  box-shadow: 0 4px 16px rgba(0,0,0,0.4);
  color: var(--up-text-3);
}

.up-collapsed:hover { background: var(--up-surface); color: var(--up-text-1); }
.up-collapsed:active { cursor: grabbing; }

.up-collapsed svg {
  width: 16px;
  height: 16px;
}

/* ------------------------------------------------------------------ */
/* Resize handles                                                     */
/* ------------------------------------------------------------------ */

.up-resize {
  position: absolute;
  z-index: 10;
}

.up-resize-top    { top: -3px; left: 8px; right: 8px; height: 6px; cursor: ns-resize; }
.up-resize-bottom { bottom: -3px; left: 8px; right: 8px; height: 6px; cursor: ns-resize; }
.up-resize-left   { left: -3px; top: 8px; bottom: 8px; width: 6px; cursor: ew-resize; }
.up-resize-right  { right: -3px; top: 8px; bottom: 8px; width: 6px; cursor: ew-resize; }

.up-resize-top-left     { top: -3px; left: -3px; width: 12px; height: 12px; cursor: nwse-resize; }
.up-resize-top-right    { top: -3px; right: -3px; width: 12px; height: 12px; cursor: nesw-resize; }
.up-resize-bottom-left  { bottom: -3px; left: -3px; width: 12px; height: 12px; cursor: nesw-resize; }
.up-resize-bottom-right { bottom: -3px; right: -3px; width: 12px; height: 12px; cursor: nwse-resize; }

/* ------------------------------------------------------------------ */
/* Folder                                                             */
/* ------------------------------------------------------------------ */

.up-folder {
  margin-bottom: 2px;
}

.up-folder-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: var(--up-row-h);
  cursor: pointer;
  user-select: none;
}

.up-folder-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--up-text-3);
}

.up-folder-chevron {
  width: 16px;
  height: 16px;
  color: var(--up-text-4);
  transition: transform 0.2s cubic-bezier(0,0,0.2,1);
  flex-shrink: 0;
}

.up-folder-chevron-open { transform: rotate(0deg); }
.up-folder-chevron-closed { transform: rotate(-90deg); }

.up-folder-content {
  overflow: hidden;
  transition: height 0.25s cubic-bezier(0,0,0.2,1);
}

.up-folder-inner {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-bottom: 4px;
}

/* ------------------------------------------------------------------ */
/* Slider                                                             */
/* ------------------------------------------------------------------ */

.up-slider-wrap { position: relative; height: var(--up-row-h); }

.up-slider {
  position: absolute;
  inset: 0;
  cursor: pointer;
  user-select: none;
  overflow: hidden;
  background: var(--up-surface);
  border-radius: var(--up-radius);
  touch-action: none;
}

.up-slider-hashmarks {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.up-slider-hashmark {
  position: absolute;
  top: 50%;
  width: 1px;
  height: 8px;
  border-radius: 999px;
  transform: translateX(-50%) translateY(-50%);
  background: transparent;
  transition: background 0.2s;
}

.up-slider-active .up-slider-hashmark {
  background: rgba(255,255,255,0.15);
}

.up-slider-fill {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  pointer-events: none;
  transition: background 0.15s;
}

.up-slider-handle {
  position: absolute;
  top: 50%;
  width: 3px;
  height: 20px;
  border-radius: 999px;
  background: rgba(255,255,255,0.9);
  pointer-events: none;
  transform: translateY(-50%);
  opacity: 0;
  transition: opacity 0.15s;
}

.up-slider-active .up-slider-handle { opacity: 0.5; }
.up-slider-dragging .up-slider-handle { opacity: 0.9; }

.up-slider-label {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 13px;
  font-weight: 500;
  color: var(--up-text-3);
  pointer-events: none;
}

.up-slider-value {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 13px;
  font-weight: 500;
  font-family: ui-monospace, 'SF Mono', monospace;
  color: var(--up-text-3);
  pointer-events: auto;
  border-bottom: 1px solid transparent;
  padding-bottom: 1px;
  transition: color 0.15s;
}

.up-slider-active .up-slider-value { color: var(--up-text-1); }

.up-slider-value-editable {
  border-bottom-color: var(--up-text-4);
  cursor: text;
}

.up-slider-input {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  width: 5ch;
  font-size: 13px;
  font-weight: 500;
  font-family: ui-monospace, 'SF Mono', monospace;
  color: var(--up-text-1);
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--up-text-3);
  padding: 0 0 1px;
  outline: none;
  text-align: right;
}

/* ------------------------------------------------------------------ */
/* Toggle (segmented)                                                 */
/* ------------------------------------------------------------------ */

.up-labeled-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  height: var(--up-row-h);
  padding: 2px 10px 2px 12px;
  background: var(--up-surface);
  border-radius: var(--up-radius);
}

.up-labeled-row-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--up-text-3);
  flex-shrink: 0;
}

.up-seg {
  position: relative;
  display: flex;
  padding: 2px;
  border-radius: var(--up-radius);
  flex-shrink: 0;
}

.up-seg-pill {
  position: absolute;
  top: 2px;
  bottom: 2px;
  background: var(--up-surface-active);
  border-radius: 6px;
  z-index: 0;
  pointer-events: none;
  transition: left 0.2s cubic-bezier(0,0,0.2,1), width 0.2s cubic-bezier(0,0,0.2,1);
}

.up-seg-btn {
  position: relative;
  z-index: 1;
  flex: 1;
  padding: 6px 12px;
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: color 0.15s;
  color: var(--up-text-4);
}

.up-seg-btn-active { color: var(--up-text-2); }

/* ------------------------------------------------------------------ */
/* Action button                                                      */
/* ------------------------------------------------------------------ */

.up-action {
  width: 100%;
  padding: 10px 16px;
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
  color: var(--up-text-3);
  background: var(--up-surface);
  border: none;
  border-radius: var(--up-radius);
  cursor: pointer;
  transition: background var(--up-transition), color var(--up-transition);
}

.up-action:hover { background: var(--up-surface-hover); color: var(--up-text-2); }
.up-action:active { background: var(--up-surface-active); }

/* ------------------------------------------------------------------ */
/* Select                                                             */
/* ------------------------------------------------------------------ */

.up-select-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  height: var(--up-row-h);
  padding: 0 12px;
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
  color: var(--up-text-3);
  background: var(--up-surface);
  border: none;
  border-radius: var(--up-radius);
  cursor: pointer;
  transition: background var(--up-transition);
}

.up-select-trigger:hover { background: var(--up-surface-hover); }
.up-select-trigger-open { background: var(--up-surface-active); }

.up-select-right {
  display: flex;
  align-items: center;
  gap: 6px;
}

.up-select-value {
  font-size: 13px;
  font-weight: 500;
  color: var(--up-text-3);
}

.up-select-chevron {
  width: 16px;
  height: 16px;
  color: var(--up-text-4);
  transition: transform 0.2s cubic-bezier(0,0,0.2,1);
  flex-shrink: 0;
}

.up-select-chevron-open { transform: rotate(180deg); }

.up-select-dropdown {
  position: absolute;
  background: #1a1a1a;
  border: 1px solid var(--up-border-hover);
  border-radius: var(--up-radius);
  padding: 4px;
  z-index: 10;
  box-shadow: 0 8px 24px rgba(0,0,0,0.5);
  animation: up-dropdown-in 0.15s cubic-bezier(0,0,0.2,1);
}

@keyframes up-dropdown-in {
  from { opacity: 0; transform: translateY(-4px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}

.up-select-option {
  display: block;
  width: 100%;
  padding: 8px 10px;
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
  color: var(--up-text-3);
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  text-align: left;
  transition: background var(--up-transition);
}

.up-select-option:hover { background: var(--up-surface-hover); }
.up-select-option-selected { color: var(--up-text-1); background: var(--up-surface-active); }

/* ------------------------------------------------------------------ */
/* Text input                                                         */
/* ------------------------------------------------------------------ */

.up-text-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  height: var(--up-row-h);
  padding: 0 12px;
  background: var(--up-surface);
  border-radius: var(--up-radius);
}

.up-text-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--up-text-3);
  flex-shrink: 0;
}

.up-text-input {
  flex: 1;
  min-width: 0;
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
  color: var(--up-text-3);
  background: transparent;
  border: none;
  padding: 0;
  outline: none;
  text-align: right;
}

.up-text-input:focus { color: var(--up-text-1); }
.up-text-input::placeholder { color: var(--up-text-4); }

/* ------------------------------------------------------------------ */
/* Color                                                              */
/* ------------------------------------------------------------------ */

.up-color-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  height: var(--up-row-h);
  padding: 0 12px;
  background: var(--up-surface);
  border-radius: var(--up-radius);
}

.up-color-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--up-text-3);
  flex-shrink: 0;
}

.up-color-inputs {
  display: flex;
  align-items: center;
  gap: 8px;
}

.up-color-hex {
  font-size: 13px;
  font-weight: 500;
  font-family: ui-monospace, 'SF Mono', monospace;
  color: var(--up-text-3);
  cursor: text;
}

.up-color-hex-input {
  width: 7ch;
  font-size: 13px;
  font-weight: 500;
  font-family: ui-monospace, 'SF Mono', monospace;
  color: var(--up-text-3);
  background: transparent;
  border: none;
  padding: 0;
  outline: none;
  text-transform: uppercase;
}

.up-color-hex-input:focus { color: var(--up-text-1); }

.up-color-swatch {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  border: 1px solid var(--up-border-hover);
  cursor: pointer;
  transition: transform 0.15s;
  flex-shrink: 0;
}

.up-color-swatch:hover { transform: scale(1.1); }

.up-color-native {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
  pointer-events: none;
}

/* ------------------------------------------------------------------ */
/* Spring/Easing visualization                                        */
/* ------------------------------------------------------------------ */

.up-viz {
  width: 100%;
  border-radius: var(--up-radius);
  background: var(--up-surface);
  overflow: visible;
}

/* ------------------------------------------------------------------ */
/* Preset manager                                                     */
/* ------------------------------------------------------------------ */

.up-preset-bar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border-bottom: 1px solid var(--up-border);
  flex-shrink: 0;
}

.up-preset-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex: 1;
  height: 28px;
  padding: 0 10px;
  font-family: inherit;
  font-size: 12px;
  font-weight: 500;
  color: var(--up-text-3);
  background: var(--up-surface);
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: background var(--up-transition);
}

.up-preset-trigger:hover { background: var(--up-surface-hover); }

.up-preset-add {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: var(--up-surface);
  border: none;
  border-radius: 6px;
  cursor: pointer;
  color: var(--up-text-4);
  flex-shrink: 0;
  transition: background var(--up-transition), color var(--up-transition);
}

.up-preset-add:hover { background: var(--up-surface-hover); color: var(--up-text-2); }

.up-preset-add svg {
  width: 14px;
  height: 14px;
}

.up-preset-dropdown {
  position: absolute;
  background: #1a1a1a;
  border: 1px solid var(--up-border-hover);
  border-radius: 10px;
  padding: 4px;
  z-index: 20;
  box-shadow: 0 8px 24px rgba(0,0,0,0.5);
  min-width: 140px;
  animation: up-dropdown-in 0.15s cubic-bezier(0,0,0.2,1);
}

.up-preset-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  gap: 8px;
  border-radius: 6px;
  cursor: pointer;
  transition: background var(--up-transition);
  font-size: 12px;
  font-weight: 500;
  color: var(--up-text-3);
}

.up-preset-item:hover { background: var(--up-surface-hover); }
.up-preset-item-active { color: var(--up-text-1); background: var(--up-surface-active); }

.up-preset-delete {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  background: none;
  border: none;
  cursor: pointer;
  opacity: 0;
  color: var(--up-text-4);
  flex-shrink: 0;
  transition: opacity var(--up-transition);
}

.up-preset-item:hover .up-preset-delete { opacity: 0.6; }
.up-preset-delete:hover { opacity: 1 !important; }

.up-preset-delete svg {
  width: 12px;
  height: 12px;
}

/* ------------------------------------------------------------------ */
/* Copy button                                                        */
/* ------------------------------------------------------------------ */

.up-copy-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: var(--up-surface);
  border: none;
  border-radius: 6px;
  cursor: pointer;
  color: var(--up-text-4);
  flex-shrink: 0;
  transition: background var(--up-transition), color var(--up-transition);
}

.up-copy-btn:hover { background: var(--up-surface-hover); color: var(--up-text-2); }

.up-copy-btn svg {
  width: 14px;
  height: 14px;
}

/* ------------------------------------------------------------------ */
/* Slot                                                               */
/* ------------------------------------------------------------------ */

.up-slot-wrap {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.up-slot-wrap-empty {
  display: none;
}

.up-slot {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.up-slot-label {
  font-size: 11px;
  color: var(--up-text-3);
  padding: 0 2px;
}

/* ------------------------------------------------------------------ */
/* Panel section                                                      */
/* ------------------------------------------------------------------ */

.up-panel-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

/* ------------------------------------------------------------------ */
/* Children slot                                                      */
/* ------------------------------------------------------------------ */

.up-children {
  padding: 0 0 10px;
  margin-bottom: 10px;
  border-bottom: 1px solid var(--up-border);
}

.up-children:empty {
  display: none;
}

/* ------------------------------------------------------------------ */
/* Portal container (for dropdowns inside shadow DOM)                  */
/* ------------------------------------------------------------------ */

.up-portal {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 2147483647;
  pointer-events: none;
}

.up-portal > * {
  pointer-events: auto;
}
`;
