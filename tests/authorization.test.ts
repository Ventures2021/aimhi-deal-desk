import { describe, expect, it } from 'vitest';

import {
  canAccessDeal,
  denyByDefault,
} from '../packages/authorization/src/index';

describe('authorization helpers', () => {
  it('defaults to deny', () => {
    expect(denyByDefault()).toEqual({
      allowed: false,
      reason: 'deny_by_default',
    });
  });

  it('requires both workspace and deal access', () => {
    expect(
      canAccessDeal({
        hasWorkspaceAccess: true,
        hasDealAccess: false,
      })
    ).toEqual({
      allowed: false,
      reason: 'deal_access_required',
    });

    expect(
      canAccessDeal({
        hasWorkspaceAccess: true,
        hasDealAccess: true,
      })
    ).toEqual({
      allowed: true,
      reason: 'deal_access_granted',
    });
  });
});
