import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { resolveExtractionPath } from "./safe-extraction.js";

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
});
