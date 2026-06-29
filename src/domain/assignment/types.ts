import type { Seed } from "../random/types";
import type { Seat, SeatId, Zone } from "../seats/types";
import type { Student, StudentId } from "../students/types";

export type AnimationSpeed = "fast" | "normal" | "slow";

export type PreferenceDistance = 0 | 1 | 2;

export type AssignmentCandidate = {
  studentId: StudentId;
  originPreference: Zone;
  targetZone: Zone;
  weight: number;
  preferenceDistance: PreferenceDistance;
};

export type AssignmentStepReason = "primary" | "overflow" | "unpreferred";

export type AssignmentStep = {
  id: string;
  zone: Zone;
  zoneSequenceIndex: number;
  stepIndex: number;
  candidateStudentIds: StudentId[];
  selectedStudentId: StudentId;
  candidateSeatIds: SeatId[];
  selectedSeatId: SeatId;
  weightByStudentId: Record<StudentId, number>;
  reason: AssignmentStepReason;
  preferenceDistance: PreferenceDistance | null;
};

export type AssignmentSummary = {
  primaryAssignedCount: number;
  firstOverflowAssignedCount: number;
  secondOverflowAssignedCount: number;
  unpreferredAssignedCount: number;
  emptySeatCount: number;
  manualSwapCount: number;
};

export type AssignedSeat = Seat & {
  student?: Student;
};

export type AssignmentResult = {
  seed: Seed;
  seats: AssignedSeat[];
  steps: AssignmentStep[];
  summary: AssignmentSummary;
};
