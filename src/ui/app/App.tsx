const setupSteps = [
  "좌석 설정",
  "학생 입력",
  "선호 선택",
  "추첨 연출",
  "결과 확인",
];

export function App() {
  return (
    <main className="app-shell">
      <section className="app-header" aria-labelledby="app-title">
        <p className="app-kicker">교실/학원 좌석 추첨 도구</p>
        <h1 id="app-title">seat-picker</h1>
        <p className="app-description">
          선호 구역과 사용 불가 좌석을 반영해 재현 가능한 좌석 배정을 준비합니다.
        </p>
      </section>

      <section className="setup-panel" aria-label="v1 개발 기준">
        <div className="panel-heading">
          <span>v1 흐름</span>
          <strong>프로젝트 셸 준비됨</strong>
        </div>
        <ol className="step-list">
          {setupSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>
    </main>
  );
}
