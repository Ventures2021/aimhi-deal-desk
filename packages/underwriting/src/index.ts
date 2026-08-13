export type UnderwritingVersion = {
  id: string;
  scenarioIds: string[];
  createdAt: string;
};
export type Scenario = { id: string; name: string; assumptionIds: string[] };
export type Assumption = {
  id: string;
  key: string;
  value: number;
  units?: string;
};
export type ModelRun = {
  id: string;
  underwritingVersionId: string;
  status: CalculationStatus;
};
export type Metric = { name: string; value: number; units: string };
export type Warning = { code: string; message: string };
export type CalculationStatus = "ready" | "running" | "failed" | "complete";

export const calc = {
  noi: (revenue: number, operatingExpenses: number): number =>
    revenue - operatingExpenses,
  capitalizationValue: (noi: number, capRate: number): number => noi / capRate,
  debtService: (annualDebtPayment: number): number => annualDebtPayment,
  dscr: (noi: number, annualDebtService: number): number =>
    noi / annualDebtService,
  debtYield: (noi: number, loanAmount: number): number => noi / loanAmount,
  ltv: (loanAmount: number, value: number): number => loanAmount / value,
  ltc: (loanAmount: number, totalCost: number): number =>
    loanAmount / totalCost,
  equityMultiple: (
    totalDistributions: number,
    equityInvested: number,
  ): number => totalDistributions / equityInvested,
} as const;
