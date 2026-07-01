import { describe, expect, it } from "vitest";
import type { Student } from "../students";
import { PreferenceSession } from "./PreferenceSession";

describe("PreferenceSession", () => {
  it("starts with all students pending and no submissions", () => {
    const session = new PreferenceSession({
      students: createStudents(),
      mode: "sequential",
    });

    expect(session.getMode()).toBe("sequential");
    expect(session.getSubmissions()).toEqual([]);
    expect(session.getPendingStudentIds()).toEqual([
      "student-1",
      "student-2",
      "student-3",
    ]);
    expect(session.getCurrentStudent()?.id).toBe("student-1");
    expect(session.getProgress()).toEqual({
      totalCount: 3,
      submittedCount: 0,
      pendingCount: 3,
      isComplete: false,
    });
  });

  it("submits preferences and applies them to assignment-ready students", () => {
    const session = new PreferenceSession({ students: createStudents() })
      .submitPreference("student-1", "front", "teacher", "2026-06-30T01:00:00.000Z")
      .submitPreference("student-2", null, "teacher", "2026-06-30T01:01:00.000Z");

    expect(session.getSubmissions()).toEqual([
      {
        studentId: "student-1",
        preference: "front",
        source: "teacher",
        submittedAt: "2026-06-30T01:00:00.000Z",
      },
      {
        studentId: "student-2",
        preference: null,
        source: "teacher",
        submittedAt: "2026-06-30T01:01:00.000Z",
      },
    ]);
    expect(session.applyToStudents()).toEqual([
      { id: "student-1", name: "A", preference: "front" },
      { id: "student-2", name: "B", preference: null },
      { id: "student-3", name: "C", preference: null },
    ]);
  });

  it("submits adjacent student preferences with zone preferences", () => {
    const session = new PreferenceSession({ students: createStudents() }).submit({
      studentId: "student-1",
      preference: "front",
      adjacentStudentId: "student-2",
      source: "teacher",
    });

    expect(session.getSubmission("student-1")).toEqual({
      studentId: "student-1",
      preference: "front",
      adjacentStudentId: "student-2",
      source: "teacher",
    });
    expect(session.applyToStudents()[0]).toEqual({
      id: "student-1",
      name: "A",
      preference: "front",
      adjacentStudentId: "student-2",
    });
  });

  it("treats an explicit null preference as submitted, not pending", () => {
    const session = new PreferenceSession({ students: createStudents() })
      .submitPreference("student-1", null, "shared-device");

    expect(session.getSubmission("student-1")).toMatchObject({
      studentId: "student-1",
      preference: null,
      source: "shared-device",
    });
    expect(session.getPendingStudentIds()).toEqual(["student-2", "student-3"]);
    expect(session.getCurrentStudent()?.id).toBe("student-2");
  });

  it("replaces a student's previous submission with the latest one", () => {
    const session = new PreferenceSession({ students: createStudents() })
      .submitPreference("student-1", "front", "teacher")
      .submitPreference("student-1", "back", "shared-device");

    expect(session.getSubmissions()).toEqual([
      {
        studentId: "student-1",
        preference: "back",
        source: "shared-device",
      },
    ]);
    expect(session.applyToStudents()[0]).toEqual({
      id: "student-1",
      name: "A",
      preference: "back",
    });
  });

  it("can clear a submission and make the student pending again", () => {
    const session = new PreferenceSession({ students: createStudents() })
      .submitPreference("student-1", "middle", "teacher")
      .clearSubmission("student-1");

    expect(session.getSubmission("student-1")).toBeUndefined();
    expect(session.getPendingStudentIds()).toEqual([
      "student-1",
      "student-2",
      "student-3",
    ]);
  });

  it("can switch collection mode without losing submissions", () => {
    const session = new PreferenceSession({ students: createStudents() })
      .submitPreference("student-1", "front", "teacher")
      .withMode("sequential");

    expect(session.getMode()).toBe("sequential");
    expect(session.getSubmission("student-1")?.preference).toBe("front");
    expect(session.getCurrentStudent()?.id).toBe("student-2");
  });

  it("rejects submissions for unknown students", () => {
    const session = new PreferenceSession({ students: createStudents() });

    expect(() =>
      session.submitPreference("student-999", "front", "teacher")
    ).toThrow("Unknown student");
  });

  it("rejects adjacent preferences for self or unknown students", () => {
    const session = new PreferenceSession({ students: createStudents() });

    expect(() =>
      session.submit({
        studentId: "student-1",
        preference: "front",
        adjacentStudentId: "student-1",
        source: "teacher",
      })
    ).toThrow("same student");

    expect(() =>
      session.submit({
        studentId: "student-1",
        preference: "front",
        adjacentStudentId: "student-999",
        source: "teacher",
      })
    ).toThrow("Unknown adjacent student");
  });

  it("rejects duplicate student ids", () => {
    expect(
      () =>
        new PreferenceSession({
          students: [
            { id: "student-1", name: "A", preference: null },
            { id: "student-1", name: "B", preference: null },
          ],
        })
    ).toThrow("unique");
  });

  it("returns defensive copies of students and submissions", () => {
    const session = new PreferenceSession({ students: createStudents() })
      .submitPreference("student-1", "front", "teacher");
    const students = session.getStudents();
    const submissions = session.getSubmissions();
    const currentStudent = session.getCurrentStudent();

    students[0]!.name = "Changed";
    submissions[0]!.preference = "back";
    currentStudent!.name = "Also changed";

    expect(session.getStudents()[0]?.name).toBe("A");
    expect(session.getCurrentStudent()?.name).toBe("B");
    expect(session.getSubmission("student-1")?.preference).toBe("front");
  });
});

function createStudents(): Student[] {
  return [
    { id: "student-1", name: "A", preference: null },
    { id: "student-2", name: "B", preference: null },
    { id: "student-3", name: "C", preference: null },
  ];
}
