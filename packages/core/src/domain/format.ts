/** Display helpers shared across web/driver UIs. */

/** 38485 kg -> "38.485 MT" (Indian logistics convention, 3 decimals). */
export function formatWeightMt(kg: number | null | undefined): string {
  if (kg === null || kg === undefined) return "—";
  return `${(kg / 1000).toFixed(3)} MT`;
}

export function formatInr(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return "—";
  return `₹${amount.toLocaleString("en-IN")}`;
}
