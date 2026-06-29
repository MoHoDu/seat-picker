import type { GridConfig, Zone, ZoneRowConfig } from "./types";

// 행 수를 앞/중간/뒤로 어떻게 나눌지 담당
export class ZoneLayoutPolicy {
  static createDefault(totalRows: number): ZoneRowConfig {
    this.assertPositiveInteger(totalRows, "totalRows");

    if (totalRows === 1) {
      return { frontRows: 1, middleRows: 0, backRows: 0 };
    }

    if (totalRows === 2) {
      return { frontRows: 1, middleRows: 0, backRows: 1 };
    }

    const edgeRows = Math.max(1, Math.floor((totalRows * 2) / 5));

    return {
      frontRows: edgeRows,
      middleRows: totalRows - edgeRows * 2,
      backRows: edgeRows,
    };
  }

  static validateGrid(config: GridConfig): void {
    this.assertPositiveInteger(config.rows, "rows");
    this.assertPositiveInteger(config.columns, "columns");
  }

  static validateZoneRows(zoneRows: ZoneRowConfig, totalRows: number): void {
    this.assertPositiveInteger(totalRows, "totalRows");
    this.assertNonNegativeInteger(zoneRows.frontRows, "frontRows");
    this.assertNonNegativeInteger(zoneRows.middleRows, "middleRows");
    this.assertNonNegativeInteger(zoneRows.backRows, "backRows");

    const zoneTotal =
      zoneRows.frontRows + zoneRows.middleRows + zoneRows.backRows;

    if (zoneTotal !== totalRows) {
      throw new Error("Zone row counts must add up to total rows.");
    }
  }

  static getZoneForRow(row: number, zoneRows: ZoneRowConfig): Zone {
    const totalRows =
      zoneRows.frontRows + zoneRows.middleRows + zoneRows.backRows;

    this.validateZoneRows(zoneRows, totalRows);
    this.assertPositiveInteger(row, "row");

    if (row > totalRows) {
      throw new Error("row must be within configured zone rows.");
    }

    if (row <= zoneRows.frontRows) {
      return "front";
    }

    if (row <= zoneRows.frontRows + zoneRows.middleRows) {
      return "middle";
    }

    return "back";
  }

  private static assertPositiveInteger(value: number, label: string): void {
    if (!Number.isInteger(value) || value <= 0) {
      throw new Error(`${label} must be a positive integer.`);
    }
  }

  private static assertNonNegativeInteger(value: number, label: string): void {
    if (!Number.isInteger(value) || value < 0) {
      throw new Error(`${label} must be a non-negative integer.`);
    }
  }
}
