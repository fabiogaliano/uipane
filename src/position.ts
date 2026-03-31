import type { Corner } from "./types.ts";

export const SAFE_AREA = 12;
export const MIN_WIDTH = 280;
export const MIN_HEIGHT = 200;
export const COLLAPSED_SIZE = 36;

export function calculatePosition(
  corner: Corner,
  width: number,
  height: number,
): { x: number; y: number } {
  const ww = window.innerWidth;
  const wh = window.innerHeight;
  const right = ww - width - SAFE_AREA;
  const bottom = wh - height - SAFE_AREA;

  switch (corner) {
    case "top-left":
      return { x: SAFE_AREA, y: SAFE_AREA };
    case "top-right":
      return { x: right, y: SAFE_AREA };
    case "bottom-left":
      return { x: SAFE_AREA, y: bottom };
    case "bottom-right":
      return { x: right, y: bottom };
  }
}

export function getBestCorner(
  mouseX: number,
  mouseY: number,
  initialMouseX: number,
  initialMouseY: number,
  threshold = 60,
): Corner {
  const dx = mouseX - initialMouseX;
  const dy = mouseY - initialMouseY;
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2;

  const movingRight = dx > threshold;
  const movingLeft = dx < -threshold;
  const movingDown = dy > threshold;
  const movingUp = dy < -threshold;

  if (movingRight || movingLeft) {
    const isBottom = mouseY > cy;
    return movingRight
      ? isBottom
        ? "bottom-right"
        : "top-right"
      : isBottom
        ? "bottom-left"
        : "top-left";
  }

  if (movingDown || movingUp) {
    const isRight = mouseX > cx;
    return movingDown
      ? isRight
        ? "bottom-right"
        : "bottom-left"
      : isRight
        ? "top-right"
        : "top-left";
  }

  return mouseX > cx
    ? mouseY > cy
      ? "bottom-right"
      : "top-right"
    : mouseY > cy
      ? "bottom-left"
      : "top-left";
}

export function getCollapsedPosition(
  corner: Corner,
  orientation: "horizontal" | "vertical",
): { x: number; y: number } {
  const ww = window.innerWidth;
  const wh = window.innerHeight;
  const half = COLLAPSED_SIZE / 2;

  if (orientation === "horizontal") {
    const y = corner.startsWith("top")
      ? SAFE_AREA + 60
      : wh - SAFE_AREA - COLLAPSED_SIZE - 60;
    return corner.endsWith("left")
      ? { x: -half, y }
      : { x: ww - half, y };
  }

  const x = corner.endsWith("left")
    ? SAFE_AREA + 60
    : ww - SAFE_AREA - COLLAPSED_SIZE - 60;
  return corner.startsWith("top")
    ? { x, y: -half }
    : { x, y: wh - half };
}

export function clampPosition(
  x: number,
  y: number,
  width: number,
  height: number,
): { x: number; y: number } {
  return {
    x: Math.max(SAFE_AREA, Math.min(x, window.innerWidth - width - SAFE_AREA)),
    y: Math.max(
      SAFE_AREA,
      Math.min(y, window.innerHeight - height - SAFE_AREA),
    ),
  };
}

export function calculateResizedSizeAndPosition(
  handle: string,
  initialWidth: number,
  initialHeight: number,
  initialX: number,
  initialY: number,
  deltaX: number,
  deltaY: number,
): { width: number; height: number; x: number; y: number } {
  const maxW = window.innerWidth - SAFE_AREA * 2;
  const maxH = window.innerHeight - SAFE_AREA * 2;
  let w = initialWidth;
  let h = initialHeight;
  let x = initialX;
  let y = initialY;

  if (handle.includes("right")) {
    const avail = window.innerWidth - initialX - SAFE_AREA;
    w = Math.min(maxW, Math.max(MIN_WIDTH, Math.min(initialWidth + deltaX, avail)));
  }
  if (handle.includes("left")) {
    const avail = initialX + initialWidth - SAFE_AREA;
    const proposed = Math.min(maxW, Math.max(MIN_WIDTH, Math.min(initialWidth - deltaX, avail)));
    x = initialX - (proposed - initialWidth);
    w = proposed;
  }
  if (handle.includes("bottom")) {
    const avail = window.innerHeight - initialY - SAFE_AREA;
    h = Math.min(maxH, Math.max(MIN_HEIGHT, Math.min(initialHeight + deltaY, avail)));
  }
  if (handle.includes("top")) {
    const avail = initialY + initialHeight - SAFE_AREA;
    const proposed = Math.min(maxH, Math.max(MIN_HEIGHT, Math.min(initialHeight - deltaY, avail)));
    y = initialY - (proposed - initialHeight);
    h = proposed;
  }

  return { width: w, height: h, x, y };
}
