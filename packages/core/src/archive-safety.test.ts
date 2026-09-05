import { describe, expect, it } from "vitest";
import {
  ArchiveSafetyError,
  DEFAULT_ARCHIVE_LIMITS,
  normalizeArchivePath,
  validateArchiveEntry,
  validateArchiveManifest,
} from "./archive-safety.js";

describe("archive safety", () => {
  it("normalizes safe separators and dot segments", () => {
    expect(normalizeArchivePath("project\\src\\.\\index.ts")).toBe("project/src/index.ts");
  });

  it("rejects traversal and absolute paths", () => {
    expect(() => normalizeArchivePath("../../outside.txt")).toThrowError(ArchiveSafetyError);
    expect(() => normalizeArchivePath("/etc/passwd")).toThrowError(ArchiveSafetyError);
    expect(() => normalizeArchivePath("C:/Windows/system.ini")).toThrowError(ArchiveSafetyError);
    try {
      normalizeArchivePath("../../outside.txt");
    } catch (error) {
      expect(error).toMatchObject({ code: "path-traversal" });
    }
  });

  it("rejects links and device entries", () => {
    expect(() => validateArchiveEntry({
      path: "link",
      type: "symlink",
      compressedSize: 1,
      uncompressedSize: 1,
    })).toThrowError(ArchiveSafetyError);
  });

  it("enforces per-entry and total limits", () => {
    expect(() => validateArchiveEntry({
      path: "large.bin",
      type: "file",
      compressedSize: 1,
      uncompressedSize: DEFAULT_ARCHIVE_LIMITS.maxEntryBytes + 1,
    })).toThrowError(ArchiveSafetyError);
    expect(() => validateArchiveManifest([
      { path: "a.txt", type: "file", compressedSize: 10, uncompressedSize: 10 },
      { path: "b.txt", type: "file", compressedSize: 10, uncompressedSize: 10 },
    ], { ...DEFAULT_ARCHIVE_LIMITS, maxUncompressedBytes: 15 })).toThrowError(ArchiveSafetyError);
  });

  it("reports the machine-readable safety code", () => {
    try {
      normalizeArchivePath("../outside.txt");
      throw new Error("Expected traversal to be rejected");
    } catch (error) {
      expect(error).toMatchObject({ code: "path-traversal" });
    }
  });
});
