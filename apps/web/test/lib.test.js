import assert from "node:assert/strict";
import test from "node:test";

import {
  HttpError,
  normalizeEmail,
  normalizeText,
  readJson,
  safeQueuePayload,
} from "../src/lib.ts";
import { requireInternalToken } from "@aimhi/authorization";

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
    headers: { authorization: "******" },
  });

  assert.throws(() => requireInternalToken(request, undefined), /auth_context_unavailable/);
  assert.throws(() => requireInternalToken(request, "wrong"), /unauthorized/);
  assert.deepEqual(requireInternalToken(request, "correct").workspaceIds, ["*"]);
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

  assert.equal(payload?.jobId, "job-1");
  assert.equal(Object.hasOwn(payload ?? {}, "documentText"), false);
  assert.equal(Object.hasOwn(payload ?? {}, "email"), false);
});
