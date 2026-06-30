import { beforeEach, describe, expect, it, vi } from "vitest";
import { toPng } from "html-to-image";
import { SeatMapExporter } from "./SeatMapExporter";

vi.mock("html-to-image", () => ({
  toPng: vi.fn(),
}));

describe("SeatMapExporter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(toPng).mockResolvedValue("data:image/png;base64,c2VhdC1tYXA=");
    Object.defineProperty(window, "showSaveFilePicker", {
      configurable: true,
      value: undefined,
    });
  });

  it("falls back to browser download when save picker is unavailable", async () => {
    const element = document.createElement("div");
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    const result = await new SeatMapExporter().exportPng(element, {
      fileName: "class-seat-map.png",
    });

    expect(result).toBe("saved");
    expect(toPng).toHaveBeenCalledWith(
      element,
      expect.objectContaining({
        backgroundColor: "#ffffff",
        cacheBust: true,
        pixelRatio: 2,
      }),
    );
    expect(clickSpy).toHaveBeenCalled();
  });

  it("lets the user choose save location and file name when supported", async () => {
    const element = document.createElement("div");
    const write = vi.fn().mockResolvedValue(undefined);
    const close = vi.fn().mockResolvedValue(undefined);
    const showSaveFilePicker = vi.fn().mockResolvedValue({
      createWritable: vi.fn().mockResolvedValue({ write, close }),
    });

    Object.defineProperty(window, "showSaveFilePicker", {
      configurable: true,
      value: showSaveFilePicker,
    });

    const result = await new SeatMapExporter().exportPng(element, {
      fileName: "class-seat-map.png",
    });

    expect(result).toBe("saved");
    expect(showSaveFilePicker).toHaveBeenCalledWith(
      expect.objectContaining({
        suggestedName: "class-seat-map.png",
      }),
    );
    expect(write).toHaveBeenCalledWith(expect.any(Blob));
    expect(close).toHaveBeenCalled();
  });

  it("returns cancelled when the save picker is dismissed", async () => {
    const element = document.createElement("div");

    Object.defineProperty(window, "showSaveFilePicker", {
      configurable: true,
      value: vi.fn().mockRejectedValue(new DOMException("", "AbortError")),
    });

    await expect(new SeatMapExporter().exportPng(element)).resolves.toBe(
      "cancelled",
    );
    expect(toPng).not.toHaveBeenCalled();
  });
});
