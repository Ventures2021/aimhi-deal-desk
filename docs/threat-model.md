# Threat Model

## Data classification

| Class        | Examples                                                      | Handling                                                |
| ------------ | ------------------------------------------------------------- | ------------------------------------------------------- |
| Public       | marketing copy, pricing summaries                             | Cacheable and publishable.                              |
| Internal     | implementation plans, workflow metadata                       | Authenticated access only.                              |
| Confidential | tenant deal records, underwriting assumptions                 | Workspace and deal-scoped authorization.                |
| Restricted   | uploaded documents, financing packages, signed authorizations | Private object storage, audited access, no public URLs. |

## Primary threats

- Cross-workspace data leakage
- Unauthorized deal access
- Distribution without explicit financing authorization
- Malicious uploads, archive bombs, and malware payloads
- Injection and broken object-level authorization
- Leakage of sensitive data through logs, analytics, URLs, or error messages

## Baseline mitigations in this scaffold

- Default-deny authorization helpers
- Append-only audit table design
- Tenant-first `workspace_id` columns on tenant-owned records
- Quarantine-minded document status fields in the initial migration
- No secrets in source control; `.env.example` only
