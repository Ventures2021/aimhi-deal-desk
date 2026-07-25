# Contributing

## Current status

This repository is in `scaffolded` status. Production integrations, branded assets, and several product modules are blocked pending the missing source package named in the issue.

## Local validation

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm format:check
```

## Contribution rules

- Keep tenant boundaries explicit.
- Default authorization helpers to deny.
- Treat uploaded files as quarantined until validated.
- Preserve immutable versioning for consequential records.
- Do not commit secrets, customer data, or proprietary source documents.
