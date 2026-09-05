import { gunzip } from "node:zlib";
import { promisify } from "node:util";
import * as tar from "tar-stream";
import * as unzipper from "unzipper";
import {
  DEFAULT_ARCHIVE_LIMITS,
  normalizeArchivePath,
  validateArchiveManifest,
  type ArchiveEntryInput,
  type ArchiveLimits,
} from "@devflow/core";

const gunzipAsync = promisify(gunzip);

export interface ArchiveInspectionEntry extends ArchiveEntryInput {
  normalizedPath: string;
}

export interface ArchiveInspection {
  format: "zip" | "tar" | "tar.gz";
  files: number;
  directories: number;
  compressedSize: number;
  uncompressedSize: number;
  entries: ArchiveInspectionEntry[];
}

function formatFromFilename(filename: string): ArchiveInspection["format"] {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".zip")) return "zip";
  if (lower.endsWith(".tar.gz") || lower.endsWith(".tgz")) return "tar.gz";
  if (lower.endsWith(".tar")) return "tar";
  throw new Error(`Unsupported archive format: ${filename}`);
}

function finalizeInspection(
  format: ArchiveInspection["format"],
  compressedSize: number,
  entries: ArchiveEntryInput[],
  limits: ArchiveLimits,
): ArchiveInspection {
  const normalizedPaths = validateArchiveManifest(entries, limits);
  const inspectedEntries = entries.map((entry, index) => ({
    ...entry,
    normalizedPath: normalizedPaths[index]!,
  }));
  return {
    format,
    files: entries.filter((entry) => entry.type === "file").length,
    directories: entries.filter((entry) => entry.type === "directory").length,
    compressedSize,
    uncompressedSize: entries.reduce((total, entry) => total + entry.uncompressedSize, 0),
    entries: inspectedEntries,
  };
}

async function inspectZip(buffer: Buffer, limits: ArchiveLimits): Promise<ArchiveInspection> {
  const directory = await unzipper.Open.buffer(buffer);
  const entries: ArchiveEntryInput[] = directory.files.map((file) => ({
    path: file.path,
    type: file.type === "Directory" ? "directory" : "file",
    compressedSize: file.compressedSize,
    uncompressedSize: file.uncompressedSize,
  }));
  return finalizeInspection("zip", buffer.byteLength, entries, limits);
}

async function inspectTar(buffer: Buffer, format: "tar" | "tar.gz", limits: ArchiveLimits): Promise<ArchiveInspection> {
  const tarBuffer = format === "tar.gz" ? await gunzipAsync(buffer) : buffer;
  const extract = tar.extract();
  const entries: ArchiveEntryInput[] = [];
  await new Promise<void>((resolve, reject) => {
    extract.on("entry", (header, stream, next) => {
      const type = header.type === "file" ? "file" : header.type === "directory" ? "directory" : "unknown";
      entries.push({
        path: header.name,
        type,
        compressedSize: header.size,
        uncompressedSize: header.size,
      });
      stream.resume();
      stream.on("end", next);
    });
    extract.on("finish", resolve);
    extract.on("error", reject);
    extract.end(tarBuffer);
  });
  return finalizeInspection(format, buffer.byteLength, entries, limits);
}

export async function inspectArchive(
  buffer: Buffer,
  filename: string,
  limits: ArchiveLimits = DEFAULT_ARCHIVE_LIMITS,
): Promise<ArchiveInspection> {
  const format = formatFromFilename(filename);
  if (buffer.byteLength > limits.maxUncompressedBytes) {
    throw new Error("Archive input exceeds the configured size limit");
  }
  return format === "zip" ? inspectZip(buffer, limits) : inspectTar(buffer, format, limits);
}

export interface ArchiveFilePreview {
  path: string;
  content: string;
  encoding: "utf-8";
  truncated: boolean;
}

const MAX_PREVIEW_BYTES = 256 * 1024;

async function readZipEntry(buffer: Buffer, targetPath: string): Promise<Buffer | null> {
  const directory = await unzipper.Open.buffer(buffer);
  const entry = directory.files.find((file) => normalizeArchivePath(file.path) === targetPath);
  if (!entry || entry.type !== "File") return null;
  return entry.buffer();
}

async function readTarEntry(buffer: Buffer, format: "tar" | "tar.gz", targetPath: string): Promise<Buffer | null> {
  const tarBuffer = format === "tar.gz" ? await gunzipAsync(buffer) : buffer;
  const extract = tar.extract();
  let result: Buffer | null = null;
  await new Promise<void>((resolve, reject) => {
    extract.on("entry", (header, stream, next) => {
      const chunks: Buffer[] = [];
      stream.on("data", (chunk) => {
        if (normalizeArchivePath(header.name) === targetPath && header.type === "file") chunks.push(Buffer.from(chunk as Uint8Array));
      });
      stream.on("end", () => {
        if (chunks.length > 0) result = Buffer.concat(chunks);
        next();
      });
    });
    extract.on("finish", resolve);
    extract.on("error", reject);
    extract.end(tarBuffer);
  });
  return result;
}

export async function readArchiveFile(
  buffer: Buffer,
  filename: string,
  archivePath: string,
): Promise<ArchiveFilePreview | null> {
  const format = formatFromFilename(filename);
  const targetPath = normalizeArchivePath(archivePath);
  const bytes = format === "zip"
    ? await readZipEntry(buffer, targetPath)
    : await readTarEntry(buffer, format, targetPath);
  if (!bytes) return null;
  const truncated = bytes.byteLength > MAX_PREVIEW_BYTES;
  const previewBytes = truncated ? bytes.subarray(0, MAX_PREVIEW_BYTES) : bytes;
  if (previewBytes.subarray(0, 4096).includes(0)) return null;
  return {
    path: targetPath,
    content: previewBytes.toString("utf8"),
    encoding: "utf-8",
    truncated,
  };
}