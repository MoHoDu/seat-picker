import { describe, expect, it } from "vitest";
import { PreferenceSession } from "../../domain/preferences";
import { SeatLayout } from "../../domain/seats";
import { createDefaultProjectState } from "../storage";
import {
  validatePreferenceSelection,
  validateSeatSetup,
  validateStudentInput,
} from "./SeatPickerProjectValidation";

describe("SeatPickerProjectValidation", () => {
  it("allows the default seat setup", () => {
    const state = createDefaultProjectState();
    const layout = new SeatLayout({
      grid: state.grid,
      zones: state.zoneRows,
      unavailableSeatIds: state.unavailableSeatIds,
    });
    const validation = validateSeatSetup(state, layout);

    expect(validation).toMatchObject({
      zoneRowTotal: 5,
      totalSeatCount: 30,
      unavailableSeatCount: 0,
      availableSeatCount: 30,
      canContinue: true,
    });
    expect(validation.issues).toEqual([]);
  });

  it("blocks a zone row total mismatch with a teacher-facing message", () => {
    const state = {
      ...createDefaultProjectState(),
      zoneRows: { frontRows: 1, middleRows: 1, backRows: 1 },
    };
    const validation = validateSeatSetup(state, null);

    expect(validation.canContinue).toBe(false);
    expect(validation.issues[0]).toMatchObject({
      code: "zone-row-total-mismatch",
      severity: "error",
      message:
        "앞/중간/뒤 행 합계가 전체 행과 같아야 합니다. 현재 합계가 2행 부족합니다.",
    });
  });

  it("blocks seat setup when every seat is unavailable", () => {
    const state = createDefaultProjectState({
      grid: { rows: 1, columns: 2 },
      zoneRows: { frontRows: 1, middleRows: 0, backRows: 0 },
      unavailableSeatIds: ["1-1", "1-2"],
    });
    const layout = new SeatLayout({
      grid: state.grid,
      zones: state.zoneRows,
      unavailableSeatIds: state.unavailableSeatIds,
    });
    const validation = validateSeatSetup(state, layout);

    expect(validation.canContinue).toBe(false);
    expect(validation.issues).toContainEqual({
      code: "no-available-seats",
      severity: "error",
      message: "사용 가능한 좌석이 없습니다. 사용 불가 좌석을 한 칸 이상 해제하세요.",
    });
  });

  it("blocks student input when there are more students than seats", () => {
    const validation = validateStudentInput({
      studentCount: 3,
      availableSeatCount: 2,
    });

    expect(validation.canContinue).toBe(false);
    expect(validation.issues[0]).toMatchObject({
      code: "too-many-students",
      severity: "error",
    });
  });

  it("blocks assignment until seed and pending preferences are resolved", () => {
    const students = [
      { id: "student-1", name: "A", preference: null },
      { id: "student-2", name: "B", preference: null },
    ];
    const state = createDefaultProjectState({
      seed: "   ",
      students,
    });
    const layout = new SeatLayout({
      grid: state.grid,
      zones: state.zoneRows,
    });
    const session = new PreferenceSession({
      students,
      submissions: [{ studentId: "student-1", preference: "front", source: "teacher" }],
    });
    const validation = validatePreferenceSelection({
      project: state,
      seatLayout: layout,
      preferenceSession: session,
    });

    expect(validation.canStart).toBe(false);
    expect(validation.issues.map((issue) => issue.code)).toEqual([
      "empty-seed",
      "pending-preferences",
    ]);
  });
});
