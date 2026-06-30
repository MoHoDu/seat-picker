import type { Zone } from "../seats";
import type { AnimationSpeed, AssignmentStep } from "./types";

export type AssignmentPlaybackStatus =
  | "idle"
  | "playing"
  | "paused"
  | "completed";

export type PlaybackSkipMode = "current-student" | "current-zone" | "all";

export type AssignmentPlaybackState = {
  status: AssignmentPlaybackStatus;
  speed: AnimationSpeed;
  currentStepIndex: number | null;
  currentStep: AssignmentStep | null;
  currentZone: Zone | null;
  totalStepCount: number;
  completedStepCount: number;
  isComplete: boolean;
};

export type AssignmentPlaybackControllerOptions = {
  steps: readonly AssignmentStep[];
  speed?: AnimationSpeed;
  status?: AssignmentPlaybackStatus;
  currentStepIndex?: number | null;
};

export class AssignmentPlaybackController {
  private readonly steps: AssignmentStep[];
  private readonly speed: AnimationSpeed;
  private readonly status: AssignmentPlaybackStatus;
  private readonly currentStepIndex: number | null;

  constructor(options: AssignmentPlaybackControllerOptions) {
    this.steps = options.steps.map((step) => this.cloneStep(step));
    this.speed = options.speed ?? "normal";
    this.currentStepIndex = this.normalizeStepIndex(
      options.currentStepIndex ?? null
    );
    this.status = this.normalizeStatus(options.status ?? "idle");
  }

  play(): AssignmentPlaybackController {
    if (this.steps.length === 0) {
      return this.complete();
    }

    if (this.status === "completed") {
      return this;
    }

    return this.createNext({
      status: "playing",
      currentStepIndex: this.currentStepIndex ?? 0,
    });
  }

  pause(): AssignmentPlaybackController {
    if (this.status !== "playing") {
      return this;
    }

    return this.createNext({ status: "paused" });
  }

  reset(): AssignmentPlaybackController {
    return this.createNext({
      status: "idle",
      currentStepIndex: null,
    });
  }

  advance(): AssignmentPlaybackController {
    if (this.steps.length === 0) {
      return this.complete();
    }

    if (this.currentStepIndex === null) {
      return this.play();
    }

    const nextStepIndex = this.currentStepIndex + 1;

    if (nextStepIndex >= this.steps.length) {
      return this.complete();
    }

    return this.createNext({
      status: "playing",
      currentStepIndex: nextStepIndex,
    });
  }

  skip(mode: PlaybackSkipMode): AssignmentPlaybackController {
    switch (mode) {
      case "current-student":
        return this.advance();
      case "current-zone":
        return this.skipCurrentZone();
      case "all":
        return this.complete();
    }
  }

  complete(): AssignmentPlaybackController {
    return this.createNext({
      status: "completed",
      currentStepIndex: this.steps.length > 0 ? this.steps.length - 1 : null,
    });
  }

  withSpeed(speed: AnimationSpeed): AssignmentPlaybackController {
    return this.createNext({ speed });
  }

  getState(): AssignmentPlaybackState {
    const currentStep = this.getCurrentStep();

    return {
      status: this.status,
      speed: this.speed,
      currentStepIndex: this.currentStepIndex,
      currentStep,
      currentZone: currentStep?.zone ?? null,
      totalStepCount: this.steps.length,
      completedStepCount: this.getCompletedStepCount(),
      isComplete: this.status === "completed",
    };
  }

  getSteps(): AssignmentStep[] {
    return this.steps.map((step) => this.cloneStep(step));
  }

  getCurrentStep(): AssignmentStep | null {
    if (this.currentStepIndex === null) {
      return null;
    }

    const step = this.steps[this.currentStepIndex];

    return step ? this.cloneStep(step) : null;
  }

  private skipCurrentZone(): AssignmentPlaybackController {
    if (this.steps.length === 0) {
      return this.complete();
    }

    if (this.currentStepIndex === null) {
      return this.play();
    }

    const currentStep = this.steps[this.currentStepIndex];

    if (!currentStep) {
      return this.complete();
    }

    const nextStepIndex = this.steps.findIndex(
      (step, index) =>
        index > this.currentStepIndex! &&
        step.zoneSequenceIndex !== currentStep.zoneSequenceIndex
    );

    if (nextStepIndex < 0) {
      return this.complete();
    }

    return this.createNext({
      status: "playing",
      currentStepIndex: nextStepIndex,
    });
  }

  private getCompletedStepCount(): number {
    if (this.steps.length === 0) {
      return 0;
    }

    if (this.status === "completed") {
      return this.steps.length;
    }

    return this.currentStepIndex === null ? 0 : this.currentStepIndex;
  }

  private createNext(
    options: Partial<AssignmentPlaybackControllerOptions>
  ): AssignmentPlaybackController {
    return new AssignmentPlaybackController({
      steps: this.steps,
      speed: options.speed ?? this.speed,
      status: options.status ?? this.status,
      currentStepIndex:
        options.currentStepIndex !== undefined
          ? options.currentStepIndex
          : this.currentStepIndex,
    });
  }

  private normalizeStatus(
    status: AssignmentPlaybackStatus
  ): AssignmentPlaybackStatus {
    if (this.steps.length === 0 && status !== "idle") {
      return "completed";
    }

    return status;
  }

  private normalizeStepIndex(stepIndex: number | null): number | null {
    if (stepIndex === null || this.steps.length === 0) {
      return null;
    }

    if (!Number.isInteger(stepIndex)) {
      throw new Error("currentStepIndex must be an integer.");
    }

    if (stepIndex < 0 || stepIndex >= this.steps.length) {
      throw new Error("currentStepIndex must be within playback steps.");
    }

    return stepIndex;
  }

  private cloneStep(step: AssignmentStep): AssignmentStep {
    return {
      ...step,
      candidateStudentIds: [...step.candidateStudentIds],
      candidateSeatIds: [...step.candidateSeatIds],
      weightByStudentId: { ...step.weightByStudentId },
    };
  }
}
