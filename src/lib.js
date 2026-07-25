const encoder = new TextEncoder();

export const SECURITY_HEADERS = Object.freeze({
  "content-security-policy":
    "default-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; connect-src 'self' https://challenges.cloudflare.com",
  "cross-origin-opener-policy": "same-origin",
  "cross-origin-resource-policy": "same-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=()",
  "referrer-policy": "strict-origin-when-cross-origin",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
});

export function json(data, status = 200, extraHeaders = {}) {
  return Response.json(data, {
    status,
    headers: {
      ...SECURITY_HEADERS,
      "cache-control": "no-store",
      ...extraHeaders,
    },
  });
}

export function withSecurity(response, extraHeaders = {}) {
  const secured = new Response(response.body, response);
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    secured.headers.set(key, value);
  }
  for (const [key, value] of Object.entries(extraHeaders)) {
    secured.headers.set(key, value);
  }
  return secured;
}

export function normalizeText(value, maxLength) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ").slice(0, maxLength);
}

export function normalizeEmail(value) {
  const email = normalizeText(value, 254).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

export async function readJson(request, maxBytes = 32_768) {
  const declared = Number(request.headers.get("content-length") || 0);
  if (declared > maxBytes) throw new HttpError(413, "payload_too_large");

  let raw;
  try {
    raw = await request.text();
  } catch {
    throw new HttpError(400, "invalid_body");
  }
  if (encoder.encode(raw).byteLength > maxBytes) {
    throw new HttpError(413, "payload_too_large");
  }
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
      throw new Error("JSON object required");
    }
    return parsed;
  } catch {
    throw new HttpError(400, "invalid_json");
  }
}

export function requestId(request) {
  return request.headers.get("cf-ray") || crypto.randomUUID();
}

export function referenceCode() {
  return `AH-${Date.now().toString(36).toUpperCase()}-${crypto
    .randomUUID()
    .slice(0, 6)
    .toUpperCase()}`;
}

export async function sha256(value) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export class HttpError extends Error {
  constructor(status, code, details) {
    super(code);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function isInternalRequest(request, env) {
  if (!env.INTERNAL_API_TOKEN) return false;
  const authorization = request.headers.get("authorization") || "";
  const [scheme, token] = authorization.split(/\s+/, 2);
  return scheme?.toLowerCase() === "bearer" && token === env.INTERNAL_API_TOKEN;
}

export async function verifyTurnstile(token, request, env) {
  if (env.TURNSTILE_REQUIRED !== "true") return { success: true, bypassed: true };
  if (!env.TURNSTILE_SECRET_KEY) {
    throw new HttpError(503, "intake_protection_unavailable");
  }
  if (!token) throw new HttpError(400, "turnstile_token_required");

  const body = new FormData();
  body.append("secret", env.TURNSTILE_SECRET_KEY);
  body.append("response", token);
  const ip = request.headers.get("cf-connecting-ip");
  if (ip) body.append("remoteip", ip);

  const response = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    { method: "POST", body },
  );
  if (!response.ok) throw new HttpError(503, "intake_protection_unavailable");
  const result = await response.json();
  if (!result.success) throw new HttpError(400, "turnstile_verification_failed");
  const expectedHostnames = new Set(
    String(env.TURNSTILE_EXPECTED_HOSTNAMES || "")
      .split(",")
      .map((hostname) => hostname.trim().toLowerCase())
      .filter(Boolean),
  );
  if (
    expectedHostnames.size &&
    !expectedHostnames.has(String(result.hostname || "").toLowerCase())
  ) {
    throw new HttpError(400, "turnstile_hostname_mismatch");
  }
  if (result.action !== "intake") {
    throw new HttpError(400, "turnstile_action_mismatch");
  }
  return result;
}

export function safeQueuePayload(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const allowed = {
    schemaVersion: normalizeText(value.schemaVersion, 16),
    eventType: normalizeText(value.eventType, 64),
    eventId: normalizeText(value.eventId, 64),
    workspaceId: normalizeText(value.workspaceId, 64),
    dealId: normalizeText(value.dealId, 64),
    storageObjectId: normalizeText(value.storageObjectId, 64),
    jobId: normalizeText(value.jobId, 64),
    occurredAt: normalizeText(value.occurredAt, 40),
  };
  if (!allowed.eventType || !allowed.eventId || !allowed.jobId) return null;
  return allowed;
}
