import { describe, expect, it, vi } from "vitest";
import { DevFlowClient, DevFlowApiError } from "./index.js";

describe("DevFlowClient", () => {
  it("uploads an archive and polls a completed job", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ artifact: { id: "artifact_1" }, job: { id: "job_1" } }), { status: 202 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ job: { id: "job_1", state: "completed" }, result: { format: "zip" } }), { status: 200 }));
    const client = new DevFlowClient({ baseUrl: "http://api.test", fetcher });
    const upload = await client.uploadArchive(new Uint8Array([1, 2, 3]), "project.zip");
    const result = await client.waitForJob(upload.job.id);
    expect(result.job.state).toBe("completed");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("surfaces structured API errors", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ error: "job_not_found" }), { status: 404 }));
    await expect(new DevFlowClient({ fetcher }).getJob("missing")).rejects.toEqual(expect.any(DevFlowApiError));
  });
});
