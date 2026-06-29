import { describe, expect, it } from "vitest";
import { SeededRandom } from "./SeededRandom";

describe("SeededRandom", () => {
  it("generates the same sequence for the same seed", () => {
    const first = new SeededRandom("same-seed");
    const second = new SeededRandom("same-seed");

    expect([first.next(), first.next(), first.next()]).toEqual([
      second.next(),
      second.next(),
      second.next(),
    ]);
  });

  it("shuffles deterministically without mutating the source list", () => {
    const source = ["a", "b", "c", "d", "e"];
    const first = new SeededRandom("shuffle").shuffle(source);
    const second = new SeededRandom("shuffle").shuffle(source);

    expect(first).toEqual(second);
    expect(source).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("picks only items with positive weights", () => {
    const picked = new SeededRandom("weighted").weightedPick(
      [
        { id: "blocked", weight: 0 },
        { id: "available", weight: 1 },
      ],
      (item) => item.weight,
    );

    expect(picked.id).toBe("available");
  });

  it("rejects weighted picks without positive weights", () => {
    expect(() =>
      new SeededRandom("empty").weightedPick([{ weight: 0 }], (item) => item.weight),
    ).toThrow("positive weight");
  });
});
