import { afterEach, describe, expect, it, vi } from "vitest";
import { runReveals, runTypers, type Typer } from "./storyMotion";

interface FakeElement {
  node: HTMLElement;
  attributes: Map<string, string>;
}

function fakeElement(name: string, top: number, reads: string[]): FakeElement {
  const attributes = new Map<string, string>();
  const classes = new Set<string>();
  const node = {
    style: { opacity: "", transform: "" },
    textContent: "",
    getBoundingClientRect: () => {
      reads.push(name);
      return { top } as DOMRect;
    },
    setAttribute: (key: string, value: string) => attributes.set(key, value),
    classList: {
      add: (value: string) => classes.add(value),
      remove: (value: string) => classes.delete(value),
    },
    dataset: {},
  } as unknown as HTMLElement;
  return { node, attributes };
}

afterEach(() => vi.useRealTimers());

describe("runReveals", () => {
  it("reveals the crossed prefix and stops measuring at the first future block", () => {
    const reads: string[] = [];
    const first = fakeElement("first", 120, reads);
    const second = fakeElement("second", 700, reads);
    const future = fakeElement("future", 960, reads);
    const later = fakeElement("later", 2000, reads);
    const pending = [first.node, second.node, future.node, later.node];

    runReveals(pending, 1000);

    expect(reads).toEqual(["first", "second", "future"]);
    expect(pending).toEqual([future.node, later.node]);
    expect(first.attributes.get("data-rv")).toBe("done");
    expect(second.attributes.get("data-rv")).toBe("done");
    expect(future.attributes.has("data-rv")).toBe(false);
  });
});

describe("runTypers", () => {
  it("starts the crossed prefix and leaves later entries unmeasured", () => {
    vi.useFakeTimers();
    const reads: string[] = [];
    const first = fakeElement("first", 100, reads);
    const second = fakeElement("second", 300, reads);
    const future = fakeElement("future", 600, reads);
    const later = fakeElement("later", 900, reads);
    const pending: Typer[] = [
      { el: first.node, text: "a" },
      { el: second.node, text: "b" },
      { el: future.node, text: "c" },
      { el: later.node, text: "d" },
    ];
    const timers = new Set<ReturnType<typeof setTimeout>>();

    runTypers(pending, 1000, timers);

    expect(reads).toEqual(["first", "second", "future"]);
    expect(pending.map((entry) => entry.el)).toEqual([future.node, later.node]);
    expect(timers.size).toBe(2);
    for (const timer of timers) clearTimeout(timer);
  });
});
