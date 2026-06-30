import { describe, expect, it } from "vitest";
import { SeatLayout, type ZoneRowConfig } from "../seats";
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

    expect(
      result.seats.find((seat) => seat.id === "1-1")?.student,
    ).toBeUndefined();
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
    expect(getAssignedZones(result).sort()).toEqual([
      "back",
      "front",
      "middle",
    ]);
    expect(result.steps.map((step) => step.preferenceDistance)).toEqual([
      0, 1, 2,
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
    expect(
      getAssignedZones(result).some(
        (zone) => zone === "front" || zone === "back",
      ),
    ).toBe(true);
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
      0, 1, 2,
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
      1, 1,
    ]);
  });

  it("overflows preferred students when their primary zone has no available seats", () => {
    const result = new AssignmentEngine().assign({
      students: [
        { id: "student-1", name: "A", preference: "front" },
        { id: "student-2", name: "B", preference: "front" },
      ],
      seatLayout: createSeatLayout({
        rows: 3,
        columns: 1,
        unavailableSeatIds: ["1-1"],
      }),
      seed: "blocked-primary-zone",
    });

    expect(result.summary).toMatchObject({
      primaryAssignedCount: 0,
      firstOverflowAssignedCount: 1,
      secondOverflowAssignedCount: 1,
      unpreferredAssignedCount: 0,
      emptySeatCount: 0,
    });
    expect(getAssignedStudentIds(result).sort()).toEqual([
      "student-1",
      "student-2",
    ]);
    expect(getAssignedZones(result).sort()).toEqual(["back", "middle"]);
    expect(result.steps.map((step) => step.preferenceDistance)).toEqual([1, 2]);
  });

  it("respects custom zone row configuration during assignment", () => {
    const result = new AssignmentEngine().assign({
      students: [
        { id: "front-student", name: "A", preference: "front" },
        { id: "middle-student", name: "B", preference: "middle" },
        { id: "back-student", name: "C", preference: "back" },
      ],
      seatLayout: createSeatLayout({
        rows: 6,
        columns: 1,
        zones: { frontRows: 2, middleRows: 1, backRows: 3 },
      }),
      seed: "custom-zone-rows",
    });

    expect(getAssignedSeatByStudentId(result, "front-student")?.zone).toBe(
      "front",
    );
    expect(getAssignedSeatByStudentId(result, "middle-student")?.zone).toBe(
      "middle",
    );
    expect(getAssignedSeatByStudentId(result, "back-student")?.zone).toBe(
      "back",
    );
    expect(result.summary.primaryAssignedCount).toBe(3);
  });

  it("fills every available seat when student count matches available seats", () => {
    const result = new AssignmentEngine().assign({
      students: [
        { id: "student-1", name: "A", preference: "front" },
        { id: "student-2", name: "B", preference: "middle" },
        { id: "student-3", name: "C", preference: null },
      ],
      seatLayout: createSeatLayout({
        rows: 2,
        columns: 2,
        unavailableSeatIds: ["2-2"],
      }),
      seed: "exact-seat-count",
    });

    expect(result.summary.emptySeatCount).toBe(0);
    expect(
      result.seats.filter((seat) => seat.status === "available"),
    ).toHaveLength(3);
    expect(result.seats.filter((seat) => seat.student)).toHaveLength(3);
    expect(
      result.seats.find((seat) => seat.id === "2-2")?.student,
    ).toBeUndefined();
  });

  it("keeps every animation step internally consistent", () => {
    const result = new AssignmentEngine().assign({
      students: [
        { id: "student-1", name: "A", preference: "front" },
        { id: "student-2", name: "B", preference: "front" },
        { id: "student-3", name: "C", preference: "front" },
        { id: "student-4", name: "D", preference: "middle" },
        { id: "student-5", name: "E", preference: null },
      ],
      seatLayout: createSeatLayout({
        rows: 3,
        columns: 2,
        unavailableSeatIds: ["2-2"],
      }),
      seed: "step-consistency",
    });
    const seatsById = new Map(result.seats.map((seat) => [seat.id, seat]));

    result.steps.forEach((step, index) => {
      expect(step.id).toBe(`step-${index + 1}`);
      expect(step.stepIndex).toBe(index);
      expect(step.zoneSequenceIndex).toBeGreaterThanOrEqual(0);

      if (index > 0) {
        expect(step.zoneSequenceIndex).toBeGreaterThanOrEqual(
          result.steps[index - 1]!.zoneSequenceIndex,
        );
      }

      expect(step.candidateStudentIds).toContain(step.selectedStudentId);
      expect(step.candidateSeatIds).toContain(step.selectedSeatId);
      expect(new Set(step.candidateStudentIds).size).toBe(
        step.candidateStudentIds.length,
      );
      expect(new Set(step.candidateSeatIds).size).toBe(
        step.candidateSeatIds.length,
      );
      expect(Object.keys(step.weightByStudentId).sort()).toEqual(
        [...step.candidateStudentIds].sort(),
      );
      expect(step.weightByStudentId[step.selectedStudentId]).toBeGreaterThan(0);
      expect(
        step.candidateSeatIds.every(
          (seatId) => seatsById.get(seatId)?.status === "available",
        ),
      ).toBe(true);
    });
  });

  it("keeps assignment summary consistent with assigned seats and steps", () => {
    const result = new AssignmentEngine().assign({
      students: [
        { id: "student-1", name: "A", preference: "front" },
        { id: "student-2", name: "B", preference: "front" },
        { id: "student-3", name: "C", preference: "back" },
        { id: "student-4", name: "D", preference: null },
      ],
      seatLayout: createSeatLayout({
        rows: 3,
        columns: 2,
        unavailableSeatIds: ["3-2"],
      }),
      seed: "summary-consistency",
    });
    const assignedSeatCount = result.seats.filter(
      (seat) => seat.student,
    ).length;
    const emptyAvailableSeatCount = result.seats.filter(
      (seat) => seat.status === "available" && !seat.student,
    ).length;
    const summaryAssignedCount =
      result.summary.primaryAssignedCount +
      result.summary.firstOverflowAssignedCount +
      result.summary.secondOverflowAssignedCount +
      result.summary.unpreferredAssignedCount;

    expect(summaryAssignedCount).toBe(assignedSeatCount);
    expect(result.steps).toHaveLength(assignedSeatCount);
    expect(result.summary.emptySeatCount).toBe(emptyAvailableSeatCount);
    expect(result.summary.manualSwapCount).toBe(0);
  });

  it("does not mutate input students or seat layout state", () => {
    const students: Student[] = [
      { id: "student-1", name: "A", preference: "front" },
      { id: "student-2", name: "B", preference: null },
    ];
    const seatLayout = createSeatLayout({
      rows: 2,
      columns: 2,
      unavailableSeatIds: ["2-2"],
    });
    const studentsBefore = students.map((student) => ({ ...student }));
    const seatsBefore = seatLayout.getSeats();

    const result = new AssignmentEngine().assign({
      students,
      seatLayout,
      seed: "immutability",
    });

    expect(students).toEqual(studentsBefore);
    expect(seatLayout.getSeats()).toEqual(seatsBefore);
    expect(result.seats).not.toEqual(seatsBefore);
  });
});

function createSeatLayout(options: {
  rows: number;
  columns: number;
  unavailableSeatIds?: string[];
  zones?: ZoneRowConfig;
}): SeatLayout {
  return new SeatLayout({
    grid: { rows: options.rows, columns: options.columns },
    zones: options.zones ?? createEvenZones(options.rows),
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
  return result.seats.flatMap((seat) =>
    seat.student ? [seat.student.id] : [],
  );
}

function getAssignedZones(result: AssignmentResult): string[] {
  return result.seats.flatMap((seat) => (seat.student ? [seat.zone] : []));
}

function getAssignedSeatByStudentId(
  result: AssignmentResult,
  studentId: string,
) {
  return result.seats.find((seat) => seat.student?.id === studentId);
}
