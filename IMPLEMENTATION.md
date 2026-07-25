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
- A lender-interest selection is not distribution authorization. Actual
  circulation requires an unexpired approval tied to the exact package version
  and exact recipients.
- Public store and membership CTAs remain interest collection until checkout,
  signed payment events, subscription state, entitlements, refunds, and
  protected delivery pass end-to-end testing.

## API surface

- `GET /health`
- `GET /api/v1/capabilities`
- `GET /api/v1/model-versions/current`
- `GET /api/v1/underwriting/demo`
- `POST /api/v1/underwriting/preview`
- `POST /api/v1/intake`
- `POST /api/v1/documents/register` (internal, disabled by default)
- `POST /api/v1/approvals` (internal)
- `POST /api/v1/model-versions/:versionId/decision` (internal)
- `POST /api/v1/deals/:dealId/underwriting-runs` (internal, idempotent)
- `GET /api/v1/deals/:dealId/underwriting-runs/:runId` (internal)

The migrations add the deal/evidence/review/decision spine, immutable approval
and decision receipts, audit events, idempotency records, async document jobs,
the deterministic underwriting model package, and purpose-classified public
intake.

## Deterministic underwriting

The Worker—not the uploaded workbook—is the calculation source of truth.

- Engine version: `2026.07.25`
- Model version: `model-version-2026-07-25`
- Timing: monthly
- Return measures: unlevered, senior-levered, sponsor, and partner
- Debt measures: senior and all-in DSCR, debt yield, LTV, LTC, and
  loan-to-purchase
- Refinance sizing: minimum of LTV, DSCR, and debt-yield constraints
- Release gate: every blocker must pass, every review must be resolved, the
  evidence snapshot must be complete, and the model version must be approved

The original XLSM is an immutable source artifact and regression fixture. Its
VBA is never executed. The source object belongs at:

`model-packages/aimhi-underwriting/1.0.0/source/aimhi-sample-underwriting-model.xlsm`

The public demo and preview routes never persist data. Persisted deal runs
require the internal token, an existing workspace/deal, and an
`Idempotency-Key` header.

## Model release procedure

1. Run `npm run check` and `npm run build`.
2. Apply migrations `0003_underwriting_engine.sql` and
   `0004_offering_intake.sql`.
3. Upload the immutable source XLSM to its versioned R2 key.
4. Confirm the stored SHA-256 matches the D1 model-version record.
5. Validate the Worker against the corrected, desktop-recalculated golden
   cases.
6. Submit an internal model-version decision with a reviewer identity.
7. Keep the version `in_review` until the approval receipt is written.
