import { describe, expect, test } from "vite-plus/test";
import { flattenValues, normalizeSelectOptions, parseConfig } from "../src/config.ts";

describe("parseConfig", () => {
  test("slider produces correct ControlMeta", () => {
    const controls = parseConfig(
      { opacity: { type: "slider", value: 0.5, min: 0, max: 1, step: 0.01 } },
      "",
    );

    expect(controls).toHaveLength(1);
    expect(controls[0]).toMatchObject({
      type: "slider",
      path: "opacity",
      label: "Opacity",
      min: 0,
      max: 1,
      step: 0.01,
    });
  });

  test("toggle produces correct ControlMeta", () => {
    const controls = parseConfig(
      { autoSave: { type: "toggle", value: true } },
      "",
    );

    expect(controls[0]).toMatchObject({
      type: "toggle",
      path: "autoSave",
      label: "Auto Save",
    });
  });

  test("action produces correct ControlMeta with custom label", () => {
    const controls = parseConfig(
      { doReset: { type: "action", label: "Reset Everything" } },
      "",
    );

    expect(controls[0]).toMatchObject({
      type: "action",
      path: "doReset",
      label: "Reset Everything",
    });
  });

  test("folder nests children and applies prefix", () => {
    const controls = parseConfig(
      {
        timing: {
          type: "folder",
          open: false,
          children: {
            delay: { type: "slider", value: 100, min: 0, max: 1000 },
          },
        },
      },
      "",
    );

    expect(controls).toHaveLength(1);
    expect(controls[0]?.type).toBe("folder");
    expect(controls[0]?.defaultOpen).toBe(false);
    expect(controls[0]?.children).toHaveLength(1);
    expect(controls[0]?.children?.[0]?.path).toBe("timing.delay");
  });

  test("step is inferred when not provided", () => {
    const controls = parseConfig(
      { big: { type: "slider", value: 500, min: 0, max: 5000 } },
      "",
    );
    expect(controls[0]?.step).toBe(10);
  });

  test("select, color, text produce correct types", () => {
    const controls = parseConfig(
      {
        mode: { type: "select", options: ["a", "b"] },
        accent: { type: "color", value: "#ff0000" },
        name: { type: "text", placeholder: "Enter name" },
      },
      "",
    );

    expect(controls[0]?.type).toBe("select");
    expect(controls[1]?.type).toBe("color");
    expect(controls[2]?.type).toBe("text");
    expect(controls[2]?.placeholder).toBe("Enter name");
  });

  test("spring and easing become transition type", () => {
    const controls = parseConfig(
      {
        s: { type: "spring", stiffness: 200, damping: 25, mass: 1 },
        e: { type: "easing", duration: 0.3, ease: [0.4, 0, 0.2, 1] },
      },
      "",
    );

    expect(controls[0]?.type).toBe("transition");
    expect(controls[1]?.type).toBe("transition");
  });
});

describe("flattenValues", () => {
  test("flattens nested folder values with dot paths", () => {
    const values = flattenValues(
      {
        x: { type: "slider", value: 5, min: 0, max: 10 },
        group: {
          type: "folder",
          children: {
            y: { type: "slider", value: 3, min: 0, max: 10 },
            on: { type: "toggle", value: true },
          },
        },
      },
      "",
    );

    expect(values).toMatchObject({
      x: 5,
      "group.y": 3,
      "group.on": true,
    });
  });

  test("select defaults to first option", () => {
    const values = flattenValues(
      {
        mode: {
          type: "select",
          options: [{ value: "fast", label: "Fast" }, "slow"],
        },
      },
      "",
    );

    expect(values["mode"]).toBe("fast");
  });

  test("color and text use defaults", () => {
    const values = flattenValues(
      {
        c: { type: "color" },
        t: { type: "text", value: "hello" },
      },
      "",
    );

    expect(values["c"]).toBe("#000000");
    expect(values["t"]).toBe("hello");
  });
});

describe("normalizeSelectOptions", () => {
  test("converts strings to value/label objects", () => {
    const result = normalizeSelectOptions(["fast", "slow"]);
    expect(result).toEqual([
      { value: "fast", label: "Fast" },
      { value: "slow", label: "Slow" },
    ]);
  });

  test("passes through objects unchanged", () => {
    const input = [{ value: "a", label: "Alpha" }];
    expect(normalizeSelectOptions(input)).toEqual(input);
  });
});
