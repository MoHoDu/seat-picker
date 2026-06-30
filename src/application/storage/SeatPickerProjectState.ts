import type { AssignmentResult } from "../../domain/assignment";
import { PreferenceSession } from "../../domain/preferences";
import type { PreferenceSubmission } from "../../domain/preferences";
import type { Seed } from "../../domain/random";
import { SeatLayout, ZoneLayoutPolicy } from "../../domain/seats";
import type { GridConfig, SeatId, ZoneRowConfig } from "../../domain/seats";
import { StudentRoster } from "../../domain/students";
import type { Student } from "../../domain/students";

export type AppStep =
  | "seat-setup"
  | "student-input"
  | "preference-selection"
  | "drawing"
  | "result";

export type SeatPickerProjectState = {
  version: 1;
  step: AppStep;
  grid: GridConfig;
  zoneRows: ZoneRowConfig;
  unavailableSeatIds: SeatId[];
  students: Student[];
  preferenceSubmissions: PreferenceSubmission[];
  seed: Seed;
  assignmentResult: AssignmentResult | null;
};

export type StoredSeatPickerProject = SeatPickerProjectState;

const DEFAULT_GRID: GridConfig = {
  rows: 5,
  columns: 6,
};

const DEFAULT_SEED: Seed = "seat-picker-v1";

export function createDefaultProjectState(
  overrides: Partial<SeatPickerProjectState> = {}
): SeatPickerProjectState {
  const grid = overrides.grid ?? DEFAULT_GRID;
  const zoneRows =
    overrides.zoneRows ?? ZoneLayoutPolicy.createDefault(grid.rows);

  ZoneLayoutPolicy.validateGrid(grid);
  ZoneLayoutPolicy.validateZoneRows(zoneRows, grid.rows);

  const state: SeatPickerProjectState = {
    version: 1,
    step: "seat-setup",
    grid,
    zoneRows,
    unavailableSeatIds: [],
    students: [],
    preferenceSubmissions: [],
    seed: DEFAULT_SEED,
    assignmentResult: null,
    ...overrides,
  };

  return cloneState({
    ...state,
    grid,
    zoneRows,
  });
}

export function updateProjectGrid(
  state: SeatPickerProjectState,
  grid: GridConfig
): SeatPickerProjectState {
  ZoneLayoutPolicy.validateGrid(grid);

  const zoneRows =
    grid.rows === state.grid.rows
      ? state.zoneRows
      : ZoneLayoutPolicy.createDefault(grid.rows);
  ZoneLayoutPolicy.validateZoneRows(zoneRows, grid.rows);

  const nextLayout = new SeatLayout({
    grid,
    zones: zoneRows,
    unavailableSeatIds: state.unavailableSeatIds,
  });

  return cloneState({
    ...state,
    grid: { ...grid },
    zoneRows: { ...zoneRows },
    unavailableSeatIds: nextLayout.getUnavailableSeatIds(),
    assignmentResult: null,
  });
}

export function updateProjectZoneRows(
  state: SeatPickerProjectState,
  zoneRows: ZoneRowConfig
): SeatPickerProjectState {
  ZoneLayoutPolicy.validateZoneRows(zoneRows, state.grid.rows);

  return cloneState({
    ...state,
    zoneRows: { ...zoneRows },
    assignmentResult: null,
  });
}

export function createSeatLayoutFromState(
  state: Pick<
    SeatPickerProjectState,
    "grid" | "zoneRows" | "unavailableSeatIds"
  >
): SeatLayout {
  return new SeatLayout({
    grid: state.grid,
    zones: state.zoneRows,
    unavailableSeatIds: state.unavailableSeatIds,
  });
}

export function createStudentRosterFromState(
  state: Pick<SeatPickerProjectState, "students">
): StudentRoster {
  return new StudentRoster(state.students);
}

export function createPreferenceSessionFromState(
  state: Pick<SeatPickerProjectState, "students" | "preferenceSubmissions">
): PreferenceSession {
  return new PreferenceSession({
    students: state.students,
    submissions: state.preferenceSubmissions,
  });
}

export function toStoredSeatPickerProject(
  state: SeatPickerProjectState
): StoredSeatPickerProject {
  return cloneState(state);
}

export function restoreSeatPickerProject(
  stored: StoredSeatPickerProject
): SeatPickerProjectState {
  return createDefaultProjectState(stored);
}

function cloneState(state: SeatPickerProjectState): SeatPickerProjectState {
  return {
    version: 1,
    step: state.step,
    grid: { ...state.grid },
    zoneRows: { ...state.zoneRows },
    unavailableSeatIds: [...state.unavailableSeatIds],
    students: state.students.map((student) => ({ ...student })),
    preferenceSubmissions: state.preferenceSubmissions.map((submission) => ({
      ...submission,
    })),
    seed: state.seed,
    assignmentResult: state.assignmentResult
      ? cloneAssignmentResult(state.assignmentResult)
      : null,
  };
}

function cloneAssignmentResult(result: AssignmentResult): AssignmentResult {
  return {
    seed: result.seed,
    seats: result.seats.map((seat) => ({
      ...seat,
      ...(seat.student ? { student: { ...seat.student } } : {}),
    })),
    steps: result.steps.map((step) => ({
      ...step,
      candidateStudentIds: [...step.candidateStudentIds],
      candidateSeatIds: [...step.candidateSeatIds],
      weightByStudentId: { ...step.weightByStudentId },
    })),
    summary: { ...result.summary },
  };
}
