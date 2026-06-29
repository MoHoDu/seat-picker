import type { PreferenceZone } from "../preferences/types";

export type StudentId = string;

export type Student = {
  id: StudentId;
  name: string;
  preference: PreferenceZone;
};

export type StudentDisplay = Student & {
  displayName: string;
};
