import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import type { ComponentChildren } from "preact";

type FolderProps = {
  title: string;
  defaultOpen?: boolean;
  children: ComponentChildren;
};

export function Folder({ title, defaultOpen = true, children }: FolderProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const contentRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | null>(null);

  const measure = useCallback(() => {
    if (innerRef.current) {
      setHeight(innerRef.current.offsetHeight);
    }
  }, []);

  useEffect(() => {
    measure();
    const ro = new ResizeObserver(measure);
    if (innerRef.current) ro.observe(innerRef.current);
    return () => ro.disconnect();
  }, [measure]);

  const toggle = useCallback(() => {
    if (!isOpen) measure();
    setIsOpen((prev) => !prev);
  }, [isOpen, measure]);

  return (
    <div class="up-folder">
      <div class="up-folder-header" onClick={toggle}>
        <span class="up-folder-title">{title}</span>
        <svg
          class={`up-folder-chevron ${isOpen ? "up-folder-chevron-open" : "up-folder-chevron-closed"}`}
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
      <div
        ref={contentRef}
        class="up-folder-content"
        style={{
          height: isOpen ? (height !== null ? `${height}px` : "auto") : "0px",
        }}
      >
        <div ref={innerRef} class="up-folder-inner">
          {children}
        </div>
      </div>
    </div>
  );
}
