# Local Development

Requirements: Node.js 22 or newer and pnpm 10.

```powershell
pnpm install
pnpm typecheck
pnpm test
pnpm --filter @devflow/api build
pnpm --filter @devflow/api start
```

The API listens on `http://127.0.0.1:4100`. The current API slice exposes `/health` and the job polling contract at `/v1/jobs/:id`; archive upload and persistent storage are the next implementation step.
