import { describe, expect, it } from "vitest";
import { SeatLayout } from "../seats";
import type { Student } from "../students";
import { AssignmentEngine } from "./AssignmentEngine";
import type { AssignmentResult } from "./types";

describe("AssignmentEngine", () => {
  it("returns the same result for the same seed and input", () => {
    const engine = new AssignmentEngine();
    const seatLayout = createSeatLayout({ rows: 3, columns: 2 });
    const students: Student[] = [
      { id: "student-1", name: "A", preference: "front" },
      { id: "student-2", name: "B", preference: "front" },
      { id: "student-3", name: "C", preference: "middle" },
      { id: "student-4", name: "D", preference: null },
    ];

    const first = engine.assign({ students, seatLayout, seed: "same-seed" });
    const second = engine.assign({ students, seatLayout, seed: "same-seed" });

    expect(first).toEqual(second);
  });

  it("rejects empty students", () => {
    expect(() =>
      new AssignmentEngine().assign({
        students: [],
        seatLayout: createSeatLayout({ rows: 1, columns: 1 }),
        seed: "empty",
      }),
    ).toThrow("At least one student");
  });

  it("rejects student counts greater than available seats", () => {
    expect(() =>
      new AssignmentEngine().assign({
        students: [
          { id: "student-1", name: "A", preference: null },
          { id: "student-2", name: "B", preference: null },
        ],
        seatLayout: createSeatLayout({ rows: 1, columns: 1 }),
        seed: "too-many",
      }),
    ).toThrow("cannot exceed");
  });

  it("rejects duplicate student ids", () => {
    expect(() =>
      new AssignmentEngine().assign({
        students: [
          { id: "student-1", name: "A", preference: null },
          { id: "student-1", name: "B", preference: null },
        ],
        seatLayout: createSeatLayout({ rows: 1, columns: 2 }),
        seed: "duplicate",
      }),
    ).toThrow("unique");
  });

  it("rejects empty student names", () => {
    expect(() =>
      new AssignmentEngine().assign({
        students: [{ id: "student-1", name: "   ", preference: null }],
        seatLayout: createSeatLayout({ rows: 1, columns: 1 }),
        seed: "empty-name",
      }),
    ).toThrow("Student name cannot be empty");
  });

  it("does not assign unavailable seats and never duplicates students", () => {
    const result = new AssignmentEngine().assign({
      students: [
        { id: "student-1", name: "A", preference: null },
        { id: "student-2", name: "B", preference: null },
        { id: "student-3", name: "C", preference: null },
      ],
      seatLayout: createSeatLayout({
        rows: 2,
        columns: 2,
        unavailableSeatIds: ["1-1"],
      }),
      seed: "unavailable",
    });

    expect(result.seats.find((seat) => seat.id === "1-1")?.student).toBeUndefined();
    expect(getAssignedStudentIds(result).sort()).toEqual([
      "student-1",
      "student-2",
      "student-3",
    ]);
  });

  it("overflows front preference losers into middle seats first", () => {
    const result = new AssignmentEngine().assign({
      students: [
        { id: "student-1", name: "A", preference: "front" },
        { id: "student-2", name: "B", preference: "front" },
      ],
      seatLayout: createSeatLayout({ rows: 3, columns: 1 }),
      seed: "front-overflow",
    });

    expect(result.summary).toMatchObject({
      primaryAssignedCount: 1,
      firstOverflowAssignedCount: 1,
      secondOverflowAssignedCount: 0,
      unpreferredAssignedCount: 0,
      emptySeatCount: 1,
      manualSwapCount: 0,
    });
    expect(getAssignedStudentIds(result).sort()).toEqual([
      "student-1",
      "student-2",
    ]);
    expect(getAssignedZones(result).sort()).toEqual(["front", "middle"]);
  });

  it("overflows front preference losers into back seats after middle seats fill", () => {
    const result = new AssignmentEngine().assign({
      students: [
        { id: "student-1", name: "A", preference: "front" },
        { id: "student-2", name: "B", preference: "front" },
        { id: "student-3", name: "C", preference: "front" },
      ],
      seatLayout: createSeatLayout({ rows: 3, columns: 1 }),
      seed: "front-second-overflow",
    });

    expect(result.summary).toMatchObject({
      primaryAssignedCount: 1,
      firstOverflowAssignedCount: 1,
      secondOverflowAssignedCount: 1,
      unpreferredAssignedCount: 0,
      emptySeatCount: 0,
      manualSwapCount: 0,
    });
    expect(getAssignedStudentIds(result).sort()).toEqual([
      "student-1",
      "student-2",
      "student-3",
    ]);
    expect(getAssignedZones(result).sort()).toEqual(["back", "front", "middle"]);
    expect(result.steps.map((step) => step.preferenceDistance)).toEqual([
      0,
      1,
      2,
    ]);
  });

  it("places middle preference losers into either front or back without duplicate assignment", () => {
    const result = new AssignmentEngine().assign({
      students: [
        { id: "student-1", name: "A", preference: "middle" },
        { id: "student-2", name: "B", preference: "middle" },
      ],
      seatLayout: createSeatLayout({ rows: 3, columns: 1 }),
      seed: "middle-overflow",
    });

    expect(result.summary).toMatchObject({
      primaryAssignedCount: 1,
      firstOverflowAssignedCount: 1,
      secondOverflowAssignedCount: 0,
      unpreferredAssignedCount: 0,
      emptySeatCount: 1,
    });
    expect(new Set(getAssignedStudentIds(result)).size).toBe(2);
    expect(getAssignedZones(result)).toContain("middle");
    expect(getAssignedZones(result).some((zone) => zone === "front" || zone === "back"))
      .toBe(true);
  });

  it("assigns unpreferred students after preferred candidates", () => {
    const result = new AssignmentEngine().assign({
      students: [
        { id: "student-1", name: "A", preference: "front" },
        { id: "student-2", name: "B", preference: null },
        { id: "student-3", name: "C", preference: null },
      ],
      seatLayout: createSeatLayout({ rows: 3, columns: 1 }),
      seed: "unpreferred-last",
    });

    expect(result.summary).toMatchObject({
      primaryAssignedCount: 1,
      unpreferredAssignedCount: 2,
      emptySeatCount: 0,
    });
    expect(result.steps.map((step) => step.reason)).toEqual([
      "primary",
      "unpreferred",
      "unpreferred",
    ]);
    expect(getAssignedStudentIds(result).sort()).toEqual([
      "student-1",
      "student-2",
      "student-3",
    ]);
  });

  it("keeps zone sequence indexes contiguous for generated animation steps", () => {
    const result = new AssignmentEngine().assign({
      students: [
        { id: "student-1", name: "A", preference: "front" },
        { id: "student-2", name: "B", preference: "front" },
        { id: "student-3", name: "C", preference: "front" },
      ],
      seatLayout: createSeatLayout({ rows: 3, columns: 1 }),
      seed: "contiguous-zone-sequence",
    });

    expect(result.steps.map((step) => step.zoneSequenceIndex)).toEqual([
      0,
      1,
      2,
    ]);
  });

  it("includes candidate students and seats for animation playback", () => {
    const result = new AssignmentEngine().assign({
      students: [
        { id: "student-1", name: "A", preference: "front" },
        { id: "student-2", name: "B", preference: "front" },
      ],
      seatLayout: createSeatLayout({ rows: 3, columns: 1 }),
      seed: "animation-metadata",
    });

    expect(result.steps[0]).toMatchObject({
      zone: "front",
      reason: "primary",
      preferenceDistance: 0,
      candidateSeatIds: ["1-1"],
    });
    expect(result.steps[0]?.candidateStudentIds.sort()).toEqual([
      "student-1",
      "student-2",
    ]);
    expect(result.steps[0]?.selectedStudentId).toBeTruthy();
    expect(result.steps[0]?.selectedSeatId).toBe("1-1");
    expect(Object.values(result.steps[0]?.weightByStudentId ?? {})).toEqual([
      1,
      1,
    ]);
  });
});

function createSeatLayout(options: {
  rows: number;
  columns: number;
  unavailableSeatIds?: string[];
}): SeatLayout {
  return new SeatLayout({
    grid: { rows: options.rows, columns: options.columns },
    zones: createEvenZones(options.rows),
    unavailableSeatIds: options.unavailableSeatIds,
  });
}

function createEvenZones(rows: number) {
  if (rows === 1) {
    return { frontRows: 1, middleRows: 0, backRows: 0 };
  }

  if (rows === 2) {
    return { frontRows: 1, middleRows: 0, backRows: 1 };
  }

  return { frontRows: 1, middleRows: rows - 2, backRows: 1 };
}

function getAssignedStudentIds(result: AssignmentResult): string[] {
  return result.seats.flatMap((seat) => (seat.student ? [seat.student.id] : []));
}

function getAssignedZones(result: AssignmentResult): string[] {
  return result.seats.flatMap((seat) => (seat.student ? [seat.zone] : []));
}
