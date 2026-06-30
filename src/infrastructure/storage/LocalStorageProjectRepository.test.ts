import { describe, expect, it } from "vitest";
import { createDefaultProjectState } from "../../application/storage";
import { LocalStorageProjectRepository } from "./LocalStorageProjectRepository";

describe("LocalStorageProjectRepository", () => {
  it("saves and restores the current project state", () => {
    const storage = new MemoryStorage();
    const repository = new LocalStorageProjectRepository(storage);
    const state = createDefaultProjectState({
      step: "preference-selection",
      students: [{ id: "student-1", name: "A", preference: null }],
      preferenceSubmissions: [
        { studentId: "student-1", preference: "front", source: "teacher" },
      ],
      seed: "saved-seed",
    });

    repository.save(state);

    expect(repository.load()).toEqual(state);
  });

  it("returns null for invalid json or unsupported versions", () => {
    const storage = new MemoryStorage();
    const repository = new LocalStorageProjectRepository(storage);

    storage.setItem("seat-picker:v1:project", "{broken");
    expect(repository.load()).toBeNull();

    storage.setItem(
      "seat-picker:v1:project",
      JSON.stringify({ version: 999 }),
    );
    expect(repository.load()).toBeNull();
  });

  it("clears the stored project", () => {
    const storage = new MemoryStorage();
    const repository = new LocalStorageProjectRepository(storage);

    repository.save(createDefaultProjectState());
    repository.clear();

    expect(repository.load()).toBeNull();
  });
});

class MemoryStorage implements Storage {
  private readonly entries = new Map<string, string>();

  get length(): number {
    return this.entries.size;
  }

  clear(): void {
    this.entries.clear();
  }

  getItem(key: string): string | null {
    return this.entries.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.entries.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.entries.delete(key);
  }

  setItem(key: string, value: string): void {
    this.entries.set(key, value);
  }
}
