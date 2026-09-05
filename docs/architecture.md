# DevFlow Architecture

The first implementation is a local-first archive workspace. Uploaded archives are treated as untrusted data and are inspected statically; uploaded code and binaries are never executed.

## Initial packages

- `@devflow/core`: shared limits, domain types, and archive safety rules.
- `@devflow/archive`: extraction-root enforcement and archive reader integration point.
- `apps/api`: upload and asynchronous job API.
- `apps/web`: project explorer and read-only viewer.
- `apps/cli`: command-line client using the same contracts.

Archive bytes belong in object storage. PostgreSQL stores artifact metadata and job state. Redis-backed workers will be introduced behind the job contract for operations that exceed request timeouts.
