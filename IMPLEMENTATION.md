# Aimhi Deal Desk implementation

## Live foundation

- Worker: `aimhi-deal-desk`
- D1 binding `DB`: `aimhi-deal-desk-db`
- R2 binding `DOCUMENTS`: `aimhi-deal-desk-files`
- Producer/consumer binding `PROCESSING_QUEUE`: `aimhi-deal-desk-processing`
- Dead-letter queue: `aimhi-deal-desk-processing-dlq`
- Smart Placement enabled
- Workers Logs at 100% during launch stabilization
- Traces sampled at 5%

Wrangler is the configuration source of truth. Do not make persistent binding,
placement, or observability changes only in the dashboard.

## Required deployment sequence

1. Install dependencies with `npm ci`.
2. Run `npm run check` and `npm run build`.
3. Apply D1 migrations with `npm run db:migrate:remote`.
4. Configure secrets with `wrangler secret put`:
   - `INTERNAL_API_TOKEN`
   - `IP_HASH_PEPPER`
   - `TURNSTILE_SECRET_KEY` only when Turnstile is enabled
5. Deploy with `npm run deploy`.
6. Verify `/health` and `/api/v1/capabilities`.

## Security gates

- Turnstile is required for the public intake endpoint. The managed widget is
  restricted to `dealdesk.aimhi.io` and `aimhi.io`; server validation also
  enforces the `intake` action.
- `DOCUMENT_UPLOADS_ENABLED` remains `false` until malware scanning, OCR,
  retention, and deletion policies have approved providers and tests.
- Internal document and approval endpoints fail closed until
  `INTERNAL_API_TOKEN` is configured.
- Queue messages are metadata-only. Never place document text, contact details,
  sponsor financials, payment data, or secrets on a queue.
- Lender circulation, document issuance, consequential decisions, refunds, and
  legal/regulatory language require explicit human approval.

## API surface

- `GET /health`
- `GET /api/v1/capabilities`
- `POST /api/v1/intake`
- `POST /api/v1/documents/register` (internal, disabled by default)
- `POST /api/v1/approvals` (internal)

The migration adds the deal/evidence/review/decision spine, immutable approval
and decision receipts, audit events, idempotency records, async document jobs,
and the eight explicit model gaps identified in the workflow inventory.
