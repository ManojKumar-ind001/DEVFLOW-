import Fastify, { type FastifyInstance } from "fastify";
import type { AnalysisJob, JobResponse } from "@devflow/core";

const jobs = new Map<string, AnalysisJob>();

export function createServer(): FastifyInstance {
  const server = Fastify({ logger: false });

  server.get("/health", async () => ({ status: "ok", service: "devflow-api" }));

  server.get<{ Params: { id: string } }>("/v1/jobs/:id", async (request, reply): Promise<JobResponse> => {
    const job = jobs.get(request.params.id);
    if (!job) {
      return reply.code(404).send({ error: "job_not_found" }) as never;
    }
    return { job };
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
