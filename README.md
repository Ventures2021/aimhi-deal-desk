# aimhi-deal-desk

Cloudflare-native monorepo for Aimhi Deal Desk.

## Workspace layout

- `apps/web`: public site + intake API Worker (current production behavior)
- `apps/processing-worker`: processing worker scaffold
- `apps/workflow-worker`: workflow/orchestration worker scaffold
- `packages/*`: typed shared domain and platform packages
- `migrations/`: additive D1 schema migrations

## Tooling

- pnpm workspaces
- Turborepo
- TypeScript (strict mode)
- ESLint + Prettier
- Cloudflare Workers + D1 + R2 + Queues

## Commands

```bash
pnpm install
pnpm run validate
pnpm run dev
pnpm run build
pnpm run deploy
```

### Database

```bash
pnpm run db:migrate:local
pnpm run db:migrate:remote
pnpm run db:validate
```

## Security and safeguards

- `DOCUMENT_UPLOADS_ENABLED` remains `false` by default.
- Queue payloads remain metadata-only.
- Internal endpoints fail closed without `INTERNAL_API_TOKEN`.
- Turnstile and security headers remain enforced on intake/public traffic.

See `IMPLEMENTATION.md` and `docs/architecture/` for migration status and deferred scope.
