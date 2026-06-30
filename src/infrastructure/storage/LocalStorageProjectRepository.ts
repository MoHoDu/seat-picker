import type {
  SeatPickerProjectState,
  StoredSeatPickerProject,
} from "../../application/storage";
import {
  restoreSeatPickerProject,
  toStoredSeatPickerProject,
} from "../../application/storage";

export const seatPickerStorageKey = "seat-picker:v1:project";

export class LocalStorageProjectRepository {
  constructor(
    private readonly storage: Storage,
    private readonly key: string = seatPickerStorageKey,
  ) {}

  load(): SeatPickerProjectState | null {
    const rawProject = this.storage.getItem(this.key);

    if (!rawProject) {
      return null;
    }

    try {
      const storedProject = JSON.parse(rawProject) as StoredSeatPickerProject;

      if (storedProject.version !== 1) {
        return null;
      }

      return restoreSeatPickerProject(storedProject);
    } catch {
      return null;
    }
  }

  save(state: SeatPickerProjectState): void {
    this.storage.setItem(
      this.key,
      JSON.stringify(toStoredSeatPickerProject(state)),
    );
  }

  clear(): void {
    this.storage.removeItem(this.key);
  }
}
