export type AuthContext = {
  actorType: "internal" | "user";
  actorId: string;
  workspaceIds: string[];
};

export type ScopedResource = {
  workspaceId: string;
  dealId?: string;
};

export class AuthorizationError extends Error {
  constructor(
    public readonly code: "unauthorized" | "auth_context_unavailable",
  ) {
    super(code);
  }
}

export function requireInternalToken(
  request: Request,
  token?: string,
): AuthContext {
  if (!token) {
    throw new AuthorizationError("auth_context_unavailable");
  }

  const authorization = request.headers.get("authorization") || "";
  const [scheme, bearerToken] = authorization.split(/\s+/, 2);
  if (scheme?.toLowerCase() !== "bearer" || bearerToken !== token) {
    throw new AuthorizationError("unauthorized");
  }

  return {
    actorType: "internal",
    actorId: "internal-token",
    workspaceIds: ["*"],
  };
}

export function assertScopedAuthority(
  context: AuthContext,
  resource: ScopedResource,
): void {
  if (context.workspaceIds.includes("*")) {
    return;
  }

  if (!context.workspaceIds.includes(resource.workspaceId)) {
    throw new AuthorizationError("unauthorized");
  }
}
