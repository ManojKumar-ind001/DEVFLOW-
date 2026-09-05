import { afterEach, describe, expect, it } from "vitest";
import { zipSync } from "fflate";
import { createServer } from "./server.js";

const servers = new Set<Awaited<ReturnType<typeof createServer>>>();

afterEach(async () => {
  for (const server of servers) await server.close();
  servers.clear();
});

describe("DevFlow API", () => {
  it("exposes a health check", async () => {
    const server = createServer();
    servers.add(server);
    const response = await server.inject({ method: "GET", url: "/health" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok", service: "devflow-api" });
  });

  it("returns a stable not-found response for unknown jobs", async () => {
    const server = createServer();
    servers.add(server);
    const response = await server.inject({ method: "GET", url: "/v1/jobs/job_missing" });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: "job_not_found" });
  });

  it("accepts an upload and exposes its failed inspection job", async () => {
    const server = createServer();
    servers.add(server);
    const boundary = "devflow-test-boundary";
    const payload = Buffer.from([
      `--${boundary}\r\n`,
      'Content-Disposition: form-data; name="file"; filename="notes.txt"\r\n',
      "Content-Type: text/plain\r\n\r\n",
      "not an archive\r\n",
      `--${boundary}--\r\n`,
    ].join(""));
    const upload = await server.inject({
      method: "POST",
      url: "/v1/artifacts",
      headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
      payload,
    });
    expect(upload.statusCode).toBe(202);
    const { job } = upload.json<{ job: { id: string } }>();
    await new Promise((resolve) => setTimeout(resolve, 10));
    const result = await server.inject({ method: "GET", url: `/v1/jobs/${job.id}` });
    expect(result.statusCode).toBe(200);
    expect(result.json().job.state).toBe("failed");
    expect(result.json().job.error).toContain("Unsupported archive format");
  });

  it("serves a bounded text preview for a file in a ZIP", async () => {
    const server = createServer();
    servers.add(server);
    const boundary = "devflow-preview-boundary";
    const zip = Buffer.from(zipSync({ "src/index.ts": new TextEncoder().encode("export const answer = 42;\n") }));
    const payload = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="preview.zip"\r\nContent-Type: application/zip\r\n\r\n`),
      zip,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);
    const upload = await server.inject({ method: "POST", url: "/v1/artifacts", headers: { "content-type": `multipart/form-data; boundary=${boundary}` }, payload });
    const artifactId = upload.json<{ artifact: { id: string } }>().artifact.id;
    const response = await server.inject({ method: "GET", url: `/v1/artifacts/${artifactId}/file?path=src%2Findex.ts` });
    expect(response.statusCode).toBe(200);
    expect(response.json().preview.content).toContain("answer = 42");
  });
});
