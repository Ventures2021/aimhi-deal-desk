# Current state (Phase A+B)

## Implemented

- pnpm workspace + Turborepo monorepo structure.
- TypeScript strict-mode baseline across apps and packages.
- Existing public Worker/API behavior moved to `apps/web`.
- Real Worker app scaffolds in `apps/processing-worker` and `apps/workflow-worker`.
- Typed shared package entrypoints for architecture package boundaries.
- CI pull-request quality gates for format/lint/typecheck/test/migration validation/worker dry-run builds.

## Scaffolded (not live)

- Processing worker and workflow worker runtime behavior beyond health endpoints.
- Shared package APIs that define domain boundaries but do not yet implement full Phase C–E workflows.

## Intentionally disabled

- Document uploads remain disabled unless `DOCUMENT_UPLOADS_ENABLED=true`.
- Processing worker providers for malware scanning/OCR/AI remain disabled until configured.
- Automatic deploy from pull requests is intentionally not configured.

## Pending provider/legal/product decisions

- Malware scanning provider selection.
- OCR/parser provider selection.
- AI extraction provider selection and guardrails.
- Final identity provider integration for external auth context.
