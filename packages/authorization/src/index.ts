export type AccessDecision = {
  allowed: boolean;
  reason: string;
};

export function denyByDefault(reason = 'deny_by_default'): AccessDecision {
  return {
    allowed: false,
    reason,
  };
}

export function allowIf(
  condition: boolean,
  allowedReason = 'allowed',
  deniedReason = 'deny_by_default'
): AccessDecision {
  return condition
    ? { allowed: true, reason: allowedReason }
    : denyByDefault(deniedReason);
}

export function canAccessDeal(input: {
  hasWorkspaceAccess: boolean;
  hasDealAccess: boolean;
}): AccessDecision {
  if (!input.hasWorkspaceAccess) {
    return denyByDefault('workspace_access_required');
  }

  if (!input.hasDealAccess) {
    return denyByDefault('deal_access_required');
  }

  return {
    allowed: true,
    reason: 'deal_access_granted',
  };
}
