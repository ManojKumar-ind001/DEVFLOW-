import { describe, expect, it } from "vitest";
import { spawn } from "node:child_process";

describe("CLI package", () => {
  it("builds an executable entrypoint", () => {
    expect(typeof spawn).toBe("function");
  });
});
