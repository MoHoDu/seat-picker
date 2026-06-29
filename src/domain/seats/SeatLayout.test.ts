import { describe, expect, it } from "vitest";
import { SeatLayout } from "./SeatLayout";

describe("SeatLayout", () => {
  it("builds seats with row, column, zone, and status", () => {
    const layout = new SeatLayout({
      grid: { rows: 3, columns: 2 },
      zones: { frontRows: 1, middleRows: 1, backRows: 1 },
      unavailableSeatIds: ["2-2"],
    });

    expect(layout.getSeats()).toEqual([
      { id: "1-1", row: 1, column: 1, zone: "front", status: "available" },
      { id: "1-2", row: 1, column: 2, zone: "front", status: "available" },
      { id: "2-1", row: 2, column: 1, zone: "middle", status: "available" },
      { id: "2-2", row: 2, column: 2, zone: "middle", status: "unavailable" },
      { id: "3-1", row: 3, column: 1, zone: "back", status: "available" },
      { id: "3-2", row: 3, column: 2, zone: "back", status: "available" },
    ]);
  });

  it("excludes unavailable seats from available seats", () => {
    const layout = new SeatLayout({
      grid: { rows: 2, columns: 2 },
      zones: { frontRows: 1, middleRows: 0, backRows: 1 },
      unavailableSeatIds: ["1-2", "9-9"],
    });

    expect(layout.getUnavailableSeatIds()).toEqual(["1-2"]);
    expect(layout.getAvailableSeatCount()).toBe(3);
    expect(layout.getAvailableSeats().map((seat) => seat.id)).toEqual([
      "1-1",
      "2-1",
      "2-2",
    ]);
  });

  it("filters seats by zone and availability", () => {
    const layout = new SeatLayout({
      grid: { rows: 3, columns: 2 },
      zones: { frontRows: 1, middleRows: 1, backRows: 1 },
      unavailableSeatIds: ["1-2"],
    });

    expect(layout.getSeatsByZone("front").map((seat) => seat.id)).toEqual([
      "1-1",
      "1-2",
    ]);
    expect(
      layout
        .getSeatsByZone("front", { availableOnly: true })
        .map((seat) => seat.id),
    ).toEqual(["1-1"]);
  });
});
