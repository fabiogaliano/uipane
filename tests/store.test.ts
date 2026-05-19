import { beforeEach, describe, expect, test, vi } from "vite-plus/test";
import { PaneStore } from "../src/store.ts";

// Reset store between tests by unregistering all panels
function resetStore() {
  for (const panel of PaneStore.getPanels()) {
    PaneStore.unregisterPanel(panel.id);
  }
}

beforeEach(resetStore);

describe("PaneStore", () => {
  test("registerPanel adds panel and notifies global", () => {
    const listener = vi.fn();
    const unsub = PaneStore.subscribeGlobal(listener);

    PaneStore.registerPanel("test", "Test Panel", {
      opacity: { type: "slider", value: 0.5, min: 0, max: 1 },
    });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(PaneStore.getPanels()).toHaveLength(1);
    expect(PaneStore.getPanel("test")?.name).toBe("Test Panel");
    unsub();
  });

  test("getValue returns flattened values", () => {
    PaneStore.registerPanel("p1", "P1", {
      x: { type: "slider", value: 42, min: 0, max: 100 },
      on: { type: "toggle", value: true },
    });

    expect(PaneStore.getValue("p1", "x")).toBe(42);
    expect(PaneStore.getValue("p1", "on")).toBe(true);
  });

  test("updateValue changes value and notifies", () => {
    PaneStore.registerPanel("p1", "P1", {
      x: { type: "slider", value: 10, min: 0, max: 100 },
    });

    const listener = vi.fn();
    const unsub = PaneStore.subscribe("p1", listener);

    PaneStore.updateValue("p1", "x", 50);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(PaneStore.getValue("p1", "x")).toBe(50);
    unsub();
  });

  test("unregisterPanel removes panel", () => {
    PaneStore.registerPanel("p1", "P1", {
      x: { type: "slider", value: 1, min: 0, max: 10 },
    });

    expect(PaneStore.getPanels()).toHaveLength(1);
    PaneStore.unregisterPanel("p1");
    expect(PaneStore.getPanels()).toHaveLength(0);
  });

  test("folder values are flattened with dot paths", () => {
    PaneStore.registerPanel("p1", "P1", {
      timing: {
        type: "folder",
        children: {
          delay: { type: "slider", value: 100, min: 0, max: 1000 },
          enabled: { type: "toggle", value: false },
        },
      },
    });

    expect(PaneStore.getValue("p1", "timing.delay")).toBe(100);
    expect(PaneStore.getValue("p1", "timing.enabled")).toBe(false);
  });

  test("actions trigger action listeners", () => {
    PaneStore.registerPanel("p1", "P1", {
      doIt: { type: "action", label: "Do It" },
    });

    const listener = vi.fn();
    const unsub = PaneStore.subscribeActions("p1", listener);

    PaneStore.triggerAction("p1", "doIt");

    expect(listener).toHaveBeenCalledWith("doIt");
    unsub();
  });

  test("select defaults to first option when no value specified", () => {
    PaneStore.registerPanel("p1", "P1", {
      mode: { type: "select", options: ["fast", "slow"] },
    });

    expect(PaneStore.getValue("p1", "mode")).toBe("fast");
  });

  test("presets: save, load, delete", () => {
    PaneStore.registerPanel("p1", "P1", {
      x: { type: "slider", value: 10, min: 0, max: 100 },
    });

    PaneStore.updateValue("p1", "x", 50);
    const presetId = PaneStore.savePreset("p1", "My Preset");

    expect(PaneStore.getPresets("p1")).toHaveLength(1);
    expect(PaneStore.getActivePresetId("p1")).toBe(presetId);

    PaneStore.updateValue("p1", "x", 75);
    PaneStore.clearActivePreset("p1");
    // base was updated to 50 before preset was saved
    expect(PaneStore.getValue("p1", "x")).toBe(50);

    PaneStore.loadPreset("p1", presetId);
    expect(PaneStore.getValue("p1", "x")).toBe(75);

    PaneStore.deletePreset("p1", presetId);
    expect(PaneStore.getPresets("p1")).toHaveLength(0);
  });

  test("updatePanel preserves existing values for same-type controls", () => {
    PaneStore.registerPanel("p1", "P1", {
      x: { type: "slider", value: 10, min: 0, max: 100 },
    });

    PaneStore.updateValue("p1", "x", 50);

    PaneStore.updatePanel("p1", "P1", {
      x: { type: "slider", value: 10, min: 0, max: 100 },
      y: { type: "slider", value: 20, min: 0, max: 100 },
    });

    expect(PaneStore.getValue("p1", "x")).toBe(50);
    expect(PaneStore.getValue("p1", "y")).toBe(20);
  });

  test("color defaults to #000000 when no value", () => {
    PaneStore.registerPanel("p1", "P1", {
      c: { type: "color" },
    });

    expect(PaneStore.getValue("p1", "c")).toBe("#000000");
  });

  test("text defaults to empty string when no value", () => {
    PaneStore.registerPanel("p1", "P1", {
      t: { type: "text" },
    });

    expect(PaneStore.getValue("p1", "t")).toBe("");
  });

  test("transition modes are initialized from config", () => {
    PaneStore.registerPanel("p1", "P1", {
      springy: { type: "spring", stiffness: 200, damping: 25, mass: 1 },
      eased: { type: "easing", duration: 0.3, ease: [0.4, 0, 0.2, 1] },
    });

    expect(PaneStore.getTransitionMode("p1", "springy")).toBe("advanced");
    expect(PaneStore.getTransitionMode("p1", "eased")).toBe("easing");
  });

  test("setSlotNode registers and getSlotNode retrieves it", () => {
    PaneStore.registerPanel("p1", "P1", {
      x: { type: "slider", value: 1, min: 0, max: 10 },
    });

    const node = {} as HTMLDivElement;
    PaneStore.setSlotNode("p1", "mySlot", node);
    expect(PaneStore.getSlotNode("p1", "mySlot")).toBe(node);
  });

  test("setSlotNode(null) removes the node", () => {
    PaneStore.registerPanel("p1", "P1", {
      x: { type: "slider", value: 1, min: 0, max: 10 },
    });

    const node = {} as HTMLDivElement;
    PaneStore.setSlotNode("p1", "mySlot", node);
    PaneStore.setSlotNode("p1", "mySlot", null);
    expect(PaneStore.getSlotNode("p1", "mySlot")).toBeNull();
  });

  test("subscribeSlot fires on register and unregister", () => {
    PaneStore.registerPanel("p1", "P1", {
      x: { type: "slider", value: 1, min: 0, max: 10 },
    });

    const listener = vi.fn();
    const unsub = PaneStore.subscribeSlot("p1", "mySlot", listener);

    const node = {} as HTMLDivElement;
    PaneStore.setSlotNode("p1", "mySlot", node);
    expect(listener).toHaveBeenCalledTimes(1);

    PaneStore.setSlotNode("p1", "mySlot", null);
    expect(listener).toHaveBeenCalledTimes(2);

    unsub();
  });

  test("setSlotNode no-ops when value unchanged", () => {
    PaneStore.registerPanel("p1", "P1", {
      x: { type: "slider", value: 1, min: 0, max: 10 },
    });

    const listener = vi.fn();
    PaneStore.subscribeSlot("p1", "mySlot", listener);

    const node = {} as HTMLDivElement;
    PaneStore.setSlotNode("p1", "mySlot", node);
    PaneStore.setSlotNode("p1", "mySlot", node);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  test("unregisterPanel clears slot nodes and notifies slot subscribers", () => {
    PaneStore.registerPanel("p1", "P1", {
      x: { type: "slider", value: 1, min: 0, max: 10 },
    });

    const node = {} as HTMLDivElement;
    PaneStore.setSlotNode("p1", "mySlot", node);

    const listener = vi.fn();
    PaneStore.subscribeSlot("p1", "mySlot", listener);

    PaneStore.unregisterPanel("p1");
    expect(listener).toHaveBeenCalledTimes(1);
    expect(PaneStore.getSlotNode("p1", "mySlot")).toBeNull();
  });

  test("getValues returns frozen snapshot", () => {
    PaneStore.registerPanel("p1", "P1", {
      x: { type: "slider", value: 5, min: 0, max: 10 },
    });

    const v1 = PaneStore.getValues("p1");
    PaneStore.updateValue("p1", "x", 8);
    const v2 = PaneStore.getValues("p1");

    expect(v1).not.toBe(v2);
    expect(v1["x"]).toBe(5);
    expect(v2["x"]).toBe(8);
  });
});
