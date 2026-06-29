import type { PreferenceZone } from "../preferences";
import type { Student, StudentDisplay, StudentId } from "./types";

// 학생 명단 관리
export class StudentRoster {
  private readonly students: Student[];

  constructor(students: readonly Student[]) {
    this.students = students.map((student) => {
      const name = student.name.trim();

      if (name.length === 0) {
        throw new Error("Student name cannot be empty.");
      }

      return {
        ...student,
        name,
        preference: student.preference ?? null,
      };
    });
  }

  static fromMultiline(input: string): StudentRoster {
    return StudentRoster.fromNames(input.split(/\r?\n/));
  }

  static fromNames(
    names: readonly string[],
    defaultPreference: PreferenceZone = null
  ): StudentRoster {
    const students = names
      .map((name) => name.trim())
      .filter((name) => name.length > 0)
      .map((name, index): Student => {
        return {
          id: StudentRoster.createStudentId(index),
          name,
          preference: defaultPreference,
        };
      });

    return new StudentRoster(students);
  }

  static createStudentId(index: number): StudentId {
    if (!Number.isInteger(index) || index < 0) {
      throw new Error("index must be a non-negative integer.");
    }

    return `student-${index + 1}`;
  }

  getStudents(): Student[] {
    return this.students.map((student) => ({ ...student }));
  }

  getStudent(studentId: StudentId): Student | undefined {
    const student = this.students.find(({ id }) => id === studentId);

    return student ? { ...student } : undefined;
  }

  getDisplays(): StudentDisplay[] {
    const nameCounts = this.students.reduce<Map<string, number>>(
      (counts, student) => {
        counts.set(student.name, (counts.get(student.name) ?? 0) + 1);
        return counts;
      },
      new Map()
    );
    const seenCounts = new Map<string, number>();

    return this.students.map((student) => {
      const totalCount = nameCounts.get(student.name) ?? 0;

      if (totalCount <= 1) {
        return { ...student, displayName: student.name };
      }

      const nextCount = (seenCounts.get(student.name) ?? 0) + 1;
      seenCounts.set(student.name, nextCount);

      return {
        ...student,
        displayName: `${student.name} ${String(nextCount).padStart(2, "0")}`,
      };
    });
  }

  renameStudent(studentId: StudentId, nextName: string): StudentRoster {
    const trimmedName = nextName.trim();

    if (trimmedName.length === 0) {
      throw new Error("Student name cannot be empty.");
    }

    return new StudentRoster(
      this.students.map((student) =>
        student.id === studentId ? { ...student, name: trimmedName } : student
      )
    );
  }

  removeStudent(studentId: StudentId): StudentRoster {
    return new StudentRoster(
      this.students.filter((student) => student.id !== studentId)
    );
  }

  get size(): number {
    return this.students.length;
  }
}
