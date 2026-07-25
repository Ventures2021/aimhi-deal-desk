# Security Policy

## Reporting

Report suspected vulnerabilities privately to Pryceless Ventures maintainers. Do not open public issues for exploitable findings.

## Current controls

- Default-deny authorization helpers live in `packages/authorization`.
- Monetary underwriting helpers use deterministic `bigint`-based arithmetic.
- The scaffold avoids public blob URLs and documents short-lived signed URL requirements.
- CI includes dependency auditing and the repository is configured for secret scanning before commits.

## Known limits

This repository does not yet contain the full application surfaces or provider integrations described in the issue. Anything marked `blocked`, `scaffolded`, or `future` should not be treated as production-ready.
