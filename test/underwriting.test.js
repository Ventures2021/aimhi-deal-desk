import assert from "node:assert/strict";
import test from "node:test";

import { routeApi } from "../src/api.js";
import {
  annualizedMonthlyIrr,
  calculateUnderwriting,
  DEMO_UNDERWRITING_INPUTS,
  monthlyPayment,
  normalizeUnderwritingInputs,
  UnderwritingInputError,
} from "../src/underwriting.js";

test("monthly payment uses consistent monthly periods", () => {
  const payment = monthlyPayment(1_000_000, 0.06, 360);
  assert.ok(Math.abs(payment - 5_995.505252) < 0.001);
});

test("subannual junior return annualizes monthly timing", () => {
  const flows = [-220_800, 2_208, 2_208, 2_208, 2_208, 2_208, 2_208, 2_208, 223_008];
  const irr = annualizedMonthlyIrr(flows);
  assert.ok(Math.abs(irr - 0.12682503) < 1e-7);
});

test("demo model passes all release checks with separate all-in metrics", () => {
  const result = calculateUnderwriting(DEMO_UNDERWRITING_INPUTS);
  assert.equal(result.controlStatus, "PASS");
  assert.equal(result.recommendation, "Proceed to LOI");
  assert.equal(result.checks.every((item) => item.status === "PASS"), true);
  assert.ok(Math.abs(result.metrics.sponsorIrr - 0.18438778) < 1e-7);
  assert.ok(Math.abs(result.metrics.year1AllInDscr - 1.51907362) < 1e-7);
  assert.ok(result.metrics.year1SeniorDscr > result.metrics.year1AllInDscr);
  assert.ok(result.metrics.allInLtc > result.metrics.seniorLtv);
});

test("senior principal is derived from the deal, not an active spreadsheet cell", () => {
  const result = calculateUnderwriting({
    ...DEMO_UNDERWRITING_INPUTS,
    purchasePrice: 610_000,
    closingCosts: 18_300,
    renovationBudget: 50_000,
    seniorLtv: 0.75,
    juniorPrincipal: 100_000,
  });
  assert.equal(result.metrics.seniorPrincipal, 457_500);
});

test("all-in coverage includes senior and junior periodic service", () => {
  const result = calculateUnderwriting({
    ...DEMO_UNDERWRITING_INPUTS,
    juniorPrincipal: 8_000_000,
    juniorRate: 0.12,
  });
  assert.ok(result.metrics.year1JuniorDebtService > 0);
  assert.ok(result.metrics.year1AllInDebtService > result.metrics.year1SeniorDebtService);
  assert.ok(result.metrics.year1AllInDscr < result.metrics.year1SeniorDscr);
});

test("refinance sizing uses the most conservative lender constraint", () => {
  const result = calculateUnderwriting({
    ...DEMO_UNDERWRITING_INPUTS,
    refinanceEnabled: true,
    refinanceMonth: 24,
    juniorPayoffMonth: 24,
    refinanceLtv: 0.9,
    refinanceCapRate: 0.08,
    refinanceRate: 0.09,
    minimumDscr: 1.35,
    minimumDebtYield: 0.1,
  });
  assert.ok(["ltv", "dscr", "debt_yield"].includes(result.metrics.refinanceConstraint));
  assert.ok(result.metrics.refinanceProceeds > 0);
});

test("numeric and timing validation rejects impossible scenarios", () => {
  assert.throws(
    () =>
      normalizeUnderwritingInputs({
        ...DEMO_UNDERWRITING_INPUTS,
        initialEconomicVacancy: 0.05,
        stabilizedEconomicVacancy: 0.2,
        refinanceEnabled: true,
        refinanceMonth: 8,
        juniorPayoffMonth: 12,
      }),
    (error) =>
      error instanceof UnderwritingInputError &&
      Boolean(error.errors.stabilizedEconomicVacancy) &&
      Boolean(error.errors.juniorPayoffMonth),
  );
});

test("public demo and preview APIs expose the deterministic engine", async () => {
  const demo = await routeApi(
    new Request("https://example.test/api/v1/underwriting/demo"),
    {},
    "/api/v1/underwriting/demo",
  );
  assert.equal(demo.status, 200);
  const demoBody = await demo.json();
  assert.equal(demoBody.timing, "monthly");
  assert.equal(demoBody.cashFlows, undefined);
  assert.equal(demoBody.controlStatus, "PASS");

  const preview = await routeApi(
    new Request("https://example.test/api/v1/underwriting/preview", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        inputs: {
          ...DEMO_UNDERWRITING_INPUTS,
          exitCapRate: 0.12,
        },
      }),
    }),
    {},
    "/api/v1/underwriting/preview",
  );
  assert.equal(preview.status, 200);
  const previewBody = await preview.json();
  assert.ok(previewBody.metrics.sponsorIrr < demoBody.metrics.sponsorIrr);
});
