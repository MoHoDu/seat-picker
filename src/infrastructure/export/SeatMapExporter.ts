import { toPng } from "html-to-image";

export type SeatMapExportOptions = {
  fileName?: string;
};

export type SeatMapExportResult = "saved" | "cancelled";

type FileSystemWritableFileStreamLike = {
  write: (data: Blob) => Promise<void>;
  close: () => Promise<void>;
};

type FileSystemFileHandleLike = {
  createWritable: () => Promise<FileSystemWritableFileStreamLike>;
};

type SaveFilePickerOptionsLike = {
  suggestedName?: string;
  types?: Array<{
    description: string;
    accept: Record<string, string[]>;
  }>;
};

type WindowWithSaveFilePicker = Window &
  typeof globalThis & {
    showSaveFilePicker?: (
      options: SaveFilePickerOptionsLike,
    ) => Promise<FileSystemFileHandleLike>;
  };

export class SeatMapExporter {
  async exportPng(
    element: HTMLElement,
    options: SeatMapExportOptions = {},
  ): Promise<SeatMapExportResult> {
    const fileName = options.fileName ?? "seat-picker-result.png";
    const saveFilePicker = this.getSaveFilePicker();

    if (saveFilePicker) {
      try {
        const fileHandle = await saveFilePicker({
          suggestedName: fileName,
          types: [
            {
              description: "PNG 이미지",
              accept: { "image/png": [".png"] },
            },
          ],
        });
        const dataUrl = await this.createPngDataUrl(element);
        const writable = await fileHandle.createWritable();

        await writable.write(this.dataUrlToBlob(dataUrl));
        await writable.close();

        return "saved";
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return "cancelled";
        }

        throw error;
      }
    }

    const dataUrl = await this.createPngDataUrl(element);
    this.downloadWithAnchor(dataUrl, fileName);

    return "saved";
  }

  private createPngDataUrl(element: HTMLElement): Promise<string> {
    return toPng(element, {
      backgroundColor: "#ffffff",
      cacheBust: true,
      pixelRatio: 2,
    });
  }

  private downloadWithAnchor(dataUrl: string, fileName: string): void {
    const link = document.createElement("a");

    link.href = dataUrl;
    link.download = fileName;
    link.rel = "noopener";

    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  private getSaveFilePicker():
    | WindowWithSaveFilePicker["showSaveFilePicker"]
    | undefined {
    return (window as WindowWithSaveFilePicker).showSaveFilePicker;
  }

  private dataUrlToBlob(dataUrl: string): Blob {
    const [metadata, encodedData] = dataUrl.split(",");
    const mimeType = metadata?.match(/^data:(.*?);base64$/)?.[1] ?? "image/png";
    const binary = window.atob(encodedData ?? "");
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    return new Blob([bytes], { type: mimeType });
  }
}
