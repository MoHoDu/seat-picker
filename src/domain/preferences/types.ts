import type { Zone } from "../seats/types";
import type { StudentId } from "../students/types";

export type PreferenceZone = Zone | null;

export type PreferenceSource = "teacher" | "shared-device" | "remote-device";

// 각자의 선호도에 관련한 클래스
export type PreferenceSubmission = {
  studentId: StudentId;
  preference: PreferenceZone;
  source: PreferenceSource;
  submittedAt?: string;
};
