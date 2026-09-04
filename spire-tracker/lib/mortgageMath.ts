// Canadian mortgage math for Feature Sheets. Pure functions, no React/DOM
// dependency — see /root/.claude/plans/composed-weaving-parrot.md for the
// source spec (verbatim from Renée's Claude Design prompt).

const AMORTIZATION_MONTHS = 360; // 30 years, fixed per spec

// Canadian mortgages compound semi-annually by convention (not monthly, the
// US convention). Convert the nominal annual rate to an effective monthly
// rate: half the annual rate per 6-month period, then the 6th root to get
// a monthly rate that compounds to the same 6-month growth.
export function effectiveMonthlyRate(annualRatePct: number): number {
  const r = annualRatePct / 100;
  return Math.pow(1 + r / 2, 1 / 6) - 1;
}

// Standard amortization payment formula, using the effective monthly rate.
export function monthlyPayment(principal: number, annualRatePct: number, months: number = AMORTIZATION_MONTHS): number {
  const i = effectiveMonthlyRate(annualRatePct);
  if (i === 0) return principal / months;
  return (principal * i) / (1 - Math.pow(1 + i, -months));
}

// Above $500,000: 5% of the first $500,000 + 10% of the remainder.
// At or below $500,000: flat 5%.
export function minimumDownPayment(price: number): number {
  if (price <= 500_000) return price * 0.05;
  return 500_000 * 0.05 + (price - 500_000) * 0.1;
}

// CMHC premium as a % of the loan (price - down payment), tiered by down %.
// 20%+ down returns 0 (conventional, no premium).
export function cmhcPremiumRate(downPaymentPercent: number): number {
  if (downPaymentPercent >= 20) return 0;
  if (downPaymentPercent >= 15) return 0.028;
  if (downPaymentPercent >= 10) return 0.031;
  if (downPaymentPercent >= 5) return 0.04;
  return 0; // below 5% isn't a legal down payment — caller should validate upstream
}

export interface DownPaymentColumn {
  label: string;
  downPayment: number;
  downPercent: number;
  premiumRate: number;
  premiumAmount: number;
  principal: number; // loan + premium (if insured)
  monthlyPayment: number;
}

function buildColumn(label: string, price: number, downPayment: number, annualRatePct: number): DownPaymentColumn {
  const downPercent = (downPayment / price) * 100;
  const loanBase = price - downPayment;
  const premiumRate = cmhcPremiumRate(downPercent);
  const premiumAmount = loanBase * premiumRate;
  const principal = loanBase + premiumAmount;
  return {
    label,
    downPayment,
    downPercent,
    premiumRate,
    premiumAmount,
    principal,
    monthlyPayment: monthlyPayment(principal, annualRatePct),
  };
}

export interface PriceRow {
  price: number;
  minimum: DownPaymentColumn;
  tenPercent: DownPaymentColumn;
  twentyPercent: DownPaymentColumn;
}

export function buildPriceRow(price: number, annualRatePct: number): PriceRow {
  return {
    price,
    minimum: buildColumn("Minimum Down", price, minimumDownPayment(price), annualRatePct),
    tenPercent: buildColumn("10% Down", price, price * 0.1, annualRatePct),
    twentyPercent: buildColumn("20% Down", price, price * 0.2, annualRatePct),
  };
}
