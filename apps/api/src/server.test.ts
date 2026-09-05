import { afterEach, describe, expect, it } from "vitest";
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
});
