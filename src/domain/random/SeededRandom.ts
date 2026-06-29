import type { Seed } from "./types";

export class SeededRandom {
  private state: number;

  constructor(seed: Seed) {
    this.state = SeededRandom.hash(seed);
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;

    let value = this.state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);

    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  }

  nextInt(maxExclusive: number): number {
    if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
      throw new Error("maxExclusive must be a positive integer.");
    }

    return Math.floor(this.next() * maxExclusive);
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) {
      throw new Error("Cannot pick from an empty list.");
    }

    return items[this.nextInt(items.length)] as T;
  }

  shuffle<T>(items: readonly T[]): T[] {
    const shuffled = [...items];

    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swapIndex = this.nextInt(index + 1);
      [shuffled[index], shuffled[swapIndex]] = [
        shuffled[swapIndex] as T,
        shuffled[index] as T,
      ];
    }

    return shuffled;
  }

  weightedPick<T>(items: readonly T[], getWeight: (item: T) => number): T {
    const weightedItems = items
      .map((item) => ({ item, weight: getWeight(item) }))
      .filter(({ weight }) => Number.isFinite(weight) && weight > 0);

    if (weightedItems.length === 0) {
      throw new Error("Cannot pick without at least one positive weight.");
    }

    const totalWeight = weightedItems.reduce(
      (total, { weight }) => total + weight,
      0,
    );
    let threshold = this.next() * totalWeight;

    for (const { item, weight } of weightedItems) {
      threshold -= weight;

      if (threshold < 0) {
        return item;
      }
    }

    return weightedItems[weightedItems.length - 1]!.item;
  }

  private static hash(seed: Seed): number {
    let hash = 2_166_136_261;

    for (let index = 0; index < seed.length; index += 1) {
      hash ^= seed.charCodeAt(index);
      hash = Math.imul(hash, 16_777_619);
    }

    return hash >>> 0;
  }
}
