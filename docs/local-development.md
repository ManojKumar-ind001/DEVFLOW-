# Local Development

Requirements: Node.js 22 or newer and pnpm 10.

```powershell
pnpm install
pnpm typecheck
pnpm test
pnpm --filter @devflow/api build
pnpm --filter @devflow/api start
```

The API listens on `http://127.0.0.1:4100`.

Current endpoints:

- `GET /health`
- `POST /v1/artifacts` with one multipart `file` field, capped at 25 MB
- `GET /v1/jobs/:id` for inspection state and the completed archive manifest

The current artifact store is process-local for development. Persistent object storage, database metadata, and a separate worker are still required before deployment.
