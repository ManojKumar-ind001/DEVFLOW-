# Local Development

Requirements: Node.js 22 or newer and pnpm 10.

```powershell
pnpm install
pnpm typecheck
pnpm test
pnpm --filter @devflow/api build
pnpm --filter @devflow/api start
pnpm dev:web
```

The API listens on `http://127.0.0.1:4100`.

Current endpoints:


The current artifact store is process-local for development. Persistent object storage, database metadata, and a separate worker are still required before deployment.

Open the workspace at `http://127.0.0.1:5173/`. The web app uploads to the API at `http://127.0.0.1:4100`; set `VITE_API_URL` when using another API origin.

Use the CLI against the same API:

```powershell
pnpm --filter @devflow/cli start -- health
pnpm --filter @devflow/cli start -- inspect .\project.zip
pnpm --filter @devflow/cli start -- file <artifact-id> src\index.ts
```

Set `DEVFLOW_API_URL` to target a different API instance.
