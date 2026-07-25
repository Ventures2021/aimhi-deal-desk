# Requirements Matrix

| Capability                                                  | Status      | Evidence                                                                                                 |
| ----------------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------- |
| Inspect repository baseline                                 | implemented | Empty baseline confirmed from repository inventory.                                                      |
| Inspect supplied source package                             | blocked     | None of the 12 named source files exist in the working directory. See `docs/source-traceability.md`.     |
| Requirements coverage and implementation plan               | implemented | This matrix, `docs/architecture.md`, `docs/phased-implementation-plan.md`.                               |
| pnpm workspace and Turborepo scaffold                       | implemented | `package.json`, `pnpm-workspace.yaml`, `turbo.json`.                                                     |
| TypeScript strict mode                                      | implemented | `tsconfig.base.json`, `tsconfig.json`.                                                                   |
| ESLint, Prettier, Vitest baseline                           | implemented | Root configs and CI workflow.                                                                            |
| Next.js web application                                     | blocked     | `apps/web/` reserved but no branded app can be generated responsibly without the missing source package. |
| Cloudflare worker runtime                                   | scaffolded  | `apps/worker/` reserved; runtime code deferred.                                                          |
| D1/SQLite data model                                        | scaffolded  | `migrations/0001_initial.sql`, `scripts/seed-demo.sql`.                                                  |
| Runtime schemas and shared types                            | implemented | `packages/schemas`.                                                                                      |
| Default-deny authorization helpers                          | implemented | `packages/authorization`, `tests/authorization.test.ts`.                                                 |
| Deterministic underwriting calculations                     | implemented | `packages/underwriting`, `tests/underwriting.test.ts`.                                                   |
| OpenAPI specification                                       | scaffolded  | `docs/openapi.yaml`.                                                                                     |
| Threat model and data classification                        | implemented | `docs/threat-model.md`.                                                                                  |
| CI for lint/types/tests/build/security/accessibility status | implemented | `.github/workflows/ci.yml`.                                                                              |
| Runbooks and governance docs                                | implemented | `CONTRIBUTING.md`, `SECURITY.md`, `docs/runbooks/*`.                                                     |
