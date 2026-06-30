import { useEffect, useMemo, useState } from "react";
import {
  AssignmentEngine,
  AssignmentPlaybackController,
  SeatLayout,
  StudentRoster,
  type AssignmentResult,
  type PreferenceZone,
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

export function App() {
  const [project, setProject] = useState<SeatPickerProjectState>(() =>
    createDefaultProjectState(),
  );
  const [studentNamesInput, setStudentNamesInput] = useState("");
  const [playback, setPlayback] =
    useState<AssignmentPlaybackController | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const seatLayoutState = useMemo(() => {
    try {
      return {
        layout: createSeatLayoutFromState(project),
        error: null,
      };
    } catch (error) {
      return {
        layout: null,
        error: error instanceof Error ? error.message : "좌석 설정을 확인하세요.",
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

  const moveFromSeatSetup = () => {
    if (seatLayoutState.error) {
      setMessage(seatLayoutState.error);
      return;
    }

    goToStep("student-input");
  };

  const applyStudentNames = () => {
    const students = studentRoster.getStudents();

    if (students.length === 0) {
      setMessage("학생 이름을 한 명 이상 입력하세요.");
      return;
    }

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

    const nextSession = preferenceSession.submitPreference(
      studentId,
      preference,
      "teacher",
    );

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
    if (!preferenceSession || !seatLayoutState.layout) {
      setMessage(seatLayoutState.error ?? "추첨 준비 상태를 확인하세요.");
      return;
    }

    try {
      const completedSession = preferenceSession.submitMany(
        preferenceSession.getPendingStudentIds().map((studentId) => ({
          studentId,
          preference: null,
          source: "teacher",
        })),
      );
      const students = completedSession.applyToStudents();
      const result = new AssignmentEngine().assign({
        students,
        seatLayout: seatLayoutState.layout,
        seed: project.seed,
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
        preferenceSubmissions: completedSession.getSubmissions(),
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

  return (
    <main className="app-shell">
      <header className="app-header" aria-labelledby="app-title">
        <div>
          <p className="app-kicker">교실/학원 좌석 추첨 도구</p>
          <h1 id="app-title">seat-picker</h1>
        </div>
        <p className="app-description">
          좌석 설정, 학생 명단, 선호 구역을 한 흐름에서 입력하고 재현 가능한
          좌석 배정을 만듭니다.
        </p>
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
          error={seatLayoutState.error}
          onGridChange={(rows, columns) => {
            setProject((current) =>
              updateProjectGrid(current, { rows, columns }),
            );
          }}
          onZoneRowChange={setZoneRowCount}
          onToggleUnavailableSeat={toggleUnavailableSeat}
          onNext={moveFromSeatSetup}
        />
      ) : null}

      {project.step === "student-input" ? (
        <StudentInputStep
          namesInput={studentNamesInput}
          roster={studentRoster}
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
          onPreferenceChange={submitPreference}
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
          playback={playback}
          studentsById={new Map(project.students.map((student) => [student.id, student]))}
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
          onRestart={() => goToStep("seat-setup")}
        />
      ) : null}
    </main>
  );
}

function SeatSetupStep(props: {
  project: SeatPickerProjectState;
  seatLayout: SeatLayout | null;
  error: string | null;
  onGridChange: (rows: number, columns: number) => void;
  onZoneRowChange: (
    key: keyof SeatPickerProjectState["zoneRows"],
    value: number,
  ) => void;
  onToggleUnavailableSeat: (seatId: SeatId) => void;
  onNext: () => void;
}) {
  const { project, seatLayout, error } = props;
  const zoneTotal =
    project.zoneRows.frontRows +
    project.zoneRows.middleRows +
    project.zoneRows.backRows;

  return (
    <section className="tool-section" aria-labelledby="seat-setup-title">
      <div className="section-heading">
        <div>
          <p>1단계</p>
          <h2 id="seat-setup-title">좌석 설정</h2>
        </div>
        <button type="button" onClick={props.onNext}>
          다음
        </button>
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
              props.onZoneRowChange("frontRows", Number(event.currentTarget.value))
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
              props.onZoneRowChange("backRows", Number(event.currentTarget.value))
            }
          />
        </label>
      </div>

      <p className={zoneTotal === project.grid.rows ? "hint" : "hint warning"}>
        구역 행 합계 {zoneTotal} / 전체 행 {project.grid.rows}
      </p>
      {error ? <p className="inline-error">{error}</p> : null}

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
          <button type="button" onClick={props.onNext}>
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
  onPreferenceChange: (studentId: StudentId, preference: PreferenceZone) => void;
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
          <button type="button" onClick={props.onStart}>
            추첨 시작
          </button>
        </div>
      </div>

      <div className="preference-toolbar">
        <p>
          제출 {progress.submittedCount}명 / 전체 {progress.totalCount}명
        </p>
        <label>
          Seed
          <input
            value={props.project.seed}
            onChange={(event) => props.onSeedChange(event.currentTarget.value)}
          />
        </label>
        <button type="button" className="secondary" onClick={props.onFillPending}>
          미선택 무선호 처리
        </button>
      </div>

      <div className="preference-list">
        {props.studentDisplays.map((student) => {
          const submission = props.preferenceSession.getSubmission(student.id);

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
                    <label key={optionKey} className={checked ? "selected" : ""}>
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
            </fieldset>
          );
        })}
      </div>
    </section>
  );
}

function DrawingStep(props: {
  result: AssignmentResult;
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
    ? props.studentsById.get(state.currentStep.selectedStudentId)?.name
    : null;
  const displayStudentName = displayStudentId
    ? props.studentsById.get(displayStudentId)?.name
    : null;
  const zoneStepNumber = currentStep ? currentStep.zoneSequenceIndex + 1 : 0;
  const isFirstStepInZone = currentStep
    ? isFirstStepOfZone(props.result.steps, currentStep.stepIndex)
    : false;

  useEffect(() => {
    if (!currentStep) {
      setPhase("completed");
      setDisplayStudentId(null);
      setDisplaySeatId(null);
      return;
    }

    if (state.status === "completed") {
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
    isFirstStepInZone,
    state.status,
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
    }, 1100);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [currentStepKey, phase, state.status]);

  useEffect(() => {
    if (!currentStep || state.status !== "playing") {
      return;
    }

    if (phase !== "student-spin") {
      return;
    }

    let spinIndex = 0;
    const candidates = currentStep.candidateStudentIds;
    setDisplayStudentId(candidates[0] ?? currentStep.selectedStudentId);

    const interval = window.setInterval(() => {
      spinIndex += 1;
      setDisplayStudentId(candidates[spinIndex % candidates.length] ?? null);
    }, 90);
    const timeout = window.setTimeout(() => {
      window.clearInterval(interval);
      setDisplayStudentId(currentStep.selectedStudentId);
      setPhase("seat-spin");
    }, 1300);

    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [currentStepKey, phase, state.status]);

  useEffect(() => {
    if (!currentStep || state.status !== "playing") {
      return;
    }

    if (phase !== "seat-spin") {
      return;
    }

    let spinIndex = 0;
    const candidateSeatIds = currentStep.candidateSeatIds;
    setDisplaySeatId(candidateSeatIds[0] ?? currentStep.selectedSeatId);

    const interval = window.setInterval(() => {
      spinIndex += 1;
      setDisplaySeatId(
        candidateSeatIds[spinIndex % candidateSeatIds.length] ?? null,
      );
    }, 90);
    const timeout = window.setTimeout(() => {
      window.clearInterval(interval);
      setDisplaySeatId(currentStep.selectedSeatId);
      setPhase("fixed");
    }, 3000);

    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [currentStepKey, phase, state.status]);

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
    }, 850);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [controller, currentStepKey, phase, props.onPlaybackChange, state.status]);

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

      <div className={`draw-stage ${phase}`}>
        <div className="draw-panel">
          <p>{phase === "completed" ? "추첨 완료" : "현재 추첨"}</p>
          <strong>
            {selectedStudentName
              ? `${selectedStudentName} → ${state.currentStep?.selectedSeatId}`
              : "배정할 단계가 없습니다"}
          </strong>
          <span>
            {state.currentZone ? zoneLabels[state.currentZone] : "전체"} ·{" "}
            {state.completedStepCount}/{state.totalStepCount}
          </span>
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
              <strong className="slot-value">
                {displayStudentName ?? "학생 선택 중"}
              </strong>
              <span>{zoneLabels[currentStep.zone]} 후보에서 한 명 선택</span>
            </>
          ) : null}

          {phase === "seat-spin" && currentStep ? (
            <>
              <p>자리 슬롯</p>
              <strong className="slot-value">
                {displayStudentName ?? selectedStudentName} →{" "}
                {displaySeatId ?? "좌석 선택 중"}
              </strong>
              <span>3초 동안 구역 안에서 좌석이 바뀝니다</span>
            </>
          ) : null}

          {phase === "fixed" && currentStep ? (
            <>
              <p>좌석 확정</p>
              <strong className="slot-value">
                {selectedStudentName} → {currentStep.selectedSeatId}
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
          onClick={() => props.onPlaybackChange(controller.pause())}
        >
          일시정지
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() => props.onPlaybackChange(controller.play())}
        >
          재생
        </button>
        <button
          type="button"
          onClick={() =>
            props.onPlaybackChange(controller.skip("current-student"))
          }
        >
          현재 학생 건너뛰기
        </button>
        <button
          type="button"
          onClick={() => props.onPlaybackChange(controller.skip("current-zone"))}
        >
          구역 건너뛰기
        </button>
        <button
          type="button"
          onClick={() => props.onPlaybackChange(controller.skip("all"))}
        >
          전체 건너뛰기
        </button>
      </div>
    </section>
  );
}

function ResultStep(props: {
  result: AssignmentResult;
  columns: number;
  onBack: () => void;
  onRestart: () => void;
}) {
  const { result } = props;

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
          <button type="button" onClick={props.onRestart}>
            처음으로
          </button>
        </div>
      </div>

      <dl className="summary-grid">
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
          <dt>빈 좌석</dt>
          <dd>{result.summary.emptySeatCount}</dd>
        </div>
      </dl>

      <div
        className="seat-grid result-grid"
        style={{
          gridTemplateColumns: `repeat(${props.columns}, minmax(64px, 1fr))`,
        }}
      >
        {result.seats.map((seat) => (
          <div key={seat.id} className={`seat-cell ${seat.zone} ${seat.status}`}>
            <span>{seat.id}</span>
            <strong>{seat.student?.name ?? "빈 자리"}</strong>
          </div>
        ))}
      </div>
    </section>
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

function toPositiveInteger(value: string): number {
  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
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
