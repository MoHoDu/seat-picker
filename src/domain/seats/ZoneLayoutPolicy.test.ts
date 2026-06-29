import { describe, expect, it } from "vitest";
import { ZoneLayoutPolicy } from "./ZoneLayoutPolicy";

describe("ZoneLayoutPolicy", () => {
  it("creates default zone rows from the 2:1:2 ratio", () => {
    expect(ZoneLayoutPolicy.createDefault(5)).toEqual({
      frontRows: 2,
      middleRows: 1,
      backRows: 2,
    });
    expect(ZoneLayoutPolicy.createDefault(10)).toEqual({
      frontRows: 4,
      middleRows: 2,
      backRows: 4,
    });
    expect(ZoneLayoutPolicy.createDefault(7)).toEqual({
      frontRows: 2,
      middleRows: 3,
      backRows: 2,
    });
  });

  it("maps one-based row numbers to zones", () => {
    const zones = { frontRows: 2, middleRows: 1, backRows: 2 };

    expect(ZoneLayoutPolicy.getZoneForRow(1, zones)).toBe("front");
    expect(ZoneLayoutPolicy.getZoneForRow(2, zones)).toBe("front");
    expect(ZoneLayoutPolicy.getZoneForRow(3, zones)).toBe("middle");
    expect(ZoneLayoutPolicy.getZoneForRow(4, zones)).toBe("back");
    expect(ZoneLayoutPolicy.getZoneForRow(5, zones)).toBe("back");
  });

  it("rejects invalid zone row totals", () => {
    expect(() =>
      ZoneLayoutPolicy.validateZoneRows(
        { frontRows: 2, middleRows: 2, backRows: 2 },
        5,
      ),
    ).toThrow("add up");
  });
});
