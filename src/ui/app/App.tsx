import { useEffect, useMemo, useRef, useState } from "react";
import {
  AssignmentEngine,
  AssignmentPlaybackController,
  SeatLayout,
  StudentRoster,
  type AssignedSeat,
  type AnimationSpeed,
  type AssignmentResult,
  type PreferenceZone,
  type Seat,
  type SeatId,
  type StudentId,
  type Zone,
} from "../../domain";
import {
  createDefaultProjectState,
  createPreferenceSessionFromState,
  createSeatLayoutFromState,
  type AppStep,
  type SeatPickerProjectState,
  updateProjectGrid,
} from "../../application/storage";
import {
  validatePreferenceSelection,
  validateSeatSetup,
  validateStudentInput,
  type PreferenceSelectionValidation,
  type ProjectValidationIssue,
  type SeatSetupValidation,
  type StudentInputValidation,
} from "../../application/validation";
import { SeatMapExporter } from "../../infrastructure/export";
import { LocalStorageProjectRepository } from "../../infrastructure/storage";
import { VersionSelector } from "../components";

const steps: Array<{ id: AppStep; label: string }> = [
  { id: "seat-setup", label: "좌석 설정" },
  { id: "student-input", label: "학생 입력" },
  { id: "preference-selection", label: "선호 선택" },
  { id: "drawing", label: "추첨 연출" },
  { id: "result", label: "결과 확인" },
];

const zoneLabels: Record<Zone, string> = {
  front: "앞자리",
  middle: "중간자리",
  back: "뒷자리",
};

const preferenceOptions: Array<{
  label: string;
  value: PreferenceZone;
}> = [
  { label: "앞자리", value: "front" },
  { label: "중간자리", value: "middle" },
  { label: "뒷자리", value: "back" },
  { label: "무선호", value: null },
];

type DrawAnimationPhase =
  | "zone-intro"
  | "student-spin"
  | "seat-spin"
  | "fixed"
  | "completed";

const animationSpeedOptions: Array<{
  label: string;
  value: AnimationSpeed;
}> = [
  { label: "빠름", value: "fast" },
  { label: "보통", value: "normal" },
  { label: "느림", value: "slow" },
];

type AnimationDurations = {
  zoneIntroMs: number;
  studentSpinMs: number;
  seatSpinMs: number;
  fixedMs: number;
  spinIntervalMs: number;
};

const normalAnimationDurations: AnimationDurations = {
  zoneIntroMs: 1100,
  studentSpinMs: 1300,
  seatSpinMs: 3000,
  fixedMs: 850,
  spinIntervalMs: 90,
};

const animationTimeScale: Record<AnimationSpeed, number> = {
  fast: 0.5,
  normal: 1,
  slow: 1.5,
};

export function App() {
  const storageRepository = useMemo(
    () => new LocalStorageProjectRepository(window.localStorage),
    [],
  );
  const [project, setProject] = useState<SeatPickerProjectState>(
    () => storageRepository.load() ?? createDefaultProjectState(),
  );
  const [studentNamesInput, setStudentNamesInput] = useState(() =>
    project.students.map((student) => student.name).join("\n"),
  );
  const [playback, setPlayback] = useState<AssignmentPlaybackController | null>(
    null,
  );
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    storageRepository.save(project);
  }, [project, storageRepository]);

  const seatLayoutState = useMemo(() => {
    try {
      return {
        layout: createSeatLayoutFromState(project),
        error: null,
      };
    } catch (error) {
      return {
        layout: null,
        error:
          error instanceof Error ? error.message : "좌석 설정을 확인하세요.",
      };
    }
  }, [project]);

  const studentRoster = useMemo(
    () => StudentRoster.fromMultiline(studentNamesInput),
    [studentNamesInput],
  );
  const studentDisplays = useMemo(() => {
    if (project.students.length === 0) {
      return [];
    }

    return new StudentRoster(project.students).getDisplays();
  }, [project.students]);
  const preferenceSession = useMemo(() => {
    if (project.students.length === 0) {
      return null;
    }

    return createPreferenceSessionFromState(project);
  }, [project]);
  const seatSetupValidation = useMemo(
    () =>
      validateSeatSetup(project, seatLayoutState.layout, seatLayoutState.error),
    [project, seatLayoutState.error, seatLayoutState.layout],
  );
  const studentInputValidation = useMemo(
    () =>
      validateStudentInput({
        studentCount: studentRoster.size,
        availableSeatCount: seatSetupValidation.availableSeatCount,
      }),
    [seatSetupValidation.availableSeatCount, studentRoster.size],
  );
  const preferenceValidation = useMemo(() => {
    if (!preferenceSession) {
      return null;
    }

    return validatePreferenceSelection({
      project,
      seatLayout: seatLayoutState.layout,
      preferenceSession,
    });
  }, [preferenceSession, project, seatLayoutState.layout]);

  const canOpenStep = (step: AppStep): boolean => {
    if (step === "seat-setup" || step === "student-input") {
      return true;
    }

    if (step === "preference-selection") {
      return project.students.length > 0;
    }

    return project.assignmentResult !== null;
  };

  const goToStep = (step: AppStep) => {
    if (!canOpenStep(step)) {
      setMessage("이전 단계를 먼저 완료하세요.");
      return;
    }

    setMessage(null);
    setProject((current) => ({ ...current, step }));
  };

  const setZoneRowCount = (
    key: keyof SeatPickerProjectState["zoneRows"],
    value: number,
  ) => {
    setProject((current) => ({
      ...current,
      zoneRows: {
        ...current.zoneRows,
        [key]: Math.max(0, Math.trunc(value) || 0),
      },
      assignmentResult: null,
    }));
  };

  const toggleUnavailableSeat = (seatId: SeatId) => {
    setProject((current) => {
      const unavailableSeatIds = current.unavailableSeatIds.includes(seatId)
        ? current.unavailableSeatIds.filter((id) => id !== seatId)
        : [...current.unavailableSeatIds, seatId];

      return {
        ...current,
        unavailableSeatIds,
        assignmentResult: null,
      };
    });
  };

  const resetSeatSetup = () => {
    const defaults = createDefaultProjectState();

    setPlayback(null);
    setMessage(null);
    setProject((current) => ({
      ...current,
      step: "seat-setup",
      grid: defaults.grid,
      zoneRows: defaults.zoneRows,
      unavailableSeatIds: [],
      assignmentResult: null,
    }));
  };

  const moveFromSeatSetup = () => {
    if (!seatSetupValidation.canContinue) {
      setMessage(getFirstBlockingMessage(seatSetupValidation.issues));
      return;
    }

    goToStep("student-input");
  };

  const applyStudentNames = () => {
    if (!studentInputValidation.canContinue) {
      setMessage(getFirstBlockingMessage(studentInputValidation.issues));
      return;
    }

    const students = studentRoster.getStudents();

    setMessage(null);
    setProject((current) => ({
      ...current,
      step: "preference-selection",
      students,
      preferenceSubmissions: [],
      assignmentResult: null,
    }));
  };

  const submitPreference = (
    studentId: StudentId,
    preference: PreferenceZone,
  ) => {
    if (!preferenceSession) {
      return;
    }

    const currentSubmission = preferenceSession.getSubmission(studentId);
    const nextSession = preferenceSession.submit({
      studentId,
      preference,
      adjacentStudentId: currentSubmission?.adjacentStudentId ?? null,
      source: "teacher",
    });

    setProject((current) => ({
      ...current,
      preferenceSubmissions: nextSession.getSubmissions(),
      assignmentResult: null,
    }));
  };

  const submitAdjacentPreference = (
    studentId: StudentId,
    adjacentStudentId: StudentId | null,
  ) => {
    if (!preferenceSession) {
      return;
    }

    const currentSubmission = preferenceSession.getSubmission(studentId);

    if (!currentSubmission) {
      setMessage("먼저 구역 선호를 선택하세요.");
      return;
    }

    const nextSession = preferenceSession.submit({
      ...currentSubmission,
      adjacentStudentId,
      source: "teacher",
    });

    setMessage(null);
    setProject((current) => ({
      ...current,
      preferenceSubmissions: nextSession.getSubmissions(),
      assignmentResult: null,
    }));
  };

  const fillPendingAsUnpreferred = () => {
    if (!preferenceSession) {
      return;
    }

    const nextSession = preferenceSession.submitMany(
      preferenceSession.getPendingStudentIds().map((studentId) => ({
        studentId,
        preference: null,
        source: "teacher",
      })),
    );

    setProject((current) => ({
      ...current,
      preferenceSubmissions: nextSession.getSubmissions(),
    }));
  };

  const startAssignment = () => {
    if (!preferenceValidation?.canStart) {
      setMessage(getFirstBlockingMessage(preferenceValidation?.issues ?? []));
      return;
    }

    runAssignment(project.seed.trim());
  };

  const runAssignment = (seed: string) => {
    if (!preferenceSession || !seatLayoutState.layout) {
      setMessage(seatLayoutState.error ?? "추첨 준비 상태를 확인하세요.");
      return;
    }

    const normalizedSeed = seed.trim();

    if (normalizedSeed.length === 0) {
      setMessage("Seed를 입력하세요.");
      return;
    }

    if (!preferenceSession.getProgress().isComplete) {
      setMessage("선호 미선택 학생을 무선호로 확정한 뒤 추첨을 시작하세요.");
      return;
    }

    try {
      const students = preferenceSession.applyToStudents();
      const result = new AssignmentEngine().assign({
        students,
        seatLayout: seatLayoutState.layout,
        seed: normalizedSeed,
      });
      const nextPlayback = new AssignmentPlaybackController({
        steps: result.steps,
      }).play();

      setPlayback(nextPlayback);
      setMessage(null);
      setProject((current) => ({
        ...current,
        step: "drawing",
        students,
        preferenceSubmissions: preferenceSession.getSubmissions(),
        seed: normalizedSeed,
        assignmentResult: result,
      }));
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "추첨을 시작할 수 없습니다.",
      );
    }
  };

  const showResult = () => {
    if (!project.assignmentResult) {
      setMessage("먼저 추첨을 실행하세요.");
      return;
    }

    setPlayback((current) => current?.complete() ?? null);
    goToStep("result");
  };

  const resetProject = () => {
    const nextProject = createDefaultProjectState();

    storageRepository.clear();
    setPlayback(null);
    setStudentNamesInput("");
    setMessage(null);
    setProject(nextProject);
  };

  const rerollAssignment = () => {
    runAssignment(createRerollSeed());
  };

  const swapResultSeats = (firstSeatId: SeatId, secondSeatId: SeatId) => {
    setProject((current) => {
      if (!current.assignmentResult) {
        return current;
      }

      return {
        ...current,
        assignmentResult: swapAssignedStudents(
          current.assignmentResult,
          firstSeatId,
          secondSeatId,
        ),
      };
    });
  };

  return (
    <main className="app-shell">
      <header className="app-header" aria-labelledby="app-title">
        <div>
          <p className="app-kicker">교실/학원 좌석 추첨 도구</p>
          <h1 id="app-title">seat-picker</h1>
        </div>
        <div className="header-side">
          <p className="app-description">
            좌석 설정, 학생 명단, 선호 구역을 한 흐름에서 입력하고 재현 가능한
            좌석 배정을 만듭니다.
          </p>
          <VersionSelector />
        </div>
      </header>

      <nav className="step-nav" aria-label="진행 단계">
        {steps.map((step, index) => (
          <button
            key={step.id}
            type="button"
            className={step.id === project.step ? "active" : ""}
            disabled={!canOpenStep(step.id)}
            onClick={() => goToStep(step.id)}
          >
            <span>{index + 1}</span>
            {step.label}
          </button>
        ))}
      </nav>

      {message ? <p className="status-message">{message}</p> : null}

      {project.step === "seat-setup" ? (
        <SeatSetupStep
          project={project}
          seatLayout={seatLayoutState.layout}
          validation={seatSetupValidation}
          onGridChange={(rows, columns) => {
            setProject((current) =>
              updateProjectGrid(current, { rows, columns }),
            );
          }}
          onZoneRowChange={setZoneRowCount}
          onToggleUnavailableSeat={toggleUnavailableSeat}
          onReset={resetSeatSetup}
          onNext={moveFromSeatSetup}
        />
      ) : null}

      {project.step === "student-input" ? (
        <StudentInputStep
          namesInput={studentNamesInput}
          roster={studentRoster}
          validation={studentInputValidation}
          onChange={setStudentNamesInput}
          onBack={() => goToStep("seat-setup")}
          onNext={applyStudentNames}
        />
      ) : null}

      {project.step === "preference-selection" && preferenceSession ? (
        <PreferenceSelectionStep
          project={project}
          studentDisplays={studentDisplays}
          preferenceSession={preferenceSession}
          validation={preferenceValidation}
          onPreferenceChange={submitPreference}
          onAdjacentPreferenceChange={submitAdjacentPreference}
          onFillPending={fillPendingAsUnpreferred}
          onSeedChange={(seed) =>
            setProject((current) => ({
              ...current,
              seed,
              assignmentResult: null,
            }))
          }
          onBack={() => goToStep("student-input")}
          onStart={startAssignment}
        />
      ) : null}

      {project.step === "drawing" && project.assignmentResult ? (
        <DrawingStep
          result={project.assignmentResult}
          columns={project.grid.columns}
          playback={playback}
          studentsById={
            new Map(project.students.map((student) => [student.id, student]))
          }
          onPlaybackChange={setPlayback}
          onBack={() => goToStep("preference-selection")}
          onShowResult={showResult}
        />
      ) : null}

      {project.step === "result" && project.assignmentResult ? (
        <ResultStep
          result={project.assignmentResult}
          columns={project.grid.columns}
          onBack={() => goToStep("drawing")}
          onSwapSeats={swapResultSeats}
          onReroll={rerollAssignment}
          onRestart={resetProject}
        />
      ) : null}
    </main>
  );
}

function SeatSetupStep(props: {
  project: SeatPickerProjectState;
  seatLayout: SeatLayout | null;
  validation: SeatSetupValidation;
  onGridChange: (rows: number, columns: number) => void;
  onZoneRowChange: (
    key: keyof SeatPickerProjectState["zoneRows"],
    value: number,
  ) => void;
  onToggleUnavailableSeat: (seatId: SeatId) => void;
  onReset: () => void;
  onNext: () => void;
}) {
  const { project, seatLayout, validation } = props;

  return (
    <section className="tool-section" aria-labelledby="seat-setup-title">
      <div className="section-heading">
        <div>
          <p>1단계</p>
          <h2 id="seat-setup-title">좌석 설정</h2>
        </div>
        <div className="button-row">
          <button type="button" className="secondary" onClick={props.onReset}>
            좌석 설정 초기화
          </button>
          <button
            type="button"
            disabled={!validation.canContinue}
            onClick={props.onNext}
          >
            다음
          </button>
        </div>
      </div>

      <div className="control-grid">
        <label>
          행
          <input
            type="number"
            min={1}
            value={project.grid.rows}
            onChange={(event) =>
              props.onGridChange(
                toPositiveInteger(event.currentTarget.value),
                project.grid.columns,
              )
            }
          />
        </label>
        <label>
          열
          <input
            type="number"
            min={1}
            value={project.grid.columns}
            onChange={(event) =>
              props.onGridChange(
                project.grid.rows,
                toPositiveInteger(event.currentTarget.value),
              )
            }
          />
        </label>
        <label>
          앞줄
          <input
            type="number"
            min={0}
            value={project.zoneRows.frontRows}
            onChange={(event) =>
              props.onZoneRowChange(
                "frontRows",
                Number(event.currentTarget.value),
              )
            }
          />
        </label>
        <label>
          중간줄
          <input
            type="number"
            min={0}
            value={project.zoneRows.middleRows}
            onChange={(event) =>
              props.onZoneRowChange(
                "middleRows",
                Number(event.currentTarget.value),
              )
            }
          />
        </label>
        <label>
          뒷줄
          <input
            type="number"
            min={0}
            value={project.zoneRows.backRows}
            onChange={(event) =>
              props.onZoneRowChange(
                "backRows",
                Number(event.currentTarget.value),
              )
            }
          />
        </label>
      </div>

      <p
        className={
          validation.zoneRowTotal === project.grid.rows
            ? "hint"
            : "hint warning"
        }
      >
        구역 행 합계 {validation.zoneRowTotal} / 전체 행 {project.grid.rows}
      </p>
      <p className="hint">
        전체 {validation.totalSeatCount}석 · 사용 가능{" "}
        {validation.availableSeatCount}석 · 사용 불가{" "}
        {validation.unavailableSeatCount}석
      </p>
      <ValidationMessages issues={validation.issues} />

      {seatLayout ? (
        <SeatGrid
          seats={seatLayout.getSeats()}
          columns={project.grid.columns}
          unavailableSeatIds={project.unavailableSeatIds}
          onToggleSeat={props.onToggleUnavailableSeat}
        />
      ) : null}
    </section>
  );
}

function StudentInputStep(props: {
  namesInput: string;
  roster: StudentRoster;
  validation: StudentInputValidation;
  onChange: (value: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const displays = props.roster.getDisplays();

  return (
    <section className="tool-section" aria-labelledby="student-input-title">
      <div className="section-heading">
        <div>
          <p>2단계</p>
          <h2 id="student-input-title">학생 입력</h2>
        </div>
        <div className="button-row">
          <button type="button" className="secondary" onClick={props.onBack}>
            이전
          </button>
          <button
            type="button"
            disabled={!props.validation.canContinue}
            onClick={props.onNext}
          >
            명단 적용 및 선호 선택
          </button>
        </div>
      </div>

      <label className="textarea-field">
        학생 이름 목록
        <textarea
          value={props.namesInput}
          rows={8}
          placeholder={"김민준\n이서연\n박지호"}
          onChange={(event) => props.onChange(event.currentTarget.value)}
        />
      </label>

      <div className="student-preview" aria-label="학생 미리보기">
        <strong>인식된 학생 {displays.length}명</strong>
        <p className="hint">
          사용 가능 좌석 {props.validation.availableSeatCount}석 / 입력 학생{" "}
          {props.validation.studentCount}명
        </p>
        <ValidationMessages issues={props.validation.issues} />
        <ul>
          {displays.map((student) => (
            <li key={student.id}>{student.displayName}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function PreferenceSelectionStep(props: {
  project: SeatPickerProjectState;
  studentDisplays: ReturnType<StudentRoster["getDisplays"]>;
  preferenceSession: NonNullable<
    ReturnType<typeof createPreferenceSessionFromState>
  >;
  validation: PreferenceSelectionValidation | null;
  onPreferenceChange: (
    studentId: StudentId,
    preference: PreferenceZone,
  ) => void;
  onAdjacentPreferenceChange: (
    studentId: StudentId,
    adjacentStudentId: StudentId | null,
  ) => void;
  onFillPending: () => void;
  onSeedChange: (seed: string) => void;
  onBack: () => void;
  onStart: () => void;
}) {
  const progress = props.preferenceSession.getProgress();

  return (
    <section className="tool-section" aria-labelledby="preference-title">
      <div className="section-heading">
        <div>
          <p>3단계</p>
          <h2 id="preference-title">선호 선택</h2>
        </div>
        <div className="button-row">
          <button type="button" className="secondary" onClick={props.onBack}>
            이전
          </button>
          <button
            type="button"
            disabled={!props.validation?.canStart}
            onClick={props.onStart}
          >
            추첨 시작
          </button>
        </div>
      </div>

      <div className="preference-toolbar">
        <p>
          제출 {progress.submittedCount}명 / 전체 {progress.totalCount}명 ·
          미선택 {progress.pendingCount}명
        </p>
        <label>
          Seed
          <input
            value={props.project.seed}
            onChange={(event) => props.onSeedChange(event.currentTarget.value)}
          />
        </label>
        <button
          type="button"
          className="secondary"
          disabled={progress.pendingCount === 0}
          onClick={props.onFillPending}
        >
          미선택 무선호 처리
        </button>
      </div>
      <ValidationMessages issues={props.validation?.issues ?? []} />

      <div className="preference-list">
        {props.studentDisplays.map((student) => {
          const submission = props.preferenceSession.getSubmission(student.id);
          const hasSubmittedPreference = submission !== undefined;

          return (
            <fieldset key={student.id} className="preference-row">
              <legend>{student.displayName}</legend>
              <div className="segmented-control">
                {preferenceOptions.map((option) => {
                  const optionKey = option.value ?? "none";
                  const checked =
                    submission !== undefined &&
                    submission.preference === option.value;

                  return (
                    <label
                      key={optionKey}
                      className={checked ? "selected" : ""}
                    >
                      <input
                        type="radio"
                        name={`preference-${student.id}`}
                        aria-label={`${student.displayName} ${option.label}`}
                        checked={checked}
                        onChange={() =>
                          props.onPreferenceChange(student.id, option.value)
                        }
                      />
                      {option.label}
                    </label>
                  );
                })}
              </div>
              <label className="adjacent-select">
                옆자리 희망
                <select
                  aria-label={`${student.displayName} 옆자리 희망`}
                  disabled={!hasSubmittedPreference}
                  value={submission?.adjacentStudentId ?? ""}
                  onChange={(event) =>
                    props.onAdjacentPreferenceChange(
                      student.id,
                      event.currentTarget.value.length > 0
                        ? event.currentTarget.value
                        : null,
                    )
                  }
                >
                  <option value="">없음</option>
                  {props.studentDisplays
                    .filter((candidate) => candidate.id !== student.id)
                    .map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {candidate.displayName}
                      </option>
                    ))}
                </select>
              </label>
            </fieldset>
          );
        })}
      </div>
    </section>
  );
}

function DrawingStep(props: {
  result: AssignmentResult;
  columns: number;
  playback: AssignmentPlaybackController | null;
  studentsById: Map<StudentId, { name: string }>;
  onPlaybackChange: (controller: AssignmentPlaybackController) => void;
  onBack: () => void;
  onShowResult: () => void;
}) {
  const controller =
    props.playback ??
    new AssignmentPlaybackController({ steps: props.result.steps }).play();
  const state = controller.getState();
  const currentStep = state.currentStep;
  const currentStepKey = currentStep?.stepIndex ?? null;
  const durations = getAnimationDurations(state.speed);
  const [phase, setPhase] = useState<DrawAnimationPhase>(() =>
    state.status === "completed" ? "completed" : "zone-intro",
  );
  const [displayStudentId, setDisplayStudentId] = useState<StudentId | null>(
    currentStep?.selectedStudentId ?? null,
  );
  const [displaySeatId, setDisplaySeatId] = useState<SeatId | null>(
    currentStep?.selectedSeatId ?? null,
  );
  const selectedStudentName = state.currentStep
    ? (props.studentsById.get(state.currentStep.selectedStudentId)?.name ??
      null)
    : null;
  const displayStudentName = displayStudentId
    ? (props.studentsById.get(displayStudentId)?.name ?? null)
    : null;
  const zoneStepNumber = currentStep ? currentStep.zoneSequenceIndex + 1 : 0;
  const isFirstStepInZone = currentStep
    ? isFirstStepOfZone(props.result.steps, currentStep.stepIndex)
    : false;
  const isCompleted = state.status === "completed";
  const isPlaying = state.status === "playing";
  const isPaused = state.status === "paused";
  const shouldSpinStudents = (currentStep?.candidateStudentIds.length ?? 0) > 1;
  const shouldSpinSeats = (currentStep?.candidateSeatIds.length ?? 0) > 1;
  const selectedSeat = currentStep
    ? findSeat(props.result.seats, currentStep.selectedSeatId)
    : undefined;
  const displaySeat = displaySeatId
    ? findSeat(props.result.seats, displaySeatId)
    : undefined;
  const selectedSeatLabel = selectedSeat
    ? formatSeatLabel(selectedSeat)
    : state.currentStep?.selectedSeatId;
  const displaySeatLabel = displaySeat
    ? formatSeatLabel(displaySeat)
    : displaySeatId;
  const visibleStudentIdBySeatId = getVisibleStudentIdBySeatId({
    steps: props.result.steps,
    completedStepCount: state.completedStepCount,
    currentStep: currentStep ?? undefined,
    phase,
    isCompleted,
  });

  useEffect(() => {
    if (!currentStep) {
      setPhase("completed");
      setDisplayStudentId(null);
      setDisplaySeatId(null);
      return;
    }

    if (isCompleted) {
      setPhase("completed");
      setDisplayStudentId(currentStep.selectedStudentId);
      setDisplaySeatId(currentStep.selectedSeatId);
      return;
    }

    setPhase(isFirstStepInZone ? "zone-intro" : "student-spin");
    setDisplayStudentId(null);
    setDisplaySeatId(null);
  }, [
    currentStep?.stepIndex,
    currentStep?.selectedSeatId,
    currentStep?.selectedStudentId,
    isCompleted,
    isFirstStepInZone,
  ]);

  useEffect(() => {
    if (!currentStep || state.status !== "playing") {
      return;
    }

    if (phase !== "zone-intro") {
      return;
    }

    const timeout = window.setTimeout(() => {
      setPhase("student-spin");
    }, durations.zoneIntroMs);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [currentStepKey, durations.zoneIntroMs, phase, state.status]);

  useEffect(() => {
    if (!currentStep || state.status !== "playing") {
      return;
    }

    if (phase !== "student-spin") {
      return;
    }

    let spinIndex = 0;
    const candidates = currentStep.candidateStudentIds;
    setDisplayStudentId(currentStep.selectedStudentId);

    if (candidates.length <= 1) {
      const timeout = window.setTimeout(() => {
        setDisplayStudentId(currentStep.selectedStudentId);
        setPhase("seat-spin");
      }, durations.studentSpinMs);

      return () => {
        window.clearTimeout(timeout);
      };
    }

    setDisplayStudentId(candidates[0] ?? currentStep.selectedStudentId);
    const interval = window.setInterval(() => {
      spinIndex += 1;
      setDisplayStudentId(candidates[spinIndex % candidates.length] ?? null);
    }, durations.spinIntervalMs);
    const timeout = window.setTimeout(() => {
      window.clearInterval(interval);
      setDisplayStudentId(currentStep.selectedStudentId);
      setPhase("seat-spin");
    }, durations.studentSpinMs);

    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [
    currentStepKey,
    durations.spinIntervalMs,
    durations.studentSpinMs,
    phase,
    state.status,
  ]);

  useEffect(() => {
    if (!currentStep || state.status !== "playing") {
      return;
    }

    if (phase !== "seat-spin") {
      return;
    }

    let spinIndex = 0;
    const candidateSeatIds = currentStep.candidateSeatIds;
    setDisplaySeatId(currentStep.selectedSeatId);

    if (candidateSeatIds.length <= 1) {
      const timeout = window.setTimeout(() => {
        setDisplaySeatId(currentStep.selectedSeatId);
        setPhase("fixed");
      }, durations.seatSpinMs);

      return () => {
        window.clearTimeout(timeout);
      };
    }

    setDisplaySeatId(candidateSeatIds[0] ?? currentStep.selectedSeatId);
    const interval = window.setInterval(() => {
      spinIndex += 1;
      setDisplaySeatId(
        candidateSeatIds[spinIndex % candidateSeatIds.length] ?? null,
      );
    }, durations.spinIntervalMs);
    const timeout = window.setTimeout(() => {
      window.clearInterval(interval);
      setDisplaySeatId(currentStep.selectedSeatId);
      setPhase("fixed");
    }, durations.seatSpinMs);

    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [
    currentStepKey,
    durations.seatSpinMs,
    durations.spinIntervalMs,
    phase,
    state.status,
  ]);

  useEffect(() => {
    if (!currentStep || state.status !== "playing") {
      return;
    }

    if (phase !== "fixed") {
      return;
    }

    const timeout = window.setTimeout(() => {
      const nextController = controller.advance();

      props.onPlaybackChange(nextController);

      if (nextController.getState().isComplete) {
        setPhase("completed");
      }
    }, durations.fixedMs);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [
    controller,
    currentStepKey,
    durations.fixedMs,
    phase,
    props.onPlaybackChange,
    state.status,
  ]);

  const changeSpeed = (speed: AnimationSpeed) => {
    props.onPlaybackChange(controller.withSpeed(speed));
  };

  const pausePlayback = () => {
    props.onPlaybackChange(controller.pause());
  };

  const playPlayback = () => {
    props.onPlaybackChange(controller.play());
  };

  const skipPlayback = (
    mode: Parameters<AssignmentPlaybackController["skip"]>[0],
  ) => {
    props.onPlaybackChange(controller.skip(mode));
  };

  return (
    <section className="tool-section" aria-labelledby="drawing-title">
      <div className="section-heading">
        <div>
          <p>4단계</p>
          <h2 id="drawing-title">추첨 연출</h2>
        </div>
        <div className="button-row">
          <button type="button" className="secondary" onClick={props.onBack}>
            이전
          </button>
          <button type="button" onClick={props.onShowResult}>
            결과 보기
          </button>
        </div>
      </div>

      <div className="playback-toolbar">
        <fieldset className="speed-control">
          <legend>연출 속도</legend>
          <div className="segmented-control">
            {animationSpeedOptions.map((option) => (
              <label
                key={option.value}
                className={state.speed === option.value ? "selected" : ""}
              >
                <input
                  type="radio"
                  name="animation-speed"
                  aria-label={`연출 속도 ${option.label}`}
                  checked={state.speed === option.value}
                  onChange={() => changeSpeed(option.value)}
                />
                {option.label}
              </label>
            ))}
          </div>
        </fieldset>

        <p className="playback-status">
          {getPlaybackStatusLabel(state.status)} · {state.completedStepCount}/
          {state.totalStepCount}
        </p>
      </div>

      <div className={`draw-stage ${phase}`}>
        <div className="draw-board-panel" aria-label="추첨 좌석표">
          <div className="draw-board-heading">
            <div>
              <p>{phase === "completed" ? "추첨 완료" : "현재 추첨"}</p>
              <strong>
                {selectedStudentName
                  ? `${selectedStudentName} → ${selectedSeatLabel}`
                  : "배정할 단계가 없습니다"}
              </strong>
            </div>
            <span>
              {state.currentZone ? zoneLabels[state.currentZone] : "전체"} ·{" "}
              {state.completedStepCount}/{state.totalStepCount}
            </span>
          </div>

          <DrawingSeatGrid
            seats={props.result.seats}
            columns={props.columns}
            assignedStudentIdBySeatId={visibleStudentIdBySeatId}
            studentsById={props.studentsById}
            candidateSeatIds={
              phase === "seat-spin" && currentStep
                ? currentStep.candidateSeatIds
                : []
            }
            activeSeatId={phase === "seat-spin" ? displaySeatId : null}
            fixedSeatId={
              phase === "fixed" && currentStep
                ? currentStep.selectedSeatId
                : null
            }
            rouletteStudentName={displayStudentName ?? selectedStudentName}
          />
        </div>

        <div className="draw-popup" role="status" aria-live="polite">
          {phase === "zone-intro" && currentStep ? (
            <>
              <p>{zoneStepNumber}번째 구역 추첨 시작</p>
              <strong>{zoneLabels[currentStep.zone]}</strong>
              <span>이 구역의 남은 좌석을 채웁니다</span>
            </>
          ) : null}

          {phase === "student-spin" && currentStep ? (
            <>
              <p>학생 슬롯</p>
              <strong
                className={
                  shouldSpinStudents ? "slot-value spinning" : "slot-value"
                }
              >
                {displayStudentName ?? "학생 선택 중"}
              </strong>
              <span>
                {shouldSpinStudents
                  ? `${zoneLabels[currentStep.zone]} 후보에서 한 명 선택`
                  : "남은 학생이 한 명이라 결과를 표시합니다"}
              </span>
            </>
          ) : null}

          {phase === "seat-spin" && currentStep ? (
            <>
              <p>자리 슬롯</p>
              <strong
                className={
                  shouldSpinSeats ? "slot-value spinning" : "slot-value"
                }
              >
                {displayStudentName ?? selectedStudentName} →{" "}
                {displaySeatLabel ?? "좌석 선택 중"}
              </strong>
              <span>
                {shouldSpinSeats
                  ? "좌석표에서 후보 좌석이 바뀝니다"
                  : "남은 좌석이 한 자리라 결과를 표시합니다"}
              </span>
            </>
          ) : null}

          {phase === "fixed" && currentStep ? (
            <>
              <p>좌석 확정</p>
              <strong className="slot-value">
                {selectedStudentName} → {selectedSeatLabel}
              </strong>
              <span>다음 학생으로 넘어갑니다</span>
            </>
          ) : null}

          {phase === "completed" ? (
            <>
              <p>모든 구역 추첨 완료</p>
              <strong>결과를 확인하세요</strong>
              <span>전체 배정이 고정되었습니다</span>
            </>
          ) : null}
        </div>
      </div>

      <div className="button-row">
        <button
          type="button"
          className="secondary"
          disabled={!isPlaying}
          onClick={pausePlayback}
        >
          {isPaused ? "일시정지됨" : "일시정지"}
        </button>
        <button
          type="button"
          className="secondary"
          disabled={isPlaying || isCompleted}
          onClick={playPlayback}
        >
          재생
        </button>
        <button
          type="button"
          disabled={isCompleted}
          onClick={() => skipPlayback("current-student")}
        >
          현재 학생 연출 건너뛰기
        </button>
        <button
          type="button"
          disabled={isCompleted}
          onClick={() => skipPlayback("current-zone")}
        >
          현재 구역 연출 건너뛰기
        </button>
        <button
          type="button"
          disabled={isCompleted}
          onClick={() => skipPlayback("all")}
        >
          전체 연출 건너뛰기
        </button>
      </div>
    </section>
  );
}

function DrawingSeatGrid(props: {
  seats: readonly AssignedSeat[];
  columns: number;
  assignedStudentIdBySeatId: Map<SeatId, StudentId>;
  studentsById: Map<StudentId, { name: string }>;
  candidateSeatIds: readonly SeatId[];
  activeSeatId: SeatId | null;
  fixedSeatId: SeatId | null;
  rouletteStudentName: string | null;
}) {
  const candidateSeatIdSet = new Set(props.candidateSeatIds);

  return (
    <div
      className="seat-grid drawing-seat-grid"
      style={{
        gridTemplateColumns: `repeat(${props.columns}, minmax(52px, 1fr))`,
      }}
    >
      {props.seats.map((seat) => {
        const assignedStudentId = props.assignedStudentIdBySeatId.get(seat.id);
        const assignedStudentName = assignedStudentId
          ? props.studentsById.get(assignedStudentId)?.name
          : null;
        const isActiveRoulette = props.activeSeatId === seat.id;
        const isCandidate = candidateSeatIdSet.has(seat.id);
        const isFixed = props.fixedSeatId === seat.id;
        const displayName =
          isActiveRoulette && props.rouletteStudentName
            ? props.rouletteStudentName
            : assignedStudentName;
        const className = [
          "seat-cell",
          "drawing-seat",
          seat.zone,
          seat.status,
          assignedStudentName ? "assigned" : "",
          isCandidate ? "candidate" : "",
          isActiveRoulette ? "active-roulette" : "",
          isFixed ? "current-fixed" : "",
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <div
            key={seat.id}
            className={className}
            aria-label={
              isActiveRoulette
                ? `현재 룰렛 좌석 ${formatSeatLabel(seat)}`
                : formatSeatLabel(seat)
            }
          >
            <span>{formatSeatLabel(seat)}</span>
            <strong>{displayName ?? "빈 자리"}</strong>
            <small>{seat.id}</small>
          </div>
        );
      })}
    </div>
  );
}

function ResultStep(props: {
  result: AssignmentResult;
  columns: number;
  onBack: () => void;
  onSwapSeats: (firstSeatId: SeatId, secondSeatId: SeatId) => void;
  onReroll: () => void;
  onRestart: () => void;
}) {
  const { result } = props;
  const seatMapRef = useRef<HTMLDivElement | null>(null);
  const exporter = useMemo(() => new SeatMapExporter(), []);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedSwapSeatId, setSelectedSwapSeatId] = useState<SeatId | null>(
    null,
  );
  const [swapMessage, setSwapMessage] = useState<string | null>(null);

  const exportPng = async () => {
    if (!seatMapRef.current) {
      setExportMessage("내보낼 좌석표를 찾을 수 없습니다.");
      return;
    }

    try {
      setIsExporting(true);
      setExportMessage(null);
      const exportResult = await exporter.exportPng(seatMapRef.current, {
        fileName: createResultFileName(result.seed),
      });
      setExportMessage(
        exportResult === "saved"
          ? "PNG 저장을 완료했습니다."
          : "PNG 저장이 취소되었습니다.",
      );
    } catch {
      setExportMessage("PNG 저장에 실패했습니다.");
    } finally {
      setIsExporting(false);
    }
  };

  const selectSeatForSwap = (seat: AssignedSeat) => {
    if (!seat.student) {
      setSwapMessage("학생이 배정된 좌석 두 개를 선택하세요.");
      return;
    }

    if (selectedSwapSeatId === null) {
      setSelectedSwapSeatId(seat.id);
      setSwapMessage(
        `${seat.student.name} 학생을 선택했습니다. 바꿀 학생의 좌석을 선택하세요.`,
      );
      return;
    }

    if (selectedSwapSeatId === seat.id) {
      setSelectedSwapSeatId(null);
      setSwapMessage("자리 교체 선택을 취소했습니다.");
      return;
    }

    const firstSeat = result.seats.find(
      (candidate) => candidate.id === selectedSwapSeatId,
    );

    if (!firstSeat?.student) {
      setSelectedSwapSeatId(seat.id);
      setSwapMessage(
        `${seat.student.name} 학생을 선택했습니다. 바꿀 학생의 좌석을 선택하세요.`,
      );
      return;
    }

    props.onSwapSeats(firstSeat.id, seat.id);
    setSelectedSwapSeatId(null);
    setSwapMessage(
      `${firstSeat.student.name} ↔ ${seat.student.name} 자리 교체를 완료했습니다.`,
    );
  };

  return (
    <section className="tool-section" aria-labelledby="result-title">
      <div className="section-heading">
        <div>
          <p>5단계</p>
          <h2 id="result-title">배정 결과</h2>
        </div>
        <div className="button-row">
          <button type="button" className="secondary" onClick={props.onBack}>
            연출로 돌아가기
          </button>
          <button
            type="button"
            className="secondary"
            disabled={isExporting}
            onClick={() => void exportPng()}
          >
            {isExporting ? "PNG 저장 중" : "PNG 저장 위치/이름 선택"}
          </button>
          <button type="button" className="secondary" onClick={props.onReroll}>
            다시 뽑기
          </button>
          <button type="button" onClick={props.onRestart}>
            처음부터 다시 설정
          </button>
        </div>
      </div>

      {exportMessage ? <p className="hint">{exportMessage}</p> : null}

      <dl className="summary-grid">
        <div>
          <dt>Seed</dt>
          <dd>{result.seed}</dd>
        </div>
        <div>
          <dt>1순위 배정</dt>
          <dd>{result.summary.primaryAssignedCount}</dd>
        </div>
        <div>
          <dt>1차 이동</dt>
          <dd>{result.summary.firstOverflowAssignedCount}</dd>
        </div>
        <div>
          <dt>2차 이동</dt>
          <dd>{result.summary.secondOverflowAssignedCount}</dd>
        </div>
        <div>
          <dt>무선호 배정</dt>
          <dd>{result.summary.unpreferredAssignedCount}</dd>
        </div>
        <div>
          <dt>옆자리 희망 충족</dt>
          <dd>
            {result.summary.adjacentPreferenceSatisfiedCount}/
            {result.summary.adjacentPreferenceCount}
          </dd>
        </div>
        <div>
          <dt>빈 좌석</dt>
          <dd>{result.summary.emptySeatCount}</dd>
        </div>
        <div>
          <dt>수동 교체</dt>
          <dd>{result.summary.manualSwapCount}</dd>
        </div>
      </dl>

      <div className="swap-guide">
        <strong>자리 교체</strong>
        <p className="hint">
          학생이 배정된 좌석 두 개를 차례로 선택하면 서로 자리가 바뀝니다.
        </p>
        {swapMessage ? <p className="hint">{swapMessage}</p> : null}
      </div>

      <div
        ref={seatMapRef}
        className="seat-grid result-grid"
        style={{
          gridTemplateColumns: `repeat(${props.columns}, minmax(64px, 1fr))`,
        }}
      >
        {result.seats.map((seat) => (
          <ResultSeatCell
            key={seat.id}
            seat={seat}
            seats={result.seats}
            isSelectedForSwap={selectedSwapSeatId === seat.id}
            onSelectForSwap={selectSeatForSwap}
          />
        ))}
      </div>
    </section>
  );
}

function ResultSeatCell(props: {
  seat: AssignedSeat;
  seats: readonly AssignedSeat[];
  isSelectedForSwap: boolean;
  onSelectForSwap: (seat: AssignedSeat) => void;
}) {
  const { seat } = props;
  const className = [
    "seat-cell",
    "result-seat",
    seat.zone,
    seat.status,
    seat.student ? "swappable" : "",
    props.isSelectedForSwap ? "selected-for-swap" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const content = (
    <>
      <span>{formatSeatLabel(seat)}</span>
      <strong>{seat.student?.name ?? "빈 자리"}</strong>
      <small>{seat.id}</small>
      <small>{formatHorizontalNeighbors(seat, props.seats)}</small>
    </>
  );

  if (!seat.student) {
    return <div className={className}>{content}</div>;
  }

  return (
    <button
      type="button"
      className={className}
      aria-pressed={props.isSelectedForSwap}
      aria-label={`${seat.student.name} ${formatSeatLabel(seat)} 자리 선택`}
      onClick={() => props.onSelectForSwap(seat)}
    >
      {content}
    </button>
  );
}

function ValidationMessages(props: { issues: ProjectValidationIssue[] }) {
  if (props.issues.length === 0) {
    return null;
  }

  return (
    <ul className="validation-list" aria-label="입력 검증 메시지">
      {props.issues.map((issue) => (
        <li key={issue.code} className={`validation-item ${issue.severity}`}>
          {issue.message}
        </li>
      ))}
    </ul>
  );
}

function SeatGrid(props: {
  seats: ReturnType<SeatLayout["getSeats"]>;
  columns: number;
  unavailableSeatIds: SeatId[];
  onToggleSeat: (seatId: SeatId) => void;
}) {
  return (
    <div
      className="seat-grid"
      style={{
        gridTemplateColumns: `repeat(${props.columns}, minmax(52px, 1fr))`,
      }}
    >
      {props.seats.map((seat) => {
        const unavailable = props.unavailableSeatIds.includes(seat.id);

        return (
          <button
            key={seat.id}
            type="button"
            className={`seat-cell ${seat.zone} ${unavailable ? "unavailable" : ""}`}
            aria-pressed={unavailable}
            onClick={() => props.onToggleSeat(seat.id)}
          >
            <span>{zoneLabels[seat.zone]}</span>
            <strong>{seat.id}</strong>
          </button>
        );
      })}
    </div>
  );
}

function formatSeatLabel(seat: Pick<Seat, "row" | "column" | "zone">): string {
  return `${zoneLabels[seat.zone]} ${seat.row}행 ${seat.column}열`;
}

function findSeat(
  seats: readonly AssignedSeat[],
  seatId: SeatId,
): AssignedSeat | undefined {
  return seats.find((seat) => seat.id === seatId);
}

function formatHorizontalNeighbors(
  seat: AssignedSeat,
  seats: readonly AssignedSeat[],
): string {
  const leftSeat = seats.find(
    (candidate) =>
      candidate.row === seat.row && candidate.column === seat.column - 1,
  );
  const rightSeat = seats.find(
    (candidate) =>
      candidate.row === seat.row && candidate.column === seat.column + 1,
  );
  const neighbors = [
    leftSeat?.student ? `왼쪽 ${leftSeat.student.name}` : null,
    rightSeat?.student ? `오른쪽 ${rightSeat.student.name}` : null,
  ].filter((neighbor): neighbor is string => neighbor !== null);

  return neighbors.length > 0 ? neighbors.join(" · ") : "옆자리 정보 없음";
}

function getVisibleStudentIdBySeatId(options: {
  steps: AssignmentResult["steps"];
  completedStepCount: number;
  currentStep: AssignmentResult["steps"][number] | undefined;
  phase: DrawAnimationPhase;
  isCompleted: boolean;
}): Map<SeatId, StudentId> {
  const visibleSteps = options.isCompleted
    ? options.steps
    : options.steps.slice(0, options.completedStepCount);
  const visibleStudentIdBySeatId = new Map<SeatId, StudentId>();

  for (const step of visibleSteps) {
    visibleStudentIdBySeatId.set(step.selectedSeatId, step.selectedStudentId);
  }

  if (options.phase === "fixed" && options.currentStep) {
    visibleStudentIdBySeatId.set(
      options.currentStep.selectedSeatId,
      options.currentStep.selectedStudentId,
    );
  }

  return visibleStudentIdBySeatId;
}

function swapAssignedStudents(
  result: AssignmentResult,
  firstSeatId: SeatId,
  secondSeatId: SeatId,
): AssignmentResult {
  if (firstSeatId === secondSeatId) {
    return result;
  }

  const firstSeat = result.seats.find((seat) => seat.id === firstSeatId);
  const secondSeat = result.seats.find((seat) => seat.id === secondSeatId);

  if (!firstSeat?.student || !secondSeat?.student) {
    return result;
  }

  const firstStudent = { ...firstSeat.student };
  const secondStudent = { ...secondSeat.student };
  const seats = result.seats.map((seat) => {
    if (seat.id === firstSeatId) {
      return { ...seat, student: secondStudent };
    }

    if (seat.id === secondSeatId) {
      return { ...seat, student: firstStudent };
    }

    return {
      ...seat,
      ...(seat.student ? { student: { ...seat.student } } : {}),
    };
  });
  const adjacentStats = AssignmentEngine.calculateAdjacentPreferenceStats(seats);

  return {
    ...result,
    seats,
    summary: {
      ...result.summary,
      ...adjacentStats,
      manualSwapCount: result.summary.manualSwapCount + 1,
    },
  };
}

function toPositiveInteger(value: string): number {
  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function createRerollSeed(): string {
  return `seat-picker-${Date.now()}`;
}

function createResultFileName(seed: string): string {
  const safeSeed = seed.replace(/[^a-z0-9가-힣_-]+/gi, "-");

  return `seat-picker-${safeSeed}.png`;
}

function getFirstBlockingMessage(
  issues: readonly ProjectValidationIssue[],
): string {
  return (
    issues.find((issue) => issue.severity === "error")?.message ??
    "입력값을 확인하세요."
  );
}

function getAnimationDurations(speed: AnimationSpeed): AnimationDurations {
  const scale = animationTimeScale[speed];

  return {
    zoneIntroMs: Math.round(normalAnimationDurations.zoneIntroMs * scale),
    studentSpinMs: Math.round(normalAnimationDurations.studentSpinMs * scale),
    seatSpinMs: Math.round(normalAnimationDurations.seatSpinMs * scale),
    fixedMs: Math.round(normalAnimationDurations.fixedMs * scale),
    spinIntervalMs: Math.max(
      16,
      Math.round(normalAnimationDurations.spinIntervalMs * scale),
    ),
  };
}

function getPlaybackStatusLabel(
  status: ReturnType<AssignmentPlaybackController["getState"]>["status"],
): string {
  switch (status) {
    case "idle":
      return "대기";
    case "playing":
      return "재생 중";
    case "paused":
      return "일시정지";
    case "completed":
      return "완료";
  }
}

function isFirstStepOfZone(
  steps: AssignmentResult["steps"],
  stepIndex: number,
): boolean {
  const step = steps[stepIndex];
  const previousStep = steps[stepIndex - 1];

  return (
    step !== undefined &&
    (previousStep === undefined ||
      previousStep.zoneSequenceIndex !== step.zoneSequenceIndex)
  );
}
