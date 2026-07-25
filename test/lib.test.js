import assert from "node:assert/strict";
import test from "node:test";

import {
  HttpError,
  isInternalRequest,
  normalizeEmail,
  normalizeText,
  readJson,
  safeQueuePayload,
} from "../src/lib.js";
import { handleIntake } from "../src/api.js";

test("normalization trims, collapses whitespace, and validates email", () => {
  assert.equal(normalizeText("  a \n b  ", 20), "a b");
  assert.equal(normalizeEmail(" USER@Example.com "), "user@example.com");
  assert.equal(normalizeEmail("not-an-email"), "");
});

test("readJson accepts objects and rejects arrays", async () => {
  const body = await readJson(
    new Request("https://example.test", {
      method: "POST",
      body: JSON.stringify({ ok: true }),
    }),
  );
  assert.deepEqual(body, { ok: true });

  await assert.rejects(
    readJson(
      new Request("https://example.test", {
        method: "POST",
        body: "[]",
      }),
    ),
    (error) => error instanceof HttpError && error.code === "invalid_json",
  );
});

test("internal access fails closed without the matching token", () => {
  const request = new Request("https://example.test", {
    headers: { authorization: "Bearer correct" },
  });
  assert.equal(isInternalRequest(request, {}), false);
  assert.equal(isInternalRequest(request, { INTERNAL_API_TOKEN: "wrong" }), false);
  assert.equal(isInternalRequest(request, { INTERNAL_API_TOKEN: "correct" }), true);
});

test("queue envelopes discard unexpected sensitive fields", () => {
  const payload = safeQueuePayload({
    schemaVersion: "1",
    eventType: "document.registered",
    eventId: "event-1",
    workspaceId: "workspace-1",
    dealId: "deal-1",
    storageObjectId: "object-1",
    jobId: "job-1",
    occurredAt: "2026-07-25T00:00:00Z",
    documentText: "must not cross queue",
    email: "must-not-cross@example.com",
  });
  assert.equal(payload.documentText, undefined);
  assert.equal(payload.email, undefined);
  assert.equal(payload.jobId, "job-1");
});

test("public intake requires an offering and permits a non-deal-specific request", async () => {
  await assert.rejects(
    handleIntake(
      new Request("https://example.test/api/v1/intake", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: "member@example.com",
          assetType: "not-deal-specific",
          decisionNeeded: "I would like details about membership access.",
          privacyConsent: true,
        }),
      }),
      { DB: {} },
    ),
    (error) =>
      error instanceof HttpError &&
      error.code === "validation_failed" &&
      Boolean(error.details.interestArea) &&
      !error.details.assetType,
  );

  await assert.rejects(
    handleIntake(
      new Request("https://example.test/api/v1/intake", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: "member@example.com",
          interestArea: "membership",
          assetType: "not-deal-specific",
          decisionNeeded: "Too short",
          privacyConsent: true,
        }),
      }),
      { DB: {} },
    ),
    (error) =>
      error instanceof HttpError &&
      error.code === "validation_failed" &&
      Boolean(error.details.decisionNeeded) &&
      !error.details.assetType &&
      !error.details.interestArea,
  );
});
