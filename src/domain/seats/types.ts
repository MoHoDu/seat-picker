export type Zone = "front" | "middle" | "back";

export type SeatStatus = "available" | "unavailable";

export type SeatId = string;

// 그리드 타입
export type GridConfig = {
  rows: number;
  columns: number;
};

// 좌석 영역 타입: 앞줄/중간줄/뒷줄
export type ZoneRowConfig = {
  frontRows: number;
  middleRows: number;
  backRows: number;
};

// 좌석 타입: seatID, 행/열, 영역, 상태
export type Seat = {
  id: SeatId;
  row: number;
  column: number;
  zone: Zone;
  status: SeatStatus;
};
