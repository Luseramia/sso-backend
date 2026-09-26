# bun-sso

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts
```

## Financial statement AI normalizer

The `/financial-analysis/ai-preview` route sends workbook cells to the existing
AI orchestrator and returns the normal financial-analysis preview. No LLM or
gateway credential is required in this service. For local development, forward
the Kubernetes `ai-orchestrator` Service to port 18000. These are the built-in
defaults, so no `.env` change is required for the normal local setup:

```powershell
# Run from the ai-orchestrator repository. Add -SshHost when kubectl is remote.
.\scripts\dev-port-forward.ps1 -Service ai-orchestrator -LocalPort 18000 -RemotePort 8000 -SshRemotePort 18000
```

For the current remote kubectl host, add
`-SshHost tarchunk@192.168.1.51` and keep that terminal open while using the
local backend.

```env
AI_ORCHESTRATOR_REST_URL=http://127.0.0.1:18000
AI_ORCHESTRATOR_TIMEOUT_MS=1300000
```

When this backend runs in the cluster, use:

```env
AI_ORCHESTRATOR_REST_URL=http://ai-orchestrator.codex.svc.cluster.local:8000
```

The AI only identifies workbook structure and canonical mappings. The
orchestrator verifies returned numbers against their source sheet/row/column,
and `bun-sso` still performs the accounting-equation validation before import.

This project was created using `bun init` in bun v1.2.14. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.
