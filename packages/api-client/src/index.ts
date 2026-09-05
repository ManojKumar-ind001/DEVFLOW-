import type { ArchiveFilePreview, ArchiveInspection } from "@devflow/archive";
import type { AnalysisJob, ArtifactRecord, JobResponse } from "@devflow/core";

export interface ArtifactUploadResponse {
  artifact: ArtifactRecord;
  job: AnalysisJob;
}

export interface JobResultResponse extends JobResponse<ArchiveInspection> {
  result?: ArchiveInspection;
}

export interface DevFlowClientOptions {
  baseUrl?: string;
  fetcher?: typeof fetch;
}

export class DevFlowApiError extends Error {
  constructor(public readonly status: number, public readonly code: string, message = code) {
    super(message);
    this.name = "DevFlowApiError";
  }
}

export class DevFlowClient {
  private readonly baseUrl: string;
  private readonly fetcher: typeof fetch;

  constructor(options: DevFlowClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? "http://127.0.0.1:4100").replace(/\/$/u, "");
    this.fetcher = options.fetcher ?? fetch;
  }

  async health(): Promise<{ status: string; service: string }> {
    return this.request("/health");
  }

  async uploadArchive(bytes: Uint8Array, filename: string): Promise<ArtifactUploadResponse> {
    const body = new FormData();
    const copy = bytes.slice();
    body.append("file", new Blob([copy.buffer as ArrayBuffer]), filename);
    return this.request("/v1/artifacts", { method: "POST", body });
  }

  async getJob(jobId: string): Promise<JobResultResponse> {
    return this.request(`/v1/jobs/${encodeURIComponent(jobId)}`);
  }

  async waitForJob(jobId: string, options: { intervalMs?: number; timeoutMs?: number } = {}): Promise<JobResultResponse> {
    const intervalMs = options.intervalMs ?? 250;
    const timeoutMs = options.timeoutMs ?? 30_000;
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const response = await this.getJob(jobId);
      if (response.job.state === "completed" || response.job.state === "failed") return response;
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
    throw new DevFlowApiError(408, "job_timeout", `Job did not finish within ${timeoutMs}ms`);
  }

  async getFilePreview(artifactId: string, path: string): Promise<ArchiveFilePreview> {
    const response = await this.request<{ preview: ArchiveFilePreview }>(`/v1/artifacts/${encodeURIComponent(artifactId)}/file?path=${encodeURIComponent(path)}`);
    return response.preview;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await this.fetcher(`${this.baseUrl}${path}`, init);
    const payload = await response.json() as T & { error?: string };
    if (!response.ok) throw new DevFlowApiError(response.status, payload.error ?? "request_failed");
    return payload;
  }
}
