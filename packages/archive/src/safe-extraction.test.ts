import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as tar from "tar-stream";
import { zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { resolveExtractionPath } from "./safe-extraction.js";
import { inspectArchive } from "./inspect.js";

describe("safe extraction", () => {
  it("keeps normalized entries inside the extraction root", async () => {
    const root = await realpath(await mkdtemp(`${tmpdir()}\\devflow-test-`));
    try {
      expect(resolveExtractionPath(root, "src/index.ts")).toBe(`${root}\\src\\index.ts`);
      expect(() => resolveExtractionPath(root, "../../outside.txt")).toThrow();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects unsupported archive formats before parsing", async () => {
    await expect(inspectArchive(Buffer.from("not an archive"), "notes.txt")).rejects.toThrow("Unsupported archive format");
  });

  it("inspects a tar archive into a normalized manifest", async () => {
    const pack = tar.pack();
    const chunks: Buffer[] = [];
    pack.on("data", (chunk) => chunks.push(Buffer.from(chunk as Uint8Array)));
    const finished = new Promise<Buffer>((resolve, reject) => {
      pack.on("end", () => resolve(Buffer.concat(chunks)));
      pack.on("error", reject);
    });
    pack.entry({ name: "project/src/index.ts", type: "file" }, "export const ready = true;\n");
    pack.entry({ name: "project/src", type: "directory" });
    pack.finalize();

    const inspection = await inspectArchive(await finished, "project.tar");
    expect(inspection.format).toBe("tar");
    expect(inspection.files).toBe(1);
    expect(inspection.entries[0]?.normalizedPath).toBe("project/src/index.ts");
  });

  it("inspects a zip archive into a normalized manifest", async () => {
    const zip = Buffer.from(zipSync({
      "project/src/index.ts": new TextEncoder().encode("export const ready = true;\n"),
      "project/README.md": new TextEncoder().encode("# DevFlow\n"),
    }));
    const inspection = await inspectArchive(zip, "project.zip");
    expect(inspection.format).toBe("zip");
    expect(inspection.files).toBeGreaterThan(0);
    expect(inspection.entries[0]?.normalizedPath).toBeTruthy();
  });
});
