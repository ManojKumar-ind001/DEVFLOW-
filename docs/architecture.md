# DevFlow Architecture

The first implementation is a local-first archive workspace. Uploaded archives are treated as untrusted data and are inspected statically; uploaded code and binaries are never executed.

## Initial packages

- `packages/api-client`: typed HTTP client reused by the CLI, web integrations, VS Code extension, and GitHub Action.

Archive bytes belong in object storage. PostgreSQL stores artifact metadata and job state. Redis-backed workers will be introduced behind the job contract for operations that exceed request timeouts.

## Current interfaces

- Web: `pnpm dev:web`, then open `http://127.0.0.1:5173/`.
- API: `pnpm dev:api`, listening on `http://127.0.0.1:4100`.
- CLI: `pnpm --filter @devflow/cli start -- health`, `inspect <archive>`, or `file <artifact-id> <path>`.

The CLI and future VS Code/GitHub integrations use `@devflow/api-client`; archive parsing remains owned by the API/archive packages.
