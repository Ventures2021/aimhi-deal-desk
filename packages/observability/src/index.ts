export type RequestContext = {
  requestId: string;
  startedAt: number;
};

export function createRequestContext(request: Request): RequestContext {
  return {
    requestId: request.headers.get("cf-ray") || crypto.randomUUID(),
    startedAt: Date.now(),
  };
}

export function logHttpRequest(
  request: Request,
  response: Response,
  context: RequestContext,
): void {
  const url = new URL(request.url);
  console.log(
    JSON.stringify({
      event: "http.request",
      requestId: context.requestId,
      method: request.method,
      path: url.pathname,
      status: response.status,
      durationMs: Date.now() - context.startedAt,
      colo: (request as Request & { cf?: { colo?: string } }).cf?.colo || null,
    }),
  );
}

export type AuditEvent = {
  workspaceId?: string | null;
  dealId?: string | null;
  requestId?: string | null;
  eventType: string;
  actorType: "anonymous" | "user" | "worker" | "system" | "external";
  actorId?: string | null;
  resourceType?: string | null;
  resourceId?: string | null;
  outcome: string;
  metadata?: Record<string, unknown>;
};
