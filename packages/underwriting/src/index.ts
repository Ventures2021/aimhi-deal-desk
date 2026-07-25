export type RevenueInputs = {
  grossPotentialRevenueCents: bigint;
  vacancyCents: bigint;
  concessionsCents: bigint;
  otherIncomeCents: bigint;
  operatingExpensesCents: bigint;
};

function assertPositive(label: string, value: bigint): void {
  if (value <= 0n) {
    throw new Error(`${label} must be greater than zero`);
  }
}

export function sumCents(values: readonly bigint[]): bigint {
  return values.reduce((total, value) => total + value, 0n);
}

export function computeNoiCents(input: RevenueInputs): bigint {
  return (
    input.grossPotentialRevenueCents -
    input.vacancyCents -
    input.concessionsCents +
    input.otherIncomeCents -
    input.operatingExpensesCents
  );
}

export function ratioBps(numerator: bigint, denominator: bigint): number {
  assertPositive('denominator', denominator);
  return Number((numerator * 10000n) / denominator);
}

export function computeCapRateBps(
  noiCents: bigint,
  valueCents: bigint
): number {
  return ratioBps(noiCents, valueCents);
}

export function computeLtvBps(
  loanAmountCents: bigint,
  valueCents: bigint
): number {
  return ratioBps(loanAmountCents, valueCents);
}

export function computeLtcBps(
  loanAmountCents: bigint,
  totalCostCents: bigint
): number {
  return ratioBps(loanAmountCents, totalCostCents);
}

export function computeDscrBps(
  noiCents: bigint,
  annualDebtServiceCents: bigint
): number {
  return ratioBps(noiCents, annualDebtServiceCents);
}
