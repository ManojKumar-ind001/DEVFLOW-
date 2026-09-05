export type ArchiveEntryType = "file" | "directory" | "symlink" | "hardlink" | "device" | "unknown";

export interface ArchiveEntryInput {
  path: string;
  type: ArchiveEntryType;
  compressedSize: number;
  uncompressedSize: number;
}

export interface ArchiveLimits {
  maxEntries: number;
  maxUncompressedBytes: number;
  maxEntryBytes: number;
  maxNestingDepth: number;
  maxCompressionRatio: number;
}

export const DEFAULT_ARCHIVE_LIMITS: Readonly<ArchiveLimits> = {
  maxEntries: 50_000,
  maxUncompressedBytes: 2 * 1024 * 1024 * 1024,
  maxEntryBytes: 512 * 1024 * 1024,
  maxNestingDepth: 20,
  maxCompressionRatio: 100,
};

export type ArchiveSafetyCode =
  | "path-traversal"
  | "absolute-path"
  | "unsupported-entry"
  | "too-many-entries"
  | "entry-too-large"
  | "archive-too-large"
  | "compression-ratio-too-high"
  | "nesting-too-deep";

export class ArchiveSafetyError extends Error {
  constructor(public readonly code: ArchiveSafetyCode, message: string) {
    super(message);
    this.name = "ArchiveSafetyError";
  }
}

export function normalizeArchivePath(input: string): string {
  const replaced = input.replaceAll("\\", "/");
  if (replaced.startsWith("/") || /^[A-Za-z]:\//u.test(replaced)) {
    throw new ArchiveSafetyError("absolute-path", `Archive entry is absolute: ${input}`);
  }

  const parts = replaced.split("/").filter(Boolean);
  const normalized: string[] = [];
  for (const part of parts) {
    if (part === ".") continue;
    if (part === "..") {
      throw new ArchiveSafetyError("path-traversal", `Archive entry escapes its root: ${input}`);
    }
    normalized.push(part);
  }

  if (normalized.length === 0) {
    throw new ArchiveSafetyError("path-traversal", `Archive entry has no safe path: ${input}`);
  }
  return normalized.join("/");
}

export function validateArchiveEntry(
  entry: ArchiveEntryInput,
  limits: ArchiveLimits = DEFAULT_ARCHIVE_LIMITS,
): string {
  const normalizedPath = normalizeArchivePath(entry.path);
  if (entry.type !== "file" && entry.type !== "directory") {
    throw new ArchiveSafetyError("unsupported-entry", `Archive entry type is not allowed: ${entry.type}`);
  }
  if (!Number.isSafeInteger(entry.compressedSize) || entry.compressedSize < 0) {
    throw new ArchiveSafetyError("compression-ratio-too-high", `Invalid compressed size for ${entry.path}`);
  }
  if (!Number.isSafeInteger(entry.uncompressedSize) || entry.uncompressedSize < 0) {
    throw new ArchiveSafetyError("entry-too-large", `Invalid uncompressed size for ${entry.path}`);
  }
  if (entry.uncompressedSize > limits.maxEntryBytes) {
    throw new ArchiveSafetyError("entry-too-large", `Archive entry exceeds the size limit: ${entry.path}`);
  }
  if (
    entry.uncompressedSize > 0 &&
    (entry.compressedSize === 0 || entry.uncompressedSize / entry.compressedSize > limits.maxCompressionRatio)
  ) {
    throw new ArchiveSafetyError("compression-ratio-too-high", `Archive entry compression ratio is too high: ${entry.path}`);
  }
  if (normalizedPath.split("/").length > limits.maxNestingDepth) {
    throw new ArchiveSafetyError("nesting-too-deep", `Archive entry is nested too deeply: ${entry.path}`);
  }
  return normalizedPath;
}

export function validateArchiveManifest(
  entries: readonly ArchiveEntryInput[],
  limits: ArchiveLimits = DEFAULT_ARCHIVE_LIMITS,
): string[] {
  if (entries.length > limits.maxEntries) {
    throw new ArchiveSafetyError("too-many-entries", "Archive contains too many entries");
  }

  let totalUncompressedBytes = 0;
  const normalizedPaths: string[] = [];
  for (const entry of entries) {
    normalizedPaths.push(validateArchiveEntry(entry, limits));
    totalUncompressedBytes += entry.uncompressedSize;
    if (totalUncompressedBytes > limits.maxUncompressedBytes) {
      throw new ArchiveSafetyError("archive-too-large", "Archive exceeds the total extraction limit");
    }
  }
  return normalizedPaths;
}
