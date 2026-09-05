export type ArtifactState = "quarantined" | "validated" | "analyzing" | "ready" | "expired" | "failed";

export type JobState = "queued" | "running" | "completed" | "failed";

export interface ArtifactRecord {
  id: string;
  filename: string;
  size: number;
  sha256: string;
  state: ArtifactState;
  createdAt: string;
  expiresAt: string;
}

export interface AnalysisJob {
  id: string;
  artifactId: string;
  kind: "inspect" | "extract";
  state: JobState;
  progress: number;
  createdAt: string;
  updatedAt: string;
  error?: string;
}

export interface JobResponse<TResult = unknown> {
  job: AnalysisJob;
  result?: TResult;
  resultUrl?: string;
}
