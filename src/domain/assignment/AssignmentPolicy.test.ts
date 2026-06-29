import { describe, expect, it } from "vitest";
import { SeededRandom } from "../random";
import type { Student } from "../students";
import { AssignmentPolicy } from "./AssignmentPolicy";

describe("AssignmentPolicy", () => {
  it("creates primary candidates only for students with preferences", () => {
    const candidates = AssignmentPolicy.createPrimaryCandidates([
      { id: "student-1", preference: "front" },
      { id: "student-2", preference: null },
      { id: "student-3", preference: "back" },
    ]);

    expect(candidates).toEqual([
      {
        studentId: "student-1",
        originPreference: "front",
        targetZone: "front",
        weight: 1,
        preferenceDistance: 0,
      },
      {
        studentId: "student-3",
        originPreference: "back",
        targetZone: "back",
        weight: 1,
        preferenceDistance: 0,
      },
    ]);
  });

  it("returns front preference overflow candidates in middle then back order", () => {
    const [frontStage, middleStage, backStage] =
      AssignmentPolicy.createCandidatesForPreference("student-1", "front");

    expect(frontStage).toEqual([
      {
        studentId: "student-1",
        originPreference: "front",
        targetZone: "front",
        weight: 1,
        preferenceDistance: 0,
      },
    ]);
    expect(middleStage).toEqual([
      {
        studentId: "student-1",
        originPreference: "front",
        targetZone: "middle",
        weight: 0.7,
        preferenceDistance: 1,
      },
    ]);
    expect(backStage).toEqual([
      {
        studentId: "student-1",
        originPreference: "front",
        targetZone: "back",
        weight: 0.4,
        preferenceDistance: 2,
      },
    ]);
  });

  it("moves middle preference overflow candidates into front and back together", () => {
    const primary = AssignmentPolicy.createPrimaryCandidate({
      id: "student-1",
      preference: "middle",
    });

    expect(primary).not.toBeNull();
    expect(AssignmentPolicy.getNextCandidates(primary!)).toEqual([
      {
        studentId: "student-1",
        originPreference: "middle",
        targetZone: "front",
        weight: 0.7,
        preferenceDistance: 1,
      },
      {
        studentId: "student-1",
        originPreference: "middle",
        targetZone: "back",
        weight: 0.7,
        preferenceDistance: 1,
      },
    ]);
  });

  it("returns no further overflow for exhausted middle preference branches", () => {
    const [, overflowStage] = AssignmentPolicy.createCandidatesForPreference(
      "student-1",
      "middle",
    );

    expect(AssignmentPolicy.getNextCandidates(overflowStage![0]!)).toEqual([]);
    expect(AssignmentPolicy.getNextCandidates(overflowStage![1]!)).toEqual([]);
  });

  it("counts primary preferences by zone and ignores unpreferred students", () => {
    const students: Student[] = [
      { id: "student-1", name: "A", preference: "front" },
      { id: "student-2", name: "B", preference: "front" },
      { id: "student-3", name: "C", preference: "middle" },
      { id: "student-4", name: "D", preference: null },
    ];

    expect(AssignmentPolicy.getPrimaryPreferenceCounts(students)).toEqual({
      front: 2,
      middle: 1,
      back: 0,
    });
  });

  it("orders zones by primary preference count and shuffles ties by seed", () => {
    const students: Student[] = [
      { id: "student-1", name: "A", preference: "front" },
      { id: "student-2", name: "B", preference: "front" },
      { id: "student-3", name: "C", preference: "back" },
      { id: "student-4", name: "D", preference: "back" },
      { id: "student-5", name: "E", preference: "middle" },
    ];

    const firstOrder = AssignmentPolicy.getZoneProcessingOrder(
      students,
      new SeededRandom("zone-order"),
    );
    const secondOrder = AssignmentPolicy.getZoneProcessingOrder(
      students,
      new SeededRandom("zone-order"),
    );

    expect(firstOrder).toEqual(secondOrder);
    expect(firstOrder.slice(0, 2).sort()).toEqual(["back", "front"]);
    expect(firstOrder[2]).toBe("middle");
  });

  it("filters assigned students out of active candidate pools", () => {
    const candidates = AssignmentPolicy.createPrimaryCandidates([
      { id: "student-1", preference: "front" },
      { id: "student-2", preference: "front" },
    ]);

    expect(
      AssignmentPolicy.filterActiveCandidates(candidates, ["student-1"]),
    ).toEqual([
      {
        studentId: "student-2",
        originPreference: "front",
        targetZone: "front",
        weight: 1,
        preferenceDistance: 0,
      },
    ]);
  });

  it("groups candidates by target zone", () => {
    const frontCandidates = AssignmentPolicy.createCandidatesForPreference(
      "student-1",
      "front",
    ).flat();
    const middleCandidates = AssignmentPolicy.createCandidatesForPreference(
      "student-2",
      "middle",
    ).flat();

    expect(
      AssignmentPolicy.groupCandidatesByTargetZone([
        ...frontCandidates,
        ...middleCandidates,
      ]),
    ).toEqual({
      front: [
        {
          studentId: "student-1",
          originPreference: "front",
          targetZone: "front",
          weight: 1,
          preferenceDistance: 0,
        },
        {
          studentId: "student-2",
          originPreference: "middle",
          targetZone: "front",
          weight: 0.7,
          preferenceDistance: 1,
        },
      ],
      middle: [
        {
          studentId: "student-1",
          originPreference: "front",
          targetZone: "middle",
          weight: 0.7,
          preferenceDistance: 1,
        },
        {
          studentId: "student-2",
          originPreference: "middle",
          targetZone: "middle",
          weight: 1,
          preferenceDistance: 0,
        },
      ],
      back: [
        {
          studentId: "student-1",
          originPreference: "front",
          targetZone: "back",
          weight: 0.4,
          preferenceDistance: 2,
        },
        {
          studentId: "student-2",
          originPreference: "middle",
          targetZone: "back",
          weight: 0.7,
          preferenceDistance: 1,
        },
      ],
    });
  });
});
