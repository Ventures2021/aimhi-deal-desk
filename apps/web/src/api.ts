import {
  assertScopedAuthority,
  AuthorizationError,
  requireInternalToken,
} from "@aimhi/authorization";
import { type AuditEvent } from "@aimhi/observability";
import {
  HttpError,
  json,
  normalizeEmail,
  normalizeText,
  readJson,
  referenceCode,
  requestId,
  safeQueuePayload,
  sha256,
  verifyTurnstile,
} from "./lib";

type D1PreparedStatement = {
  bind: (...values: Array<string | number | null>) => {
    run: () => Promise<unknown>;
  };
};

type D1Database = {
  prepare: (query: string) => D1PreparedStatement;
  batch: (
    statements: Array<{ run: () => Promise<unknown> }>,
  ) => Promise<unknown>;
};

export type Env = {
  DB?: D1Database;
  DOCUMENTS?: { head: (key: string) => Promise<{ size: number } | null> };
  PROCESSING_QUEUE?: { send: (payload: unknown) => Promise<void> };
  INTERNAL_API_TOKEN?: string;
  TURNSTILE_REQUIRED?: string;
  TURNSTILE_SECRET_KEY?: string;
  TURNSTILE_EXPECTED_HOSTNAMES?: string;
  DOCUMENT_UPLOADS_ENABLED?: string;
  IP_HASH_PEPPER?: string;
};

const ASSET_TYPES = new Set([
  "multifamily",
  "industrial",
  "retail",
  "office",
  "hospitality",
  "self-storage",
  "mixed-use",
  "other",
]);

function requireDb(env: Env): D1Database {
  if (!env.DB) throw new HttpError(503, "database_unavailable");
  return env.DB;
}

function requireInternal(request: Request, env: Env): void {
  try {
    requireInternalToken(request, env.INTERNAL_API_TOKEN);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      throw new HttpError(
        error.code === "auth_context_unavailable" ? 503 : 401,
        error.code === "auth_context_unavailable"
          ? "internal_access_not_configured"
          : "unauthorized",
      );
    }
    throw error;
  }
}

async function audit(db: D1Database, event: AuditEvent): Promise<void> {
  await db
    .prepare(
      `INSERT INTO audit_events
       (id, workspace_id, deal_id, request_id, event_type, actor_type,
        actor_id, resource_type, resource_id, outcome, metadata_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      event.workspaceId || null,
      event.dealId || null,
      event.requestId || null,
      event.eventType,
      event.actorType,
      event.actorId || null,
      event.resourceType || null,
      event.resourceId || null,
      event.outcome,
      JSON.stringify(event.metadata || {}),
    )
    .run();
}

export async function handleCapabilities(env: Env): Promise<Response> {
  return json({
    service: "aimhi-deal-desk",
    version: "2",
    configured: {
      database: Boolean(env.DB),
      documentStorage: Boolean(env.DOCUMENTS),
      asynchronousProcessing: Boolean(env.PROCESSING_QUEUE),
      turnstile:
        env.TURNSTILE_REQUIRED === "true" && Boolean(env.TURNSTILE_SECRET_KEY),
      internalAccess: Boolean(env.INTERNAL_API_TOKEN),
      documentUploads:
        env.DOCUMENT_UPLOADS_ENABLED === "true" &&
        Boolean(env.INTERNAL_API_TOKEN),
    },
    safeguards: {
      lenderCirculation: "locked_until_explicit_authorization",
      documentIssuance: "human_approval_required",
      consequentialDecisions: "human_approval_required",
      queuePayloads: "metadata_only",
    },
  });
}

export async function handleIntake(
  request: Request,
  env: Env,
): Promise<Response> {
  const db = requireDb(env);
  const body = await readJson(request);
  if (normalizeText(body.website, 200)) {
    return json({ accepted: true }, 202);
  }

  const email = normalizeEmail(body.email);
  const assetType = normalizeText(body.assetType, 40).toLowerCase();
  const decisionNeeded = normalizeText(body.decisionNeeded, 1_000);
  const privacyConsent = body.privacyConsent === true;
  const errors: Record<string, string> = {};
  if (!email) errors.email = "A valid email is required.";
  if (!ASSET_TYPES.has(assetType))
    errors.assetType = "Select a supported asset type.";
  if (decisionNeeded.length < 20) {
    errors.decisionNeeded = "Describe the decision in at least 20 characters.";
  }
  if (!privacyConsent) errors.privacyConsent = "Consent is required.";
  if (Object.keys(errors).length) {
    throw new HttpError(422, "validation_failed", errors);
  }

  await verifyTurnstile(
    normalizeText(body.turnstileToken, 2_048),
    request,
    env,
  );
  const id = crypto.randomUUID();
  const code = referenceCode();
  const reqId = requestId(request);
  const ip = request.headers.get("cf-connecting-ip") || "";
  const ipHash = ip
    ? await sha256(`${ip}:${env.IP_HASH_PEPPER || "unconfigured"}`)
    : null;

  await db.batch([
    db
      .prepare(
        `INSERT INTO intake_requests
         (id, reference_code, email, first_name, last_name, company, asset_type,
          deal_size_band, decision_needed, geography, lender_opt_in,
          privacy_consent, source_ip_hash)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        code,
        email,
        normalizeText(body.firstName, 80) || null,
        normalizeText(body.lastName, 80) || null,
        normalizeText(body.company, 160) || null,
        assetType,
        normalizeText(body.dealSizeBand, 40) || null,
        decisionNeeded,
        normalizeText(body.geography, 160) || null,
        body.lenderOptIn === true ? 1 : 0,
        1,
        ipHash,
      ),
    db
      .prepare(
        `INSERT INTO audit_events
         (id, request_id, event_type, actor_type, resource_type, resource_id,
          outcome, metadata_json)
         VALUES (?, ?, 'intake.received', 'anonymous', 'intake_request', ?, 'accepted', ?)`,
      )
      .bind(
        crypto.randomUUID(),
        reqId,
        id,
        JSON.stringify({ assetType, lenderOptIn: body.lenderOptIn === true }),
      ),
  ]);

  return json(
    {
      accepted: true,
      referenceCode: code,
      message:
        "Your request was received. Do not send confidential property documents by email; a secure intake path will be provided after scope confirmation.",
    },
    201,
  );
}

export async function handleDocumentRegistration(
  request: Request,
  env: Env,
): Promise<Response> {
  requireInternal(request, env);
  if (env.DOCUMENT_UPLOADS_ENABLED !== "true") {
    throw new HttpError(503, "document_uploads_not_enabled");
  }
  const db = requireDb(env);
  if (!env.PROCESSING_QUEUE || !env.DOCUMENTS) {
    throw new HttpError(503, "document_pipeline_unavailable");
  }

  const body = await readJson(request);
  const workspaceId = normalizeText(body.workspaceId, 64);
  const dealId = normalizeText(body.dealId, 64);
  const storageObjectId = normalizeText(body.storageObjectId, 64);
  const r2Key = normalizeText(body.r2Key, 512);
  const filename = normalizeText(body.filename, 255);
  const mediaType = normalizeText(body.mediaType, 128);
  const sizeBytes = Number(body.sizeBytes);

  if (
    !workspaceId ||
    !dealId ||
    !storageObjectId ||
    !r2Key ||
    !filename ||
    !mediaType ||
    !Number.isSafeInteger(sizeBytes) ||
    sizeBytes < 0
  ) {
    throw new HttpError(422, "validation_failed");
  }

  assertScopedAuthority(
    { actorType: "internal", actorId: "internal-token", workspaceIds: ["*"] },
    { workspaceId, dealId },
  );

  const head = await env.DOCUMENTS.head(r2Key);
  if (!head || head.size !== sizeBytes) {
    throw new HttpError(409, "storage_object_mismatch");
  }

  const jobId = crypto.randomUUID();
  const eventId = crypto.randomUUID();

  await db.batch([
    db
      .prepare(
        `INSERT INTO storage_objects
         (id, workspace_id, deal_id, r2_key, original_filename, media_type,
          size_bytes, sha256, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        storageObjectId,
        workspaceId,
        dealId,
        r2Key,
        filename,
        mediaType,
        sizeBytes,
        normalizeText(body.sha256, 64) || null,
        normalizeText(body.createdBy, 64) || null,
      ),
    db
      .prepare(
        `INSERT INTO document_jobs
         (id, workspace_id, deal_id, storage_object_id, job_type)
         VALUES (?, ?, ?, ?, 'scan_and_extract')`,
      )
      .bind(jobId, workspaceId, dealId, storageObjectId),
  ]);

  await env.PROCESSING_QUEUE.send({
    schemaVersion: "1",
    eventType: "document.registered",
    eventId,
    workspaceId,
    dealId,
    storageObjectId,
    jobId,
    occurredAt: new Date().toISOString(),
  });

  await audit(db, {
    workspaceId,
    dealId,
    requestId: requestId(request),
    eventType: "document.registered",
    actorType: "user",
    actorId: normalizeText(body.createdBy, 64) || null,
    resourceType: "storage_object",
    resourceId: storageObjectId,
    outcome: "queued",
    metadata: { jobId, mediaType, sizeBytes },
  });

  return json({ accepted: true, jobId }, 202);
}

export async function handleApproval(
  request: Request,
  env: Env,
): Promise<Response> {
  requireInternal(request, env);
  const db = requireDb(env);
  const body = await readJson(request);
  const decision = normalizeText(body.decision, 16);

  if (!["approved", "rejected", "revoked"].includes(decision)) {
    throw new HttpError(422, "validation_failed");
  }

  const fields = {
    workspaceId: normalizeText(body.workspaceId, 64),
    dealId: normalizeText(body.dealId, 64),
    approvalType: normalizeText(body.approvalType, 80),
    subjectType: normalizeText(body.subjectType, 80),
    subjectId: normalizeText(body.subjectId, 64),
    decidedBy: normalizeText(body.decidedBy, 64),
  };

  if (Object.values(fields).some((value) => !value)) {
    throw new HttpError(422, "validation_failed");
  }

  assertScopedAuthority(
    { actorType: "internal", actorId: "internal-token", workspaceIds: ["*"] },
    { workspaceId: fields.workspaceId, dealId: fields.dealId },
  );

  const id = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO approval_receipts
       (id, workspace_id, deal_id, approval_type, subject_type, subject_id,
        decision, conditions_json, decided_by, predecessor_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      fields.workspaceId,
      fields.dealId,
      fields.approvalType,
      fields.subjectType,
      fields.subjectId,
      decision,
      JSON.stringify(
        Array.isArray(body.conditions) ? body.conditions.slice(0, 20) : [],
      ),
      fields.decidedBy,
      normalizeText(body.predecessorId, 64) || null,
    )
    .run();

  await audit(db, {
    workspaceId: fields.workspaceId,
    dealId: fields.dealId,
    requestId: requestId(request),
    eventType: `approval.${decision}`,
    actorType: "user",
    actorId: fields.decidedBy,
    resourceType: fields.subjectType,
    resourceId: fields.subjectId,
    outcome: decision,
    metadata: { approvalType: fields.approvalType, approvalReceiptId: id },
  });

  return json({ approvalReceiptId: id, decision }, 201);
}

export async function routeApi(
  request: Request,
  env: Env,
  pathname: string,
): Promise<Response> {
  if (request.method === "GET" && pathname === "/api/v1/capabilities") {
    return handleCapabilities(env);
  }
  if (request.method === "POST" && pathname === "/api/v1/intake") {
    return handleIntake(request, env);
  }
  if (request.method === "POST" && pathname === "/api/v1/documents/register") {
    return handleDocumentRegistration(request, env);
  }
  if (request.method === "POST" && pathname === "/api/v1/approvals") {
    return handleApproval(request, env);
  }
  throw new HttpError(404, "not_found");
}

export async function consumeDocumentJobs(
  batch: {
    messages: Array<{
      id: string;
      body: unknown;
      ack: () => void;
      retry: (opts: { delaySeconds: number }) => void;
    }>;
  },
  env: Env,
): Promise<void> {
  const db = requireDb(env);
  for (const message of batch.messages) {
    const payload = safeQueuePayload(message.body);
    if (!payload) {
      console.warn(
        JSON.stringify({
          event: "queue.message_rejected",
          messageId: message.id,
          reason: "invalid_metadata_envelope",
        }),
      );
      message.ack();
      continue;
    }

    try {
      await db
        .prepare(
          `UPDATE document_jobs
           SET status = 'processing', attempts = attempts + 1,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ? AND status IN ('queued', 'failed')`,
        )
        .bind(payload.jobId)
        .run();

      await db
        .prepare(
          `UPDATE document_jobs
           SET status = 'failed', last_error_code = 'PROCESSOR_NOT_CONFIGURED',
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
        )
        .bind(payload.jobId)
        .run();

      console.warn(
        JSON.stringify({
          event: "document.processing_blocked",
          eventId: payload.eventId,
          jobId: payload.jobId,
          reason: "processor_not_configured",
        }),
      );
      message.ack();
    } catch (error) {
      const err = error as { name?: string };
      console.error(
        JSON.stringify({
          event: "queue.processing_error",
          eventId: payload.eventId,
          jobId: payload.jobId,
          error: err?.name || "Error",
        }),
      );
      message.retry({ delaySeconds: 30 });
    }
  }
}
