import { describe, expect, it } from 'vitest';

import {
  computeCapRateBps,
  computeDscrBps,
  computeLtcBps,
  computeLtvBps,
  computeNoiCents,
} from '../packages/underwriting/src/index';

describe('underwriting primitives', () => {
  it('computes NOI without floating point drift', () => {
    const noi = computeNoiCents({
      grossPotentialRevenueCents: 120000000n,
      vacancyCents: 6000000n,
      concessionsCents: 1000000n,
      otherIncomeCents: 2500000n,
      operatingExpensesCents: 42000000n,
    });

    expect(noi).toBe(73500000n);
  });

  it('computes leverage and coverage ratios in basis points', () => {
    expect(computeCapRateBps(73500000n, 1050000000n)).toBe(700);
    expect(computeLtvBps(700000000n, 1000000000n)).toBe(7000);
    expect(computeLtcBps(700000000n, 875000000n)).toBe(8000);
    expect(computeDscrBps(147000000n, 120000000n)).toBe(12250);
  });
});
