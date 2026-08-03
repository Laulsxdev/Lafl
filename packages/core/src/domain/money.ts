/** All amounts are in INR rupees (2-decimal). */

export interface SettlementInput {
  driverAllowance: number;
  approvedExpenses: number;
  bonus: number;
  penalty: number;
  advancesPaid: number;
}

export interface SettlementBreakdown extends SettlementInput {
  grossAmount: number;
  netPayable: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function computeSettlement(input: SettlementInput): SettlementBreakdown {
  const grossAmount = round2(
    input.driverAllowance + input.approvedExpenses + input.bonus,
  );
  const netPayable = round2(grossAmount - input.advancesPaid - input.penalty);
  return { ...input, grossAmount, netPayable };
}

/**
 * Split a total across drivers by weight (leg km or hours), guaranteeing the
 * rounded parts sum exactly to the total (largest-remainder method).
 */
export function splitByWeight(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0 || weights.length === 0) {
    throw new Error("splitByWeight requires positive weights");
  }
  const totalPaise = Math.round(total * 100);
  const raw = weights.map((w) => (totalPaise * w) / sum);
  const floors = raw.map(Math.floor);
  let remainder = totalPaise - floors.reduce((a, b) => a + b, 0);
  const order = raw
    .map((v, i) => ({ frac: v - Math.floor(v), i }))
    .sort((a, b) => b.frac - a.frac);
  for (const { i } of order) {
    if (remainder <= 0) break;
    floors[i] = (floors[i] ?? 0) + 1;
    remainder--;
  }
  return floors.map((p) => p / 100);
}

/** Deviation of an edited charge vs the master rate, as a fraction (0.1 = 10%). */
export function chargeDeviation(master: number, approved: number): number {
  if (master === 0) return approved === 0 ? 0 : Infinity;
  return Math.abs(approved - master) / master;
}

/** Charges edited beyond this fraction of the master rate need admin approval. */
export const CHARGE_DEVIATION_TOLERANCE = 0.1;
