import { describe, expect, it } from "vitest";
import { AssignmentEngine } from "../../domain/assignment";
import { SeatLayout } from "../../domain/seats";
import type { Student } from "../../domain/students";
import {
  createDefaultProjectState,
  createPreferenceSessionFromState,
  createSeatLayoutFromState,
  createStudentRosterFromState,
  restoreSeatPickerProject,
  toStoredSeatPickerProject,
  updateProjectGrid,
  updateProjectZoneRows,
} from "./SeatPickerProjectState";

describe("SeatPickerProjectState", () => {
  it("creates a valid default project state", () => {
    const state = createDefaultProjectState();

    expect(state).toMatchObject({
      version: 1,
      step: "seat-setup",
      grid: { rows: 5, columns: 6 },
      zoneRows: { frontRows: 2, middleRows: 1, backRows: 2 },
      unavailableSeatIds: [],
      students: [],
      preferenceSubmissions: [],
      seed: "seat-picker-v1",
      assignmentResult: null,
    });
    expect(createSeatLayoutFromState(state).getAvailableSeatCount()).toBe(30);
  });

  it("updates grid and recalculates zone rows when row count changes", () => {
    const state = createDefaultProjectState({
      unavailableSeatIds: ["5-6", "99-99"],
    });
    const next = updateProjectGrid(state, { rows: 3, columns: 2 });

    expect(next.grid).toEqual({ rows: 3, columns: 2 });
    expect(next.zoneRows).toEqual({ frontRows: 1, middleRows: 1, backRows: 1 });
    expect(next.unavailableSeatIds).toEqual([]);
    expect(next.assignmentResult).toBeNull();
  });

  it("validates zone rows before updating project state", () => {
    const state = createDefaultProjectState();

    expect(() =>
      updateProjectZoneRows(state, {
        frontRows: 1,
        middleRows: 1,
        backRows: 1,
      })
    ).toThrow("add up");
  });

  it("converts to and restores from plain storage data", () => {
    const students: Student[] = [
      {
        id: "student-1",
        name: "A",
        preference: "front",
        adjacentStudentId: "student-2",
      },
      { id: "student-2", name: "B", preference: null },
    ];
    const seatLayout = new SeatLayout({
      grid: { rows: 2, columns: 1 },
      zones: { frontRows: 1, middleRows: 0, backRows: 1 },
    });
    const assignmentResult = new AssignmentEngine().assign({
      students,
      seatLayout,
      seed: "stored-seed",
    });
    const state = createDefaultProjectState({
      step: "result",
      grid: { rows: 2, columns: 1 },
      zoneRows: { frontRows: 1, middleRows: 0, backRows: 1 },
      students,
      preferenceSubmissions: [
        {
          studentId: "student-1",
          preference: "front",
          adjacentStudentId: "student-2",
          source: "teacher",
        },
      ],
      seed: "stored-seed",
      assignmentResult,
    });
    const stored = toStoredSeatPickerProject(state);
    const restored = restoreSeatPickerProject(stored);

    stored.students[0]!.name = "Changed";
    stored.assignmentResult!.seats[0]!.student!.name = "Changed";

    expect(restored.students[0]?.name).toBe("A");
    expect(restored.assignmentResult?.seats[0]?.student?.name).toBe("A");
    expect(createSeatLayoutFromState(restored).getAvailableSeatCount()).toBe(2);
    expect(createStudentRosterFromState(restored).getStudents()).toEqual(students);
    expect(
      createPreferenceSessionFromState(restored).getSubmission("student-1")
        ?.preference
    ).toBe("front");
    expect(
      createPreferenceSessionFromState(restored).getSubmission("student-1")
        ?.adjacentStudentId
    ).toBe("student-2");
  });
});
