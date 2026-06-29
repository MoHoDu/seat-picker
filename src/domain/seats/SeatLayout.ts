import { ZoneLayoutPolicy } from "./ZoneLayoutPolicy";
import type { GridConfig, Seat, SeatId, Zone, ZoneRowConfig } from "./types";

// 좌석판 옵션
export type SeatLayoutOptions = {
  grid: GridConfig;
  zones?: ZoneRowConfig;
  unavailableSeatIds?: Iterable<SeatId>;
};

// 좌석판 전체 표현
export class SeatLayout {
  private readonly grid: GridConfig;
  private readonly zones: ZoneRowConfig;
  private readonly unavailableSeatIds: Set<SeatId>;
  private readonly seats: Seat[];

  constructor(options: SeatLayoutOptions) {
    ZoneLayoutPolicy.validateGrid(options.grid);

    this.grid = { ...options.grid };
    this.zones =
      options.zones ?? ZoneLayoutPolicy.createDefault(options.grid.rows);

    ZoneLayoutPolicy.validateZoneRows(this.zones, this.grid.rows);

    this.unavailableSeatIds = this.collectValidUnavailableSeatIds(
      options.unavailableSeatIds ?? []
    );
    this.seats = this.buildSeats();
  }

  static createSeatId(row: number, column: number): SeatId {
    return `${row}-${column}`;
  }

  getGridConfig(): GridConfig {
    return { ...this.grid };
  }

  getZoneRowConfig(): ZoneRowConfig {
    return { ...this.zones };
  }

  getUnavailableSeatIds(): SeatId[] {
    return [...this.unavailableSeatIds];
  }

  getSeats(): Seat[] {
    return this.seats.map((seat) => ({ ...seat }));
  }

  getAvailableSeats(): Seat[] {
    return this.seats
      .filter((seat) => seat.status === "available")
      .map((seat) => ({ ...seat }));
  }

  getSeatsByZone(zone: Zone, options?: { availableOnly?: boolean }): Seat[] {
    return this.seats
      .filter((seat) => seat.zone === zone)
      .filter((seat) => !options?.availableOnly || seat.status === "available")
      .map((seat) => ({ ...seat }));
  }

  getAvailableSeatCount(): number {
    return this.seats.filter((seat) => seat.status === "available").length;
  }

  getSeat(seatId: SeatId): Seat | undefined {
    const seat = this.seats.find(({ id }) => id === seatId);

    return seat ? { ...seat } : undefined;
  }

  private buildSeats(): Seat[] {
    const seats: Seat[] = [];

    for (let row = 1; row <= this.grid.rows; row += 1) {
      for (let column = 1; column <= this.grid.columns; column += 1) {
        const id = SeatLayout.createSeatId(row, column);

        seats.push({
          id,
          row,
          column,
          zone: ZoneLayoutPolicy.getZoneForRow(row, this.zones),
          status: this.unavailableSeatIds.has(id) ? "unavailable" : "available",
        });
      }
    }

    return seats;
  }

  private collectValidUnavailableSeatIds(
    unavailableSeatIds: Iterable<SeatId>
  ): Set<SeatId> {
    const validSeatIds = new Set<SeatId>();

    for (let row = 1; row <= this.grid.rows; row += 1) {
      for (let column = 1; column <= this.grid.columns; column += 1) {
        validSeatIds.add(SeatLayout.createSeatId(row, column));
      }
    }

    return new Set(
      [...unavailableSeatIds].filter((seatId) => validSeatIds.has(seatId))
    );
  }
}
