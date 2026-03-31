import { beforeEach, describe, expect, test } from "vite-plus/test";
import {
  calculatePosition,
  calculateResizedSizeAndPosition,
  getBestCorner,
  MIN_HEIGHT,
  MIN_WIDTH,
  SAFE_AREA,
} from "../src/position.ts";

// Mock window dimensions
beforeEach(() => {
  Object.defineProperty(globalThis, "window", {
    value: { innerWidth: 1920, innerHeight: 1080 },
    writable: true,
    configurable: true,
  });
});

describe("calculatePosition", () => {
  test("top-left positions at safe area", () => {
    const pos = calculatePosition("top-left", 320, 400);
    expect(pos.x).toBe(SAFE_AREA);
    expect(pos.y).toBe(SAFE_AREA);
  });

  test("top-right positions at right edge", () => {
    const pos = calculatePosition("top-right", 320, 400);
    expect(pos.x).toBe(1920 - 320 - SAFE_AREA);
    expect(pos.y).toBe(SAFE_AREA);
  });

  test("bottom-right positions at bottom-right", () => {
    const pos = calculatePosition("bottom-right", 320, 400);
    expect(pos.x).toBe(1920 - 320 - SAFE_AREA);
    expect(pos.y).toBe(1080 - 400 - SAFE_AREA);
  });

  test("bottom-left positions at bottom-left", () => {
    const pos = calculatePosition("bottom-left", 320, 400);
    expect(pos.x).toBe(SAFE_AREA);
    expect(pos.y).toBe(1080 - 400 - SAFE_AREA);
  });
});

describe("getBestCorner", () => {
  test("moving right goes to right side", () => {
    const corner = getBestCorner(1500, 300, 800, 300, 60);
    expect(corner).toMatch(/right$/);
  });

  test("moving left goes to left side", () => {
    const corner = getBestCorner(200, 300, 900, 300, 60);
    expect(corner).toMatch(/left$/);
  });

  test("moving down goes to bottom", () => {
    const corner = getBestCorner(960, 900, 960, 200, 60);
    expect(corner).toMatch(/^bottom/);
  });

  test("no significant movement uses quadrant", () => {
    const corner = getBestCorner(100, 100, 100, 100, 60);
    expect(corner).toBe("top-left");

    const corner2 = getBestCorner(1800, 900, 1800, 900, 60);
    expect(corner2).toBe("bottom-right");
  });
});

describe("calculateResizedSizeAndPosition", () => {
  test("right handle increases width", () => {
    const result = calculateResizedSizeAndPosition(
      "right", 320, 400, 100, 100, 50, 0,
    );
    expect(result.width).toBe(370);
    expect(result.x).toBe(100);
  });

  test("respects minimum width", () => {
    const result = calculateResizedSizeAndPosition(
      "right", 320, 400, 100, 100, -200, 0,
    );
    expect(result.width).toBe(MIN_WIDTH);
  });

  test("left handle adjusts x and width", () => {
    const result = calculateResizedSizeAndPosition(
      "left", 320, 400, 500, 100, -50, 0,
    );
    expect(result.width).toBe(370);
    expect(result.x).toBe(450);
  });

  test("bottom handle increases height", () => {
    const result = calculateResizedSizeAndPosition(
      "bottom", 320, 400, 100, 100, 0, 80,
    );
    expect(result.height).toBe(480);
    expect(result.y).toBe(100);
  });

  test("respects minimum height", () => {
    const result = calculateResizedSizeAndPosition(
      "bottom", 320, 400, 100, 100, 0, -400,
    );
    expect(result.height).toBe(MIN_HEIGHT);
  });
});
