import {
  HttpError,
  isInternalRequest,
  json,
  normalizeEmail,
  normalizeText,
  readJson,
  referenceCode,
  requestId,
  safeQueuePayload,
  sha256,
  verifyTurnstile,
} from "./lib.js";
import {
  calculateUnderwriting,
  DEMO_UNDERWRITING_INPUTS,
  publicUnderwritingResult,
  UNDERWRITING_ENGINE_VERSION,
  UNDERWRITING_MODEL_VERSION_ID,
  UnderwritingInputError,
} from "./underwriting.js";

const ASSET_TYPES = new Set([
  "multifamily",
  "industrial",
  "retail",
  "office",
  "hospitality",
  "self-storage",
  "mixed-use",
  "not-deal-specific",
  "other",
]);
const INTEREST_AREAS = new Set([
  "underwriting",
  "digital-products",
  "free-tools",
  "lender-match",
  "membership",
]);

function requireDb(env) {
  if (!env.DB) throw new HttpError(503, "database_unavailable");
  return env.DB;
}

function requireInternal(request, env) {
  if (!env.INTERNAL_API_TOKEN) {
    throw new HttpError(503, "internal_access_not_configured");
  }
  if (!isInternalRequest(request, env)) {
    throw new HttpError(401, "unauthorized");
  }
}

async function audit(db, event) {
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

export async function handleCapabilities(env) {
  return json({
    service: "aimhi-deal-desk",
    version: "3",
    configured: {
      database: Boolean(env.DB),
      documentStorage: Boolean(env.DOCUMENTS),
      asynchronousProcessing: Boolean(env.PROCESSING_QUEUE),
      turnstile: env.TURNSTILE_REQUIRED === "true" && Boolean(env.TURNSTILE_SECRET_KEY),
      internalAccess: Boolean(env.INTERNAL_API_TOKEN),
      documentUploads:
        env.DOCUMENT_UPLOADS_ENABLED === "true" && Boolean(env.INTERNAL_API_TOKEN),
      underwritingEngine: true,
      underwritingPersistence: Boolean(env.DB),
    },
    safeguards: {
      lenderCirculation: "locked_until_explicit_authorization",
      documentIssuance: "human_approval_required",
      consequentialDecisions: "human_approval_required",
      queuePayloads: "metadata_only",
      underwritingTiming: "monthly",
      modelRelease: "human_approval_required",
      macros: "never_executed",
    },
    underwriting: {
      engineVersion: UNDERWRITING_ENGINE_VERSION,
      modelVersionId: UNDERWRITING_MODEL_VERSION_ID,
      metrics: ["unlevered", "senior_levered", "all_in_debt", "sponsor", "partner"],
    },
  });
}

function calculateOrThrow(inputs) {
  try {
    return calculateUnderwriting(inputs);
  } catch (error) {
    if (error instanceof UnderwritingInputError) {
      throw new HttpError(422, error.code, error.errors);
    }
    throw error;
  }
}

export async function handleUnderwritingDemo() {
  return json(publicUnderwritingResult(calculateUnderwriting(DEMO_UNDERWRITING_INPUTS)));
}

export async function handleUnderwritingPreview(request) {
  const body = await readJson(request, 65_536);
  const inputs =
    body.inputs && typeof body.inputs === "object" && !Array.isArray(body.inputs)
      ? body.inputs
      : body;
  return json(publicUnderwritingResult(calculateOrThrow(inputs)));
}

export async function handleCurrentModelVersion(env) {
  const fallback = {
    id: UNDERWRITING_MODEL_VERSION_ID,
    semanticVersion: "1.0.0",
    engineVersion: UNDERWRITING_ENGINE_VERSION,
    status: "in_review",
    sourceSha256: "d70e0be2c157c7e7efc629d122e3343128d0b0b6a0770f54ce3025ff94933105",
    sourceR2Key:
      "model-packages/aimhi-underwriting/1.0.0/source/aimhi-sample-underwriting-model.xlsm",
  };
  if (!env.DB) return json(fallback);
  const row = await env.DB.prepare(
    `SELECT id, semantic_version, engine_version, status, source_sha256,
            source_r2_key, source_filename, limitations_json, approved_at
     FROM model_package_versions
     WHERE id = ?`,
  )
    .bind(UNDERWRITING_MODEL_VERSION_ID)
    .first();
  if (!row) return json(fallback);
  return json({
    id: row.id,
    semanticVersion: row.semantic_version,
    engineVersion: row.engine_version,
    status: row.status,
    sourceSha256: row.source_sha256,
    sourceR2Key: row.source_r2_key,
    sourceFilename: row.source_filename,
    limitations: JSON.parse(row.limitations_json || "[]"),
    approvedAt: row.approved_at,
  });
}

function multiRowInserts(db, table, columns, rows, maximumBindings = 90) {
  if (!rows.length) return [];
  const chunkSize = Math.max(1, Math.floor(maximumBindings / columns.length));
  const statements = [];
  for (let index = 0; index < rows.length; index += chunkSize) {
    const chunk = rows.slice(index, index + chunkSize);
    const placeholders = chunk
      .map(() => `(${columns.map(() => "?").join(", ")})`)
      .join(", ");
    statements.push(
      db
        .prepare(`INSERT INTO ${table} (${columns.join(", ")}) VALUES ${placeholders}`)
        .bind(...chunk.flat()),
    );
  }
  return statements;
}

function metricUnit(metricId) {
  if (
    metricId.endsWith("Irr") ||
    metricId.endsWith("Ltv") ||
    metricId.endsWith("Ltc") ||
    metricId.endsWith("Rate") ||
    metricId.endsWith("DebtYield") ||
    metricId === "allInLoanToPurchase"
  ) {
    return "percent";
  }
  if (
    metricId.endsWith("Dscr") ||
    metricId.endsWith("EquityMultiple") ||
    metricId === "minimumMonthlyAllInDscr"
  ) {
    return "multiple";
  }
  if (metricId.endsWith("Bps")) return "basis_points";
  if (metricId === "refinanceConstraint") return "text";
  return "currency";
}

async function findRunByIdempotency(db, workspaceId, idempotencyKey) {
  return db
    .prepare(
      `SELECT id, output_json, release_status, created_at
       FROM underwriting_runs
       WHERE workspace_id = ? AND idempotency_key = ?`,
    )
    .bind(workspaceId, idempotencyKey)
    .first();
}

export async function handleCreateUnderwritingRun(request, env, dealIdFromPath) {
  requireInternal(request, env);
  const db = requireDb(env);
  const body = await readJson(request, 131_072);
  const workspaceId = normalizeText(body.workspaceId, 64);
  const dealId = normalizeText(dealIdFromPath, 64);
  const idempotencyKey = normalizeText(request.headers.get("idempotency-key"), 120);
  const createdBy = normalizeText(body.createdBy, 64) || null;
  const scenarioId = normalizeText(body.scenarioId, 64) || null;
  const evidenceSnapshot =
    body.evidenceSnapshot &&
    typeof body.evidenceSnapshot === "object" &&
    !Array.isArray(body.evidenceSnapshot)
      ? body.evidenceSnapshot
      : {};
  if (!workspaceId || !dealId || !idempotencyKey) {
    throw new HttpError(422, "validation_failed", {
      workspaceId: workspaceId ? undefined : "Required.",
      dealId: dealId ? undefined : "Required.",
      idempotencyKey: idempotencyKey ? undefined : "Idempotency-Key header is required.",
    });
  }
  const existing = await findRunByIdempotency(db, workspaceId, idempotencyKey);
  if (existing) {
    return json(
      {
        underwritingRunId: existing.id,
        releaseStatus: existing.release_status,
        result: JSON.parse(existing.output_json),
        idempotentReplay: true,
      },
      200,
    );
  }
  const deal = await db
    .prepare(`SELECT id FROM deals WHERE id = ? AND workspace_id = ?`)
    .bind(dealId, workspaceId)
    .first();
  if (!deal) throw new HttpError(404, "deal_not_found");

  const modelVersion = await db
    .prepare(`SELECT id, status FROM model_package_versions WHERE id = ?`)
    .bind(UNDERWRITING_MODEL_VERSION_ID)
    .first();
  if (!modelVersion) throw new HttpError(503, "underwriting_model_unavailable");

  const startedAt = new Date().toISOString();
  const result = calculateOrThrow(body.inputs);
  if (modelVersion.status !== "approved") {
    result.checks.unshift({
      checkId: "CHK-MODEL-VERSION",
      severity: "blocker",
      status: "BLOCK",
      actual: { status: modelVersion.status },
      threshold: { status: "approved" },
      message: "The underwriting model version requires human approval before decision release.",
    });
    result.controlStatus = "BLOCK";
    result.releaseEligible = false;
    result.recommendation = "Pass";
    result.recommendationReason =
      "The calculation completed, but the model version is not approved for decision release.";
  }
  const completedAt = new Date().toISOString();
  const releaseStatus =
    result.controlStatus === "BLOCK"
      ? "blocked"
      : result.controlStatus === "REVIEW"
        ? "in_review"
        : "computed";
  const inputsJson = JSON.stringify(result.inputs);
  const outputJson = JSON.stringify(result);
  const evidenceJson = JSON.stringify(evidenceSnapshot);
  const inputHash = await sha256(inputsJson);
  const runId = crypto.randomUUID();

  const metricRows = Object.entries(result.metrics).map(([metricId, value]) => [
    runId,
    metricId,
    typeof value === "number" ? value : null,
    typeof value === "string" ? value : null,
    metricUnit(metricId),
    metricId.startsWith("year1") || metricId === "firstYearNoi" ? "year_1" : null,
  ]);
  const checkRows = result.checks.map((item) => [
    runId,
    item.checkId,
    item.severity,
    item.status,
    JSON.stringify(item.actual),
    JSON.stringify(item.threshold),
    item.message,
  ]);
  const cashFlowStatements = Object.entries(result.cashFlows).flatMap(
    ([cashFlowType, flows]) =>
      multiRowInserts(
      db,
      "underwriting_cash_flows",
      [
        "underwriting_run_id",
        "cash_flow_type",
        "period_month",
        "occurred_at",
        "amount",
        "components_json",
      ],
      flows.map((flow) => [
        runId,
        cashFlowType === "seniorLevered" ? "senior_levered" : cashFlowType,
        flow.periodMonth,
        flow.occurredAt,
        flow.amount,
        "{}",
      ]),
      ),
  );
  const metricStatements = multiRowInserts(
    db,
    "underwriting_metrics",
    [
      "underwriting_run_id",
      "metric_id",
      "value",
      "text_value",
      "unit",
      "period_label",
    ],
    metricRows,
  );
  const checkStatements = multiRowInserts(
    db,
    "underwriting_checks",
    [
      "underwriting_run_id",
      "check_id",
      "severity",
      "status",
      "actual_json",
      "threshold_json",
      "message",
    ],
    checkRows,
  );
  const statements = [
    db
      .prepare(
        `INSERT INTO underwriting_runs
         (id, workspace_id, deal_id, scenario_id, model_version_id,
          idempotency_key, input_hash, inputs_json, output_json,
          evidence_snapshot_json, release_status, calculation_started_at,
          calculation_completed_at, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        runId,
        workspaceId,
        dealId,
        scenarioId,
        UNDERWRITING_MODEL_VERSION_ID,
        idempotencyKey,
        inputHash,
        inputsJson,
        outputJson,
        evidenceJson,
        releaseStatus,
        startedAt,
        completedAt,
        createdBy,
      ),
    ...metricStatements,
    ...checkStatements,
    ...cashFlowStatements,
    db
      .prepare(
        `INSERT INTO audit_events
         (id, workspace_id, deal_id, request_id, event_type, actor_type,
          actor_id, resource_type, resource_id, outcome, metadata_json)
         VALUES (?, ?, ?, ?, 'underwriting.computed', 'user', ?,
                 'underwriting_run', ?, ?, ?)`,
      )
      .bind(
        crypto.randomUUID(),
        workspaceId,
        dealId,
        requestId(request),
        createdBy,
        runId,
        releaseStatus,
        JSON.stringify({
          engineVersion: result.engineVersion,
          modelVersionId: result.modelVersionId,
          inputHash,
          controlStatus: result.controlStatus,
        }),
      ),
  ].filter(Boolean);
  await db.batch(statements);

  return json(
    {
      underwritingRunId: runId,
      releaseStatus,
      result,
      idempotentReplay: false,
    },
    201,
  );
}

export async function handleGetUnderwritingRun(request, env, dealIdFromPath, runIdFromPath) {
  requireInternal(request, env);
  const db = requireDb(env);
  const dealId = normalizeText(dealIdFromPath, 64);
  const runId = normalizeText(runIdFromPath, 64);
  const row = await db
    .prepare(
      `SELECT id, model_version_id, input_hash, output_json, evidence_snapshot_json,
              release_status, calculation_started_at, calculation_completed_at,
              created_at
       FROM underwriting_runs
       WHERE id = ? AND deal_id = ?`,
    )
    .bind(runId, dealId)
    .first();
  if (!row) throw new HttpError(404, "underwriting_run_not_found");
  return json({
    underwritingRunId: row.id,
    modelVersionId: row.model_version_id,
    inputHash: row.input_hash,
    releaseStatus: row.release_status,
    calculationStartedAt: row.calculation_started_at,
    calculationCompletedAt: row.calculation_completed_at,
    createdAt: row.created_at,
    evidenceSnapshot: JSON.parse(row.evidence_snapshot_json),
    result: JSON.parse(row.output_json),
  });
}

export async function handleModelVersionDecision(request, env, modelVersionIdFromPath) {
  requireInternal(request, env);
  const db = requireDb(env);
  const body = await readJson(request);
  const modelVersionId = normalizeText(modelVersionIdFromPath, 64);
  const workspaceId = normalizeText(body.workspaceId, 64);
  const decidedBy = normalizeText(body.decidedBy, 64);
  const decision = normalizeText(body.decision, 16);
  const conditions = Array.isArray(body.conditions)
    ? body.conditions.map((item) => normalizeText(item, 500)).filter(Boolean).slice(0, 20)
    : [];
  if (
    !modelVersionId ||
    !workspaceId ||
    !decidedBy ||
    !["approved", "rejected"].includes(decision)
  ) {
    throw new HttpError(422, "validation_failed");
  }
  const version = await db
    .prepare(`SELECT id, status FROM model_package_versions WHERE id = ?`)
    .bind(modelVersionId)
    .first();
  if (!version) throw new HttpError(404, "model_version_not_found");
  const approvalReceiptId = crypto.randomUUID();
  const nextStatus = decision === "approved" ? "approved" : "rejected";
  await db.batch([
    db
      .prepare(
        `INSERT INTO approval_receipts
         (id, workspace_id, approval_type, subject_type, subject_id,
          decision, conditions_json, decided_by)
         VALUES (?, ?, 'model_release', 'model_version', ?, ?, ?, ?)`,
      )
      .bind(
        approvalReceiptId,
        workspaceId,
        modelVersionId,
        decision,
        JSON.stringify(conditions),
        decidedBy,
      ),
    db
      .prepare(
        `UPDATE model_package_versions
         SET status = ?, approved_by = ?, approved_at =
           CASE WHEN ? = 'approved' THEN CURRENT_TIMESTAMP ELSE NULL END
         WHERE id = ?`,
      )
      .bind(nextStatus, decidedBy, decision, modelVersionId),
    db
      .prepare(
        `INSERT INTO audit_events
         (id, workspace_id, request_id, event_type, actor_type, actor_id,
          resource_type, resource_id, outcome, metadata_json)
         VALUES (?, ?, ?, ?, 'user', ?, 'model_version', ?, ?, ?)`,
      )
      .bind(
        crypto.randomUUID(),
        workspaceId,
        requestId(request),
        `model_version.${decision}`,
        decidedBy,
        modelVersionId,
        decision,
        JSON.stringify({ approvalReceiptId, conditions }),
      ),
  ]);
  return json(
    {
      modelVersionId,
      status: nextStatus,
      approvalReceiptId,
      conditions,
    },
    201,
  );
}

export async function handleIntake(request, env) {
  const db = requireDb(env);
  const body = await readJson(request);
  if (normalizeText(body.website, 200)) {
    return json({ accepted: true }, 202);
  }

  const email = normalizeEmail(body.email);
  const assetType = normalizeText(body.assetType, 40).toLowerCase();
  const interestArea = normalizeText(body.interestArea, 40).toLowerCase();
  const decisionNeeded = normalizeText(body.decisionNeeded, 1_000);
  const privacyConsent = body.privacyConsent === true;
  const errors = {};
  if (!email) errors.email = "A valid email is required.";
  if (!INTEREST_AREAS.has(interestArea)) errors.interestArea = "Select an area of interest.";
  if (!ASSET_TYPES.has(assetType)) errors.assetType = "Select a supported asset type.";
  if (decisionNeeded.length < 20) {
    errors.decisionNeeded = "Describe the decision in at least 20 characters.";
  }
  if (!privacyConsent) errors.privacyConsent = "Consent is required.";
  if (Object.keys(errors).length) {
    throw new HttpError(422, "validation_failed", errors);
  }

  await verifyTurnstile(normalizeText(body.turnstileToken, 2_048), request, env);
  const id = crypto.randomUUID();
  const code = referenceCode();
  const reqId = requestId(request);
  const ip = request.headers.get("cf-connecting-ip") || "";
  const ipHash = ip ? await sha256(`${ip}:${env.IP_HASH_PEPPER || "unconfigured"}`) : null;

  await db.batch([
    db
      .prepare(
        `INSERT INTO intake_requests
         (id, reference_code, email, first_name, last_name, company, interest_area, asset_type,
          deal_size_band, decision_needed, geography, lender_opt_in,
          privacy_consent, source_ip_hash)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        code,
        email,
        normalizeText(body.firstName, 80) || null,
        normalizeText(body.lastName, 80) || null,
        normalizeText(body.company, 160) || null,
        interestArea,
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
        JSON.stringify({ interestArea, assetType, lenderOptIn: body.lenderOptIn === true }),
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

export async function handleDocumentRegistration(request, env) {
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

export async function handleApproval(request, env) {
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
      JSON.stringify(Array.isArray(body.conditions) ? body.conditions.slice(0, 20) : []),
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

export async function routeApi(request, env, pathname) {
  if (request.method === "GET" && pathname === "/api/v1/capabilities") {
    return handleCapabilities(env);
  }
  if (request.method === "GET" && pathname === "/api/v1/model-versions/current") {
    return handleCurrentModelVersion(env);
  }
  if (request.method === "GET" && pathname === "/api/v1/underwriting/demo") {
    return handleUnderwritingDemo();
  }
  if (request.method === "POST" && pathname === "/api/v1/underwriting/preview") {
    return handleUnderwritingPreview(request);
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
  const modelDecision = pathname.match(
    /^\/api\/v1\/model-versions\/([^/]+)\/decision$/,
  );
  if (request.method === "POST" && modelDecision) {
    return handleModelVersionDecision(
      request,
      env,
      decodeURIComponent(modelDecision[1]),
    );
  }
  const runCollection = pathname.match(
    /^\/api\/v1\/deals\/([^/]+)\/underwriting-runs$/,
  );
  if (request.method === "POST" && runCollection) {
    return handleCreateUnderwritingRun(request, env, decodeURIComponent(runCollection[1]));
  }
  const runDetail = pathname.match(
    /^\/api\/v1\/deals\/([^/]+)\/underwriting-runs\/([^/]+)$/,
  );
  if (request.method === "GET" && runDetail) {
    return handleGetUnderwritingRun(
      request,
      env,
      decodeURIComponent(runDetail[1]),
      decodeURIComponent(runDetail[2]),
    );
  }
  throw new HttpError(404, "not_found");
}

export async function consumeDocumentJobs(batch, env) {
  const db = requireDb(env);
  for (const message of batch.messages) {
    const payload = safeQueuePayload(message.body);
    if (!payload || payload.eventType !== "document.registered") {
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

      // The pipeline intentionally stops before malware scanning/OCR. Those
      // provider choices must be configured before confidential documents flow.
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
      console.error(
        JSON.stringify({
          event: "queue.processing_error",
          eventId: payload.eventId,
          jobId: payload.jobId,
          error: error?.name || "Error",
        }),
      );
      message.retry({ delaySeconds: 30 });
    }
  }
}
