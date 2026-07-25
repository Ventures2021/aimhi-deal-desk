# Deployment Runbook

Current status: `scaffolded`.

1. Install with `pnpm install`.
2. Run validation commands from the root README.
3. Provision Cloudflare D1, R2, and queue resources.
4. Apply `migrations/` sequentially before deploying runtime code.
5. Do not enable external providers until authorization and audit controls are implemented end to end.
