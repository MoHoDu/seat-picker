import { SeededRandom } from "../random";
import type { Zone } from "../seats";
import type { Student, StudentId } from "../students";
import type {
  AssignmentCandidate,
  PreferenceDistance,
  ZoneCandidateTarget,
} from "./types";

const ZONES: readonly Zone[] = ["front", "middle", "back"];

export class AssignmentPolicy {
  static readonly primaryWeight = 1;
  static readonly firstOverflowWeight = 0.7;
  static readonly secondOverflowWeight = 0.4;

  static getZones(): Zone[] {
    return [...ZONES];
  }

  static getWeightForDistance(distance: PreferenceDistance): number {
    switch (distance) {
      case 0:
        return this.primaryWeight;
      case 1:
        return this.firstOverflowWeight;
      case 2:
        return this.secondOverflowWeight;
    }
  }

  static getPreferenceStages(originPreference: Zone): ZoneCandidateTarget[][] {
    switch (originPreference) {
      case "front":
        return [
          [this.createTarget("front", 0)],
          [this.createTarget("middle", 1)],
          [this.createTarget("back", 2)],
        ];
      case "middle":
        return [
          [this.createTarget("middle", 0)],
          [this.createTarget("front", 1), this.createTarget("back", 1)],
        ];
      case "back":
        return [
          [this.createTarget("back", 0)],
          [this.createTarget("middle", 1)],
          [this.createTarget("front", 2)],
        ];
    }
  }

  static createPrimaryCandidate(
    student: Pick<Student, "id" | "preference">,
  ): AssignmentCandidate | null {
    if (student.preference === null) {
      return null;
    }

    return this.createCandidate(student.id, student.preference, {
      targetZone: student.preference,
      preferenceDistance: 0,
      weight: this.primaryWeight,
    });
  }

  static createPrimaryCandidates(
    students: readonly Pick<Student, "id" | "preference">[],
  ): AssignmentCandidate[] {
    return students.flatMap((student) => {
      const candidate = this.createPrimaryCandidate(student);
      return candidate ? [candidate] : [];
    });
  }

  static createCandidatesForPreference(
    studentId: StudentId,
    originPreference: Zone,
  ): AssignmentCandidate[][] {
    return this.getPreferenceStages(originPreference).map((stage) =>
      stage.map((target) =>
        this.createCandidate(studentId, originPreference, target),
      ),
    );
  }

  static getNextCandidates(
    candidate: AssignmentCandidate,
  ): AssignmentCandidate[] {
    const stages = this.getPreferenceStages(candidate.originPreference);
    const currentStageIndex = stages.findIndex((stage) =>
      stage.some(
        (target) =>
          target.targetZone === candidate.targetZone &&
          target.preferenceDistance === candidate.preferenceDistance,
      ),
    );

    if (currentStageIndex < 0 || currentStageIndex >= stages.length - 1) {
      return [];
    }

    return stages[currentStageIndex + 1]!.map((target) =>
      this.createCandidate(
        candidate.studentId,
        candidate.originPreference,
        target,
      ),
    );
  }

  static getPrimaryPreferenceCounts(
    students: readonly Pick<Student, "preference">[],
  ): Record<Zone, number> {
    const counts = this.createEmptyZoneCounts();

    for (const student of students) {
      if (student.preference !== null) {
        counts[student.preference] += 1;
      }
    }

    return counts;
  }

  static getZoneProcessingOrder(
    students: readonly Pick<Student, "preference">[],
    random: SeededRandom,
  ): Zone[] {
    const counts = this.getPrimaryPreferenceCounts(students);
    const countGroups = new Map<number, Zone[]>();

    for (const zone of ZONES) {
      const count = counts[zone];
      countGroups.set(count, [...(countGroups.get(count) ?? []), zone]);
    }

    return [...countGroups.entries()]
      .sort(([leftCount], [rightCount]) => rightCount - leftCount)
      .flatMap(([, zones]) => random.shuffle(zones));
  }

  static filterActiveCandidates(
    candidates: readonly AssignmentCandidate[],
    assignedStudentIds: Iterable<StudentId>,
  ): AssignmentCandidate[] {
    const assigned = new Set(assignedStudentIds);

    return candidates.filter(
      (candidate) => !assigned.has(candidate.studentId),
    );
  }

  static groupCandidatesByTargetZone(
    candidates: readonly AssignmentCandidate[],
  ): Record<Zone, AssignmentCandidate[]> {
    const groups: Record<Zone, AssignmentCandidate[]> = {
      front: [],
      middle: [],
      back: [],
    };

    for (const candidate of candidates) {
      groups[candidate.targetZone].push(candidate);
    }

    return groups;
  }

  private static createTarget(
    targetZone: Zone,
    preferenceDistance: PreferenceDistance,
  ): ZoneCandidateTarget {
    return {
      targetZone,
      preferenceDistance,
      weight: this.getWeightForDistance(preferenceDistance),
    };
  }

  private static createCandidate(
    studentId: StudentId,
    originPreference: Zone,
    target: ZoneCandidateTarget,
  ): AssignmentCandidate {
    return {
      studentId,
      originPreference,
      targetZone: target.targetZone,
      weight: target.weight,
      preferenceDistance: target.preferenceDistance,
    };
  }

  private static createEmptyZoneCounts(): Record<Zone, number> {
    return {
      front: 0,
      middle: 0,
      back: 0,
    };
  }
}
