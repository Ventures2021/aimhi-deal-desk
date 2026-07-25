# Aimhi Deal Desk

Aimhi Deal Desk is a decision-first commercial real-estate platform for Pryceless Ventures and [aimhi.io](https://aimhi.io).

## Repository status

This repository is an initial `scaffolded` foundation. It currently delivers:

- production-oriented planning and architecture documentation
- source-traceability reporting that records blocked source inputs
- a pnpm workspace and Turborepo baseline
- deterministic underwriting primitives using `bigint`
- default-deny authorization helpers and tests
- a starter D1/SQLite migration and demo seed data
- CI scaffolding for lint, types, tests, build, security, and accessibility status

The proprietary source package named in the issue is **not present** in this working copy, so any requirement that depends on those files is explicitly marked `blocked` instead of being implied as complete.

## Monorepo layout

```text
apps/
  web/
  worker/
packages/
  authorization/
  brand/
  database/
  documents/
  domain/
  evidence/
  integrations/
  observability/
  schemas/
  ui/
  underwriting/
  workflows/
skills/
docs/
migrations/
scripts/
tests/
.github/
```

## Validation

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm format:check
```

## Feature status snapshot

| Area                     | Status      | Notes                                                                       |
| ------------------------ | ----------- | --------------------------------------------------------------------------- |
| Requirements audit       | scaffolded  | See `docs/requirements-matrix.md`.                                          |
| Source traceability      | blocked     | Named source package files are unavailable in this environment.             |
| Monorepo/tooling         | implemented | pnpm, Turbo, TypeScript, Vitest, ESLint, Prettier.                          |
| Authorization foundation | implemented | Default-deny helper and deal access guard.                                  |
| Underwriting primitives  | implemented | Deterministic core metrics with tests.                                      |
| Database model           | scaffolded  | Initial migration covers workspace, deals, documents, authorization, audit. |
| Marketing site           | scaffolded  | Reserved path only; branded UI blocked by missing assets.                   |
| Worker runtime           | scaffolded  | Reserved path only.                                                         |
| Provider adapters        | future      | Awaiting implementation details and credentials ownership model.            |

## Key documentation

- `docs/requirements-matrix.md`
- `docs/source-traceability.md`
- `docs/architecture.md`
- `docs/threat-model.md`
- `docs/phased-implementation-plan.md`
- `docs/runbooks/`

## Important limitations

- No proprietary artwork or source package documents were present to inspect.
- No external providers are configured.
- No financing distribution workflow should be treated as operational.
- No claims in this repository should be read as lender authorization, payment entitlement, or legal approval.
