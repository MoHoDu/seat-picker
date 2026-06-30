# seat-picker v1 구현 요청

교실/학원 좌석 배정을 위한 로컬 웹앱 `seat-picker`를 구현한다.

## 현재 상태

- 아직 프로젝트 파일은 생성되지 않았음.
- 상세 제품/구현 명세는 [SPEC.md](SPEC.md)에 정리됨.
- 이전 세션에서 `npm create vite@latest seat-picker -- --template react-ts`를 시도했지만 npm registry 네트워크 접근이 막혀 실패함.
- 구현은 새 디렉토리에서 처음부터 시작하면 됨.

## 확정된 제품 방향

- 대상: 교실/학원 좌석 배정
- 사용자: 학생 참여형이지만 v1은 한 기기에서 차례로 선택
- 앱 형태: 로컬 웹앱
- 배포 URL: https://mohodu.github.io/seat-picker/
- UI 언어: 한국어
- 스택: Vite + React + TypeScript
- 저장: `localStorage`
- 결과 내보내기: PNG 이미지
- QR 참여, 서버, 로그인은 v1 범위 밖이지만 추후 확장 가능하게 구조 분리

## v1 화면 흐름

1. 좌석 설정

   - 행 수, 열 수 입력
   - 좌석은 격자 형태
   - 행을 기준으로 앞자리/중간자리/뒷자리 구역 자동 분할

2. 학생 입력

   - 학생 이름 목록 입력
   - 학생 정보는 이름만 사용

3. 선호 선택

   - 학생이 차례로 `앞자리 / 중간자리 / 뒷자리` 중 하나 선택
   - 기본 선호값은 중간자리로 둬도 됨

4. 결과
   - 좌석표 생성
   - 다시 뽑기
   - PNG로 내보내기
   - 학생 수가 좌석 수보다 많으면 생성 전 오류 표시

## 핵심 타입

```ts
type Zone = "front" | "middle" | "back";

type Student = {
  id: string;
  name: string;
  preference: Zone;
};

type GridConfig = {
  rows: number;
  columns: number;
};

type Seat = {
  id: string;
  row: number;
  column: number;
  zone: Zone;
};

type AssignedSeat = Seat & {
  student?: Student;
};

type AssignmentResult = {
  seed: string;
  seats: AssignedSeat[];
};
```

## 핵심 함수

- buildSeats(config: GridConfig): Seat[]
- assignSeats(students: Student[], config: GridConfig, seed: string): AssignmentResult
- 배정 함수는 React 상태에 의존하지 않는 순수 함수로 구현

## 배정 규칙

- 같은 seed와 같은 입력이면 같은 결과가 나와야 함.
- 좌석 행을 앞/중간/뒤 구역으로 자동 분할.
- 학생은 자신의 선호 구역에 우선 배정.
- 선호 구역 정원이 넘치면 가까운 구역으로 이동.
  - front overflow: middle → back
  - middle overflow: front/back 중 가능한 곳, 랜덤 또는 균형 기준
  - back overflow: middle → front
- 같은 조건 안에서는 seed 기반 랜덤 추첨.
- 학생은 중복 배정되면 안 됨.

## 테스트

- 같은 seed면 같은 결과
- 학생 중복 배정 없음
- 학생 수 > 좌석 수면 오류
- 앞/중간/뒤 구역 자동 분할 검증
- 특정 구역 선호가 몰릴 때 가까운 구역으로 overflow
- localStorage 복원
- PNG 내보내기 버튼 동작 가능 상태 확인

## 권장 프로젝트 생성

```bash
npm create vite@latest seat-picker -- --template react-ts
cd seat-picker
npm install
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
npm install html-to-image
git init
```

## GitHub Pages 배포

```bash
npm run deploy
```

- Vite `base`는 GitHub Pages 저장소 경로에 맞춰 `/seat-picker/`로 설정한다.
- 배포 결과물은 `gh-pages` 브랜치에 올라가며, GitHub Pages source는 `gh-pages` 브랜치의 `/root`를 사용한다.
