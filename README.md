# DevFlow

DevFlow is a developer workspace for inspecting and analyzing untrusted project artifacts. The first implementation is a local-first archive workspace.

## Current slice

- Shared TypeScript monorepo contracts
- Bounded archive path validation
- Traversal, absolute-path, symlink, device-entry, nesting, entry-size, total-size, and compression-ratio guards
- Safe extraction-root resolution
- Fastify API health endpoint and job polling contract

Uploaded source code and binaries are inspected statically only. They are never executed by the initial platform.

## Development

```powershell
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

Run the API with:

```powershell
pnpm dev:api
```

The API listens on `http://127.0.0.1:4100`.
