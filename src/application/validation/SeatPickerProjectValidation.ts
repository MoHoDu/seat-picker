import type { PreferenceSession } from "../../domain/preferences";
import type { SeatLayout } from "../../domain/seats";
import type { SeatPickerProjectState } from "../storage";

export type ValidationSeverity = "error" | "warning";

export type ProjectValidationIssueCode =
  | "zone-row-total-mismatch"
  | "seat-layout-invalid"
  | "no-available-seats"
  | "limited-available-seats"
  | "empty-student-list"
  | "too-many-students"
  | "pending-preferences"
  | "empty-seed";

export type ProjectValidationIssue = {
  code: ProjectValidationIssueCode;
  severity: ValidationSeverity;
  message: string;
};

export type SeatSetupValidation = {
  zoneRowTotal: number;
  totalSeatCount: number;
  unavailableSeatCount: number;
  availableSeatCount: number;
  issues: ProjectValidationIssue[];
  canContinue: boolean;
};

export type StudentInputValidation = {
  studentCount: number;
  availableSeatCount: number;
  issues: ProjectValidationIssue[];
  canContinue: boolean;
};

export type PreferenceSelectionValidation = {
  pendingPreferenceCount: number;
  issues: ProjectValidationIssue[];
  canStart: boolean;
};

export function validateSeatSetup(
  state: Pick<
    SeatPickerProjectState,
    "grid" | "zoneRows" | "unavailableSeatIds"
  >,
  seatLayout: SeatLayout | null,
  layoutError: string | null = null,
): SeatSetupValidation {
  const zoneRowTotal = getZoneRowTotal(state.zoneRows);
  const totalSeatCount = state.grid.rows * state.grid.columns;
  const unavailableSeatCount = seatLayout
    ? totalSeatCount - seatLayout.getAvailableSeatCount()
    : state.unavailableSeatIds.length;
  const availableSeatCount = seatLayout ? seatLayout.getAvailableSeatCount() : 0;
  const issues: ProjectValidationIssue[] = [];

  if (zoneRowTotal !== state.grid.rows) {
    issues.push({
      code: "zone-row-total-mismatch",
      severity: "error",
      message: createZoneRowMismatchMessage(zoneRowTotal, state.grid.rows),
    });
  } else if (!seatLayout && layoutError) {
    issues.push({
      code: "seat-layout-invalid",
      severity: "error",
      message: `좌석 설정을 확인하세요. ${layoutError}`,
    });
  }

  if (seatLayout && availableSeatCount === 0) {
    issues.push({
      code: "no-available-seats",
      severity: "error",
      message: "사용 가능한 좌석이 없습니다. 사용 불가 좌석을 한 칸 이상 해제하세요.",
    });
  } else if (
    seatLayout &&
    unavailableSeatCount > 0 &&
    availableSeatCount <= Math.max(1, Math.floor(totalSeatCount * 0.2))
  ) {
    issues.push({
      code: "limited-available-seats",
      severity: "warning",
      message: `사용 가능 좌석이 ${availableSeatCount}석뿐입니다. 학생 수보다 적으면 추첨을 시작할 수 없습니다.`,
    });
  }

  return {
    zoneRowTotal,
    totalSeatCount,
    unavailableSeatCount,
    availableSeatCount,
    issues,
    canContinue: !hasBlockingIssue(issues),
  };
}

export function validateStudentInput(options: {
  studentCount: number;
  availableSeatCount: number;
}): StudentInputValidation {
  const issues: ProjectValidationIssue[] = [];

  if (options.studentCount === 0) {
    issues.push({
      code: "empty-student-list",
      severity: "error",
      message: "학생 이름을 한 명 이상 입력하세요.",
    });
  }

  if (options.availableSeatCount === 0) {
    issues.push({
      code: "no-available-seats",
      severity: "error",
      message: "사용 가능한 좌석이 없습니다. 좌석 설정에서 사용 불가 좌석을 조정하세요.",
    });
  }

  if (
    options.studentCount > 0 &&
    options.availableSeatCount > 0 &&
    options.studentCount > options.availableSeatCount
  ) {
    issues.push({
      code: "too-many-students",
      severity: "error",
      message: `학생 ${options.studentCount}명은 사용 가능 좌석 ${options.availableSeatCount}석보다 많습니다. 좌석을 늘리거나 명단을 줄이세요.`,
    });
  }

  return {
    studentCount: options.studentCount,
    availableSeatCount: options.availableSeatCount,
    issues,
    canContinue: !hasBlockingIssue(issues),
  };
}

export function validatePreferenceSelection(options: {
  project: Pick<SeatPickerProjectState, "seed" | "students">;
  seatLayout: SeatLayout | null;
  preferenceSession: PreferenceSession;
}): PreferenceSelectionValidation {
  const progress = options.preferenceSession.getProgress();
  const availableSeatCount = options.seatLayout?.getAvailableSeatCount() ?? 0;
  const issues: ProjectValidationIssue[] = [];

  if (options.project.seed.trim().length === 0) {
    issues.push({
      code: "empty-seed",
      severity: "error",
      message: "Seed를 입력하세요. 같은 Seed는 같은 추첨 결과를 재현하는 데 사용됩니다.",
    });
  }

  if (progress.pendingCount > 0) {
    issues.push({
      code: "pending-preferences",
      severity: "error",
      message: `선호 미선택 학생 ${progress.pendingCount}명이 있습니다. 미선택 무선호 처리를 눌러 확정한 뒤 추첨을 시작하세요.`,
    });
  }

  if (options.project.students.length > availableSeatCount) {
    issues.push({
      code: "too-many-students",
      severity: "error",
      message: `학생 ${options.project.students.length}명은 사용 가능 좌석 ${availableSeatCount}석보다 많습니다. 좌석 설정이나 명단을 조정하세요.`,
    });
  }

  return {
    pendingPreferenceCount: progress.pendingCount,
    issues,
    canStart: !hasBlockingIssue(issues),
  };
}

function getZoneRowTotal(
  zoneRows: Pick<
    SeatPickerProjectState["zoneRows"],
    "frontRows" | "middleRows" | "backRows"
  >,
): number {
  return zoneRows.frontRows + zoneRows.middleRows + zoneRows.backRows;
}

function createZoneRowMismatchMessage(
  zoneRowTotal: number,
  totalRows: number,
): string {
  const difference = zoneRowTotal - totalRows;
  const detail =
    difference > 0
      ? `${difference}행 많습니다`
      : `${Math.abs(difference)}행 부족합니다`;

  return `앞/중간/뒤 행 합계가 전체 행과 같아야 합니다. 현재 합계가 ${detail}.`;
}

function hasBlockingIssue(issues: readonly ProjectValidationIssue[]): boolean {
  return issues.some((issue) => issue.severity === "error");
}
