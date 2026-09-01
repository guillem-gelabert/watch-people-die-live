import { describe, expect, it } from "vitest";
import { nearestWithin, tapOutcome, TAP_RADIUS } from "./touchPick";

const at = (x: number, y: number, name = "") => ({ x, y, name });

describe("nearestWithin", () => {
  it("takes the nearest candidate inside the radius", () => {
    const picked = nearestWithin([at(0, 0, "far"), at(10, 10, "near")], 12, 12);
    expect(picked?.name).toBe("near");
  });

  it("answers null when the nearest is out of reach, so a tap on empty space dismisses", () => {
    expect(nearestWithin([at(0, 0)], 100, 100)).toBeNull();
  });

  it("reaches exactly a thumb's radius and no further", () => {
    expect(nearestWithin([at(0, 0)], TAP_RADIUS, 0)).not.toBeNull();
    expect(nearestWithin([at(0, 0)], TAP_RADIUS + 0.5, 0)).toBeNull();
  });

  it("picks the nearest of a clump rather than the first drawn", () => {
    // The case that makes a per-dot handler a lottery: twenty points inside one target.
    const clump = Array.from({ length: 20 }, (_, i) => at(100 + i * 0.5, 100, `p${i}`));
    expect(nearestWithin(clump, 109.5, 100)?.name).toBe("p19");
  });

  it("takes any distance when the radius is unbounded, which is what the curated charts pass", () => {
    // A tap far from every representative still lands on the nearest one: a Voronoi cell over them
    // without drawing one.
    const reps = [at(0, 0, "left"), at(300, 0, "right")];
    expect(nearestWithin(reps, 260, 200, Infinity)?.name).toBe("right");
    expect(nearestWithin(reps, 260, 200)).toBeNull();
  });

  it("breaks ties on the chart's own order, so a pick is stable across taps", () => {
    const tied = [at(0, 0, "first"), at(0, 0, "second")];
    expect(nearestWithin(tied, 1, 0)?.name).toBe("first");
    expect(nearestWithin(tied, 1, 0)?.name).toBe("first");
  });
});

describe("per-candidate reach", () => {
  it("lets a representative win from any distance while dots keep the thumb radius", () => {
    // The layered rule: a tap near a country dot gets that dot, and a tap in open space falls
    // through to the nearest labelled representative instead of finding nothing.
    const dot = { x: 100, y: 100, name: "dot" };
    const rep = { x: 300, y: 300, name: "rep", reach: Infinity };
    expect(nearestWithin([dot, rep], 105, 100)?.name).toBe("dot");
    expect(nearestWithin([dot, rep], 260, 260)?.name).toBe("rep");
    // And the nearer dot still wins when the finger is genuinely on it.
    expect(nearestWithin([dot, rep], 100, 100)?.name).toBe("dot");
  });

  it("still finds nothing when every candidate is out of its own reach", () => {
    expect(nearestWithin([{ x: 0, y: 0, reach: 5 }], 50, 0)).toBeNull();
  });
});

describe("tapOutcome", () => {
  it("opens what was picked", () => {
    expect(tapOutcome(null, "a").shown).toBe("a");
  });

  it("closes when the same point is tapped again — the only dismiss a finger has", () => {
    expect(tapOutcome("a", "a").shown).toBeNull();
  });

  it("moves straight to another point without a close in between", () => {
    expect(tapOutcome("a", "b").shown).toBe("b");
  });

  it("closes when a tap picks nothing", () => {
    expect(tapOutcome("a", null).shown).toBeNull();
  });
});
