import { mkdir, realpath, stat } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { normalizeArchivePath, type ArchiveEntryType } from "@devflow/core";

export interface ExtractionTarget {
  archivePath: string;
  destinationRoot: string;
  type: ExtractableEntryType;
}

export type ExtractableEntryType = Extract<ArchiveEntryType, "file" | "directory">;

export function resolveExtractionPath(destinationRoot: string, archivePath: string): string {
  const root = resolve(destinationRoot);
  const normalizedPath = normalizeArchivePath(archivePath);
  const output = resolve(root, ...normalizedPath.split("/"));
  const relativeOutput = relative(root, output);
  if (relativeOutput === ".." || relativeOutput.startsWith(`..${sep}`) || resolve(output) === root) {
    throw new Error(`Archive path escapes extraction root: ${archivePath}`);
  }
  return output;
}

export async function prepareExtractionTarget(target: ExtractionTarget): Promise<string> {
  const output = resolveExtractionPath(target.destinationRoot, target.archivePath);
  const root = await realpath(target.destinationRoot);
  const parent = resolve(dirname(output));
  const relativeParent = relative(root, parent);
  if (relativeParent === ".." || relativeParent.startsWith(`..${sep}`)) {
    throw new Error(`Extraction parent escapes extraction root: ${target.archivePath}`);
  }

  await mkdir(parent, { recursive: true });
  const parentStats = await stat(parent);
  if (!parentStats.isDirectory()) {
    throw new Error(`Extraction parent is not a directory: ${target.archivePath}`);
  }
  return output;
}

export async function createIsolatedExtractionRoot(baseDirectory: string, jobId: string): Promise<string> {
  const root = join(resolve(baseDirectory), `devflow-${jobId}`);
  await mkdir(root, { recursive: false });
  return realpath(root);
}

export function describeExtractionTarget(target: ExtractionTarget): string {
  return `${target.type}:${normalizeArchivePath(target.archivePath)}`;
}

export async function rejectSymlinkTarget(path: string): Promise<void> {
  try {
    const targetStats = await stat(path);
    if (targetStats.isSymbolicLink()) {
      throw new Error(`Refusing to follow symlink during extraction: ${path}`);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

export async function createSafeSymlink(): Promise<never> {
  throw new Error("Archive symlink entries are disabled");
}
