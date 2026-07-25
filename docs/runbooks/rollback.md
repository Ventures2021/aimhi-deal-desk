# Rollback Runbook

Current status: `scaffolded`.

- Revert the most recent application deployment.
- Restore previous environment configuration.
- Do not roll back append-only audit records.
- If a migration introduces risk, create a forward corrective migration instead of silently deleting history.
