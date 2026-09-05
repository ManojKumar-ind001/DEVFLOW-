import Fastify, { type FastifyInstance } from "fastify";
import multipart from "@fastify/multipart";
import { createHash, randomUUID } from "node:crypto";
import { inspectArchive, type ArchiveInspection } from "@devflow/archive";
import type { AnalysisJob, ArtifactRecord, JobResponse } from "@devflow/core";

const jobs = new Map<string, AnalysisJob>();
const artifacts = new Map<string, { record: ArtifactRecord; bytes: Buffer }>();
const inspectionResults = new Map<string, ArchiveInspection>();
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

async function readUpload(stream: AsyncIterable<Buffer>): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of stream) {
    size += chunk.byteLength;
    if (size > MAX_UPLOAD_BYTES) throw new Error("Upload exceeds the 25 MB limit");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export function createServer(): FastifyInstance {
  const server = Fastify({ logger: false });
  server.register(multipart, { limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } });

  server.get("/health", async () => ({ status: "ok", service: "devflow-api" }));

  server.post("/v1/artifacts", async (request, reply) => {
    const upload = await request.file();
    if (!upload) return reply.code(400).send({ error: "file_required" });
    const bytes = await readUpload(upload.file);
    const id = `artifact_${randomUUID()}`;
    const now = new Date();
    const record: ArtifactRecord = {
      id,
      filename: upload.filename,
      size: bytes.byteLength,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      state: "quarantined",
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
    };
    artifacts.set(id, { record, bytes });
    const jobId = `job_${randomUUID()}`;
    const job: AnalysisJob = {
      id: jobId,
      artifactId: id,
      kind: "inspect",
      state: "queued",
      progress: 0,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    jobs.set(jobId, job);
    queueMicrotask(async () => {
      job.state = "running";
      job.progress = 10;
      job.updatedAt = new Date().toISOString();
      try {
        const inspection = await inspectArchive(bytes, upload.filename);
        inspectionResults.set(jobId, inspection);
        record.state = "ready";
        job.state = "completed";
        job.progress = 100;
      } catch (error) {
        record.state = "failed";
        job.state = "failed";
        job.error = error instanceof Error ? error.message : "Archive inspection failed";
      }
      job.updatedAt = new Date().toISOString();
    });
    return reply.code(202).send({ artifact: record, job });
  });

  server.get<{ Params: { id: string } }>("/v1/jobs/:id", async (request, reply): Promise<JobResponse<ArchiveInspection>> => {
    const job = jobs.get(request.params.id);
    if (!job) {
      return reply.code(404).send({ error: "job_not_found" }) as never;
    }
    const result = inspectionResults.get(job.id);
    return result ? { job, result } : { job };
  });

  return server;
}

if (process.env.NODE_ENV !== "test") {
  const server = createServer();
  server.listen({ host: "127.0.0.1", port: Number(process.env.PORT ?? 4100) }).catch((error: unknown) => {
    server.log.error(error);
    process.exitCode = 1;
  });
}
