# ADR 0002: Defer Phase C–E to follow-up work

## Status
Accepted

## Context
Phase C–E introduces substantial schema, authorization, and deterministic modeling work with high correctness and migration risk.

## Decision
Deliver these as follow-up issues/PRs after foundation and quality gates are merged.

## Follow-up scopes
- Phase C: canonical document/evidence/fact lineage tables + additive migrations + integration tests.
- Phase D: deterministic underwriting kernel with versioned calculation functions and test conventions.
- Phase E: server-derived auth context, workspace/deal scope checks, and fail-closed authorization tests.
