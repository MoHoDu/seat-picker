# seat-picker v1 제품 및 구현 명세

확정일: 2026-06-29

## 1. 제품 방향

`seat-picker`는 교실/학원에서 좌석을 배정하기 위한 한국어 로컬 웹앱이다. v1은 선생님이 한 기기에서 조작하는 흐름을 기본으로 하되, 학생이 한 기기에서 차례로 선호를 선택하는 모드도 제공한다. 이후 버전에서는 QR 기반으로 학생이 각자 휴대폰이나 컴퓨터에서 선호를 제출하는 방식을 고려한다.

핵심 가치는 다음과 같다.

- 학생 선호를 반영하되 특정 학생이 중복 배정되지 않는 공정한 추첨
- 같은 입력과 같은 seed에서 항상 같은 결과를 만드는 재현성
- 설정과 입력은 차분한 교사용 도구처럼, 추첨 단계는 슬롯머신처럼 긴장감 있게
- 서버, 로그인, QR 참여는 v1 범위 밖이지만 확장 가능한 구조
- localStorage 기반 저장과 PNG 좌석표 내보내기

## 2. v1 사용자 흐름

v1 화면은 단계형 마법사로 구성한다.

1. 좌석 설정
   - 행 수와 열 수를 입력한다.
   - 화면 위쪽이 앞자리/칠판 방향이다.
   - 기본 구역 분할은 앞/중간/뒤를 `2:1:2` 비율에 가깝게 계산한다.
   - 사용자는 앞자리 행 수, 중간자리 행 수, 뒷자리 행 수를 숫자로 조정할 수 있다.
   - 세 구역 행 수의 합은 전체 행 수와 같아야 한다.
   - 좌석 격자에서 좌석을 클릭해 사용 가능/사용 불가를 토글한다.
   - 설정 화면에서는 좌석 번호를 항상 표시한다.

2. 학생 입력
   - 이름을 한 줄에 한 명씩 붙여넣는다.
   - "목록 만들기" 후 학생 목록으로 변환한다.
   - 빈 줄은 제거하고 이름 앞뒤 공백은 trim한다.
   - 변환 후 목록에서 이름 수정과 삭제가 가능하다.
   - 동명이인이 있으면 화면 표시명에 `01`, `02`, `03`처럼 번호를 붙인다.
   - 원본 이름과 표시명은 분리한다. 표시명은 이름 목록에서 계산하는 값으로 둔다.

3. 선호 선택
   - 일괄 지정 모드: 선생님이 학생별로 앞자리/중간자리/뒷자리/무선호를 지정한다.
   - 차례 선택 모드: 학생 이름을 하나씩 보여주고 해당 학생이 선호를 선택한다.
   - 학생 목록 순서는 기본적으로 입력 순서를 유지한다.
   - 차례 선택 모드에서는 선택 순서 섞기 옵션을 제공한다.
   - 선택하지 않은 학생은 `무선호`로 처리한다.
   - v1 제출 출처는 `teacher` 또는 `shared-device`로 표현할 수 있게 둔다.
   - 이후 QR 참여는 `remote-device` 제출 출처로 확장한다.

4. 추첨 연출
   - 배정 엔진은 전체 결과와 `AssignmentStep[]` 로그를 먼저 계산한다.
   - UI는 계산된 로그를 순서대로 재생한다.
   - 구역마다 한 명씩 후보 학생 이름이 슬롯머신처럼 돌아간 뒤 당첨자가 확정된다.
   - 이어서 해당 구역의 남은 좌석들이 슬롯머신처럼 표시된 뒤 최종 좌석이 확정된다.
   - 연출은 기본 재생한다.
   - 건너뛰기는 3단계로 제공한다.
     - 현재 학생 건너뛰기: 현재 step만 즉시 확정한다.
     - 현재 구역 건너뛰기: 현재 구역의 남은 step을 즉시 확정한다.
     - 전체 건너뛰기: 모든 남은 step을 확정하고 결과로 이동한다.
   - 연출 속도는 빠름/보통/느림을 제공한다.
   - 음향은 기본 꺼짐 + 켜기 옵션으로 둔다. 단, 리소스 확보나 구현 비용이 크면 v1에서는 음향 없이 간다.
   - 가능하면 외부 음원 대신 Web Audio API로 짧은 tick/confirm 효과음을 생성한다.

5. 결과
   - 최종 좌석표를 표시한다.
   - 사용 불가 좌석은 회색/비활성 또는 빗금으로 표시한다.
   - 빈 좌석은 좌석 번호만 표시한다.
   - 결과 화면에서는 학생이 있는 좌석에는 학생 이름을 우선 표시하고 좌석 번호는 숨긴다.
   - 선생님용 요약을 표시한다.
     - 1순위 배정 인원
     - 1단계 이동 인원
     - 2단계 이동 인원
     - 무선호 배정 인원
     - 빈 좌석 수
     - 수동 자리 바꾸기 횟수
   - 학생별로 누가 밀렸는지는 노출하지 않는다.
   - 두 학생의 자리 바꾸기만 허용한다.
   - 빈 자리로 이동하거나 자유 드래그 앤 드롭은 v1 범위 밖이다.
   - 다시 뽑기는 좌석 설정/학생/선호는 유지하고 새 seed로 전체 재추첨한다.
   - PNG 내보내기는 좌석표만 포함한다. 선생님용 요약, 버튼, 설정 패널은 포함하지 않는다.

## 3. 배정 규칙

### 3.1 기본 검증

배정 실행 전 다음을 검증한다.

- 학생이 1명 이상이어야 한다.
- 학생 수는 사용 가능 좌석 수보다 많을 수 없다.
- 행 수와 열 수는 유효한 양수여야 한다.
- 앞/중간/뒤 구역 행 수의 합은 전체 행 수와 같아야 한다.
- 사용 가능 좌석이 1개 이상이어야 한다.
- 학생 목록에 빈 이름이 남아 있으면 안 된다.
- 무선호 학생은 정상 상태로 간주한다.

### 3.2 좌석과 구역

- 좌석은 행/열 격자다.
- 좌석 상태는 `available` 또는 `unavailable`이다.
- 배정 대상은 `available` 좌석뿐이다.
- 구역은 `front`, `middle`, `back`이다.
- 구역 기본 분할은 `2:1:2` 비율에 가깝게 자동 계산한다.
- 사용자가 숫자로 구역별 행 수를 직접 변경할 수 있다.
- 이후 버전에서 경계 드래그 UI를 붙일 수 있게 구역 분할 정책은 별도 객체로 분리한다.

### 3.3 선호와 가중치

선호는 앞자리/중간자리/뒷자리/무선호 중 하나다. 내부 타입은 `Zone | null`을 기본으로 한다.

가중치는 다음과 같다.

- 1순위 구역: `1.0`
- 한 단계 밀린 구역: `0.7`
- 두 단계 밀린 구역: `0.4`

overflow 경로는 다음과 같다.

- 앞자리 선호: 앞자리 `1.0` -> 중간자리 `0.7` -> 뒷자리 `0.4`
- 뒷자리 선호: 뒷자리 `1.0` -> 중간자리 `0.7` -> 앞자리 `0.4`
- 중간자리 선호: 중간자리 `1.0` -> 앞자리 `0.7` 및 뒷자리 `0.7` 동시 후보

중간자리에서 밀린 학생은 앞자리와 뒷자리 후보군에 동시에 들어간다. 단, 학생이 한 구역에서 배정되는 순간 다른 모든 구역 후보에서는 비활성으로 간주한다.

### 3.4 후보군과 중복 방지

학생은 여러 구역 후보군에 동시에 존재할 수 있다. 중복 배정 방지는 후보 배열을 물리적으로 계속 삭제하는 방식이 아니라 전역 배정 상태로 보장한다.

핵심 상태:

```ts
assignedStudentIds: Set<StudentId>
assignedSeatIds: Set<SeatId>
candidatePoolsByZone: Map<Zone, AssignmentCandidate[]>
```

구역 추첨 시에는 항상 다음처럼 활성 후보만 사용한다.

```ts
const activeCandidates = candidates.filter(
  (candidate) => !assignedStudentIds.has(candidate.studentId),
);
```

학생이 배정되면 `assignedStudentIds`와 `assignedSeatIds`에 등록한다. 다른 구역 후보군에 같은 학생 후보가 남아 있어도 다음 조회에서 자동 제외된다.

### 3.5 구역 처리 순서

- 각 구역의 1순위 선호 학생 수를 센다.
- 1순위 선호 학생 수가 많은 구역부터 추첨을 시작한다.
- 선호 학생 수가 같으면 seed 기반 랜덤으로 구역 순서를 정한다.
- 새 overflow 후보가 아직 좌석이 남은 구역으로 들어오면 해당 구역은 다시 처리될 수 있다.
- 모든 처리는 같은 seed와 같은 입력에서 같은 순서로 재현되어야 한다.

### 3.6 구역별 추첨

구역을 처리할 때는 해당 구역의 활성 후보를 가중치 기반으로 한 명 뽑는다. 뽑힌 학생은 같은 순간 해당 구역의 남은 사용 가능 좌석 중 하나를 seed 기반 랜덤으로 배정받는다.

구역에 좌석이 남아 있고 활성 후보도 남아 있으면 계속 추첨한다. 구역 좌석이 다 차면 아직 배정되지 않은 활성 후보는 자신의 overflow 경로에 따라 다음 후보군으로 이동한다.

무선호 학생은 모든 선호/overflow 처리가 끝난 뒤 남은 사용 가능 좌석 전체에서 seed 기반 랜덤으로 배정한다.

배정 결과에는 다음이 포함되어야 한다.

- 최종 좌석 상태
- seed
- animation step 로그
- 선생님용 요약
- 수동 자리 바꾸기 횟수

## 4. 핵심 타입 초안

```ts
type Zone = "front" | "middle" | "back";
type PreferenceZone = Zone | null;
type SeatStatus = "available" | "unavailable";
type PreferenceSource = "teacher" | "shared-device" | "remote-device";
type AnimationSpeed = "fast" | "normal" | "slow";

type Student = {
  id: string;
  name: string;
  preference: PreferenceZone;
};

type StudentDisplay = Student & {
  displayName: string;
};

type GridConfig = {
  rows: number;
  columns: number;
};

type ZoneRowConfig = {
  frontRows: number;
  middleRows: number;
  backRows: number;
};

type Seat = {
  id: string;
  row: number;
  column: number;
  zone: Zone;
  status: SeatStatus;
};

type AssignedSeat = Seat & {
  student?: Student;
};

type PreferenceSubmission = {
  studentId: string;
  preference: PreferenceZone;
  source: PreferenceSource;
  submittedAt?: string;
};

type AssignmentCandidate = {
  studentId: string;
  originPreference: Zone;
  targetZone: Zone;
  weight: number;
  preferenceDistance: 0 | 1 | 2;
};

type AssignmentStepReason = "primary" | "overflow" | "unpreferred";

type AssignmentStep = {
  id: string;
  zone: Zone;
  zoneSequenceIndex: number;
  stepIndex: number;
  candidateStudentIds: string[];
  selectedStudentId: string;
  candidateSeatIds: string[];
  selectedSeatId: string;
  weightByStudentId: Record<string, number>;
  reason: AssignmentStepReason;
  preferenceDistance: 0 | 1 | 2 | null;
};

type AssignmentSummary = {
  primaryAssignedCount: number;
  firstOverflowAssignedCount: number;
  secondOverflowAssignedCount: number;
  unpreferredAssignedCount: number;
  emptySeatCount: number;
  manualSwapCount: number;
};

type AssignmentResult = {
  seed: string;
  seats: AssignedSeat[];
  steps: AssignmentStep[];
  summary: AssignmentSummary;
};
```

## 5. 객체 지향 설계

핵심 도메인은 class로 두고, 단순 데이터는 type/interface로 둔다. React 컴포넌트는 도메인 class를 직접 복잡하게 소유하지 않고 application layer를 통해 사용한다.

주요 class 책임:

- `SeatLayout`
  - 행/열, 구역 행 수, 사용 불가 좌석을 바탕으로 좌석 목록을 만든다.
  - 사용 가능 좌석 수와 구역별 좌석을 계산한다.

- `ZoneLayoutPolicy`
  - `2:1:2` 기본 구역 분할을 계산한다.
  - 사용자가 지정한 구역 행 수를 검증한다.

- `StudentRoster`
  - 줄바꿈 이름 입력을 학생 목록으로 변환한다.
  - 이름 수정/삭제를 처리한다.
  - 동명이인 표시명을 계산한다.

- `PreferenceSession`
  - 학생별 선호 제출을 관리한다.
  - 일괄 지정 모드와 차례 선택 모드의 상태를 표현한다.
  - 이후 remote-device 제출로 확장 가능하게 source를 보존한다.

- `SeededRandom`
  - seed 기반 난수, shuffle, weighted pick을 제공한다.
  - 같은 seed와 같은 입력에서 같은 결과를 보장한다.

- `AssignmentPolicy`
  - overflow 경로와 가중치 규칙을 제공한다.
  - 구역 처리 순서를 계산한다.

- `AssignmentEngine`
  - 좌석, 학생, 선호, seed를 받아 `AssignmentResult`를 만든다.
  - React 상태에 의존하지 않는 순수한 도메인 서비스로 둔다.

- `AssignmentPlaybackController`
  - `AssignmentStep[]`를 재생한다.
  - 현재 학생/현재 구역/전체 건너뛰기를 처리한다.
  - 빠름/보통/느림 속도 프로필을 적용한다.

- `LocalStorageProjectRepository`
  - 현재 작업 상태를 저장하고 복원한다.
  - 저장 데이터 version을 둬 이후 마이그레이션 여지를 남긴다.

- `SeatMapExporter`
  - 좌석표 DOM만 PNG로 내보낸다.

권장 폴더 구조:

```text
src/
  domain/
    assignment/
    seats/
    students/
    preferences/
    random/
  application/
    usecases/
    storage/
  infrastructure/
    storage/
    export/
  ui/
    features/
      seat-setup/
      student-input/
      preference-selection/
      drawing/
      result/
    components/
    app/
```

## 6. 저장 정책

v1은 현재 작업 상태만 localStorage에 저장한다.

저장 대상:

- 행/열
- 구역별 행 수
- 사용 불가 좌석 목록
- 학생 이름 목록
- 학생별 선호 또는 무선호 상태
- 마지막 seed
- 현재 단계
- 마지막 수동 자리 바꾸기 횟수

배정 결과 전체를 영구 상태로 삼기보다 입력값과 seed로 재계산 가능한 구조를 우선한다. 복원 시에는 저장된 입력과 seed로 결과를 재계산한다.

## 7. UI와 디자인 기준

- 전체 UI 언어는 한국어다.
- 설정/입력/결과는 차분한 교사용 도구 톤으로 만든다.
- 추첨 단계는 큰 이름, 구역 강조, 슬롯머신 모션으로 게임성을 살린다.
- 설정/추첨 화면에서는 앞/중간/뒤 구역 색상을 확실히 구분한다.
- 최종 결과와 PNG에서는 중립색 중심으로 두고 학생 이름 가독성을 우선한다.
- 칠판/앞 방향 라벨은 좌석표 상단에 표시한다.
- 사용 불가 좌석은 모든 화면에서 명확히 구분한다.
- 버튼과 설정 컨트롤은 실제 수업 중 빠르게 조작할 수 있어야 한다.

## 8. 테스트 계획

v1은 도메인 테스트, UI 테스트, E2E 테스트를 모두 포함한다.

도메인 테스트:

- 같은 seed와 같은 입력이면 같은 결과가 나온다.
- 학생이 중복 배정되지 않는다.
- 사용 불가 좌석에는 학생이 배정되지 않는다.
- 학생 수가 사용 가능 좌석 수보다 많으면 오류가 난다.
- `2:1:2` 기본 구역 분할이 올바르게 계산된다.
- 구역 행 수 합이 전체 행 수와 다르면 오류가 난다.
- 앞/중간/뒤 overflow 경로와 가중치가 적용된다.
- 중간 선호 탈락자가 앞/뒤 후보군에 동시에 들어가도 한 번만 배정된다.
- 무선호 학생은 선호 학생 처리 후 남은 좌석에 배정된다.

UI 테스트:

- localStorage에서 현재 작업 상태가 복원된다.
- 단계형 마법사에서 다음/이전 이동이 동작한다.
- 배정 전 검증 오류가 버튼 상태나 메시지에 반영된다.
- 사용 불가 좌석 토글이 화면에 반영된다.
- 동명이인 표시명이 `01`, `02`처럼 표시된다.
- PNG 내보내기 버튼이 결과 단계에서 동작 가능한 상태가 된다.

E2E 테스트:

- 정상 흐름: 좌석 설정 -> 학생 입력 -> 선호 선택 -> 추첨 -> 결과
- 학생 수가 사용 가능 좌석보다 많은 경우 오류 표시
- 사용 불가 좌석에 학생이 배정되지 않음
- 전체 연출 건너뛰기 동작
- 결과에서 두 학생 자리 바꾸기 동작
- PNG 내보내기 버튼 상태 확인

## 9. v1 범위 밖

다음은 v1에서 구현하지 않는다.

- 서버 저장
- 로그인
- QR 기반 원격 참여
- 여러 좌석표 이력 관리
- 좌석 구역 경계 드래그 조정
- 빈 자리로 학생 이동
- 자유 드래그 앤 드롭 자리 수정
- 상세 자리 바꾸기 이력과 되돌리기
- 학생 번호/메모/태그/제약조건 입력

다만 도메인 모델과 레이어 구조는 위 기능을 이후에 추가할 수 있게 설계한다.
