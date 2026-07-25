export const UNDERWRITING_ENGINE_VERSION = "2026.07.25";
export const UNDERWRITING_MODEL_VERSION_ID = "model-version-2026-07-25";

const EPSILON = 1e-9;

export class UnderwritingInputError extends Error {
  constructor(errors) {
    super("underwriting_input_invalid");
    this.code = "underwriting_input_invalid";
    this.errors = errors;
  }
}

export const DEMO_UNDERWRITING_INPUTS = Object.freeze({
  modelVersionId: UNDERWRITING_MODEL_VERSION_ID,
  assetType: "multifamily",
  scenarioName: "Base",
  startDate: "2026-07-01",
  purchasePrice: 22_000_000,
  closingCosts: 330_000,
  renovationBudget: 1_200_000,
  sponsorSoftCosts: 0,
  holdMonths: 60,
  year1GrossPotentialRevenue: 3_200_000,
  otherIncomeYear1: 120_000,
  initialEconomicVacancy: 0.09,
  stabilizedEconomicVacancy: 0.06,
  leaseUpMonths: 12,
  operatingExpenseRatio: 0.22,
  managementFeeRate: 0.03,
  reservesAnnual: 180_000,
  revenueGrowthAnnual: 0.04,
  expenseGrowthAnnual: 0.03,
  exitCapRate: 0.103,
  sellingCostsRate: 0.02,
  seniorLtv: 0.55,
  seniorRate: 0.0675,
  seniorAmortizationYears: 30,
  seniorInterestOnlyMonths: 60,
  juniorPrincipal: 6_000_000,
  juniorRate: 0.10,
  juniorPayoffMonth: 60,
  refinanceEnabled: false,
  refinanceMonth: 0,
  refinanceLtv: 0.65,
  refinanceRate: 0.065,
  refinanceAmortizationYears: 30,
  refinanceCapRate: 0.103,
  minimumDscr: 1.25,
  minimumDebtYield: 0.09,
  maximumSeniorLtv: 0.75,
  maximumAllInLtc: 0.90,
  minimumExitCapSpreadBps: 50,
  evidence: {
    required: 18,
    accepted: 18,
    pending: 0,
    rejected: 0,
  },
});

function finiteNumber(value, field, errors, { min = -Infinity, max = Infinity } = {}) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) {
    errors[field] = `Expected a finite number from ${min} to ${max}.`;
    return 0;
  }
  return number;
}

function integer(value, field, errors, bounds) {
  const number = finiteNumber(value, field, errors, bounds);
  if (!Number.isInteger(number)) {
    errors[field] = "Expected a whole number.";
    return 0;
  }
  return number;
}

function normalizeIsoDate(value, errors) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(Date.parse(`${text}T00:00:00Z`))) {
    errors.startDate = "Expected an ISO date in YYYY-MM-DD format.";
    return "2026-01-01";
  }
  return text;
}

export function normalizeUnderwritingInputs(raw) {
  const input = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const errors = {};
  const holdMonths = integer(input.holdMonths, "holdMonths", errors, { min: 12, max: 360 });
  const refinanceEnabled = input.refinanceEnabled === true;
  const refinanceMonth = refinanceEnabled
    ? integer(input.refinanceMonth, "refinanceMonth", errors, {
        min: 1,
        max: Math.max(1, holdMonths - 1),
      })
    : 0;
  const juniorPrincipal = finiteNumber(input.juniorPrincipal ?? 0, "juniorPrincipal", errors, {
    min: 0,
    max: 10_000_000_000,
  });
  const juniorPayoffMonth =
    juniorPrincipal > 0
      ? integer(input.juniorPayoffMonth, "juniorPayoffMonth", errors, {
          min: 1,
          max: holdMonths,
        })
      : 0;
  const evidence = input.evidence && typeof input.evidence === "object" ? input.evidence : {};
  const requiredEvidence = integer(evidence.required ?? 0, "evidence.required", errors, {
    min: 0,
    max: 10_000,
  });
  const acceptedEvidence = integer(evidence.accepted ?? 0, "evidence.accepted", errors, {
    min: 0,
    max: requiredEvidence,
  });
  const pendingEvidence = integer(evidence.pending ?? 0, "evidence.pending", errors, {
    min: 0,
    max: 10_000,
  });
  const rejectedEvidence = integer(evidence.rejected ?? 0, "evidence.rejected", errors, {
    min: 0,
    max: 10_000,
  });

  const normalized = {
    modelVersionId:
      typeof input.modelVersionId === "string" && input.modelVersionId.trim()
        ? input.modelVersionId.trim().slice(0, 64)
        : UNDERWRITING_MODEL_VERSION_ID,
    assetType:
      typeof input.assetType === "string" && input.assetType.trim()
        ? input.assetType.trim().toLowerCase().slice(0, 40)
        : "other",
    scenarioName:
      typeof input.scenarioName === "string" && input.scenarioName.trim()
        ? input.scenarioName.trim().slice(0, 80)
        : "Base",
    startDate: normalizeIsoDate(input.startDate, errors),
    purchasePrice: finiteNumber(input.purchasePrice, "purchasePrice", errors, {
      min: 1,
      max: 10_000_000_000,
    }),
    closingCosts: finiteNumber(input.closingCosts ?? 0, "closingCosts", errors, {
      min: 0,
      max: 1_000_000_000,
    }),
    renovationBudget: finiteNumber(input.renovationBudget ?? 0, "renovationBudget", errors, {
      min: 0,
      max: 2_000_000_000,
    }),
    sponsorSoftCosts: finiteNumber(input.sponsorSoftCosts ?? 0, "sponsorSoftCosts", errors, {
      min: 0,
      max: 1_000_000_000,
    }),
    holdMonths,
    year1GrossPotentialRevenue: finiteNumber(
      input.year1GrossPotentialRevenue,
      "year1GrossPotentialRevenue",
      errors,
      { min: 0, max: 10_000_000_000 },
    ),
    otherIncomeYear1: finiteNumber(input.otherIncomeYear1 ?? 0, "otherIncomeYear1", errors, {
      min: 0,
      max: 2_000_000_000,
    }),
    initialEconomicVacancy: finiteNumber(
      input.initialEconomicVacancy,
      "initialEconomicVacancy",
      errors,
      { min: 0, max: 0.95 },
    ),
    stabilizedEconomicVacancy: finiteNumber(
      input.stabilizedEconomicVacancy,
      "stabilizedEconomicVacancy",
      errors,
      { min: 0, max: 0.95 },
    ),
    leaseUpMonths: integer(input.leaseUpMonths ?? 0, "leaseUpMonths", errors, {
      min: 0,
      max: holdMonths,
    }),
    operatingExpenseRatio: finiteNumber(
      input.operatingExpenseRatio,
      "operatingExpenseRatio",
      errors,
      { min: 0, max: 0.9 },
    ),
    managementFeeRate: finiteNumber(input.managementFeeRate ?? 0, "managementFeeRate", errors, {
      min: 0,
      max: 0.5,
    }),
    reservesAnnual: finiteNumber(input.reservesAnnual ?? 0, "reservesAnnual", errors, {
      min: 0,
      max: 2_000_000_000,
    }),
    revenueGrowthAnnual: finiteNumber(
      input.revenueGrowthAnnual,
      "revenueGrowthAnnual",
      errors,
      { min: -0.5, max: 0.5 },
    ),
    expenseGrowthAnnual: finiteNumber(
      input.expenseGrowthAnnual,
      "expenseGrowthAnnual",
      errors,
      { min: -0.5, max: 0.5 },
    ),
    exitCapRate: finiteNumber(input.exitCapRate, "exitCapRate", errors, {
      min: 0.005,
      max: 0.5,
    }),
    sellingCostsRate: finiteNumber(input.sellingCostsRate ?? 0, "sellingCostsRate", errors, {
      min: 0,
      max: 0.2,
    }),
    seniorLtv: finiteNumber(input.seniorLtv, "seniorLtv", errors, { min: 0, max: 1.5 }),
    seniorRate: finiteNumber(input.seniorRate, "seniorRate", errors, { min: 0, max: 1 }),
    seniorAmortizationYears: integer(
      input.seniorAmortizationYears,
      "seniorAmortizationYears",
      errors,
      { min: 1, max: 50 },
    ),
    seniorInterestOnlyMonths: integer(
      input.seniorInterestOnlyMonths ?? 0,
      "seniorInterestOnlyMonths",
      errors,
      { min: 0, max: holdMonths },
    ),
    juniorPrincipal,
    juniorRate: finiteNumber(input.juniorRate ?? 0, "juniorRate", errors, {
      min: 0,
      max: 1,
    }),
    juniorPayoffMonth,
    refinanceEnabled,
    refinanceMonth,
    refinanceLtv: finiteNumber(input.refinanceLtv ?? 0, "refinanceLtv", errors, {
      min: 0,
      max: 1.5,
    }),
    refinanceRate: finiteNumber(input.refinanceRate ?? 0, "refinanceRate", errors, {
      min: 0,
      max: 1,
    }),
    refinanceAmortizationYears: integer(
      input.refinanceAmortizationYears ?? 30,
      "refinanceAmortizationYears",
      errors,
      { min: 1, max: 50 },
    ),
    refinanceCapRate: finiteNumber(
      input.refinanceCapRate ?? input.exitCapRate,
      "refinanceCapRate",
      errors,
      { min: 0.005, max: 0.5 },
    ),
    minimumDscr: finiteNumber(input.minimumDscr ?? 1.25, "minimumDscr", errors, {
      min: 0.5,
      max: 5,
    }),
    minimumDebtYield: finiteNumber(
      input.minimumDebtYield ?? 0.09,
      "minimumDebtYield",
      errors,
      { min: 0, max: 1 },
    ),
    maximumSeniorLtv: finiteNumber(
      input.maximumSeniorLtv ?? 0.75,
      "maximumSeniorLtv",
      errors,
      { min: 0.1, max: 1.5 },
    ),
    maximumAllInLtc: finiteNumber(
      input.maximumAllInLtc ?? 0.9,
      "maximumAllInLtc",
      errors,
      { min: 0.1, max: 1.5 },
    ),
    minimumExitCapSpreadBps: integer(
      input.minimumExitCapSpreadBps ?? 0,
      "minimumExitCapSpreadBps",
      errors,
      { min: -1_000, max: 5_000 },
    ),
    evidence: {
      required: requiredEvidence,
      accepted: acceptedEvidence,
      pending: pendingEvidence,
      rejected: rejectedEvidence,
    },
  };

  if (normalized.stabilizedEconomicVacancy > normalized.initialEconomicVacancy) {
    errors.stabilizedEconomicVacancy =
      "Stabilized vacancy cannot exceed initial vacancy in this lease-up model.";
  }
  if (refinanceEnabled && juniorPrincipal > 0 && juniorPayoffMonth !== refinanceMonth) {
    errors.juniorPayoffMonth =
      "When refinancing, junior debt must be repaid in the refinance month.";
  }
  if (Object.keys(errors).length) throw new UnderwritingInputError(errors);
  return normalized;
}

export function monthlyPayment(principal, annualRate, amortizationMonths) {
  if (principal <= 0) return 0;
  if (amortizationMonths <= 0) throw new RangeError("amortizationMonths must be positive");
  const monthlyRate = annualRate / 12;
  if (Math.abs(monthlyRate) < EPSILON) return principal / amortizationMonths;
  return (
    (principal * monthlyRate * (1 + monthlyRate) ** amortizationMonths) /
    ((1 + monthlyRate) ** amortizationMonths - 1)
  );
}

function periodicIrr(cashFlows) {
  if (!cashFlows.some((value) => value < 0) || !cashFlows.some((value) => value > 0)) {
    return null;
  }
  const npv = (rate) =>
    cashFlows.reduce((sum, value, index) => sum + value / (1 + rate) ** index, 0);
  let low = -0.9999;
  let high = 1;
  let lowValue = npv(low);
  let highValue = npv(high);
  while (Math.sign(lowValue) === Math.sign(highValue) && high < 1_000_000) {
    high *= 2;
    highValue = npv(high);
  }
  if (Math.sign(lowValue) === Math.sign(highValue)) return null;
  for (let iteration = 0; iteration < 240; iteration += 1) {
    const mid = (low + high) / 2;
    const midValue = npv(mid);
    if (Math.abs(midValue) < 1e-7) return mid;
    if (Math.sign(midValue) === Math.sign(lowValue)) {
      low = mid;
      lowValue = midValue;
    } else {
      high = mid;
    }
  }
  return (low + high) / 2;
}

export function annualizedMonthlyIrr(cashFlows) {
  const monthly = periodicIrr(cashFlows);
  if (monthly === null || monthly <= -1) return null;
  const annualized = (1 + monthly) ** 12 - 1;
  return Number.isFinite(annualized) ? annualized : null;
}

function equityMultiple(cashFlows) {
  const invested = -cashFlows.filter((value) => value < 0).reduce((sum, value) => sum + value, 0);
  const returned = cashFlows.filter((value) => value > 0).reduce((sum, value) => sum + value, 0);
  return invested > EPSILON ? returned / invested : null;
}

function addMonths(isoDate, months) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.toISOString().slice(0, 10);
}

function sum(values, start, end) {
  let total = 0;
  for (let index = start; index <= end; index += 1) total += values[index] || 0;
  return total;
}

function check(checkId, severity, status, actual, threshold, message) {
  return { checkId, severity, status, actual, threshold, message };
}

function round(value, places = 8) {
  if (value === null || !Number.isFinite(value)) return null;
  const factor = 10 ** places;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function publicCashFlow(values, startDate) {
  return values.map((amount, periodMonth) => ({
    periodMonth,
    occurredAt: addMonths(startDate, periodMonth),
    amount: round(amount, 2),
  }));
}

export function calculateUnderwriting(rawInputs) {
  const inputs = normalizeUnderwritingInputs(rawInputs);
  const months = inputs.holdMonths + 12;
  const totalUses =
    inputs.purchasePrice +
    inputs.closingCosts +
    inputs.renovationBudget +
    inputs.sponsorSoftCosts;
  const seniorPrincipal = inputs.purchasePrice * inputs.seniorLtv;
  const totalInitialDebt = seniorPrincipal + inputs.juniorPrincipal;
  const sponsorInitialEquity = totalUses - totalInitialDebt;
  const unlevered = Array(months + 1).fill(0);
  const seniorLevered = Array(months + 1).fill(0);
  const sponsor = Array(months + 1).fill(0);
  const partner = Array(months + 1).fill(0);
  const noi = Array(months + 1).fill(0);
  const grossPotentialRevenue = Array(months + 1).fill(0);
  const effectiveGrossIncome = Array(months + 1).fill(0);
  const operatingExpenses = Array(months + 1).fill(0);
  const seniorDebtService = Array(months + 1).fill(0);
  const juniorDebtService = Array(months + 1).fill(0);
  const allInDebtService = Array(months + 1).fill(0);
  const monthlyRevenueGrowth = (1 + inputs.revenueGrowthAnnual) ** (1 / 12) - 1;
  const monthlyExpenseGrowth = (1 + inputs.expenseGrowthAnnual) ** (1 / 12) - 1;

  for (let month = 1; month <= months; month += 1) {
    const leaseUpProgress =
      inputs.leaseUpMonths <= 1
        ? 1
        : Math.min(1, Math.max(0, (month - 1) / (inputs.leaseUpMonths - 1)));
    const vacancy =
      inputs.initialEconomicVacancy +
      (inputs.stabilizedEconomicVacancy - inputs.initialEconomicVacancy) * leaseUpProgress;
    const growthFactor = (1 + monthlyRevenueGrowth) ** (month - 1);
    const expenseGrowthFactor = (1 + monthlyExpenseGrowth) ** (month - 1);
    grossPotentialRevenue[month] =
      ((inputs.year1GrossPotentialRevenue + inputs.otherIncomeYear1) / 12) * growthFactor;
    effectiveGrossIncome[month] = grossPotentialRevenue[month] * (1 - vacancy);
    const ratioExpenses =
      effectiveGrossIncome[month] *
      (inputs.operatingExpenseRatio + inputs.managementFeeRate) *
      expenseGrowthFactor;
    const reserves = (inputs.reservesAnnual / 12) * expenseGrowthFactor;
    operatingExpenses[month] = ratioExpenses + reserves;
    noi[month] = effectiveGrossIncome[month] - operatingExpenses[month];
  }

  const firstYearNoi = sum(noi, 1, 12);
  const goingInCapRate = firstYearNoi / inputs.purchasePrice;
  let seniorBalance = seniorPrincipal;
  let refinanceBalance = 0;
  let refinanceProceeds = 0;
  let refinanceValue = 0;
  let refinanceConstraint = "not_applicable";
  let refinanceCoverage = 0;
  let juniorBalance = inputs.juniorPrincipal;
  const initialSeniorPayment = monthlyPayment(
    seniorPrincipal,
    inputs.seniorRate,
    inputs.seniorAmortizationYears * 12,
  );
  const refinancePaymentConstant =
    inputs.refinanceEnabled && inputs.refinanceLtv > 0
      ? monthlyPayment(1, inputs.refinanceRate, inputs.refinanceAmortizationYears * 12) * 12
      : 0;

  unlevered[0] = -totalUses;
  seniorLevered[0] = -(totalUses - seniorPrincipal);
  sponsor[0] = -sponsorInitialEquity;
  partner[0] = -inputs.juniorPrincipal;

  for (let month = 1; month <= inputs.holdMonths; month += 1) {
    let seniorPayment = 0;
    let seniorPrincipalPaid = 0;
    let refinancePayment = 0;
    let refinancePrincipalPaid = 0;
    let juniorInterest = 0;
    let eventCash = 0;
    let seniorEventCash = 0;

    if (seniorBalance > EPSILON) {
      const interest = seniorBalance * (inputs.seniorRate / 12);
      seniorPayment =
        month <= inputs.seniorInterestOnlyMonths ? interest : Math.min(initialSeniorPayment, seniorBalance + interest);
      seniorPrincipalPaid = Math.max(0, seniorPayment - interest);
      seniorBalance = Math.max(0, seniorBalance - seniorPrincipalPaid);
    } else if (refinanceBalance > EPSILON) {
      const interest = refinanceBalance * (inputs.refinanceRate / 12);
      const scheduled = monthlyPayment(
        refinanceBalance,
        inputs.refinanceRate,
        inputs.refinanceAmortizationYears * 12,
      );
      refinancePayment = Math.min(scheduled, refinanceBalance + interest);
      refinancePrincipalPaid = Math.max(0, refinancePayment - interest);
      refinanceBalance = Math.max(0, refinanceBalance - refinancePrincipalPaid);
    }

    if (juniorBalance > EPSILON) {
      juniorInterest = juniorBalance * (inputs.juniorRate / 12);
      partner[month] += juniorInterest;
    }

    seniorDebtService[month] = seniorPayment + refinancePayment;
    juniorDebtService[month] = juniorInterest;
    allInDebtService[month] = seniorDebtService[month] + juniorDebtService[month];

    if (inputs.refinanceEnabled && month === inputs.refinanceMonth) {
      refinanceValue = sum(noi, month + 1, month + 12) / inputs.refinanceCapRate;
      const ltvLimit = refinanceValue * inputs.refinanceLtv;
      const annualizedForwardNoi = sum(noi, month + 1, month + 12);
      const dscrLimit =
        refinancePaymentConstant > EPSILON
          ? annualizedForwardNoi / inputs.minimumDscr / refinancePaymentConstant
          : ltvLimit;
      const debtYieldLimit =
        inputs.minimumDebtYield > EPSILON
          ? annualizedForwardNoi / inputs.minimumDebtYield
          : ltvLimit;
      refinanceProceeds = Math.max(0, Math.min(ltvLimit, dscrLimit, debtYieldLimit));
      const limits = [
        ["ltv", ltvLimit],
        ["dscr", dscrLimit],
        ["debt_yield", debtYieldLimit],
      ].sort((left, right) => left[1] - right[1]);
      refinanceConstraint = limits[0][0];
      const seniorPayoff = seniorBalance;
      const juniorPayoff = juniorBalance;
      refinanceCoverage = refinanceProceeds - seniorPayoff - juniorPayoff;
      eventCash += refinanceCoverage;
      seniorEventCash += refinanceProceeds - seniorPayoff;
      seniorBalance = 0;
      refinanceBalance = refinanceProceeds;
      if (juniorPayoff > 0) {
        partner[month] += juniorPayoff;
        juniorBalance = 0;
      }
    } else if (juniorBalance > EPSILON && month === inputs.juniorPayoffMonth) {
      eventCash -= juniorBalance;
      partner[month] += juniorBalance;
      juniorBalance = 0;
    }

    const operatingCash = noi[month];
    unlevered[month] += operatingCash;
    seniorLevered[month] += operatingCash - seniorDebtService[month] + seniorEventCash;
    sponsor[month] += operatingCash - allInDebtService[month] + eventCash;

    if (month === inputs.holdMonths) {
      const forwardNoi = sum(noi, month + 1, month + 12);
      const grossSalePrice = forwardNoi / inputs.exitCapRate;
      const netSalePrice = grossSalePrice * (1 - inputs.sellingCostsRate);
      const debtPayoff = seniorBalance + refinanceBalance;
      unlevered[month] += netSalePrice;
      seniorLevered[month] += netSalePrice - debtPayoff;
      sponsor[month] += netSalePrice - debtPayoff - juniorBalance;
      if (juniorBalance > EPSILON) {
        partner[month] += juniorBalance;
        juniorBalance = 0;
      }
      seniorBalance = 0;
      refinanceBalance = 0;
    }
  }

  const year1SeniorDebtService = sum(seniorDebtService, 1, 12);
  const year1JuniorDebtService = sum(juniorDebtService, 1, 12);
  const year1AllInDebtService = sum(allInDebtService, 1, 12);
  const monthlyDscrValues = [];
  for (let month = 1; month <= inputs.holdMonths; month += 1) {
    if (allInDebtService[month] > EPSILON) {
      monthlyDscrValues.push(noi[month] / allInDebtService[month]);
    }
  }
  const minimumMonthlyAllInDscr = monthlyDscrValues.length
    ? Math.min(...monthlyDscrValues)
    : null;
  const allInLtc = totalInitialDebt / totalUses;
  const allInLoanToPurchase = totalInitialDebt / inputs.purchasePrice;
  const year1AllInDscr =
    year1AllInDebtService > EPSILON ? firstYearNoi / year1AllInDebtService : null;
  const year1SeniorDscr =
    year1SeniorDebtService > EPSILON ? firstYearNoi / year1SeniorDebtService : null;
  const allInDebtYield =
    totalInitialDebt > EPSILON ? firstYearNoi / totalInitialDebt : null;
  const sponsorIrr = annualizedMonthlyIrr(sponsor.slice(0, inputs.holdMonths + 1));
  const partnerIrr = annualizedMonthlyIrr(partner.slice(0, inputs.holdMonths + 1));
  const unleveredIrr = annualizedMonthlyIrr(unlevered.slice(0, inputs.holdMonths + 1));
  const seniorLeveredIrr = annualizedMonthlyIrr(
    seniorLevered.slice(0, inputs.holdMonths + 1),
  );

  const checks = [];
  checks.push(
    check(
      "CHK-SOURCES-USES",
      "blocker",
      Math.abs(totalInitialDebt + sponsorInitialEquity - totalUses) < 0.01 ? "PASS" : "BLOCK",
      { sources: totalInitialDebt + sponsorInitialEquity, uses: totalUses },
      { difference: 0 },
      "Initial debt plus sponsor equity must equal acquisition, closing, renovation, and soft-cost uses.",
    ),
  );
  checks.push(
    check(
      "CHK-SPONSOR-EQUITY",
      "blocker",
      sponsorInitialEquity > 0 ? "PASS" : "BLOCK",
      { sponsorInitialEquity },
      { minimumExclusive: 0 },
      "Sponsor equity must remain a positive outflow; over-funded structures require explicit distribution controls.",
    ),
  );
  checks.push(
    check(
      "CHK-SENIOR-LTV",
      "blocker",
      inputs.seniorLtv <= inputs.maximumSeniorLtv ? "PASS" : "BLOCK",
      { seniorLtv: inputs.seniorLtv },
      { maximumSeniorLtv: inputs.maximumSeniorLtv },
      "Senior leverage must remain within the approved asset-type limit.",
    ),
  );
  checks.push(
    check(
      "CHK-ALL-IN-LTC",
      "blocker",
      allInLtc <= inputs.maximumAllInLtc ? "PASS" : "BLOCK",
      { allInLtc },
      { maximumAllInLtc: inputs.maximumAllInLtc },
      "All initial debt must remain within the approved loan-to-cost limit.",
    ),
  );
  checks.push(
    check(
      "CHK-YEAR1-ALL-IN-DSCR",
      "blocker",
      year1AllInDscr !== null && year1AllInDscr >= inputs.minimumDscr ? "PASS" : "BLOCK",
      { year1AllInDscr },
      { minimumDscr: inputs.minimumDscr },
      "Year-1 coverage includes senior, refinance, and junior periodic debt service.",
    ),
  );
  checks.push(
    check(
      "CHK-MIN-MONTHLY-DSCR",
      "warning",
      minimumMonthlyAllInDscr === null || minimumMonthlyAllInDscr >= 1 ? "PASS" : "REVIEW",
      { minimumMonthlyAllInDscr },
      { minimum: 1 },
      "No operating month should fall below debt-service breakeven without a funded reserve.",
    ),
  );
  const requiredExitCap =
    goingInCapRate + inputs.minimumExitCapSpreadBps / 10_000;
  checks.push(
    check(
      "CHK-EXIT-CAP",
      "warning",
      inputs.exitCapRate + EPSILON >= requiredExitCap ? "PASS" : "REVIEW",
      { exitCapRate: inputs.exitCapRate, goingInCapRate },
      { requiredExitCap },
      "Exit pricing should include the approved cap-rate expansion unless an override is reviewed.",
    ),
  );
  checks.push(
    check(
      "CHK-REFI-COVERAGE",
      "blocker",
      !inputs.refinanceEnabled || refinanceCoverage >= -0.01 ? "PASS" : "BLOCK",
      {
        refinanceProceeds,
        refinanceCoverage,
        constraint: refinanceConstraint,
      },
      { minimumCoverage: 0 },
      "Refinance proceeds must cover senior and junior principal before sponsor cash-out.",
    ),
  );
  const evidenceComplete =
    inputs.evidence.required === inputs.evidence.accepted &&
    inputs.evidence.pending === 0 &&
    inputs.evidence.rejected === 0;
  checks.push(
    check(
      "CHK-EVIDENCE",
      "warning",
      evidenceComplete ? "PASS" : "REVIEW",
      inputs.evidence,
      { accepted: inputs.evidence.required, pending: 0, rejected: 0 },
      "Every required material fact must be accepted and source-linked before decision release.",
    ),
  );
  checks.push(
    check(
      "CHK-TIMING",
      "blocker",
      (!inputs.refinanceEnabled || inputs.refinanceMonth < inputs.holdMonths) &&
      (inputs.juniorPrincipal === 0 || inputs.juniorPayoffMonth <= inputs.holdMonths)
        ? "PASS"
        : "BLOCK",
      {
        holdMonths: inputs.holdMonths,
        refinanceMonth: inputs.refinanceMonth,
        juniorPayoffMonth: inputs.juniorPayoffMonth,
      },
      { eventBeforeOrAtHold: true },
      "Refinance and partner payoff events must occur within the modeled hold.",
    ),
  );
  checks.push(
    check(
      "CHK-RENOVATION-CAUSALITY",
      "warning",
      inputs.renovationBudget === 0 ||
      inputs.leaseUpMonths > 0 ||
      inputs.initialEconomicVacancy !== inputs.stabilizedEconomicVacancy
        ? "PASS"
        : "REVIEW",
      {
        renovationBudget: inputs.renovationBudget,
        leaseUpMonths: inputs.leaseUpMonths,
        initialEconomicVacancy: inputs.initialEconomicVacancy,
        stabilizedEconomicVacancy: inputs.stabilizedEconomicVacancy,
      },
      { explicitOperationalBridge: true },
      "Renovation spending must connect to an explicit lease-up, vacancy, rent, or expense change.",
    ),
  );
  const smallDenominator =
    sponsorInitialEquity > 0 &&
    sponsorInitialEquity / totalUses < 0.05 &&
    sponsorIrr !== null &&
    sponsorIrr > 1;
  checks.push(
    check(
      "CHK-SMALL-DENOMINATOR",
      "warning",
      smallDenominator ? "REVIEW" : "PASS",
      {
        sponsorEquityShare: sponsorInitialEquity / totalUses,
        sponsorIrr,
      },
      { warningEquityShare: 0.05, warningIrr: 1 },
      "Very high sponsor returns on a small cash denominator must not be labeled as combined-equity returns.",
    ),
  );
  const keyOutputs = [
    firstYearNoi,
    goingInCapRate,
    year1AllInDscr,
    allInLtc,
    sponsorIrr,
    unleveredIrr,
  ].filter((value) => value !== null);
  checks.push(
    check(
      "CHK-FINITE-OUTPUTS",
      "blocker",
      keyOutputs.every(Number.isFinite) ? "PASS" : "BLOCK",
      { finiteOutputs: keyOutputs.length },
      { allFinite: true },
      "All consequential metrics must resolve to finite values.",
    ),
  );

  const hasBlocker = checks.some((item) => item.status === "BLOCK");
  const hasReview = checks.some((item) => item.status === "REVIEW");
  const controlStatus = hasBlocker ? "BLOCK" : hasReview ? "REVIEW" : "PASS";
  const releaseEligible = controlStatus === "PASS" && evidenceComplete;
  let recommendation = "Proceed to LOI";
  if (hasBlocker || sponsorIrr === null || sponsorIrr < 0.12) recommendation = "Pass";
  else if (hasReview || sponsorIrr < 0.15) recommendation = "Proceed with conditions";

  const metrics = {
    firstYearNoi,
    goingInCapRate,
    seniorPrincipal,
    juniorPrincipal: inputs.juniorPrincipal,
    totalInitialDebt,
    sponsorInitialEquity,
    seniorLtv: inputs.seniorLtv,
    allInLtc,
    allInLoanToPurchase,
    year1SeniorDebtService,
    year1JuniorDebtService,
    year1AllInDebtService,
    year1SeniorDscr,
    year1AllInDscr,
    minimumMonthlyAllInDscr,
    allInDebtYield,
    unleveredIrr,
    seniorLeveredIrr,
    sponsorIrr,
    sponsorEquityMultiple: equityMultiple(sponsor.slice(0, inputs.holdMonths + 1)),
    partnerIrr,
    partnerEquityMultiple: equityMultiple(partner.slice(0, inputs.holdMonths + 1)),
    refinanceValue,
    refinanceProceeds,
    refinanceCoverage,
    refinanceConstraint,
    exitCapSpreadBps: (inputs.exitCapRate - goingInCapRate) * 10_000,
  };
  const roundedMetrics = Object.fromEntries(
    Object.entries(metrics).map(([key, value]) => [
      key,
      typeof value === "number" ? round(value) : value,
    ]),
  );
  const publicChecks = checks.map((item) => ({
    ...item,
    actual: Object.fromEntries(
      Object.entries(item.actual).map(([key, value]) => [
        key,
        typeof value === "number" ? round(value) : value,
      ]),
    ),
    threshold: Object.fromEntries(
      Object.entries(item.threshold).map(([key, value]) => [
        key,
        typeof value === "number" ? round(value) : value,
      ]),
    ),
  }));

  return {
    engineVersion: UNDERWRITING_ENGINE_VERSION,
    modelVersionId: inputs.modelVersionId,
    timing: "monthly",
    inputs,
    controlStatus,
    releaseEligible,
    recommendation,
    recommendationReason:
      recommendation === "Proceed to LOI"
        ? "Returns and all material coverage, leverage, timing, and evidence gates pass."
        : recommendation === "Proceed with conditions"
          ? "The scenario remains viable, but one or more material review conditions must be resolved."
          : "One or more release blockers or minimum return conditions are not satisfied.",
    metrics: roundedMetrics,
    checks: publicChecks,
    risks: publicChecks
      .filter((item) => item.status !== "PASS")
      .map((item) => ({
        id: item.checkId,
        severity: item.status === "BLOCK" ? "blocker" : "review",
        message: item.message,
      })),
    evidence: {
      ...inputs.evidence,
      complete: evidenceComplete,
    },
    cashFlows: {
      unlevered: publicCashFlow(unlevered.slice(0, inputs.holdMonths + 1), inputs.startDate),
      seniorLevered: publicCashFlow(
        seniorLevered.slice(0, inputs.holdMonths + 1),
        inputs.startDate,
      ),
      sponsor: publicCashFlow(sponsor.slice(0, inputs.holdMonths + 1), inputs.startDate),
      partner: publicCashFlow(partner.slice(0, inputs.holdMonths + 1), inputs.startDate),
    },
    monthlyOperations: Array.from({ length: inputs.holdMonths }, (_, index) => {
      const month = index + 1;
      return {
        periodMonth: month,
        occurredAt: addMonths(inputs.startDate, month),
        grossPotentialRevenue: round(grossPotentialRevenue[month], 2),
        effectiveGrossIncome: round(effectiveGrossIncome[month], 2),
        operatingExpenses: round(operatingExpenses[month], 2),
        noi: round(noi[month], 2),
        seniorDebtService: round(seniorDebtService[month], 2),
        juniorDebtService: round(juniorDebtService[month], 2),
        allInDebtService: round(allInDebtService[month], 2),
      };
    }),
  };
}

export function publicUnderwritingResult(result) {
  return {
    engineVersion: result.engineVersion,
    modelVersionId: result.modelVersionId,
    timing: result.timing,
    inputs: result.inputs,
    controlStatus: result.controlStatus,
    releaseEligible: result.releaseEligible,
    recommendation: result.recommendation,
    recommendationReason: result.recommendationReason,
    metrics: result.metrics,
    checks: result.checks,
    risks: result.risks,
    evidence: result.evidence,
    monthlyOperations: result.monthlyOperations,
  };
}
