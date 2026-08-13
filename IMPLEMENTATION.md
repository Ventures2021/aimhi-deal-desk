# Aimhi Deal Desk implementation

## Current delivery status

This repository now delivers **Phase A + Phase B** foundation work in a reviewable form:

- monorepo conversion (pnpm + Turborepo)
- strict TypeScript baseline
- existing web/intake worker moved into `apps/web`
- processing/workflow workers established as real Worker apps
- shared architecture package boundaries with typed public entrypoints
- PR quality gates for formatting, lint, typecheck, unit tests, D1 migration validation, and worker dry-run builds

## Preserved behavior

The following existing behavior remains preserved in `apps/web`:

- `/health`
- `/api/v1/capabilities`
- `/api/v1/intake`
- internal `/api/v1/documents/register` and `/api/v1/approvals` safeguards
- Turnstile verification and security headers
- metadata-only queue payload discipline
- `DOCUMENT_UPLOADS_ENABLED=false` default
- processing path remains blocked until providers are configured

## Intentionally deferred (follow-up scope)

- Phase C canonical immutable evidence lineage vertical slice
- Phase D full underwriting kernel surface and parity scaffolding
- Phase E server-derived workspace/deal authorization enforcement from integrated identity context

## Deployment notes

No pull-request auto-deploy is configured.

Primary worker deployment remains `aimhi-deal-desk` via:

```bash
pnpm run deploy
```

This delegates to `apps/web` and preserves existing Cloudflare bindings.
