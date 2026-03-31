import { describe, expect, test } from "vite-plus/test";
import type { ResolvedValues } from "../src/types.ts";

describe("ResolvedValues type inference", () => {
  test("type compiles correctly (compile-time check)", () => {
    type Config = {
      opacity: { type: "slider"; value: 0.5; min: 0; max: 1 };
      enabled: { type: "toggle"; value: true };
      reset: { type: "action"; label: "Reset" };
      mode: { type: "select"; options: ["fast", "slow"] };
      accent: { type: "color"; value: "#ff0000" };
      name: { type: "text"; value: "hello" };
      group: {
        type: "folder";
        children: {
          delay: { type: "slider"; value: 100; min: 0; max: 1000 };
        };
      };
    };

    type Resolved = ResolvedValues<Config>;

    // Actions are excluded from resolved values
    type _assertNoReset = Resolved extends { reset: unknown } ? never : true;
    const _noReset: _assertNoReset = true;

    // Slider resolves to number
    type _assertOpacity = Resolved["opacity"] extends number ? true : never;
    const _opacity: _assertOpacity = true;

    // Toggle resolves to boolean
    type _assertEnabled = Resolved["enabled"] extends boolean ? true : never;
    const _enabled: _assertEnabled = true;

    // Select resolves to string
    type _assertMode = Resolved["mode"] extends string ? true : never;
    const _mode: _assertMode = true;

    // Folder resolves recursively
    type _assertDelay = Resolved["group"]["delay"] extends number
      ? true
      : never;
    const _delay: _assertDelay = true;

    expect(_noReset && _opacity && _enabled && _mode && _delay).toBe(true);
  });
});
