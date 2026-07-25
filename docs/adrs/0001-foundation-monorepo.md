# ADR 0001: Bootstrap with honest scaffolding

## Status

Accepted

## Context

The repository was effectively empty and the issue requires a large production-oriented platform plus traceability to a source package that is not present in the working tree.

## Decision

Create a working pnpm/Turborepo/TypeScript foundation, implement a few core safety primitives, and explicitly mark all source-dependent requirements as blocked rather than inventing traceability.

## Consequences

- The repository gains installable validation tooling immediately.
- Reviewers can inspect honest progress instead of placeholder claims.
- The next phase should begin by loading the missing source package into the repository or an accessible attachment set.
