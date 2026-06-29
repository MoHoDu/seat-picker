import { SeededRandom, type Seed } from "../random";
import type { Seat, SeatId, Zone } from "../seats";
import { SeatLayout } from "../seats";
import type { Student, StudentId } from "../students";
import { AssignmentPolicy } from "./AssignmentPolicy";
import type {
  AssignedSeat,
  AssignmentCandidate,
  AssignmentResult,
  AssignmentStep,
  AssignmentStepReason,
  AssignmentSummary,
  PreferenceDistance,
} from "./types";

export type AssignmentEngineInput = {
  students: readonly Student[];
  seatLayout: SeatLayout;
  seed: Seed;
};

type CandidatePoolsByZone = Record<Zone, AssignmentCandidate[]>;
type AvailableSeatsByZone = Record<Zone, Seat[]>;

export class AssignmentEngine {
  assign(input: AssignmentEngineInput): AssignmentResult {
    this.validate(input);

    const random = new SeededRandom(input.seed);
    const studentsById = this.createStudentsById(input.students);
    const assignedStudentIds = new Set<StudentId>();
    const assignedSeatIds = new Set<SeatId>();
    const assignedStudentIdBySeatId = new Map<SeatId, StudentId>();
    const availableSeatsByZone = this.createAvailableSeatsByZone(input.seatLayout);
    const candidatePoolsByZone = AssignmentPolicy.groupCandidatesByTargetZone(
      AssignmentPolicy.createPrimaryCandidates(input.students)
    );
    const steps: AssignmentStep[] = [];
    const zoneQueue = this.createZoneQueue(
      AssignmentPolicy.getZoneProcessingOrder(input.students, random)
    );
    let zoneSequenceIndex = 0;

    const enqueueZone = (zone: Zone): void => {
      zoneQueue.enqueue(zone);
    };

    while (zoneQueue.hasNext()) {
      const zone = zoneQueue.dequeue();

      const createdStep = this.processPreferredZone({
        zone,
        zoneSequenceIndex,
        candidatePoolsByZone,
        availableSeatsByZone,
        assignedStudentIds,
        assignedSeatIds,
        assignedStudentIdBySeatId,
        random,
        steps,
        enqueueZone,
      });

      if (createdStep) {
        zoneSequenceIndex += 1;
      }
    }

    zoneSequenceIndex = this.assignUnpreferredStudents({
      students: input.students,
      availableSeatsByZone,
      assignedStudentIds,
      assignedSeatIds,
      assignedStudentIdBySeatId,
      random,
      steps,
      zoneSequenceIndex,
    });

    return {
      seed: input.seed,
      seats: this.buildAssignedSeats(
        input.seatLayout.getSeats(),
        assignedStudentIdBySeatId,
        studentsById
      ),
      steps,
      summary: this.createSummary(steps, availableSeatsByZone),
    };
  }

  private validate(input: AssignmentEngineInput): void {
    if (input.students.length === 0) {
      throw new Error("At least one student is required.");
    }

    const availableSeatCount = input.seatLayout.getAvailableSeatCount();

    if (availableSeatCount === 0) {
      throw new Error("At least one available seat is required.");
    }

    if (input.students.length > availableSeatCount) {
      throw new Error("Student count cannot exceed available seats.");
    }

    const studentIds = new Set<StudentId>();

    for (const student of input.students) {
      if (student.name.trim().length === 0) {
        throw new Error("Student name cannot be empty.");
      }

      if (studentIds.has(student.id)) {
        throw new Error("Student ids must be unique.");
      }

      studentIds.add(student.id);
    }
  }

  private processPreferredZone(options: {
    zone: Zone;
    zoneSequenceIndex: number;
    candidatePoolsByZone: CandidatePoolsByZone;
    availableSeatsByZone: AvailableSeatsByZone;
    assignedStudentIds: Set<StudentId>;
    assignedSeatIds: Set<SeatId>;
    assignedStudentIdBySeatId: Map<SeatId, StudentId>;
    random: SeededRandom;
    steps: AssignmentStep[];
    enqueueZone: (zone: Zone) => void;
  }): boolean {
    const {
      zone,
      zoneSequenceIndex,
      candidatePoolsByZone,
      availableSeatsByZone,
      assignedStudentIds,
      assignedSeatIds,
      assignedStudentIdBySeatId,
      random,
      steps,
      enqueueZone,
    } = options;
    const initialStepCount = steps.length;

    while (availableSeatsByZone[zone].length > 0) {
      const activeCandidates = AssignmentPolicy.filterActiveCandidates(
        candidatePoolsByZone[zone],
        assignedStudentIds
      );

      if (activeCandidates.length === 0) {
        break;
      }

      const selectedCandidate = random.weightedPick(
        activeCandidates,
        (candidate) => candidate.weight
      );
      const selectedSeat = this.takeRandomSeat(availableSeatsByZone[zone], random);

      this.recordAssignment({
        studentId: selectedCandidate.studentId,
        seatId: selectedSeat.id,
        assignedStudentIds,
        assignedSeatIds,
        assignedStudentIdBySeatId,
      });

      steps.push(
        this.createStep({
          zone,
          zoneSequenceIndex,
          stepIndex: steps.length,
          activeCandidates,
          selectedCandidate,
          candidateSeats: [selectedSeat, ...availableSeatsByZone[zone]],
          selectedSeat,
        })
      );
    }

    if (availableSeatsByZone[zone].length > 0) {
      candidatePoolsByZone[zone] = AssignmentPolicy.filterActiveCandidates(
        candidatePoolsByZone[zone],
        assignedStudentIds
      );
      return steps.length > initialStepCount;
    }

    const overflowCandidates = AssignmentPolicy.filterActiveCandidates(
      candidatePoolsByZone[zone],
      assignedStudentIds
    );
    const overflowCandidateSet = new Set(overflowCandidates);

    candidatePoolsByZone[zone] = candidatePoolsByZone[zone].filter(
      (candidate) =>
        !assignedStudentIds.has(candidate.studentId) &&
        !overflowCandidateSet.has(candidate)
    );

    for (const candidate of overflowCandidates) {
      for (const nextCandidate of AssignmentPolicy.getNextCandidates(candidate)) {
        candidatePoolsByZone[nextCandidate.targetZone].push(nextCandidate);
        enqueueZone(nextCandidate.targetZone);
      }
    }

    return steps.length > initialStepCount;
  }

  private assignUnpreferredStudents(options: {
    students: readonly Student[];
    availableSeatsByZone: AvailableSeatsByZone;
    assignedStudentIds: Set<StudentId>;
    assignedSeatIds: Set<SeatId>;
    assignedStudentIdBySeatId: Map<SeatId, StudentId>;
    random: SeededRandom;
    steps: AssignmentStep[];
    zoneSequenceIndex: number;
  }): number {
    const {
      students,
      availableSeatsByZone,
      assignedStudentIds,
      assignedSeatIds,
      assignedStudentIdBySeatId,
      random,
      steps,
    } = options;
    let zoneSequenceIndex = options.zoneSequenceIndex;
    const unpreferredStudents = students.filter(
      (student) => student.preference === null && !assignedStudentIds.has(student.id)
    );

    while (unpreferredStudents.length > 0) {
      const candidateStudentIds = unpreferredStudents.map((student) => student.id);
      const selectedStudentIndex = random.nextInt(unpreferredStudents.length);
      const [selectedStudent] = unpreferredStudents.splice(selectedStudentIndex, 1);

      if (!selectedStudent) {
        break;
      }

      const remainingSeats = this.getRemainingSeats(availableSeatsByZone);
      const selectedSeat = this.takeRandomRemainingSeat(
        availableSeatsByZone,
        remainingSeats,
        random
      );

      this.recordAssignment({
        studentId: selectedStudent.id,
        seatId: selectedSeat.id,
        assignedStudentIds,
        assignedSeatIds,
        assignedStudentIdBySeatId,
      });

      steps.push({
        id: `step-${steps.length + 1}`,
        zone: selectedSeat.zone,
        zoneSequenceIndex,
        stepIndex: steps.length,
        candidateStudentIds,
        selectedStudentId: selectedStudent.id,
        candidateSeatIds: remainingSeats.map((seat) => seat.id),
        selectedSeatId: selectedSeat.id,
        weightByStudentId: Object.fromEntries(
          candidateStudentIds.map((studentId) => [studentId, 1])
        ),
        reason: "unpreferred",
        preferenceDistance: null,
      });
      zoneSequenceIndex += 1;
    }

    return zoneSequenceIndex;
  }

  private createStep(options: {
    zone: Zone;
    zoneSequenceIndex: number;
    stepIndex: number;
    activeCandidates: AssignmentCandidate[];
    selectedCandidate: AssignmentCandidate;
    candidateSeats: Seat[];
    selectedSeat: Seat;
  }): AssignmentStep {
    const {
      zone,
      zoneSequenceIndex,
      stepIndex,
      activeCandidates,
      selectedCandidate,
      candidateSeats,
      selectedSeat,
    } = options;

    return {
      id: `step-${stepIndex + 1}`,
      zone,
      zoneSequenceIndex,
      stepIndex,
      candidateStudentIds: activeCandidates.map((candidate) => candidate.studentId),
      selectedStudentId: selectedCandidate.studentId,
      candidateSeatIds: candidateSeats.map((seat) => seat.id),
      selectedSeatId: selectedSeat.id,
      weightByStudentId: Object.fromEntries(
        activeCandidates.map((candidate) => [
          candidate.studentId,
          candidate.weight,
        ])
      ),
      reason: this.getStepReason(selectedCandidate.preferenceDistance),
      preferenceDistance: selectedCandidate.preferenceDistance,
    };
  }

  private recordAssignment(options: {
    studentId: StudentId;
    seatId: SeatId;
    assignedStudentIds: Set<StudentId>;
    assignedSeatIds: Set<SeatId>;
    assignedStudentIdBySeatId: Map<SeatId, StudentId>;
  }): void {
    const {
      studentId,
      seatId,
      assignedStudentIds,
      assignedSeatIds,
      assignedStudentIdBySeatId,
    } = options;

    if (assignedStudentIds.has(studentId)) {
      throw new Error("Student is already assigned.");
    }

    if (assignedSeatIds.has(seatId)) {
      throw new Error("Seat is already assigned.");
    }

    assignedStudentIds.add(studentId);
    assignedSeatIds.add(seatId);
    assignedStudentIdBySeatId.set(seatId, studentId);
  }

  private getStepReason(distance: PreferenceDistance): AssignmentStepReason {
    return distance === 0 ? "primary" : "overflow";
  }

  private createSummary(
    steps: readonly AssignmentStep[],
    availableSeatsByZone: AvailableSeatsByZone
  ): AssignmentSummary {
    return {
      primaryAssignedCount: steps.filter((step) => step.reason === "primary").length,
      firstOverflowAssignedCount: steps.filter(
        (step) => step.preferenceDistance === 1
      ).length,
      secondOverflowAssignedCount: steps.filter(
        (step) => step.preferenceDistance === 2
      ).length,
      unpreferredAssignedCount: steps.filter(
        (step) => step.reason === "unpreferred"
      ).length,
      emptySeatCount: this.getRemainingSeats(availableSeatsByZone).length,
      manualSwapCount: 0,
    };
  }

  private createAvailableSeatsByZone(seatLayout: SeatLayout): AvailableSeatsByZone {
    return {
      front: seatLayout.getSeatsByZone("front", { availableOnly: true }),
      middle: seatLayout.getSeatsByZone("middle", { availableOnly: true }),
      back: seatLayout.getSeatsByZone("back", { availableOnly: true }),
    };
  }

  private createStudentsById(students: readonly Student[]): Map<StudentId, Student> {
    return new Map(students.map((student) => [student.id, { ...student }]));
  }

  private buildAssignedSeats(
    seats: readonly Seat[],
    assignedStudentIdBySeatId: Map<SeatId, StudentId>,
    studentsById: Map<StudentId, Student>
  ): AssignedSeat[] {
    return seats.map((seat) => {
      const studentId = assignedStudentIdBySeatId.get(seat.id);

      if (!studentId) {
        return { ...seat };
      }

      const student = studentsById.get(studentId);

      return student ? { ...seat, student: { ...student } } : { ...seat };
    });
  }

  private takeRandomSeat(seats: Seat[], random: SeededRandom): Seat {
    const selectedIndex = random.nextInt(seats.length);
    const [selectedSeat] = seats.splice(selectedIndex, 1);

    if (!selectedSeat) {
      throw new Error("No seat is available.");
    }

    return selectedSeat;
  }

  private takeRandomRemainingSeat(
    availableSeatsByZone: AvailableSeatsByZone,
    remainingSeats: readonly Seat[],
    random: SeededRandom
  ): Seat {
    const selectedSeat = random.pick(remainingSeats);
    const zoneSeats = availableSeatsByZone[selectedSeat.zone];
    const seatIndex = zoneSeats.findIndex((seat) => seat.id === selectedSeat.id);

    if (seatIndex < 0) {
      throw new Error("Selected seat is not available.");
    }

    zoneSeats.splice(seatIndex, 1);

    return selectedSeat;
  }

  private getRemainingSeats(availableSeatsByZone: AvailableSeatsByZone): Seat[] {
    return AssignmentPolicy.getZones().flatMap((zone) => availableSeatsByZone[zone]);
  }

  private createZoneQueue(initialZones: readonly Zone[]): {
    enqueue: (zone: Zone) => void;
    dequeue: () => Zone;
    hasNext: () => boolean;
  } {
    const queue: Zone[] = [];
    const queuedZones = new Set<Zone>();

    const enqueue = (zone: Zone): void => {
      if (!queuedZones.has(zone)) {
        queue.push(zone);
        queuedZones.add(zone);
      }
    };

    for (const zone of initialZones) {
      enqueue(zone);
    }

    return {
      enqueue,
      dequeue: () => {
        const zone = queue.shift();

        if (!zone) {
          throw new Error("Zone queue is empty.");
        }

        queuedZones.delete(zone);
        return zone;
      },
      hasNext: () => queue.length > 0,
    };
  }
}
