import { describe, expect, it } from "vitest";
import { AssignmentPlaybackController } from "./AssignmentPlaybackController";
import type { AssignmentStep } from "./types";

describe("AssignmentPlaybackController", () => {
  it("plays, advances, and completes steps in order", () => {
    const controller = new AssignmentPlaybackController({
      steps: createSteps(),
    });
    const playing = controller.play();
    const next = playing.advance();
    const completed = next.advance().advance();

    expect(controller.getState()).toMatchObject({
      status: "idle",
      currentStepIndex: null,
      completedStepCount: 0,
      isComplete: false,
    });
    expect(playing.getState()).toMatchObject({
      status: "playing",
      currentStepIndex: 0,
      currentZone: "front",
      completedStepCount: 0,
    });
    expect(next.getState()).toMatchObject({
      status: "playing",
      currentStepIndex: 1,
      currentZone: "front",
      completedStepCount: 1,
    });
    expect(completed.getState()).toMatchObject({
      status: "completed",
      currentStepIndex: 2,
      completedStepCount: 3,
      isComplete: true,
    });
  });

  it("pauses and resumes without changing the current step", () => {
    const paused = new AssignmentPlaybackController({
      steps: createSteps(),
    })
      .play()
      .advance()
      .pause();

    expect(paused.getState()).toMatchObject({
      status: "paused",
      currentStepIndex: 1,
    });
    expect(paused.play().getState()).toMatchObject({
      status: "playing",
      currentStepIndex: 1,
    });
  });

  it("skips the current student by advancing one step", () => {
    const controller = new AssignmentPlaybackController({
      steps: createSteps(),
    })
      .play()
      .skip("current-student");

    expect(controller.getState().currentStepIndex).toBe(1);
  });

  it("skips all remaining steps in the current zone sequence", () => {
    const controller = new AssignmentPlaybackController({
      steps: createSteps(),
    })
      .play()
      .skip("current-zone");

    expect(controller.getState()).toMatchObject({
      status: "playing",
      currentStepIndex: 2,
      currentZone: "middle",
    });
  });

  it("skips all steps and marks playback complete", () => {
    const controller = new AssignmentPlaybackController({
      steps: createSteps(),
    })
      .play()
      .skip("all");

    expect(controller.getState()).toMatchObject({
      status: "completed",
      currentStepIndex: 2,
      completedStepCount: 3,
      isComplete: true,
    });
  });

  it("handles an empty step list as completed playback", () => {
    const controller = new AssignmentPlaybackController({ steps: [] }).play();

    expect(controller.getState()).toEqual({
      status: "completed",
      speed: "normal",
      currentStepIndex: null,
      currentStep: null,
      currentZone: null,
      totalStepCount: 0,
      completedStepCount: 0,
      isComplete: true,
    });
  });

  it("returns defensive copies of steps", () => {
    const controller = new AssignmentPlaybackController({
      steps: createSteps(),
    }).play();
    const state = controller.getState();
    const steps = controller.getSteps();

    state.currentStep!.candidateStudentIds.push("changed");
    steps[0]!.candidateSeatIds.push("changed");

    expect(controller.getState().currentStep?.candidateStudentIds).toEqual([
      "student-1",
    ]);
    expect(controller.getSteps()[0]?.candidateSeatIds).toEqual(["1-1"]);
  });
});

function createSteps(): AssignmentStep[] {
  return [
    createStep(0, "front", 0, "student-1", "1-1"),
    createStep(1, "front", 0, "student-2", "1-2"),
    createStep(2, "middle", 1, "student-3", "2-1"),
  ];
}

function createStep(
  stepIndex: number,
  zone: "front" | "middle" | "back",
  zoneSequenceIndex: number,
  studentId: string,
  seatId: string
): AssignmentStep {
  return {
    id: `step-${stepIndex + 1}`,
    zone,
    zoneSequenceIndex,
    stepIndex,
    candidateStudentIds: [studentId],
    selectedStudentId: studentId,
    candidateSeatIds: [seatId],
    selectedSeatId: seatId,
    weightByStudentId: { [studentId]: 1 },
    reason: "primary",
    preferenceDistance: 0,
  };
}
