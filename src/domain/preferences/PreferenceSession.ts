import type { Student, StudentId } from "../students/types";
import type {
  PreferenceSessionMode,
  PreferenceSessionProgress,
  PreferenceSource,
  PreferenceSubmission,
  PreferenceZone,
} from "./types";

export type PreferenceSessionOptions = {
  students: readonly Student[];
  mode?: PreferenceSessionMode;
  submissions?: readonly PreferenceSubmission[];
};

export class PreferenceSession {
  private readonly students: Student[];
  private readonly mode: PreferenceSessionMode;
  private readonly submissionsByStudentId: Map<StudentId, PreferenceSubmission>;

  constructor(options: PreferenceSessionOptions) {
    this.students = this.normalizeStudents(options.students);
    this.mode = options.mode ?? "batch";
    this.submissionsByStudentId = this.createSubmissionMap(
      options.submissions ?? []
    );
  }

  getMode(): PreferenceSessionMode {
    return this.mode;
  }

  withMode(mode: PreferenceSessionMode): PreferenceSession {
    return new PreferenceSession({
      students: this.students,
      mode,
      submissions: this.getSubmissions(),
    });
  }

  getStudents(): Student[] {
    return this.students.map((student) => ({ ...student }));
  }

  getSubmissions(): PreferenceSubmission[] {
    return this.students.flatMap((student) => {
      const submission = this.submissionsByStudentId.get(student.id);

      return submission ? [this.cloneSubmission(submission)] : [];
    });
  }

  getSubmission(studentId: StudentId): PreferenceSubmission | undefined {
    const submission = this.submissionsByStudentId.get(studentId);

    return submission ? this.cloneSubmission(submission) : undefined;
  }

  submitPreference(
    studentId: StudentId,
    preference: PreferenceZone,
    source: PreferenceSource,
    submittedAt?: string
  ): PreferenceSession {
    return this.submit({
      studentId,
      preference,
      source,
      ...(submittedAt !== undefined ? { submittedAt } : {}),
    });
  }

  submit(submission: PreferenceSubmission): PreferenceSession {
    this.assertKnownStudentId(submission.studentId);

    return new PreferenceSession({
      students: this.students,
      mode: this.mode,
      submissions: [
        ...this.getSubmissions().filter(
          (existing) => existing.studentId !== submission.studentId
        ),
        this.cloneSubmission(submission),
      ],
    });
  }

  submitMany(submissions: readonly PreferenceSubmission[]): PreferenceSession {
    return submissions.reduce<PreferenceSession>(
      (session, submission) => session.submit(submission),
      this
    );
  }

  clearSubmission(studentId: StudentId): PreferenceSession {
    this.assertKnownStudentId(studentId);

    return new PreferenceSession({
      students: this.students,
      mode: this.mode,
      submissions: this.getSubmissions().filter(
        (submission) => submission.studentId !== studentId
      ),
    });
  }

  getSubmittedStudentIds(): StudentId[] {
    return this.students.flatMap((student) =>
      this.submissionsByStudentId.has(student.id) ? [student.id] : []
    );
  }

  getPendingStudentIds(): StudentId[] {
    return this.students.flatMap((student) =>
      this.submissionsByStudentId.has(student.id) ? [] : [student.id]
    );
  }

  getCurrentStudent(): Student | undefined {
    const currentStudentId = this.getCurrentStudentId();

    return this.cloneStudent(
      this.students.find((student) => student.id === currentStudentId)
    );
  }

  getCurrentStudentId(): StudentId | undefined {
    return this.getPendingStudentIds()[0];
  }

  getProgress(): PreferenceSessionProgress {
    const submittedCount = this.submissionsByStudentId.size;
    const totalCount = this.students.length;

    return {
      totalCount,
      submittedCount,
      pendingCount: totalCount - submittedCount,
      isComplete: submittedCount === totalCount,
    };
  }

  applyToStudents(): Student[] {
    return this.students.map((student) => {
      const submission = this.submissionsByStudentId.get(student.id);

      return {
        ...student,
        preference: submission ? submission.preference : null,
      };
    });
  }

  get size(): number {
    return this.students.length;
  }

  private normalizeStudents(students: readonly Student[]): Student[] {
    const studentIds = new Set<StudentId>();

    return students.map((student) => {
      const name = student.name.trim();

      if (name.length === 0) {
        throw new Error("Student name cannot be empty.");
      }

      if (studentIds.has(student.id)) {
        throw new Error("Student ids must be unique.");
      }

      studentIds.add(student.id);

      return {
        ...student,
        name,
        preference: student.preference ?? null,
      };
    });
  }

  private createSubmissionMap(
    submissions: readonly PreferenceSubmission[]
  ): Map<StudentId, PreferenceSubmission> {
    const submissionMap = new Map<StudentId, PreferenceSubmission>();

    for (const submission of submissions) {
      this.assertKnownStudentId(submission.studentId);
      submissionMap.set(submission.studentId, this.cloneSubmission(submission));
    }

    return submissionMap;
  }

  private assertKnownStudentId(studentId: StudentId): void {
    if (!this.students.some((student) => student.id === studentId)) {
      throw new Error(`Unknown student id: ${studentId}`);
    }
  }

  private cloneSubmission(
    submission: PreferenceSubmission
  ): PreferenceSubmission {
    return {
      studentId: submission.studentId,
      preference: submission.preference,
      source: submission.source,
      ...(submission.submittedAt !== undefined
        ? { submittedAt: submission.submittedAt }
        : {}),
    };
  }

  private cloneStudent(student: Student | undefined): Student | undefined {
    return student ? { ...student } : undefined;
  }
}
