import { describe, expect, it } from "vitest";
import { StudentRoster } from "./StudentRoster";

describe("StudentRoster", () => {
  it("parses multiline names and removes empty lines", () => {
    const roster = StudentRoster.fromMultiline(" 김민준 \n\n이서연\r\n 박지호 ");

    expect(roster.getStudents()).toEqual([
      { id: "student-1", name: "김민준", preference: null },
      { id: "student-2", name: "이서연", preference: null },
      { id: "student-3", name: "박지호", preference: null },
    ]);
  });

  it("adds display suffixes only for duplicate names", () => {
    const roster = StudentRoster.fromNames([
      "김민준",
      "이서연",
      "김민준",
      "김민준",
    ]);

    expect(roster.getDisplays().map((student) => student.displayName)).toEqual([
      "김민준 01",
      "이서연",
      "김민준 02",
      "김민준 03",
    ]);
  });

  it("renames students while preserving id and preference", () => {
    const roster = new StudentRoster([
      { id: "student-1", name: "김민준", preference: "front" },
    ]);

    expect(roster.renameStudent("student-1", " 이서연 ").getStudents()).toEqual([
      { id: "student-1", name: "이서연", preference: "front" },
    ]);
  });

  it("removes students without renumbering remaining ids", () => {
    const roster = StudentRoster.fromNames(["김민준", "이서연", "박지호"]);

    expect(roster.removeStudent("student-2").getStudents()).toEqual([
      { id: "student-1", name: "김민준", preference: null },
      { id: "student-3", name: "박지호", preference: null },
    ]);
  });
});
